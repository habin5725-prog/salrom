"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function ProfileForm({
  userId,
  initialName,
  initialInstrument,
}: {
  userId: string;
  initialName: string;
  initialInstrument: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [instrument, setInstrument] = useState(initialInstrument);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    const { error } = await getBrowserSupabase()
      .from("profiles")
      .update({ name: name.trim(), instrument: instrument.trim() || null })
      .eq("id", userId);
    setStatus(error ? "error" : "saved");
    if (!error) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="profile-name" className="label">
          이름
        </label>
        <input
          id="profile-name"
          className="input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus("idle");
          }}
          required
          maxLength={40}
        />
      </div>
      <div>
        <label htmlFor="profile-instrument" className="label">
          악기 또는 파트
        </label>
        <input
          id="profile-instrument"
          className="input"
          value={instrument}
          onChange={(e) => {
            setInstrument(e.target.value);
            setStatus("idle");
          }}
          maxLength={40}
          placeholder="예: 건반, 드럼, 싱어"
        />
      </div>
      <button type="submit" className="btn btn-secondary" disabled={status === "saving"}>
        {status === "saving" ? "저장 중..." : status === "saved" ? "저장했습니다" : "저장"}
      </button>
      {status === "error" && <p className="text-danger">저장하지 못했습니다. 다시 시도해 주세요.</p>}
    </form>
  );
}
