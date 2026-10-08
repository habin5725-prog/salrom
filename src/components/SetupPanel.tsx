"use client";

import { useState } from "react";
import { prepareSite } from "@/app/actions/mode";

export function SetupPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setBusy(true);
    setMessage("");
    const result = await prepareSite();
    if (result.ok) {
      window.location.reload();
      return;
    }
    setMessage(result.message);
    setBusy(false);
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <button type="button" className="btn btn-primary w-full" onClick={run} disabled={busy}>
        {busy ? "준비하는 중..." : "사이트 준비하기"}
      </button>
      {message && <p className="rounded-xl bg-red-50 px-4 py-3 text-danger break-keep">{message}</p>}
    </div>
  );
}
