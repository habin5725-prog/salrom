// 브라우저 검증 공통 도구. run.sh 가 환경 변수를 채운 뒤 각 시나리오를 실행한다.
import { execFileSync } from "node:child_process";

export const BASE = process.env.E2E_APP_URL ?? "http://localhost:3100";
export const WORK = process.env.E2E_WORK ?? new URL("./.work", import.meta.url).pathname;
const DB_URL = process.env.E2E_DB_URL ?? "postgres://postgres:postgres@localhost:5432/salrom_e2e";

/** 테스트 데이터베이스에 SQL을 실행하고 결과를 문자열로 돌려준다. */
export function sql(query) {
  return execFileSync("psql", [DB_URL, "-tAc", query]).toString().trim();
}

let failures = 0;
export function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${!cond && extra ? ` :: ${extra}` : ""}`);
  if (!cond) failures++;
}

export function finish(title) {
  console.log(failures === 0 ? `\n${title} 통과` : `\n${title}: 실패 ${failures}건`);
  process.exit(failures ? 1 : 0);
}

/** playwright 패키지가 프로젝트에 없으면 PLAYWRIGHT_MODULE 경로에서 불러온다. */
export async function loadPlaywright() {
  return import(process.env.PLAYWRIGHT_MODULE || "playwright");
}

/** 화면에 보이는 요소만(앞서 본 화면이 숨겨진 채 남아 있을 수 있다) */
export const visible = (locator) => locator.filter({ visible: true });

export async function login(browser, device, email, { permissions = [] } = {}) {
  const context = await browser.newContext({ ...device });
  if (permissions.length > 0) await context.grantPermissions(permissions, { origin: BASE });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "password");
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  return { context, page };
}

/** 브라우저 오류를 모은다(실시간 연결 실패는 테스트 환경에 실시간 서버가 없어서 제외). */
export function collectErrors(page, errors, label = "") {
  page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/realtime|websocket/i.test(m.text())) errors.push(`${label} console: ${m.text()}`);
  });
}
