"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { changeCodeAction, deleteOldLogs } from "@/app/actions/admin";

export function CodeChangeForm({
  role,
  title,
  usingDefault,
  defaultCode,
}: {
  role: "leader" | "admin";
  title: string;
  usingDefault: boolean;
  defaultCode: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const r = await changeCodeAction(role, code, confirm);
    setResult(r);
    setBusy(false);
    if (r.ok) {
      setCode("");
      setConfirm("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-3 p-5">
      <h2 className="text-[1.15rem] font-bold">{title}</h2>
      <p className="text-[0.95rem] text-muted">
        {usingDefault ? `지금 처음 비밀번호(${defaultCode})를 쓰고 있습니다.` : "직접 정한 비밀번호를 쓰고 있습니다."}
      </p>
      <input
        className="input"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        placeholder="새 비밀번호(숫자나 영문 4~20자)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={20}
        required
        aria-label={`${title} 새 비밀번호`}
      />
      <input
        className="input"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        placeholder="한 번 더 입력"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        maxLength={20}
        required
        aria-label={`${title} 새 비밀번호 확인`}
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "바꾸는 중..." : "비밀번호 바꾸기"}
      </button>
      {result && <p className={result.ok ? "text-accent-strong" : "text-danger"}>{result.message}</p>}
      <p className="text-[0.85rem] text-muted break-keep">
        바꿔도 이미 들어와 있는 기기는 그대로 유지됩니다. 새로 들어올 때부터 새 비밀번호가 필요합니다.
      </p>
    </form>
  );
}

export function LogCleanup() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(days: number) {
    const question =
      days > 0 ? `${days}일보다 오래된 접속 기록을 지울까요?` : "접속 기록과 관리 기록을 모두 지울까요? 되돌릴 수 없습니다.";
    if (!window.confirm(question)) return;
    setBusy(true);
    const r = await deleteOldLogs(days);
    setMessage(r.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="text-[1.15rem] font-bold">접속 기록 정리</h2>
      <p className="text-[0.95rem] text-muted break-keep">
        접속 기록은 저장 공간을 조금씩 차지합니다. 오래된 기록은 가끔 지워 주세요.
      </p>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => run(90)}>
        90일 지난 기록 지우기
      </button>
      <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(0)}>
        기록 모두 지우기
      </button>
      {message && <p className="text-muted">{message}</p>}
    </section>
  );
}
