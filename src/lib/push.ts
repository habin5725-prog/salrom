import "server-only";

import webpush, { type PushSubscription } from "web-push";

// Web Push(VAPID) 발송. 별도 유료 서비스 없이 브라우저 기본 푸시 서버를 사용한다.

export type PushPayload = {
  title: string;
  body: string;
  /** 알림을 눌렀을 때 열 화면 */
  url: string;
  /** 같은 tag의 알림은 하나로 합쳐진다. */
  tag: string;
};

export type PushTarget = { endpoint: string; subscription: unknown };

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

function isSubscription(value: unknown): value is PushSubscription {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  return typeof v.endpoint === "string" && typeof v.keys?.p256dh === "string" && typeof v.keys?.auth === "string";
}

/**
 * 구독 목록으로 알림을 보낸다.
 * expired: 기기에서 알림을 끄거나 앱을 지워 더 이상 받을 수 없는 구독(삭제 대상)
 */
export async function sendPush(
  targets: PushTarget[],
  payload: PushPayload,
): Promise<{ sent: number; failed: number; expired: string[] }> {
  configure();
  const body = JSON.stringify(payload);
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    targets.map(async (target) => {
      if (!isSubscription(target.subscription)) {
        expired.push(target.endpoint);
        return;
      }
      try {
        // 하루 안에 기기가 켜지지 않으면 버린다.
        await webpush.sendNotification(target.subscription, body, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(target.endpoint);
        else failed++;
      }
    }),
  );

  return { sent, failed, expired };
}
