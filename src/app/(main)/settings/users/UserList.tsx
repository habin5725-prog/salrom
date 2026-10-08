"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/permissions";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Profile = { id: string; name: string; role: Role; instrument: string | null };

const ROLE_HELP: Record<Role, string> = {
  pending: "아무것도 볼 수 없음",
  member: "악보 보기와 개인 필기",
  leader: "예배 편집, 공용 필기, 알림",
  admin: "리더 기능 + 사용자 관리",
};

export function UserList({ currentUserId, profiles }: { currentUserId: string; profiles: Profile[] }) {
  const router = useRouter();
  const [items, setItems] = useState(profiles);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function changeRole(profile: Profile, role: Role) {
    if (role === profile.role) return;
    if (profile.id === currentUserId && role !== "admin") {
      if (!window.confirm("내 권한을 낮추면 사용자 관리를 더 이상 할 수 없습니다. 계속할까요?")) return;
    }
    setBusyId(profile.id);
    setMessage("");
    const { error } = await getBrowserSupabase().from("profiles").update({ role }).eq("id", profile.id);
    setBusyId(null);
    if (error) {
      setMessage(
        error.message.includes("마지막 총 관리자")
          ? "마지막 총 관리자는 바꿀 수 없습니다. 다른 사람을 먼저 총 관리자로 지정해 주세요."
          : "바꾸지 못했습니다. 다시 시도해 주세요.",
      );
      return;
    }
    setItems((list) => list.map((p) => (p.id === profile.id ? { ...p, role } : p)));
    setMessage(`${profile.name || "사용자"}님을 ${ROLE_LABEL[role]}(으)로 바꿨습니다.`);
    router.refresh();
  }

  const pending = items.filter((p) => p.role === "pending");
  const others = items.filter((p) => p.role !== "pending");

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <p role="status" className="rounded-xl bg-accent-soft px-4 py-3 text-accent-strong">
          {message}
        </p>
      )}

      <section>
        <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">승인 대기 {pending.length}명</h2>
        {pending.length === 0 ? (
          <p className="card px-5 py-5 text-center text-muted">승인을 기다리는 사람이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((p) => (
              <li key={p.id} className="card flex items-center gap-3 px-4 py-4">
                <span className="min-w-0 flex-1 text-[1.1rem] font-semibold">{p.name || "(이름 없음)"}</span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busyId === p.id}
                  onClick={() => changeRole(p, "member")}
                >
                  팀원으로 승인
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">팀 {others.length}명</h2>
        <ul className="flex flex-col gap-3">
          {others.map((p) => (
            <li key={p.id} className="card px-4 py-4">
              <p className="text-[1.1rem] font-semibold">
                {p.name || "(이름 없음)"}
                {p.id === currentUserId && <span className="ml-1 text-[0.9rem] text-muted">(나)</span>}
              </p>
              {p.instrument && <p className="text-[0.95rem] text-muted">{p.instrument}</p>}
              <label className="label mt-3" htmlFor={`role-${p.id}`}>
                권한
              </label>
              <select
                id={`role-${p.id}`}
                className="input"
                value={p.role}
                disabled={busyId === p.id}
                onChange={(e) => changeRole(p, e.target.value as Role)}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role === "pending" ? "사용 중지" : ROLE_LABEL[role]} - {ROLE_HELP[role]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
