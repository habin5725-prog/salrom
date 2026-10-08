// 두 손가락 확대와 태블릿 화면 확인
import { BASE, WORK, check, finish, loadPlaywright, login } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();

const OUT = `${WORK}/shots`;

const browser = await chromium.launch();

// 휴대폰: 두 손가락 벌리기
const { page } = await login(browser, devices["Pixel 7"], "m1@test.kr");
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
await page.screenshot({ path: `${OUT}/20-pinch.png` });

// 태블릿
const { page: tablet } = await login(browser, devices["iPad Pro 11"], "leader@test.kr");
await tablet.waitForTimeout(500);
await tablet.screenshot({ path: `${OUT}/21-tablet-home.png` });
await tablet.goto(`${BASE}/play/40000000-0000-0000-0000-000000000001`);
await tablet.locator("canvas").filter({ visible: true }).first().waitFor({ timeout: 20000 });
await tablet.waitForTimeout(800);
await tablet.screenshot({ path: `${OUT}/22-tablet-viewer.png` });
const tw = (await tablet.locator("canvas").filter({ visible: true }).first().boundingBox()).width;
check("태블릿: 악보가 화면 너비에 맞춤", tw > 700, `width=${tw}`);

await browser.close();
finish("확대와 태블릿 확인");
