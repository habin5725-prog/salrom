// 업데이트 자동 적용: 업데이트 장치가 생기기 전에 설치한 사이트(처음 설치 파일만 적용)에 새 버전을 배포하면
// 처음 접속할 때 아직 적용하지 않은 스키마 파일만 실행하고 기록한다.
import fs from "node:fs";
import { BASE, WORK, check, collectErrors, finish, loadPlaywright, openDevice, sql } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();
const OUT = `${WORK}/shots`;

check("업데이트 전: PDF만 허용", sql("select allowed_mime_types::text from storage.buckets where id='sheets'") === "{application/pdf}");
check("업데이트 전: 적용 기록 없음", sql("select count(*) from app_settings where key='schema'") === "0");

const browser = await chromium.launch();
const { page } = await openDevice(browser, devices["Pixel 7"]);
const errors = [];
collectErrors(page, errors);
await page.goto(`${BASE}/`);
await page.getByRole("heading", { name: "이번 주 찬양" }).waitFor({ timeout: 30000 });
await page.screenshot({ path: `${OUT}/01-upgraded-home.png` });

const files = fs.readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((f) => f.endsWith(".sql")).sort();
check("업데이트 후: 홈 화면이 그대로 열림", await page.getByText("주님의 은혜").first().isVisible());
check(
  "업데이트 후: 모든 파일 형식 허용(50MB)",
  sql("select coalesce(allowed_mime_types::text, 'all') || '|' || file_size_limit from storage.buckets where id='sheets'") === "all|52428800",
);
check(
  "업데이트 후: 적용 기록",
  sql("select value->>'applied' from app_settings where key='schema'") === JSON.stringify(files).replace(/,/g, ", "),
  sql("select value->>'applied' from app_settings where key='schema'"),
);
check("업데이트 후: 기존 데이터 유지", sql("select count(*) from songs") === "2");
check("브라우저 오류 없음", errors.length === 0, errors.join(" | "));

await browser.close();
finish("업데이트 자동 적용");
