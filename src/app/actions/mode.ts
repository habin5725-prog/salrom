"use server";

import { getViewer, type Mode } from "@/lib/auth";
import { isLockedOut, logEvent } from "@/lib/events";
import { requestContext } from "@/lib/request-context";
import { matchCode } from "@/lib/settings";
import { runSchemaSetup } from "@/lib/setup";
import { ensureSharedAccount, sharedAccount } from "@/lib/shared-accounts";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type ModeResult = { ok: boolean; message: string; mode?: Mode };

/** 비밀번호를 확인하고 리더 모드나 총 관리자 모드로 들어간다. */
export async function enterMode(code: string): Promise<ModeResult> {
  if (!getAdminSupabase()) return { ok: false, message: "사이트 설정이 아직 끝나지 않았습니다." };
  const ctx = await requestContext();
  if (await isLockedOut(ctx.ipHash)) {
    return { ok: false, message: "비밀번호를 여러 번 틀렸습니다. 15분 뒤에 다시 시도해 주세요." };
  }

  const role = await matchCode(String(code ?? "").trim().slice(0, 40));
  if (!role) {
    await logEvent("login_fail");
    return { ok: false, message: "비밀번호가 맞지 않습니다." };
  }

  const prepared = await ensureSharedAccount(role);
  if (!prepared.ok) return { ok: false, message: `들어가지 못했습니다: ${prepared.message ?? ""}` };

  const supabase = await getServerSupabase();
  const { email, password } = sharedAccount(role);
  let signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    // 서버 키가 바뀌었으면 공용 계정 비밀번호를 다시 맞추고 한 번 더 시도한다.
    const repaired = await ensureSharedAccount(role, true);
    if (repaired.ok) signIn = await supabase.auth.signInWithPassword({ email, password });
  }
  if (signIn.error) return { ok: false, message: "들어가지 못했습니다. 잠시 후 다시 시도해 주세요." };

  await logEvent("login_success", role === "admin" ? "총 관리자 모드" : "리더 모드");
  return {
    ok: true,
    mode: role,
    message: role === "admin" ? "총 관리자 모드로 들어왔습니다." : "리더 모드로 들어왔습니다.",
  };
}

/** 모드에서 나간다. 이 기기만 나가고 같은 모드를 쓰는 다른 기기는 그대로 둔다. */
export async function exitMode(): Promise<ModeResult> {
  const viewer = await getViewer();
  const supabase = await getServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  if (viewer.mode !== "visitor") await logEvent("logout", viewer.mode === "admin" ? "총 관리자 모드" : "리더 모드");
  return { ok: true, mode: "visitor", message: "나왔습니다." };
}

/** 처음 설치: 표와 권한 정책을 만든다. 이미 준비되었으면 아무것도 하지 않는다. */
export async function prepareSite(): Promise<{ ok: boolean; message: string }> {
  const result = await runSchemaSetup();
  if (result.ok) await logEvent("setup", "사이트 준비");
  return result;
}
