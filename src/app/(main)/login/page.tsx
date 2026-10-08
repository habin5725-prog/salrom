import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExitModeButton } from "@/components/ExitModeButton";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getViewer } from "@/lib/auth";
import { CodeForm } from "./CodeForm";

export const metadata: Metadata = { title: "관리자 로그인" };

export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginContent />
    </Suspense>
  );
}

async function LoginContent() {
  const viewer = await getViewer();

  if (viewer.mode !== "visitor") {
    return (
      <>
        <PageHeader title={viewer.mode === "admin" ? "총 관리자 모드" : "리더 모드"} />
        <section className="card flex flex-col gap-3 p-5">
          <p className="text-muted">지금 {viewer.mode === "admin" ? "총 관리자" : "리더"} 모드로 사용 중입니다.</p>
          <Link href={viewer.mode === "admin" ? "/admin" : "/edit"} className="btn btn-primary w-full">
            {viewer.mode === "admin" ? "관리자 화면으로" : "예배 편집으로"}
          </Link>
          <ExitModeButton />
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="관리자 로그인" />
      <Suspense>
        <CodeForm />
      </Suspense>
      <p className="mt-4 px-1 text-[0.95rem] text-muted break-keep">
        악보를 보거나 필기하는 데는 로그인이 필요 없습니다. 예배 편집은 찬양팀 리더 비밀번호, 사이트 전체 관리는 총 관리자
        비밀번호로 들어갑니다.
      </p>
    </>
  );
}
