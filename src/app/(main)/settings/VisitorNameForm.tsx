"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getDeviceId, getVisitorName, setVisitorName } from "@/lib/device";

export function VisitorNameForm() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // 기기에 저장한 이름은 화면이 뜬 뒤에만 읽을 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(getVisitorName());
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setVisitorName(name);
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "name", deviceId: getDeviceId(), name: name.trim() }),
    }).catch(() => {});
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        className="input"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        maxLength={40}
        placeholder="예: 홍길동(건반)"
        aria-label="내 이름"
      />
      <button type="submit" className="btn btn-secondary">
        {saved ? "저장했습니다" : "저장"}
      </button>
    </form>
  );
}
