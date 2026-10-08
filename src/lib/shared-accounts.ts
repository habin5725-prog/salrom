import "server-only";

import crypto from "node:crypto";
import type { CodeRole } from "./settings";
import { getAdminSupabase, serverSecretKey } from "./supabase/admin";

// 리더 모드와 총 관리자 모드는 각각 하나의 공용 계정으로 로그인한다.
// 계정 비밀번호는 서버 비밀 키에서 만들어 어디에도 저장하지 않는다(사람이 입력하는 비밀번호와 다르다).

const NAME: Record<CodeRole, string> = { leader: "찬양팀 리더", admin: "총 관리자" };

export function sharedAccount(role: CodeRole) {
  const domain = process.env.SHARED_ACCOUNT_DOMAIN || "example.com";
  return {
    email: `worship-${role}@${domain}`,
    password: crypto.createHmac("sha256", serverSecretKey()).update(`salrom-shared-account:${role}`).digest("base64url"),
  };
}

/** 공용 계정이 없으면 만들고, 있으면 비밀번호와 역할을 맞춘다. */
export async function ensureSharedAccount(role: CodeRole, repair = false): Promise<{ ok: boolean; message?: string }> {
  const admin = getAdminSupabase();
  if (!admin) return { ok: false, message: "서버 키가 없습니다." };
  const { email, password } = sharedAccount(role);

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { app_role: role },
    user_metadata: { name: NAME[role] },
  });

  let userId = created.data.user?.id ?? null;
  if (created.error) {
    const exists = created.error.status === 422 || /already|registered|exists/i.test(created.error.message);
    if (!exists) return { ok: false, message: created.error.message };
    if (!repair) return { ok: true };
    // 이미 있는 계정: 서버 키가 바뀌었을 수 있으므로 비밀번호와 역할을 다시 맞춘다.
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = data?.users.find((u) => u.email?.toLowerCase() === email);
    if (!found) return { ok: false, message: "공용 계정을 찾지 못했습니다." };
    userId = found.id;
    const updated = await admin.auth.admin.updateUserById(found.id, { password, app_metadata: { app_role: role } });
    if (updated.error) return { ok: false, message: updated.error.message };
  }

  if (userId) await admin.from("profiles").update({ role, name: NAME[role] }).eq("id", userId);
  return { ok: true };
}
