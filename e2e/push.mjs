// 알림 발송과 서비스 워커 알림 표시 검증
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import { BASE, WORK, check, enterCode, finish, loadPlaywright, openDevice, sql } from "./lib.mjs";

const { chromium, devices } = await loadPlaywright();

const OUT = `${WORK}/shots`;
const E = WORK;
const DRAFT = "10000000-0000-0000-0000-000000000003";
const pushLog = () =>
  new Promise((resolve) =>
    https.get("https://localhost:54400/log", { ca: fs.readFileSync(`${E}/push-cert.pem`) }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(JSON.parse(body)));
    }),
  );

// 팀원 기기 2대(정상 1, 만료 1)의 구독을 만든다.
function subscription(endpoint) {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return JSON.stringify({
    endpoint,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") },
  });
}
// 다른 기기 2대(정상 1, 만료 1)의 구독을 만든다.
sql("delete from push_subscriptions");
for (const ep of ["https://localhost:54400/ok", "https://localhost:54400/gone"]) {
  sql(`insert into push_subscriptions (device_id, endpoint, subscription, device) values (gen_random_uuid(), '${ep}', '${subscription(ep)}', 'test')`);
}

const browser = await chromium.launch({ channel: "chromium" });
const { page } = await openDevice(browser, devices["Pixel 7"]);
await enterCode(page, "1234");
await page.waitForURL(`${BASE}/edit`);
// 리더 자신의 기기에는 보내지 않아야 한다.
const leaderDevice = await page.evaluate(() => localStorage.getItem("salrom-device-id"));
sql(`insert into push_subscriptions (device_id, endpoint, subscription, device) values ('${leaderDevice}', 'https://localhost:54400/leader', '${subscription("https://localhost:54400/leader")}', 'test')`);

// 초안 공개(알림 보내기)
await page.goto(`${BASE}/edit/${DRAFT}`);
await page.getByRole("button", { name: "이번 주 찬양 공개" }).filter({ visible: true }).click();
await page.getByRole("dialog").getByRole("button", { name: "공개", exact: true }).click();
const status = page.getByRole("status").filter({ visible: true }).last();
await status.waitFor();
const message = await status.innerText();
await page.screenshot({ path: `${OUT}/40-published-push.png` });
check("공개 알림: 결과 안내", message.includes("기기 1대에 알림을 보냈습니다"), message);

const log = await pushLog();
const ok = log.filter((r) => r.url === "/ok");
check("공개 알림: 팀원 기기에 1번 발송", ok.length === 1, JSON.stringify(log));
check("공개 알림: 보낸 리더 자신에게는 안 보냄", log.every((r) => r.url !== "/leader"));
check("공개 알림: VAPID 인증과 암호화", ok[0]?.authorization.startsWith("vapid t=") && ok[0]?.encoding === "aes128gcm" && ok[0]?.ttl === "86400", JSON.stringify(ok[0]));
check("공개 알림: 만료된 구독 정리", sql("select count(*) from push_subscriptions where endpoint like '%/gone'") === "0");
check("공개 알림: 발송 시각 기록", sql(`select notified_at is not null from services where id='${DRAFT}'`) === "t");

// 1분 안에 변경 알림을 또 누르면 보내지 않는다.
await page.getByRole("button", { name: "팀원에게 변경 알림 보내기" }).filter({ visible: true }).click();
await page.getByRole("dialog").getByRole("button", { name: "알림 보내기" }).click();
await page.waitForTimeout(1500);
const again = await page.getByRole("status").filter({ visible: true }).last().innerText();
check("연속 알림 방지: 안내 문구", again.includes("방금 알림을 보냈습니다"), again);
check("연속 알림 방지: 추가 발송 없음", (await pushLog()).filter((r) => r.url === "/ok").length === 1);

// 서비스 워커: 푸시를 받으면 알림을 띄우고 예배 화면 주소를 담는다.
// headless shell 에서는 알림이 표시되지 않으므로 run.sh 는 chromium 채널로 실행한다.
const { context: member, page: mp } = await openDevice(browser, devices["Pixel 7"], { permissions: ["notifications"] });
await mp.goto(`${BASE}/`);
await mp.evaluate(() => navigator.serviceWorker.ready);
const cdp = await member.newCDPSession(mp);
const registrations = [];
cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => registrations.push(...e.registrations));
await cdp.send("ServiceWorker.enable");
await mp.waitForTimeout(500);
const reg = registrations.find((r) => r.scopeURL === `${BASE}/`);
check("서비스 워커 등록", Boolean(reg));
if (reg) {
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: BASE,
    registrationId: reg.registrationId,
    data: JSON.stringify({ title: "이번 주 찬양이 올라왔습니다", body: "10월 18일 (일) 주일예배 · 1곡", url: `/services/${DRAFT}`, tag: `service-${DRAFT}` }),
  });
  await mp.waitForTimeout(1000);
  const shown = await mp.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return (await r.getNotifications()).map((n) => ({ title: n.title, body: n.body, url: n.data?.url, tag: n.tag }));
  });
  check(
    "서비스 워커: 알림 표시와 이동 주소",
    shown.length === 1 && shown[0].title === "이번 주 찬양이 올라왔습니다" && shown[0].url === `/services/${DRAFT}`,
    JSON.stringify(shown),
  );
}

await browser.close();
finish("알림 확인");
