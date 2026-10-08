// 사진 여러 장을 한 악보로 올리기, 음원과 문서 올리기, 악보함 새로 고침, 곡 지우기(총 관리자) 브라우저 검증
import fs from "node:fs";
import {
  BASE,
  WORK,
  check,
  collectErrors,
  enterCode,
  finish,
  loadPlaywright,
  makePng,
  openDevice,
  sql,
  visible,
} from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();
const OUT = `${WORK}/shots`;
const SERVICE1 = "10000000-0000-0000-0000-000000000001";

const browser = await chromium.launch();
const errors = [];

// ---------------- 악보함은 다른 화면에 다녀오면 새 곡이 보인다 ----------------
{
  const { page } = await openDevice(browser, devices["Pixel 7"]);
  collectErrors(page, errors, "방문자");
  await page.goto(`${BASE}/library`);
  await visible(page.getByText("전체 2곡")).waitFor();
  sql("insert into songs (id, title) values ('20000000-0000-0000-0000-0000000000aa', '새로 들어온 곡')");
  await visible(page.getByRole("link", { name: "홈" })).first().click();
  await page.waitForURL(`${BASE}/`);
  await visible(page.getByRole("link", { name: "악보함" })).first().click();
  await page.waitForURL(`${BASE}/library`);
  await page.waitForTimeout(1500);
  check("악보함: 다른 화면에 다녀오면 새 곡이 보임", (await visible(page.getByText("새로 들어온 곡")).count()) === 1);
  sql("delete from songs where id = '20000000-0000-0000-0000-0000000000aa'");
  await page.context().close();
}

// ---------------- 리더: 사진, 음원, 문서 올리기 ----------------
const { page } = await openDevice(browser, devices["Pixel 7"]);
collectErrors(page, errors, "리더");
await enterCode(page, "1234");
await page.waitForURL(`${BASE}/edit`);
await page.goto(`${BASE}/edit/${SERVICE1}`);
await visible(page.getByText("곡 순서")).waitFor();
const dialog = page.getByRole("dialog");

async function startNewSong(title) {
  await visible(page.getByRole("button", { name: "곡 추가" })).click();
  await dialog.getByRole("searchbox").fill(title);
  await dialog.getByRole("button", { name: /새 곡으로 등록/ }).click();
}
async function submitNewSong() {
  await dialog.getByRole("button", { name: "등록하고 이번 주에 추가" }).click();
  await dialog.waitFor({ state: "detached", timeout: 20000 });
  await page.waitForTimeout(500);
}
const photoInput = () => dialog.locator("input[type=file][multiple]").first();
const fileInput = () => dialog.locator("input[type=file]:not([accept])").first();

// 사진 두 장(세로, 가로)을 고르고 순서를 바꿔 한 악보로 올린다.
await startNewSong("사진 악보");
check("첨부: 사진 찍기, 사진 고르기, 파일 고르기 버튼", (await dialog.getByText("사진 찍기").count()) === 1 && (await dialog.getByText("사진 고르기").count()) === 1 && (await dialog.getByText(/파일 고르기/).count()) === 1);
check("첨부: 카메라 바로 열기", (await dialog.locator("input[type=file][capture=environment]").count()) === 1);
await photoInput().setInputFiles([
  { name: "1쪽.png", mimeType: "image/png", buffer: makePng(600, 800) },
  { name: "2쪽.png", mimeType: "image/png", buffer: makePng(900, 600, 25) },
]);
await dialog.getByText("사진 2장 → 악보 2쪽").waitFor();
// 한 장 더 고르면 이어 붙는다.
await photoInput().setInputFiles([{ name: "3쪽.png", mimeType: "image/png", buffer: makePng(600, 800) }]);
await dialog.getByText("사진 3장 → 악보 3쪽").waitFor();
await dialog.getByRole("button", { name: "3쪽 빼기" }).click();
await dialog.getByText("사진 2장 → 악보 2쪽").waitFor();
await dialog.getByRole("button", { name: "2쪽을 앞으로" }).click();
check("첨부: 순서 바꾸기", (await dialog.locator("li", { hasText: "1쪽" }).filter({ hasText: "2쪽.png" }).count()) === 1);
await page.screenshot({ path: `${OUT}/50-photo-picker.png` });
await submitNewSong();
const photo = sql(
  `select ss.id || '|' || v.file_path || '|' || sh.name from service_songs ss join songs s on s.id = ss.song_id join sheet_versions v on v.sheet_id = ss.sheet_id and v.version = ss.sheet_version join sheets sh on sh.id = ss.sheet_id where s.title = '사진 악보'`,
).split("|");
check("사진: PDF 악보 한 개로 저장", photo[1]?.endsWith(".pdf") && photo[2] === "악보", photo.join(" "));
const stored = fs.readFileSync(`${WORK}/storage/sheets/${photo[1]}`);
check("사진: 저장된 파일이 PDF", stored.subarray(0, 5).toString() === "%PDF-");

