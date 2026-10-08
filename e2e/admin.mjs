// 총 관리자 모드(비밀번호 1221) 브라우저 검증. visitor.mjs, leader.mjs 다음에 실행한다.
import { BASE, WORK, check, collectErrors, enterCode, finish, loadPlaywright, openDevice, sql, visible } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();
const OUT = `${WORK}/shots`;

const browser = await chromium.launch();
const errors = [];
const { page } = await openDevice(browser, devices["Pixel 7"]);
collectErrors(page, errors, "총 관리자");

// 리더 비밀번호로는 관리자 화면에 못 들어간다.
await page.goto(`${BASE}/admin`);
await page.waitForURL(/\/login/);
check("관리자 화면: 비밀번호 필요", new URL(page.url()).searchParams.get("need") === "admin");

await enterCode(page, "1221");
await page.waitForURL(`${BASE}/admin`);
await visible(page.getByText("최근 접속 기록")).waitFor();
await page.screenshot({ path: `${OUT}/20-admin.png`, fullPage: true });
check("로그인: 1221 → 총 관리자", (await visible(page.getByRole("link", { name: "총 관리자", exact: true })).count()) === 1);
check("관리자 화면: 처음 비밀번호 경고", (await visible(page.getByText(/처음 비밀번호/)).count()) === 1);
check("관리자 화면: 지금 접속 중에 나도 보임", (await visible(page.getByText(/지금 접속 중 \(\d+\)/)).count()) === 1);
const visitorItem = visible(page.getByRole("link").filter({ hasText: "김집사(건반)" })).first();
check("관리자 화면: 방문자 이름이 접속 기록에 보임", (await visitorItem.count()) === 1);
check("관리자 화면: 많이 본 악보", (await visible(page.getByText("주님의 은혜", { exact: true })).count()) >= 1);
check("관리자 화면: 비밀번호 틀림 기록", (await visible(page.getByText("비밀번호 틀림")).count()) >= 1);
check("관리자 화면: 리더 모드 기록", (await visible(page.getByText("관리 모드 들어옴")).count()) >= 1);

// 접속 상세: 무엇을 몇 분 보았는지
await visitorItem.click();
await page.waitForURL(/\/admin\/visits\//);
await visible(page.getByText("본 화면과 머문 시간")).waitFor();
await page.screenshot({ path: `${OUT}/21-visit.png`, fullPage: true });
check("접속 상세: 기기", (await visible(page.getByText(/Android/)).count()) >= 1);
check("접속 상세: 본 악보", (await visible(page.getByText(/악보: 주님의 은혜/)).count()) >= 1);
check("접속 상세: 머문 시간", (await visible(page.getByText(/1분 미만|\d+분/)).count()) >= 2);

// 비밀번호 바꾸기: 리더 1234 → 5678
await page.goto(`${BASE}/admin/settings`);
await page.getByLabel("찬양팀 리더 비밀번호 새 비밀번호", { exact: true }).fill("5678");
await page.getByLabel("찬양팀 리더 비밀번호 새 비밀번호 확인").fill("5678");
await visible(page.getByRole("button", { name: "비밀번호 바꾸기" })).first().click();
await visible(page.getByText("비밀번호를 바꿨습니다.")).waitFor();
check("비밀번호 변경: 저장", true);
await page.getByLabel("총 관리자 비밀번호 새 비밀번호", { exact: true }).fill("5678");
await page.getByLabel("총 관리자 비밀번호 새 비밀번호 확인").fill("5678");
await visible(page.getByRole("button", { name: "비밀번호 바꾸기" })).nth(1).click();
await visible(page.getByText(/서로 달라야 합니다/)).waitFor();
check("비밀번호 변경: 리더와 같은 비밀번호는 거부", true);
await page.screenshot({ path: `${OUT}/22-admin-settings.png`, fullPage: true });

const other = await openDevice(browser, devices["Pixel 7"]);
await enterCode(other.page, "1234");
await other.page.locator("form").getByRole("alert").waitFor();
check("비밀번호 변경: 예전 비밀번호(1234) 거부", true);
await enterCode(other.page, "5678");
await other.page.waitForURL(`${BASE}/edit`);
check("비밀번호 변경: 새 비밀번호(5678)로 리더 모드", true);
await other.context.close();

// 곡 관리: 이름 바꾸기, 예배에 쓰인 곡은 지우기 거부
await page.goto(`${BASE}/admin/songs`);
const row = visible(page.getByRole("listitem").filter({ hasText: "은혜 아니면" })).first();
await row.getByRole("button", { name: "이름 바꾸기" }).click();
await page.getByLabel("새 곡명").fill("은혜 아니면(편곡)");
await visible(page.getByRole("button", { name: "저장" })).click();
await visible(page.getByText("곡명을 바꿨습니다.")).waitFor();
check("곡 관리: 이름 바꾸기", sql("select count(*) from songs where title = '은혜 아니면(편곡)'") === "1");
page.once("dialog", (d) => d.accept());
await visible(page.getByRole("listitem").filter({ hasText: "주님의 은혜" })).first().getByRole("button", { name: "지우기" }).click();
await visible(page.getByText(/예배 순서에 쓰인 곡이라/)).waitFor();
check("곡 관리: 예배에 쓰인 곡은 지우지 않음", sql("select count(*) from songs where title = '주님의 은혜'") === "1");

// 기기별 미리보기
await page.goto(`${BASE}/preview`);
await visible(page.getByRole("radio", { name: "모두 보기" })).click();
await page.waitForTimeout(2500);
await page.setViewportSize({ width: 412, height: 915 });
check("미리보기: 휴대폰, 패드, 노트북 3개 화면", (await page.locator("iframe").count()) === 3);
const frame = page.frameLocator("iframe").first();
await frame.getByRole("heading", { name: "이번 주 찬양" }).waitFor({ timeout: 20000 });
check("미리보기: 안쪽 화면이 실제로 열림", true);
check("미리보기: 안쪽 화면에는 처음 방문 안내가 안 뜸", (await frame.getByRole("dialog").count()) === 0);
await page.screenshot({ path: `${OUT}/23-preview.png`, fullPage: true });

// 비밀번호를 여러 번 틀리면 잠시 막는다(이 검사는 마지막에 한다).
const attacker = await openDevice(browser, devices["Pixel 7"]);
for (let i = 0; i < 5; i++) {
  await enterCode(attacker.page, String(1000 + i));
  await attacker.page.locator("form").getByRole("alert").waitFor();
}
await enterCode(attacker.page, "1221");
await attacker.page.locator("form").getByRole("alert").waitFor();
check(
  "잠금: 5번 틀리면 맞는 비밀번호도 15분 동안 거부",
  (await attacker.page.locator("form").getByRole("alert").innerText()).includes("15분"),
);

check("브라우저 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
finish("총 관리자 흐름");
