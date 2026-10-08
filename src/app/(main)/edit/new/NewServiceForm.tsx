"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatServiceDate } from "@/lib/dates";
import { getBrowserSupabase } from "@/lib/supabase/client";

const TITLE_PRESETS = ["주일예배", "수요예배", "금요기도회", "특별예배"];

export function NewServiceForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [title, setTitle] = useState("주일예배");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { data, error } = await getBrowserSupabase()
      .from("services")
      .insert({ service_date: date, title: title.trim() || "주일예배" })
      .select("id")
      .single();
    if (error || !data) {
      setError("만들지 못했습니다. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    router.replace(`/edit/${data.id}`);
    router.refresh();
  }

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-5 p-5">
      <div>
        <label htmlFor="service-date" className="label">
          1. 예배 날짜
        </label>
        <input
          id="service-date"
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        {validDate && <p className="mt-2 text-[1.05rem] font-semibold text-accent-strong">{formatServiceDate(date, { withYear: true })}</p>}
      </div>

      <div>
        <label htmlFor="service-title" className="label">
          2. 예배 이름
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {TITLE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setTitle(preset)}
              aria-pressed={title === preset}
              className={`min-h-11 rounded-xl border px-3 font-semibold ${
                title === preset ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          id="service-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          required
        />
      </div>

      {error && <p className="text-danger">{error}</p>}

      <button type="submit" className="btn btn-primary w-full" disabled={busy || !validDate}>
        {busy ? "만드는 중..." : "만들고 곡 추가하기"}
      </button>
      <p className="text-center text-[0.95rem] text-muted break-keep">
        만든 예배는 공개하기 전까지 팀원에게 보이지 않습니다.
      </p>
    </form>
  );
}
