// 두 손가락 확대와 태블릿 화면 확인
import { BASE, WORK, check, enterCode, finish, loadPlaywright, openDevice } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();

const OUT = `${WORK}/shots`;

const browser = await chromium.launch();

// 휴대폰: 두 손가락 벌리기
const { page } = await openDevice(browser, devices["Pixel 7"]);
await page.goto(`${BASE}/play/40000000-0000-0000-0000-000000000002`);
await page.locator("canvas").filter({ visible: true }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(500);
const before = (await page.locator("canvas").filter({ visible: true }).first().boundingBox()).width;

await page.evaluate(async () => {
  const el = document.querySelector("div.overflow-auto");
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const touch = (id, x, y) => new Touch({ identifier: id, target: el, clientX: x, clientY: y });
  const fire = (type, touches) =>
    el.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches, changedTouches: touches, bubbles: true, cancelable: true }));
  fire("touchstart", [touch(1, cx - 40, cy), touch(2, cx + 40, cy)]);
  for (let i = 1; i <= 10; i++) {
    fire("touchmove", [touch(1, cx - 40 - i * 8, cy), touch(2, cx + 40 + i * 8, cy)]);
    await new Promise((r) => setTimeout(r, 16));
  }
  fire("touchend", []);
});
await page.waitForTimeout(800);
const after = (await page.locator("canvas").filter({ visible: true }).first().boundingBox()).width;
check("두 손가락 확대: 손가락 간격 3배 → 악보 3배", after > before * 2.8 && after < before * 3.2, `${before} -> ${after}`);
const scrollLeft = await page.evaluate(() => document.querySelector("div.overflow-auto").scrollLeft);
check("두 손가락 확대: 가운데 기준으로 확대(가로 스크롤 이동)", scrollLeft > 50, `scrollLeft=${scrollLeft}`);
await page.screenshot({ path: `${OUT}/30-pinch.png` });

// 태블릿
const { page: tablet } = await openDevice(browser, devices["iPad Pro 11"]);
await enterCode(tablet, "1234");
await tablet.waitForURL(`${BASE}/edit`);
await tablet.goto(`${BASE}/`);
await tablet.waitForTimeout(500);
await tablet.screenshot({ path: `${OUT}/31-tablet-home.png` });
await tablet.goto(`${BASE}/play/40000000-0000-0000-0000-000000000001`);
await tablet.locator("canvas").filter({ visible: true }).first().waitFor({ timeout: 20000 });
await tablet.waitForTimeout(800);
await tablet.screenshot({ path: `${OUT}/32-tablet-viewer.png` });
const tw = (await tablet.locator("canvas").filter({ visible: true }).first().boundingBox()).width;
check("태블릿: 악보가 화면 너비에 맞춤", tw > 700, `width=${tw}`);

// 노트북: 위쪽 메뉴, 아래쪽 메뉴 없음
const { page: laptop } = await openDevice(browser, { viewport: { width: 1440, height: 900 } });
await laptop.goto(`${BASE}/`);
await laptop.getByRole("heading", { name: "이번 주 찬양" }).waitFor();
await laptop.screenshot({ path: `${OUT}/33-laptop-home.png` });
const navs = await laptop.getByRole("navigation", { name: "주요 메뉴" }).evaluateAll((els) =>
  els.map((el) => getComputedStyle(el).display),
);
check("노트북: 위쪽 메뉴만 보임", navs.filter((d) => d !== "none").length === 1, JSON.stringify(navs));
check("노트북: 위쪽 메뉴에 악보함", await laptop.getByRole("link", { name: "악보함" }).first().isVisible());

await browser.close();
finish("확대와 태블릿 확인");
