"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { exitMode } from "@/app/actions/mode";

/** 리더 모드나 총 관리자 모드에서 나와 일반 화면으로 돌아간다. */
export function ExitModeButton({ className = "btn btn-secondary w-full" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function exit() {
    setBusy(true);
    await exitMode();
    router.replace("/");
    router.refresh();
  }

  return (
    <button type="button" className={className} onClick={exit} disabled={busy}>
      {busy ? "나가는 중..." : "관리 모드에서 나가기"}
    </button>
  );
}
