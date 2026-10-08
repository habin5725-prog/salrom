"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getDeviceId, isEmbeddedPreview, setVisitorName } from "@/lib/device";

const SEEN_KEY = "salrom-welcome-seen";

/**
 * 처음 방문했을 때 한 번만 보이는 안내.
 * 이름은 선택이며, 접속 기록을 남긴다는 사실을 알린다.
 */
export function WelcomeSheet() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (isEmbeddedPreview()) return;
    try {
      // 기기 저장 공간은 화면이 뜬 뒤에만 읽을 수 있다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // 저장 공간을 쓸 수 없으면 보여주지 않는다.
    }
  }, []);

  function close(saveName: boolean) {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 무시
    }
    if (saveName && name.trim()) {
      setVisitorName(name);
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "name", deviceId: getDeviceId(), name: name.trim() }),
      }).catch(() => {});
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="처음 오셨네요"
        className="safe-bottom w-full max-w-md rounded-t-3xl bg-surface p-6 shadow-xl sm:rounded-3xl"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          close(true);
        }}
      >
        <h2 className="text-[1.3rem] font-bold">처음 오셨네요</h2>
        <p className="mt-2 font-semibold text-accent-strong break-keep">꼭 실명으로 등록해 주세요!</p>
        <label htmlFor="visitor-name" className="label mt-4">
          이름
        </label>
        <input
          id="visitor-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="예: 홍길동(건반)"
          autoComplete="name"
        />
        <p className="mt-3 rounded-xl bg-page px-4 py-3 text-[0.9rem] text-muted break-keep">
          이 사이트는 운영을 위해 접속 기록(기기 종류, 대략적인 지역, 접속 시각, 본 화면과 머문 시간)을 저장하며 총
          관리자만 볼 수 있습니다.
        </p>
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
            건너뛰기
          </button>
          <button type="submit" className="btn btn-primary">
            확인
          </button>
        </div>
      </form>
    </div>
  );
}
