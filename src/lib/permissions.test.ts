import { describe, expect, it } from "vitest";
import {
  ROLES,
  canDeleteLibraryItems,
  canEditServices,
  canManageUsers,
  canWriteGlobalNotes,
  isApproved,
  type Role,
} from "./permissions";

// supabase/migrations 의 RLS 규칙과 같은 표이다. 정책을 바꾸면 이 표도 함께 바꾼다.
const expected: Record<Role, [boolean, boolean, boolean, boolean, boolean]> = {
  //        승인됨  예배편집 공용필기 사용자관리 악보삭제
  pending: [false, false, false, false, false],
  member: [true, false, false, false, false],
  leader: [true, true, true, false, false],
  admin: [true, true, true, true, true],
};

describe("권한 표", () => {
  it.each(ROLES)("%s", (role) => {
    expect([
      isApproved(role),
      canEditServices(role),
      canWriteGlobalNotes(role),
      canManageUsers(role),
      canDeleteLibraryItems(role),
    ]).toEqual(expected[role]);
  });

  it("로그인하지 않았으면 아무 권한도 없다", () => {
    expect(isApproved(null)).toBe(false);
    expect(canEditServices(undefined)).toBe(false);
  });
});
