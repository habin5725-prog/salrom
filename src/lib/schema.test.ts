import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEMA_PARTS } from "./schema.generated";

describe("자동 설치용 스키마", () => {
  it("supabase/migrations 와 같다(다르면 npm run gen:schema)", () => {
    const dir = join(__dirname, "..", "..", "supabase", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    expect(SCHEMA_PARTS.map((p) => p.name)).toEqual(files);
    for (const part of SCHEMA_PARTS) expect(part.sql).toBe(readFileSync(join(dir, part.name), "utf8"));
  });

  it("첫 파일은 처음 설치용이고 나머지는 이미 설치된 사이트의 업데이트이다", () => {
    expect(SCHEMA_PARTS[0].name).toMatch(/_init\.sql$/);
    // 업데이트 파일은 자체 트랜잭션을 열지 않는다(설치 도우미가 하나의 트랜잭션으로 묶는다).
    for (const part of SCHEMA_PARTS) expect(part.sql).not.toMatch(/^\s*(begin|commit)\s*;/im);
  });
});
