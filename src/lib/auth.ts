import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { canEditServices, canManageUsers, isApproved, type Role } from "./permissions";
import { isSupabaseConfigured } from "./supabase/env";
import { getServerSupabase } from "./supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  instrument: string | null;
};

/** 현재 로그인한 사용자와 프로필. 한 요청 안에서는 한 번만 조회한다. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role, instrument")
    .eq("id", claims.sub)
    .maybeSingle();
  const email = typeof claims.email === "string" ? claims.email : "";

  // 로그인은 되었지만 프로필이 아직 없으면 승인 대기로 취급한다(로그인 화면과 무한 반복 방지).
  if (!profile) {
    return { id: claims.sub, name: "", role: "pending", instrument: null, email };
  }

  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    instrument: profile.instrument,
    email,
  };
});

// 레이아웃과 페이지는 따로 렌더링되므로 페이지마다 아래 함수로 다시 확인한다.
// 승인 대기 중이면 null을 돌려주고, 이때 레이아웃의 AccessGate가 승인 대기 안내를 보여준다.

/** 승인된 팀원이면 사용자 정보. 로그인하지 않았으면 로그인 화면으로 보낸다. */
export async function getMember(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return isApproved(user.role) ? user : null;
}

/** 리더나 총 관리자만. 일반 팀원은 홈으로 보낸다. */
export async function getLeader(): Promise<CurrentUser | null> {
  const user = await getMember();
  if (user && !canEditServices(user.role)) redirect("/");
  return user;
}

/** 총 관리자만. 아니면 설정 화면으로 보낸다. */
export async function getAdmin(): Promise<CurrentUser | null> {
  const user = await getMember();
  if (user && !canManageUsers(user.role)) redirect("/settings");
  return user;
}
