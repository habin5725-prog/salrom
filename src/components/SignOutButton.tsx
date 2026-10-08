"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearSheetCache } from "@/lib/sheet-cache";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (!window.confirm("로그아웃할까요?")) return;
    setBusy(true);
    const supabase = getBrowserSupabase();
    try {
      // 이 기기로 오던 알림을 끊고, 기기에 저장해 둔 악보도 지운다.
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      await clearSheetCache();
    } catch {
      // 정리에 실패해도 로그아웃은 진행한다.
    }
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-secondary w-full" onClick={signOut} disabled={busy}>
      {busy ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}
