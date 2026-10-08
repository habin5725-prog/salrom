"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

// 로그인 후 돌아갈 주소는 같은 사이트 안의 경로만 허용한다.
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function toKoreanError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (/email not confirmed/i.test(message)) return "가입 확인 메일의 링크를 먼저 눌러 주세요.";
  if (/already registered|already been registered/i.test(message)) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (/password should be at least/i.test(message)) return "비밀번호는 6자 이상이어야 합니다.";
  if (/rate limit/i.test(message)) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  return "문제가 생겼습니다. 잠시 후 다시 시도해 주세요.";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const supabase = getBrowserSupabase();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace(safeNext(searchParams.get("next")));
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }
      setNotice("확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.");
      setMode("signin");
    } catch (e) {
      setError(toKoreanError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-page p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`min-h-12 rounded-xl text-base font-semibold ${
              mode === m ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {m === "signin" ? "로그인" : "처음 가입"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="label">
              이름
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              autoComplete="name"
              placeholder="홍길동"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">
            이메일
          </label>
          <input
            id="email"
            className="input"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="name@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            비밀번호
          </label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "6자 이상" : ""}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-danger">
            {error}
          </p>
        )}
        {notice && <p className="rounded-xl bg-accent-soft px-4 py-3 text-accent-strong">{notice}</p>}

        <button type="submit" className="btn btn-primary mt-1 w-full" disabled={busy}>
          {busy ? "잠시만요..." : mode === "signin" ? "로그인" : "가입하기"}
        </button>

        {mode === "signup" ? (
          <p className="text-center text-[0.95rem] text-muted break-keep">
            가입 후 찬양팀 관리자가 승인하면 사용할 수 있습니다.
          </p>
        ) : (
          <p className="text-center text-[0.95rem] text-muted break-keep">
            비밀번호를 잊으셨다면 찬양팀 관리자에게 문의해 주세요.
          </p>
        )}
      </form>
    </div>
  );
}
