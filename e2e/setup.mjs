// 처음 설치: 표가 없는 데이터베이스에서 "사이트 준비하기"를 누르면 표, 권한 정책, 처음 비밀번호, 알림 키가 만들어진다.
import { BASE, WORK, check, collectErrors, finish, loadPlaywright, openDevice, sql } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();
const OUT = `${WORK}/shots`;

check("준비 전: 앱 표가 없음", sql("select count(*) from information_schema.tables where table_schema='public'") === "0");

const browser = await chromium.launch();
const { page } = await openDevice(browser, devices["Pixel 7"]);
const errors = [];
collectErrors(page, errors);

await page.goto(`${BASE}/`);
await page.getByText("사이트를 처음 준비합니다").waitFor();
await page.screenshot({ path: `${OUT}/00-setup.png` });
await page.getByRole("button", { name: "사이트 준비하기" }).click();
await page.getByRole("heading", { name: "이번 주 찬양" }).waitFor({ timeout: 60000 });
await page.screenshot({ path: `${OUT}/00-setup-done.png` });

check("준비 후: 홈 화면", await page.getByText("아직 이번 주 찬양이 올라오지 않았습니다.").isVisible());
check("준비 후: 표 생성", Number(sql("select count(*) from information_schema.tables where table_schema='public'")) >= 12);
check(
  "준비 후: 처음 비밀번호와 알림 키",
  sql("select string_agg(key, ',' order by key) from app_settings") === "admin_code,leader_code,vapid",
);
check("준비 후: 비밀번호는 원문이 아닌 해시로 저장", !sql("select value::text from app_settings where key='leader_code'").includes("1234"));
check("준비 후: 관리 기록에 남김", sql("select count(*) from access_events where kind='setup'") === "1");
check("브라우저 오류 없음", errors.length === 0, errors.join(" | "));

await browser.close();
finish("처음 설치");
