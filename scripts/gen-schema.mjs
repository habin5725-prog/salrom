// supabase/migrations 의 SQL을 앱이 처음 실행될 때 쓸 수 있도록 src/lib/schema.generated.ts 로 옮긴다.
// 마이그레이션을 고치면 npm run gen:schema 로 다시 만든다(dev, build 전에도 자동 실행).
// 첫 파일(init) 다음 파일들은 이미 설치된 사이트에 자동으로 적용되므로 여러 번 실행해도 같은 결과가 나오게 쓴다.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const parts = files.map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));

const out = `// 자동 생성 파일: scripts/gen-schema.mjs 가 supabase/migrations 에서 만든다. 직접 고치지 않는다.
// 처음 설치할 때는 모두 실행하고, 이미 설치된 사이트에서는 아직 적용하지 않은 파일만 실행한다(src/lib/setup.ts).
export const SCHEMA_PARTS: { name: string; sql: string }[] = ${JSON.stringify(parts)};
`;
writeFileSync(join(root, "src", "lib", "schema.generated.ts"), out);
console.log(`스키마 ${files.length}개 파일을 src/lib/schema.generated.ts 로 옮겼습니다.`);
