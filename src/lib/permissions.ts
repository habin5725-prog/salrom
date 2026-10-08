import type { Enums } from "./database.types";

// 화면에서 버튼을 보이거나 숨길 때 쓰는 기준이다.
// 실제 권한은 데이터베이스 RLS 정책이 강제하며 이 함수들은 그 정책과 같은 규칙을 따른다.

export type Role = Enums<"user_role">;

export const ROLE_LABEL: Record<Role, string> = {
  pending: "승인 대기",
  member: "팀원",
  leader: "리더",
  admin: "총 관리자",
};

export const ROLES: readonly Role[] = ["pending", "member", "leader", "admin"];

/** 승인된 팀원(팀원, 리더, 총 관리자)인지 */
export function isApproved(role: Role | null | undefined): boolean {
  return role === "member" || role === "leader" || role === "admin";
}

/** 예배 생성, 곡 추가와 삭제, 순서 변경, 악보 등록, 공개 */
export function canEditServices(role: Role | null | undefined): boolean {
  return role === "leader" || role === "admin";
}

/** 공용 필기 작성, 수정, 삭제 */
export function canWriteGlobalNotes(role: Role | null | undefined): boolean {
  return role === "leader" || role === "admin";
}

/** 사용자 승인과 권한 변경 */
export function canManageUsers(role: Role | null | undefined): boolean {
  return role === "admin";
}

/** 악보함의 곡과 악보 삭제 */
export function canDeleteLibraryItems(role: Role | null | undefined): boolean {
  return role === "admin";
}
