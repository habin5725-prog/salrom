// 팀원 흐름 브라우저 검증
import { BASE, WORK, check, collectErrors, finish, loadPlaywright, sql } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();

const OUT = `${WORK}/shots`;

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Pixel 7"] });
const page = await context.newPage();
const errors = [];
collectErrors(page, errors);

// 로그인
await page.goto(`${BASE}/`);
await page.waitForURL(/\/login/);
await page.screenshot({ path: `${OUT}/01-login.png` });
await page.fill("#email", "m1@test.kr");
await page.fill("#password", "password");
await page.click("button[type=submit]");
await page.waitForURL(`${BASE}/`);
await page.getByText("주님의 은혜").first().waitFor();
await page.screenshot({ path: `${OUT}/02-home.png`, fullPage: true });
check("홈: 이번 주 찬양 제목", await page.getByRole("heading", { name: "이번 주 찬양" }).isVisible());
check("홈: 곡 2개 표시", (await page.getByText("악보 보기").filter({ visible: true }).count()) === 2);
check("홈: 팀원에게 편집 버튼 없음", (await page.getByText("이번 주 편집").filter({ visible: true }).count()) === 0);

// 악보 보기
await page.getByText("악보 보기").first().click();
await page.waitForURL(/\/play\//);
await page.locator("canvas").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/03-viewer.png` });
const canvasCount = await page.locator("canvas").filter({ visible: true }).count();
check("악보: 2쪽 모두 그림", canvasCount === 2, `canvas=${canvasCount}`);
const nonBlank = await page.locator("canvas").first().evaluate((c) => {
  const ctx = c.getContext("2d");
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let dark = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
  return dark;
});
check("악보: 캔버스에 내용이 있음", nonBlank > 1000, `dark=${nonBlank}`);

// 화면 누르면 버튼 숨김/표시
await page.locator("canvas").first().click({ position: { x: 150, y: 300 } });
await page.waitForTimeout(300);
check("악보: 화면을 누르면 위 메뉴 숨김", (await page.locator("header.absolute").getAttribute("class")).includes("-translate-y-full"));
await page.locator("canvas").first().click({ position: { x: 150, y: 300 } });
await page.waitForTimeout(300);

// 필기: 펜
await page.getByRole("button", { name: "필기" }).click();
const svg = page.locator("svg[viewBox^='0 0 1']").first();
const box = await svg.boundingBox();
await page.mouse.move(box.x + 60, box.y + 200);
await page.mouse.down();
for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + 60 + i * 8, box.y + 200 + Math.sin(i / 3) * 20);
await page.mouse.up();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/04-pen.png` });
check("필기: 펜 선이 그려짐", (await svg.locator("path").count()) >= 1);
const penRows = sql("select count(*) from annotations where user_id='00000000-0000-0000-0000-00000000000c' and type='pen' and scope='personal'");
check("필기: 개인 펜 필기가 서버에 저장됨", penRows === "1", penRows);

// 필기: 글자
await page.getByRole("button", { name: "글자" }).click();
await page.mouse.click(box.x + 100, box.y + 320);
await page.getByRole("dialog").waitFor();
await page.getByRole("dialog").locator("input").fill("카포 2");
await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
await page.waitForTimeout(800);
check("필기: 글자가 그려짐", (await svg.locator("text", { hasText: "카포 2" }).count()) === 1);
check("필기: 글자가 서버에 저장됨", sql("select count(*) from annotations where type='text' and data->>'text'='카포 2'") === "1");

// 되돌리기
await page.getByRole("button", { name: "되돌리기" }).click();
await page.waitForTimeout(800);
check("되돌리기: 글자가 사라짐", (await svg.locator("text", { hasText: "카포 2" }).count()) === 0);
check("되돌리기: 서버에서도 삭제", sql("select count(*) from annotations where type='text' and data->>'text'='카포 2'") === "0");

// 완료 후 새로고침해도 필기 유지
await page.getByRole("button", { name: "완료" }).click();
await page.reload();
await page.locator("canvas").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1000);
check("새로고침: 펜 필기 유지", (await page.locator("svg[viewBox^='0 0 1']").first().locator("path").count()) >= 1);

