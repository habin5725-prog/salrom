import type { Metadata } from "next";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/app";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={72} height={72} className="mx-auto mb-4 rounded-2xl" />
        <h1 className="text-[1.7rem] font-bold">{APP_NAME}</h1>
        <p className="mt-1 text-muted">이번 주 찬양과 악보를 확인하세요</p>
      </div>
      {isSupabaseConfigured() ? (
        <Suspense>
          <LoginForm />
        </Suspense>
      ) : (
        <p className="card p-5 text-muted break-keep">
          서버 연결 정보가 아직 입력되지 않았습니다. README의 설치 안내를 확인해 주세요.
        </p>
      )}
    </main>
  );
}
