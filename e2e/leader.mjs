// 리더 흐름과 공용 필기 브라우저 검증
import fs from "node:fs";
import { BASE, WORK, check, collectErrors, enterCode, finish, loadPlaywright, openDevice, sql, visible } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();

const OUT = `${WORK}/shots`;
const E = WORK;
const SERVICE1 = "10000000-0000-0000-0000-000000000001";

const browser = await chromium.launch();
const errors = [];
async function newDevice(label) {
  const session = await openDevice(browser, devices["Pixel 7"]);
  collectErrors(session.page, errors, label);
  return session;
}
const toast = (page) => visible(page.getByRole("status")).last();

// ---------------- 리더 모드(비밀번호 1234) ----------------
const { page } = await newDevice("리더");
await enterCode(page, "1234");
await page.waitForURL(`${BASE}/edit`);
check("로그인: 1234 → 리더 모드, 예배 관리로 이동", true);
check("로그인: 위쪽에 리더 모드 표시", (await visible(page.getByRole("link", { name: "리더 모드" })).count()) === 1);
check("로그인: 공용 리더 계정 생성", sql("select role from profiles p join auth.users u on u.id = p.id where u.email = 'worship-leader@example.com'") === "leader");
check("로그인: 관리 기록", sql("select count(*) from access_events where kind='login_success' and detail='리더 모드'") === "1");
await page.goto(`${BASE}/`);
await visible(page.getByText("이번 주 편집")).waitFor();
check("홈: 리더에게 이번 주 편집 버튼", true);
await visible(page.getByText("이번 주 편집")).click();
await page.waitForURL(/\/edit\//);
await visible(page.getByText("곡 순서")).waitFor();
await page.screenshot({ path: `${OUT}/10-editor.png`, fullPage: true });

// 순서 변경: 2번 곡을 위로
await visible(page.getByRole("button", { name: /은혜 아니면/ })).click();
await visible(page.getByRole("button", { name: "위로" })).click();
await page.waitForTimeout(800);
const order = sql(`select string_agg(s.title, ',' order by ss.position) from service_songs ss join songs s on s.id = ss.song_id where service_id = '${SERVICE1}'`);
check("편집: 순서 변경 저장", order === "은혜 아니면,주님의 은혜", order);

// Key 변경
await visible(page.getByRole("button", { name: "B", exact: true })).click();
await page.waitForTimeout(800);
check("편집: Key 저장", sql(`select song_key from service_songs where id = '40000000-0000-0000-0000-000000000002'`) === "B");
await page.screenshot({ path: `${OUT}/11-editor-item.png`, fullPage: true });

// 기존 곡 추가(초성 검색)
await visible(page.getByRole("button", { name: "곡 추가" })).click();
const dialog = page.getByRole("dialog");
await dialog.getByRole("searchbox").fill("ㅈㄴ");
await dialog.getByRole("button", { name: /주님의 은혜/ }).click();
await dialog.getByRole("button", { name: "D", exact: true }).click();
await page.screenshot({ path: `${OUT}/12-add-existing.png` });
await dialog.getByRole("button", { name: "이번 주에 추가" }).click();
await dialog.waitFor({ state: "detached" });
await page.waitForTimeout(500);
check(
  "편집: 기존 곡 추가(최신 악보 파일, Key D)",
  sql(`select count(*) from service_songs where service_id='${SERVICE1}' and song_key='D' and sheet_version=2`) === "1",
);

// 새 곡 등록 + PDF 올리기
await visible(page.getByRole("button", { name: "곡 추가" })).click();
await dialog.getByRole("searchbox").fill("새 노래");
await dialog.getByRole("button", { name: /새 곡으로 등록/ }).click();
await dialog.locator("input[type=file]:not([accept])").setInputFiles(`${E}/new-song.pdf`);
await dialog.getByText("new-song.pdf").waitFor();
await dialog.getByRole("button", { name: "E", exact: true }).click();
await page.screenshot({ path: `${OUT}/13-add-new.png` });
await dialog.getByRole("button", { name: "등록하고 이번 주에 추가" }).click();
await dialog.waitFor({ state: "detached", timeout: 15000 });
await page.waitForTimeout(500);
const newSong = sql(`select s.id || '|' || sh.current_version || '|' || v.file_path from songs s join sheets sh on sh.song_id = s.id join sheet_versions v on v.sheet_id = sh.id where s.title = '새 노래'`);
check("편집: 새 곡, 악보, 파일 등록", newSong.split("|")[1] === "1", newSong);
check("편집: PDF 파일 저장소에 올라감", fs.existsSync(`${E}/storage/sheets/${newSong.split("|")[2]}`));
check("편집: 새 곡이 이번 주에 추가(Key E)", sql(`select count(*) from service_songs where service_id='${SERVICE1}' and song_key='E'`) === "1");

// 최신 파일로 바꾸기(1번째 파일을 쓰던 곡)
await visible(page.getByRole("button", { name: /주님의 은혜.*새 악보 파일 있음/ })).click();
await visible(page.getByRole("button", { name: /악보: 악보/ })).click();
await page.getByRole("dialog").getByRole("button", { name: /최신 파일\(2번째\)로 바꾸기/ }).click();
await page.getByRole("dialog").waitFor({ state: "detached" });
await page.waitForTimeout(500);
check("편집: 최신 파일로 교체", sql(`select sheet_version from service_songs where id='40000000-0000-0000-0000-000000000001'`) === "2");
check("편집: 이전 파일 그대로 보존", sql(`select count(*) from sheet_versions where sheet_id='30000000-0000-0000-0000-000000000001'`) === "2");

// 공개된 예배: 변경 알림
await visible(page.getByRole("button", { name: "팀원에게 변경 알림 보내기" })).click();
await page.getByRole("dialog").locator("textarea").fill("Key가 바뀌었습니다");
await page.getByRole("dialog").getByRole("button", { name: "알림 보내기" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/14-notify.png` });
check("알림: 발송 시각 기록", sql(`select notified_at is not null from services where id='${SERVICE1}'`) === "t");
check("알림: 결과 안내", /알림/.test(await toast(page).innerText()));

// 새 예배 만들고 공개
await page.goto(`${BASE}/edit/new`);
await visible(page.getByText("1. 예배 날짜")).waitFor();
const d = new Date(Date.now() + 17 * 86400000).toISOString().slice(0, 10);
await page.fill("#service-date", d);
await visible(page.getByRole("button", { name: "수요예배" })).click();
await page.screenshot({ path: `${OUT}/15-new-service.png` });
await visible(page.getByRole("button", { name: "만들고 곡 추가하기" })).click();
await page.waitForURL(/\/edit\/[0-9a-f-]{36}$/);
await visible(page.getByText("곡 순서")).waitFor();
const newServiceId = page.url().split("/").pop();
check("새 예배: 초안으로 생성", sql(`select status || '|' || title from services where id='${newServiceId}'`) === "draft|수요예배");
await visible(page.getByRole("button", { name: "곡 추가" })).click();
await dialog.getByRole("searchbox").fill("은혜 아니면");
await dialog.getByRole("button", { name: /은혜 아니면.*고르기/ }).click();
await dialog.getByRole("button", { name: "이번 주에 추가" }).click();
await dialog.waitFor({ state: "detached" });
await visible(page.getByRole("button", { name: "이번 주 찬양 공개" })).click();
await page.screenshot({ path: `${OUT}/16-publish-dialog.png` });
await page.getByRole("dialog").getByRole("button", { name: "공개", exact: true }).click();
await page.waitForTimeout(1500);
check("공개: 상태가 공개로 바뀜", sql(`select status from services where id='${newServiceId}'`) === "published");
check("공개: 화면에 공개됨 표시", (await visible(page.getByText("팀원에게 공개되어 있습니다.")).count()) === 1);

// 리더 공용 필기
await page.goto(`${BASE}/play/40000000-0000-0000-0000-000000000001`);
await visible(page.locator("canvas")).first().waitFor({ timeout: 20000 });
await visible(page.getByRole("button", { name: "필기" })).click();
await visible(page.getByRole("radio", { name: /공용 필기/ })).click();
const svg = visible(page.locator("svg[viewBox^='0 0 1']")).first();
const box = await svg.boundingBox();
await page.mouse.move(box.x + 80, box.y + 420);
await page.mouse.down();
for (let i = 0; i <= 15; i++) await page.mouse.move(box.x + 80 + i * 12, box.y + 420);
await page.mouse.up();
await page.waitForTimeout(500);
await visible(page.getByRole("button", { name: "글자" })).click();
await page.mouse.click(box.x + 90, box.y + 480);
await page.getByRole("dialog").locator("input").fill("후렴 2번");
await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/17-leader-global.png` });
check("공용 필기: 선과 글자 저장", sql(`select count(*) from annotations where scope='global' and sheet_version=2`) === "2");

// ---------------- 팀원이 공용 필기를 본다 ----------------
const member = await newDevice("방문자");
const mp = member.page;
await mp.goto(`${BASE}/play/40000000-0000-0000-0000-000000000001`);
await visible(mp.locator("canvas")).first().waitFor({ timeout: 20000 });
await mp.waitForTimeout(1000);
const msvg = visible(mp.locator("svg[viewBox^='0 0 1']")).first();
check("팀원: 공용 글자 보임", (await msvg.locator("text", { hasText: "후렴 2번" }).count()) === 1);
check("팀원: 공용 표시 보임", (await msvg.locator("text", { hasText: "공용" }).count()) >= 2);
await visible(mp.getByRole("button", { name: "필기" })).click();
check("팀원: 공용 필기 선택 없음", (await mp.getByRole("radio", { name: /공용 필기/ }).count()) === 0);
await visible(mp.getByRole("button", { name: "지우개" })).click();
const mbox = await msvg.boundingBox();
await mp.mouse.move(mbox.x + 150, mbox.y + 400);
await mp.mouse.down();
for (let i = 0; i <= 10; i++) await mp.mouse.move(mbox.x + 150, mbox.y + 400 + i * 5);
await mp.mouse.up();
await mp.waitForTimeout(800);
check("팀원: 공용 필기는 지울 수 없음", sql(`select count(*) from annotations where scope='global'`) === "2");
await mp.screenshot({ path: `${OUT}/18-member-sees-global.png` });

check("버전: 서버에는 공용 필기만 있음", sql(`select count(*) from annotations where scope='personal'`) === "0");

// ---------------- 리더 모드에서 나가기 ----------------
await page.goto(`${BASE}/settings`);
await visible(page.getByRole("button", { name: "관리 모드에서 나가기" })).click();
await page.waitForURL(`${BASE}/`);
await visible(page.getByRole("link", { name: "로그인" })).waitFor();
check("나가기: 다시 로그인 버튼", true);
await page.goto(`${BASE}/edit`);
await page.waitForURL(/\/login/);
check("나가기: 편집 화면은 다시 비밀번호 필요", true);

check("브라우저 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
finish("리더 흐름");