await page.goto(`${BASE}/play/${photo[0]}`);
await visible(page.locator("canvas")).nth(1).waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
const canvases = visible(page.locator("canvas"));
const first = await canvases.nth(0).boundingBox();
const second = await canvases.nth(1).boundingBox();
check("사진 악보: 2쪽으로 보임", (await canvases.count()) === 2);
check("사진 악보: 바꾼 순서대로(1쪽 가로, 2쪽 세로)", first.width > first.height && second.height > second.width, `${first.width}x${first.height}, ${second.width}x${second.height}`);
await page.screenshot({ path: `${OUT}/51-photo-sheet.png` });
await visible(page.getByRole("button", { name: "필기" })).click();
check("사진 악보: 필기 가능", (await visible(page.getByRole("button", { name: "펜", exact: true })).count()) === 1);
await visible(page.getByRole("button", { name: "완료" })).click();

// 음원: 파일 이름이 악보 이름이 되고 사이트 안에서 재생한다.
await page.goto(`${BASE}/edit/${SERVICE1}`);
await visible(page.getByText("곡 순서")).waitFor();
await startNewSong("연습 음원 곡");
await fileInput().setInputFiles({ name: "알토 연습.mp3", mimeType: "audio/mpeg", buffer: Buffer.alloc(4096, 7) });
await dialog.getByText("알토 연습.mp3").waitFor();
check("첨부: 음원 안내", (await dialog.getByText("사이트 안에서 바로 재생할 수 있습니다.").count()) === 1);
await submitNewSong();
const audio = sql(
  `select ss.id || '|' || v.file_path || '|' || sh.name from service_songs ss join songs s on s.id = ss.song_id join sheet_versions v on v.sheet_id = ss.sheet_id and v.version = ss.sheet_version join sheets sh on sh.id = ss.sheet_id where s.title = '연습 음원 곡'`,
).split("|");
check("음원: 그대로 저장(이름은 파일 이름)", audio[1]?.endsWith(".mp3") && audio[2] === "알토 연습", audio.join(" "));
await page.goto(`${BASE}/play/${audio[0]}`);
await visible(page.locator("audio")).waitFor({ timeout: 20000 });
const download = await visible(page.getByRole("link", { name: "내려받기" })).getAttribute("href");
const got = await page.request.get(download);
check("음원: 재생 화면과 내려받기", got.status() === 200 && (await got.body()).length === 4096 && /attachment/.test(got.headers()["content-disposition"] ?? ""));
check("음원: 필기 버튼은 쓸 수 없음", await visible(page.getByRole("button", { name: "필기" })).isDisabled());
await page.screenshot({ path: `${OUT}/52-audio.png` });

