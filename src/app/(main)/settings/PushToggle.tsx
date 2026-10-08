"use client";

import { useEffect, useState } from "react";
import { sendTestPush } from "@/app/actions/push";
import { BellIcon } from "@/components/icons";
import type { Json } from "@/lib/database.types";
import { getBrowserSupabase } from "@/lib/supabase/client";

type State = "checking" | "unsupported" | "ios-install" | "not-ready" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh/.test(ua)) return "Mac";
  return "기기";
}

async function initialState(): Promise<State> {
  if (!VAPID_PUBLIC_KEY) return "not-ready";
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIOS ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    initialState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const { error } = await getBrowserSupabase().rpc("save_push_subscription", {
        p_endpoint: subscription.endpoint,
        p_subscription: JSON.parse(JSON.stringify(subscription)) as Json,
        p_device: deviceLabel(),
      });
      if (error) throw error;
      setState("on");
      setMessage("알림을 켰습니다.");
    } catch {
      setMessage("알림을 켜지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await getBrowserSupabase().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("알림을 껐습니다.");
    } catch {
      setMessage("알림을 끄지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const result = await sendTestPush();
    setMessage(result.message);
    setBusy(false);
  }

  if (state === "checking") return <p className="text-muted">확인 중...</p>;
  if (state === "not-ready") return <p className="text-muted">아직 알림 기능이 준비되지 않았습니다. 관리자에게 문의해 주세요.</p>;
  if (state === "unsupported") return <p className="text-muted">이 브라우저에서는 알림을 받을 수 없습니다.</p>;
  if (state === "ios-install")
    return (
      <p className="text-muted break-keep">
        iPhone은 아래 안내대로 홈 화면에 앱을 추가한 뒤, 그 앱에서 알림을 켤 수 있습니다.
      </p>
    );
  if (state === "denied")
    return (
      <p className="text-muted break-keep">
        알림이 차단되어 있습니다. 휴대폰 설정에서 이 앱의 알림을 허용한 뒤 다시 열어 주세요.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {state === "on" ? (
        <>
          <p className="flex items-center gap-2 font-semibold text-accent-strong">
            <BellIcon size={22} />이 기기로 알림을 받고 있습니다
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-secondary" onClick={test} disabled={busy}>
              시험 알림
            </button>
            <button type="button" className="btn btn-secondary" onClick={turnOff} disabled={busy}>
              알림 끄기
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn-primary w-full" onClick={turnOn} disabled={busy}>
          <BellIcon size={22} />
          {busy ? "잠시만요..." : "알림 켜기"}
        </button>
      )}
      {message && <p className="text-[0.95rem] text-muted">{message}</p>}
    </div>
  );
}
