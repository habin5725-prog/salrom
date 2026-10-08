import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { canEditServices, canManageSite, type Role } from "./permissions";
import { isSupabaseConfigured } from "./supabase/env";
import { getServerSupabase } from "./supabase/server";

// 누구나 로그인 없이 본다. 리더 모드와 총 관리자 모드는 비밀번호로 들어가며,
// 들어가면 서버가 공용 계정(리더용, 총 관리자용)으로 로그인시켜 데이터베이스 권한(RLS)이 적용된다.

export type Mode = "visitor" | "leader" | "admin";

export type Viewer = {
  mode: Mode;
  /** 리더/총 관리자 공용 계정 ID. 방문자는 null */
  userId: string | null;
  role: Role | null;
};

export function modeOf(role: Role | null | undefined): Mode {
  if (role === "admin") return "admin";
  if (role === "leader") return "leader";
  return "visitor";
}

/** 지금 화면을 보는 사람의 모드. 한 요청 안에서는 한 번만 확인한다. */
export const getViewer = cache(async (): Promise<Viewer> => {
  // 화면은 사람마다 다르고 현재 시각(오늘 날짜)도 쓰므로 항상 요청 시점에 만든다.
  await connection();
  const visitor: Viewer = { mode: "visitor", userId: null, role: null };
  if (!isSupabaseConfigured()) return visitor;
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return visitor;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", sub).maybeSingle();
  const role = profile?.role ?? null;
  return { mode: modeOf(role), userId: sub, role };
});

// 레이아웃과 페이지는 따로 렌더링되므로 편집 화면은 페이지마다 아래 함수로 다시 확인한다.

/** 리더 모드나 총 관리자 모드가 아니면 비밀번호 화면으로 보낸다. */
export async function getLeader(next = "/edit"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!canEditServices(viewer.role)) redirect(`/login?next=${encodeURIComponent(next)}`);
  return viewer;
}

/** 총 관리자 모드가 아니면 비밀번호 화면으로 보낸다. */
export async function getAdmin(next = "/admin"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!canManageSite(viewer.role)) redirect(`/login?next=${encodeURIComponent(next)}&need=admin`);
  return viewer;
}
