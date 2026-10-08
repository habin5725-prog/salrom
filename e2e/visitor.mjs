// 로그인 없는 방문자(팀원) 흐름 브라우저 검증
import { BASE, WORK, check, collectErrors, finish, loadPlaywright, openDevice, sql, visible } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();
const OUT = `${WORK}/shots`;

const browser = await chromium.launch();
const { page } = await openDevice(browser, devices["Pixel 7"], { welcome: true });
const errors = [];
collectErrors(page, errors);

/** 이 기기(브라우저)에 저장된 개인 필기 수 */
const localNoteCount = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("salrom", 1);
        req.onsuccess = () => {
          const tx = req.result.transaction("personal-notes", "readonly");
          const count = tx.objectStore("personal-notes").count();
          count.onsuccess = () => resolve(count.result);
        };
        req.onerror = () => resolve(-1);
      }),
  );

// 사이트를 누르면 바로 들어온다(로그인 없음). 처음 방문 안내에서 이름을 적는다.
await page.goto(`${BASE}/`);
const welcome = page.getByRole("dialog", { name: "처음 오셨네요" });
await welcome.waitFor();
await page.screenshot({ path: `${OUT}/01-welcome.png` });
check("처음 방문: 접속 기록 안내 문구", (await welcome.getByText("접속 기록").count()) === 1);
await welcome.locator("#visitor-name").fill("김집사(건반)");
await welcome.getByRole("button", { name: "확인" }).click();
await welcome.waitFor({ state: "detached" });

await visible(page.getByText("주님의 은혜")).first().waitFor();
await page.screenshot({ path: `${OUT}/02-home.png`, fullPage: true });
check("홈: 로그인 없이 이번 주 찬양", await page.getByRole("heading", { name: "이번 주 찬양" }).isVisible());
check("홈: 곡 2개", (await visible(page.getByText("악보 보기")).count()) === 2);
check("홈: 위쪽 로그인 버튼", (await visible(page.getByRole("link", { name: "로그인" })).count()) === 1);
check("홈: 방문자에게 편집 버튼 없음", (await visible(page.getByText("이번 주 편집")).count()) === 0);
const live = visible(page.getByRole("button", { name: /연결 중|실시간|자동 확인|인터넷 끊김/ }));
check("홈: 실시간 표시등", (await live.count()) === 1);
await live.click();
check("홈: 표시등 설명", (await visible(page.getByRole("status")).filter({ hasText: /연결|확인|인터넷/ }).count()) >= 1);
await live.click();

// 악보 보기
await visible(page.getByText("악보 보기")).first().click();
await page.waitForURL(/\/play\//);
await visible(page.locator("canvas")).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/03-viewer.png` });
check("악보: 2쪽 모두 그림", (await visible(page.locator("canvas")).count()) === 2);

// 개인 필기: 펜(이 기기에만 저장)
await visible(page.getByRole("button", { name: "필기" })).click();
check("필기: 방문자는 공용 필기 선택 없음", (await page.getByRole("radio", { name: /공용 필기/ }).count()) === 0);
const svg = visible(page.locator("svg[viewBox^='0 0 1']")).first();
const box = await svg.boundingBox();
await page.mouse.move(box.x + 60, box.y + 200);
await page.mouse.down();
for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + 60 + i * 8, box.y + 200 + Math.sin(i / 3) * 20);
await page.mouse.up();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/04-pen.png` });
check("필기: 펜 선이 그려짐", (await svg.locator("path").count()) >= 1);
check("필기: 이 기기에 저장", (await localNoteCount()) === 1);
check("필기: 서버에는 저장하지 않음", sql("select count(*) from annotations") === "0");

// 글자와 되돌리기
await visible(page.getByRole("button", { name: "글자" })).click();
await page.mouse.click(box.x + 100, box.y + 320);
await page.getByRole("dialog").locator("input").fill("카포 2");
await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
await page.waitForTimeout(500);
check("필기: 글자", (await svg.locator("text", { hasText: "카포 2" }).count()) === 1);
await visible(page.getByRole("button", { name: "되돌리기" })).click();
await page.waitForTimeout(500);
check("되돌리기: 글자 사라짐", (await svg.locator("text", { hasText: "카포 2" }).count()) === 0 && (await localNoteCount()) === 1);

