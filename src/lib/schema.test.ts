import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCHEMA_FILES, SCHEMA_SQL } from "./schema.generated";

describe("자동 설치용 스키마", () => {
  it("supabase/migrations 와 같다(다르면 npm run gen:schema)", () => {
    const dir = join(__dirname, "..", "..", "supabase", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    expect(SCHEMA_FILES).toEqual(files);
    expect(SCHEMA_SQL).toBe(files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n"));
  });
});
