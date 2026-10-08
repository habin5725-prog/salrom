"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { enterMode } from "@/app/actions/mode";
import { getDeviceId } from "@/lib/device";

// 들어간 뒤 돌아갈 주소는 같은 사이트 안의 경로만 허용한다.
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function CodeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needAdmin = searchParams.get("need") === "admin";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    // 관리 기록에 이 기기를 남기기 위해 기기 ID 쿠키를 먼저 둔다.
    getDeviceId();
    const result = await enterMode(code);
    if (!result.ok) {
      setError(result.message);
      setCode("");
      setBusy(false);
      return;
    }
    const next = safeNext(searchParams.get("next"));
    const fallback = result.mode === "admin" ? "/admin" : "/edit";
    router.replace(next && !(next.startsWith("/admin") && result.mode !== "admin") ? next : fallback);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4 p-5">
      {needAdmin && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900 break-keep">
          이 화면은 총 관리자 비밀번호가 필요합니다.
        </p>
      )}
      <div>
        <label htmlFor="code" className="label">
          비밀번호
        </label>
        <input
          id="code"
          className="input text-center text-[1.6rem] tracking-[0.4em]"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={20}
          required
          autoFocus
          aria-describedby="code-help"
        />
        <p id="code-help" className="mt-2 text-[0.9rem] text-muted">
          찬양팀 리더 또는 총 관리자 비밀번호를 입력하세요.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-danger break-keep">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={busy || code.length === 0}>
        {busy ? "확인 중..." : "들어가기"}
      </button>
    </form>
  );
}