// 지우개
await page.getByRole("button", { name: "필기" }).click();
await page.getByRole("button", { name: "지우개" }).click();
const box2 = await page.locator("svg[viewBox^='0 0 1']").first().boundingBox();
await page.mouse.move(box2.x + 100, box2.y + 150);
await page.mouse.down();
for (let i = 0; i <= 15; i++) await page.mouse.move(box2.x + 100, box2.y + 150 + i * 8);
await page.mouse.up();
await page.waitForTimeout(800);
check("지우개: 서버에서 펜 필기 삭제", sql("select count(*) from annotations where type='pen' and user_id='00000000-0000-0000-0000-00000000000c'") === "0");
await page.getByRole("button", { name: "되돌리기" }).click();
await page.waitForTimeout(800);
check("지우개 되돌리기: 다시 저장됨", sql("select count(*) from annotations where type='pen' and user_id='00000000-0000-0000-0000-00000000000c'") === "1");
await page.getByRole("button", { name: "완료" }).click();

// 확대 버튼
const before = (await page.locator("canvas").first().boundingBox()).width;
await page.getByRole("button", { name: "크게" }).click();
await page.waitForTimeout(600);
const after = (await page.locator("canvas").first().boundingBox()).width;
check("확대: 악보가 커짐", after > before * 1.2, `${before} -> ${after}`);
await page.screenshot({ path: `${OUT}/05-zoom.png` });

// 다음 곡
await page.getByRole("link", { name: /다음 곡/ }).click();
await page.waitForURL(/40000000-0000-0000-0000-000000000002/);
await page.locator("canvas").first().waitFor({ timeout: 20000 });
check("다음 곡: 두 번째 곡 제목", await page.getByText("은혜 아니면").first().isVisible());
check("다음 곡: 마지막 곡이라 다음 곡 버튼 없음", (await page.getByRole("link", { name: /다음 곡/ }).filter({ visible: true }).count()) === 0);
check("다음 곡: 이전 곡 버튼 있음", (await page.getByRole("link", { name: /이전 곡/ }).filter({ visible: true }).count()) === 1);

// 악보함 초성 검색
await page.goto(`${BASE}/library`);
await page.getByRole("searchbox").fill("ㅇㅎㅇ");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/06-library.png` });
check("악보함: 초성 검색", (await page.getByText("은혜 아니면").filter({ visible: true }).count()) === 1 && (await page.getByText("주님의 은혜").filter({ visible: true }).count()) === 0);

// 곡 상세(이전 파일 목록, 사용 기록)
await page.getByRole("searchbox").fill("");
await page.getByText("주님의 은혜").click();
await page.waitForURL(/\/library\//);
await page.getByText("사용 기록").filter({ visible: true }).waitFor();
await page.screenshot({ path: `${OUT}/07-song.png`, fullPage: true });
check("곡 상세: 이전 파일 표시", (await page.getByText("이전 파일 1개").filter({ visible: true }).count()) === 1);
check("곡 상세: 사용 기록 2건", (await page.getByText("Key G").filter({ visible: true }).count()) + (await page.getByText("Key F").filter({ visible: true }).count()) === 2);

// 지난 예배
await page.goto(`${BASE}/history`);
await page.getByRole("link").filter({ hasText: "주일예배" }).first().waitFor();
await page.screenshot({ path: `${OUT}/08-history.png`, fullPage: true });
check("지난 예배: 1건", (await page.getByRole("link").filter({ hasText: "주일예배" }).filter({ visible: true }).count()) === 1);

// 설정
await page.goto(`${BASE}/settings`);
await page.getByText("내 정보").waitFor();
await page.screenshot({ path: `${OUT}/09-settings.png`, fullPage: true });
check("설정: 팀원에게 관리 메뉴 없음", (await page.getByText("예배 관리").filter({ visible: true }).count()) === 0 && (await page.getByText("사용자 관리").filter({ visible: true }).count()) === 0);

// 팀원이 편집 화면 주소로 직접 가면 홈으로
await page.goto(`${BASE}/edit`);
await page.waitForTimeout(800);
check("권한: 팀원은 편집 화면에 못 들어감", new URL(page.url()).pathname === "/", page.url());

check("브라우저 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
finish("팀원 흐름");