// 새로고침해도 필기 유지
await visible(page.getByRole("button", { name: "완료" })).click();
await page.reload();
await visible(page.locator("canvas")).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
check("새로고침: 개인 필기 유지", (await visible(page.locator("svg[viewBox^='0 0 1']")).first().locator("path").count()) >= 1);

// 지우개와 되돌리기
await visible(page.getByRole("button", { name: "필기" })).click();
await visible(page.getByRole("button", { name: "지우개" })).click();
const box2 = await visible(page.locator("svg[viewBox^='0 0 1']")).first().boundingBox();
await page.mouse.move(box2.x + 100, box2.y + 150);
await page.mouse.down();
for (let i = 0; i <= 15; i++) await page.mouse.move(box2.x + 100, box2.y + 150 + i * 8);
await page.mouse.up();
await page.waitForTimeout(500);
check("지우개: 기기에서 삭제", (await localNoteCount()) === 0);
await visible(page.getByRole("button", { name: "되돌리기" })).click();
await page.waitForTimeout(500);
check("지우개 되돌리기", (await localNoteCount()) === 1);
await visible(page.getByRole("button", { name: "완료" })).click();

// 확대와 다음 곡
const before = (await visible(page.locator("canvas")).first().boundingBox()).width;
await visible(page.getByRole("button", { name: "크게" })).click();
await page.waitForTimeout(600);
const after = (await visible(page.locator("canvas")).first().boundingBox()).width;
check("확대: 악보가 커짐", after > before * 1.2, `${before} -> ${after}`);
await visible(page.getByRole("link", { name: /다음 곡/ })).click();
await page.waitForURL(/40000000-0000-0000-0000-000000000002/);
await visible(page.locator("canvas")).first().waitFor({ timeout: 20000 });
check("다음 곡: 두 번째 곡", await visible(page.getByText("은혜 아니면")).first().isVisible());
await page.waitForTimeout(1500);

// 악보함, 지난 예배, 설정
await page.goto(`${BASE}/library`);
await page.getByRole("searchbox").fill("ㅇㅎㅇ");
await page.waitForTimeout(300);
check("악보함: 초성 검색", (await visible(page.getByText("은혜 아니면")).count()) === 1 && (await visible(page.getByText("주님의 은혜")).count()) === 0);
await page.goto(`${BASE}/history`);
await page.getByRole("link").filter({ hasText: "주일예배" }).first().waitFor();
check("지난 예배: 1건", (await visible(page.getByRole("link").filter({ hasText: "주일예배" })).count()) === 1);
await page.goto(`${BASE}/settings`);
await visible(page.getByText("관리 모드")).first().waitFor();
await page.screenshot({ path: `${OUT}/09-settings.png`, fullPage: true });
check("설정: 내 이름 저장되어 있음", (await page.getByLabel("내 이름").inputValue()) === "김집사(건반)");

// 편집 화면은 비밀번호가 필요하다
await page.goto(`${BASE}/edit`);
await page.waitForURL(/\/login/);
check("권한: 방문자는 편집 화면 대신 로그인 화면", new URL(page.url()).searchParams.get("next") === "/edit");
await page.locator("#code").fill("0000");
await page.getByRole("button", { name: "들어가기" }).click();
await page.locator("form").getByRole("alert").waitFor();
check("로그인: 틀린 비밀번호 안내", (await page.locator("form").getByRole("alert").innerText()).includes("맞지 않습니다"));
check("로그인: 실패 기록", sql("select count(*) from access_events where kind='login_fail'") === "1");
await page.screenshot({ path: `${OUT}/10-login.png` });

// 접속 기록
await page.goto(`${BASE}/`);
await page.waitForTimeout(1500);
check("기록: 이름", sql("select name from visitors where name is not null limit 1") === "김집사(건반)");
const labels = sql("select string_agg(distinct label, '|') from page_views");
check("기록: 본 화면", labels.includes("홈") && labels.includes("악보: 주님의 은혜") && labels.includes("악보함"), labels);
check("기록: 기기 종류", sql("select device from visitors limit 1").includes("Android"), sql("select device from visitors limit 1"));

check("브라우저 오류 없음", errors.length === 0, errors.join(" | "));
await browser.close();
finish("방문자 흐름");
