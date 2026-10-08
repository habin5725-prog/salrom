"use client";

import { useState } from "react";
import { normalizeKey } from "@/lib/setlist";

const COMMON_KEYS = ["C", "D", "E", "F", "G", "A", "B"] as const;

/**
 * Key 선택. 자주 쓰는 Key는 한 번 눌러 고르고, 그 밖의 Key(Bb, F#m, G→A 등)는 직접 입력한다.
 * onCommit은 버튼을 누르거나 입력을 마쳤을 때(포커스가 빠질 때, Enter) 한 번만 불린다.
 */
export function KeyPicker({
  value,
  onCommit,
  disabled,
}: {
  value: string;
  onCommit: (key: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  // 바깥에서 값이 바뀌면 입력칸도 맞춘다.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  function commit(next: string) {
    const normalized = normalizeKey(next);
    setDraft(normalized);
    if (normalized !== value) onCommit(normalized);
  }

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {COMMON_KEYS.map((key) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => commit(selected ? "" : key)}
              className={`min-h-12 rounded-xl border text-[1.1rem] font-bold ${
                selected ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>
      <input
        className="input"
        value={draft}
        disabled={disabled}
        maxLength={12}
        placeholder="직접 입력 (예: Bb, F#m)"
        aria-label="Key 직접 입력"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}
