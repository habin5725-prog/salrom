import type { Enums } from "./database.types";

// 화면에서 버튼을 보이거나 숨길 때 쓰는 기준이다.
// 실제 권한은 데이터베이스 RLS 정책과 서버 코드가 강제하며 이 함수들은 그 규칙과 같다.
// 방문자(로그인 없음)는 role이 null이다.

export type Role = Enums<"user_role">;

export const ROLE_LABEL: Record<Role, string> = {
  pending: "권한 없음",
  member: "팀원",
  leader: "리더",
  admin: "총 관리자",
};

export const ROLES: readonly Role[] = ["pending", "member", "leader", "admin"];

/** 예배 생성, 곡 추가와 삭제, 순서 변경, 악보 등록, 공개, 알림 */
export function canEditServices(role: Role | null | undefined): boolean {
  return role === "leader" || role === "admin";
}

/** 공용 필기 작성, 수정, 삭제 */
export function canWriteGlobalNotes(role: Role | null | undefined): boolean {
  return role === "leader" || role === "admin";
}

/** 사이트 전체 관리: 접속 기록, 비밀번호 변경, 곡 이름 변경과 삭제 */
export function canManageSite(role: Role | null | undefined): boolean {
  return role === "admin";
}

/** 공개된 예배 삭제(리더는 초안만 삭제할 수 있다) */
export function canDeletePublishedServices(role: Role | null | undefined): boolean {
  return role === "admin";
}

/** 악보함의 곡과 악보 삭제 */
export function canDeleteLibraryItems(role: Role | null | undefined): boolean {
  return role === "admin";
}
