"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Status = "connecting" | "live" | "polling" | "offline";

const LABEL: Record<Status, string> = {
  connecting: "연결 중",
  live: "실시간",
  polling: "자동 확인",
  offline: "인터넷 끊김",
};

const HELP: Record<Status, string> = {
  connecting: "서버와 연결하는 중입니다.",
  live: "실시간으로 연결되어 있습니다. 리더가 고친 내용이 바로 이 화면에 반영됩니다.",
  polling: "실시간 연결이 잠시 안 되어 1분마다 새 내용을 확인합니다.",
  offline: "인터넷이 끊겼습니다. 연결되면 자동으로 다시 확인합니다.",
};

const DOT: Record<Status, string> = {
  connecting: "bg-amber-400",
  live: "bg-emerald-500",
  polling: "bg-amber-500",
  offline: "bg-stone-400",
};

function timeText(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(date);
}

/**
 * 화면 위쪽의 작은 실시간 표시등.
 * 예배 순서가 바뀌면(리더가 곡, Key, 순서, 공개를 바꾸면) 화면을 자동으로 새로 고치고 "방금 반영"을 잠시 보여준다.
 */
export function LiveStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [flash, setFlash] = useState(false);
  const [open, setOpen] = useState(false);
  const statusRef = useRef<Status>("connecting");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getBrowserSupabase();
    let debounce: number | undefined;
    let flashTimer: number | undefined;

    const update = (next: Status) => {
      statusRef.current = next;
      setStatus(next);
    };

    const refresh = (changed: boolean) => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        router.refresh();
        setCheckedAt(new Date());
        if (changed) {
          setFlash(true);
          window.clearTimeout(flashTimer);
          flashTimer = window.setTimeout(() => setFlash(false), 4000);
        }
      }, 500);
    };

    const channel = supabase
      .channel("live-site")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => refresh(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "service_songs" }, () => refresh(true))
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          update("live");
          setCheckedAt(new Date());
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          update(navigator.onLine ? "polling" : "offline");
        }
      });

    // 실시간 연결이 안 될 때는 1분마다 새 내용을 확인한다.
    const poll = window.setInterval(() => {
      if (statusRef.current !== "live" && document.visibilityState === "visible" && navigator.onLine) refresh(false);
    }, 60_000);

    // 앱을 다시 열면(다른 앱에 갔다 오면) 바로 최신 내용으로 바꾼다.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh(false);
    };
    const onOffline = () => update("offline");
    const onOnline = () => {
      update("connecting");
      refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearTimeout(debounce);
      window.clearTimeout(flashTimer);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${LABEL[status]}: ${HELP[status]}`}
        className={`flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-[0.8rem] font-semibold whitespace-nowrap ${
          flash ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line bg-surface text-muted"
        }`}
      >
        <span className="relative flex h-2.5 w-2.5">
          {status === "live" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
        </span>
        {flash ? "방금 반영됨" : LABEL[status]}
      </button>
      {open && (
        <div
          role="status"
          className="absolute left-0 top-11 z-40 w-64 rounded-2xl border border-line bg-surface p-3 text-[0.9rem] shadow-lg break-keep"
        >
          <p>{HELP[status]}</p>
          {checkedAt && <p className="mt-1 text-muted">마지막 확인 {timeText(checkedAt)}</p>}
        </div>
      )}
    </div>
  );
}
