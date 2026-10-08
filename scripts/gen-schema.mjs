// supabase/migrations 의 SQL을 앱이 처음 실행될 때 쓸 수 있도록 src/lib/schema.generated.ts 로 옮긴다.
// 마이그레이션을 고치면 npm run gen:schema 로 다시 만든다(dev, build 전에도 자동 실행).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

const out = `// 자동 생성 파일: scripts/gen-schema.mjs 가 supabase/migrations 에서 만든다. 직접 고치지 않는다.
export const SCHEMA_FILES = ${JSON.stringify(files)};
export const SCHEMA_SQL = ${JSON.stringify(sql)};
`;
writeFileSync(join(root, "src", "lib", "schema.generated.ts"), out);
console.log(`스키마 ${files.length}개 파일을 src/lib/schema.generated.ts 로 옮겼습니다.`);
