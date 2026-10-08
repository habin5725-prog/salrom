import { describe, expect, it } from "vitest";
import {
  ROLES,
  canDeleteLibraryItems,
  canDeletePublishedServices,
  canEditServices,
  canManageSite,
  canWriteGlobalNotes,
  type Role,
} from "./permissions";

// supabase/migrations 의 RLS 규칙과 같은 표이다. 정책을 바꾸면 이 표도 함께 바꾼다.
const expected: Record<Role, [boolean, boolean, boolean, boolean, boolean]> = {
  //        예배편집 공용필기 사이트관리 악보삭제 공개예배삭제
  pending: [false, false, false, false, false],
  member: [false, false, false, false, false],
  leader: [true, true, false, false, false],
  admin: [true, true, true, true, true],
};

describe("권한 표", () => {
  it.each(ROLES)("%s", (role) => {
    expect([
      canEditServices(role),
      canWriteGlobalNotes(role),
      canManageSite(role),
      canDeleteLibraryItems(role),
      canDeletePublishedServices(role),
    ]).toEqual(expected[role]);
  });

  it("방문자(로그인 없음)는 편집 권한이 없다", () => {
    expect(canEditServices(null)).toBe(false);
    expect(canWriteGlobalNotes(undefined)).toBe(false);
    expect(canManageSite(null)).toBe(false);
  });
});