// 한글 문서: 형식을 모르는 파일도 올리고 기기 앱으로 연다.
await page.goto(`${BASE}/edit/${SERVICE1}`);
await visible(page.getByText("곡 순서")).waitFor();
await startNewSong("가사 문서 곡");
await fileInput().setInputFiles({ name: "가사.hwp", mimeType: "", buffer: Buffer.from("HWP Document File") });
await submitNewSong();
const doc = sql(
  `select ss.id || '|' || v.file_path from service_songs ss join songs s on s.id = ss.song_id join sheet_versions v on v.sheet_id = ss.sheet_id and v.version = ss.sheet_version where s.title = '가사 문서 곡'`,
).split("|");
check("문서: 그대로 저장", doc[1]?.endsWith(".hwp"), doc.join(" "));
await page.goto(`${BASE}/play/${doc[0]}`);
const open = visible(page.getByRole("link", { name: "파일 열기" }));
await open.waitFor({ timeout: 20000 });
check("문서: 파일 열기 주소가 동작", (await page.request.get(await open.getAttribute("href"))).status() === 200);
await page.screenshot({ path: `${OUT}/53-document.png` });

// 너무 큰 파일은 고를 때 바로 알려 준다.
await page.goto(`${BASE}/edit/${SERVICE1}`);
await visible(page.getByText("곡 순서")).waitFor();
await startNewSong("큰 파일");
const big = `${WORK}/big.mp4`;
fs.writeFileSync(big, Buffer.alloc(51 * 1024 * 1024));
await fileInput().setInputFiles(big);
await visible(dialog.getByText(/파일이 너무 큽니다/)).waitFor();
check("첨부: 50MB 넘는 파일 안내", true);
await dialog.getByRole("button", { name: "닫기" }).click();
fs.rmSync(big);

// 홈 목록의 버튼 이름이 파일 종류를 따른다.
await page.goto(`${BASE}/`);
await visible(page.getByText("연습 음원 곡")).waitFor();
check("홈: 음원은 듣기, 문서는 파일 열기", (await visible(page.getByText("듣기", { exact: true })).count()) === 1 && (await visible(page.getByText("파일 열기", { exact: true })).count()) === 1);
await page.screenshot({ path: `${OUT}/54-home-kinds.png`, fullPage: true });

// 리더에게는 곡 지우기 버튼이 없다.
const photoSongId = sql("select id from songs where title = '사진 악보'");
await page.goto(`${BASE}/library/${photoSongId}`);
await visible(page.getByText("악보와 파일")).waitFor();
check("곡 지우기: 리더에게는 버튼 없음", (await page.getByRole("button", { name: "이 곡 지우기" }).count()) === 0);

// ---------------- 총 관리자: 곡 지우기 ----------------
const admin = await openDevice(browser, devices["Pixel 7"]);
collectErrors(admin.page, errors, "총 관리자");
const ap = admin.page;
await enterCode(ap, "1221");
await ap.waitForURL(`${BASE}/admin`);
await ap.goto(`${BASE}/library/${photoSongId}`);
await visible(ap.getByRole("button", { name: "이 곡 지우기" })).waitFor();
await ap.screenshot({ path: `${OUT}/55-delete-song.png`, fullPage: true });
const prompts = [];
ap.on("dialog", (d) => {
  prompts.push(d.message());
  d.accept();
});
await visible(ap.getByRole("button", { name: "이 곡 지우기" })).click();
await ap.waitForURL(`${BASE}/library`, { timeout: 15000 });
await ap.waitForTimeout(800);
check("곡 지우기: 두 번 확인(예배 순서에 쓰인 곡)", prompts.length === 2 && /예배 순서/.test(prompts[1]), prompts.join(" / "));
check("곡 지우기: 곡이 지워짐", sql("select count(*) from songs where title = '사진 악보'") === "0");
check("곡 지우기: 예배 순서에서도 빠짐", sql(`select count(*) from service_songs where id = '${photo[0]}'`) === "0");
check("곡 지우기: 파일도 지워짐", !fs.existsSync(`${WORK}/storage/sheets/${photo[1]}`));
check("곡 지우기: 악보함 목록에서 사라짐", (await visible(ap.getByText("사진 악보")).count()) === 0);

check("브라우저 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
finish("파일 올리기와 곡 지우기");
