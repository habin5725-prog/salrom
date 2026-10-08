import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExitModeButton } from "@/components/ExitModeButton";
import { ChevronRightIcon } from "@/components/icons";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getViewer } from "@/lib/auth";
import { getVapidKeys } from "@/lib/settings";
import { InstallGuide } from "./InstallGuide";
import { PushToggle } from "./PushToggle";
import { VisitorNameForm } from "./VisitorNameForm";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsContent />
    </Suspense>
  );
}

function MenuLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="card flex min-h-[4.5rem] items-center gap-3 px-5 py-3 active:bg-page">
      <span className="min-w-0 flex-1">
        <span className="block text-[1.1rem] font-semibold">{title}</span>
        <span className="block text-[0.95rem] text-muted">{description}</span>
      </span>
      <ChevronRightIcon className="text-faint" />
    </Link>
  );
}

async function SettingsContent() {
  const [viewer, vapid] = await Promise.all([getViewer(), getVapidKeys()]);

  return (
    <>
      <PageHeader title="설정" />

      <div className="flex flex-col gap-4">
        {viewer.mode === "admin" && (
          <MenuLink href="/admin" title="관리자 화면" description="접속 기록, 비밀번호, 곡 관리" />
        )}
        {viewer.mode !== "visitor" && (
          <MenuLink href="/edit" title="예배 관리" description="예배 만들기, 곡 순서와 악보 올리기, 공개" />
        )}

        <section className="card p-5">
          <h2 className="mb-1 text-[1.15rem] font-bold">관리 모드</h2>
          {viewer.mode === "visitor" ? (
            <>
              <p className="mb-4 text-[0.95rem] text-muted break-keep">
                예배를 편집하려면 찬양팀 리더 비밀번호, 사이트 전체를 관리하려면 총 관리자 비밀번호로 들어갑니다.
              </p>
              <Link href="/login" className="btn btn-secondary w-full">
                로그인
              </Link>
            </>
          ) : (
            <>
              <p className="mb-4 text-[0.95rem] text-muted">
                지금 {viewer.mode === "admin" ? "총 관리자" : "리더"} 모드입니다.
              </p>
              <ExitModeButton />
            </>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 text-[1.15rem] font-bold">내 이름</h2>
          <p className="mb-4 text-[1rem] font-semibold text-accent-strong break-keep">꼭 실명으로 등록해 주세요!</p>
          <VisitorNameForm />
        </section>

        <section className="card p-5">
          <h2 className="mb-1 text-[1.15rem] font-bold">알림</h2>
          <p className="mb-4 text-[0.95rem] text-muted break-keep">
            리더가 이번 주 찬양을 공개하면 이 기기로 알려 드립니다.
          </p>
          <PushToggle vapidPublicKey={vapid?.publicKey ?? null} />
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-[1.15rem] font-bold">홈 화면에 앱 추가</h2>
          <InstallGuide />
        </section>

        <section className="card p-5 text-[0.95rem] text-muted break-keep">
          <h2 className="mb-2 text-[1.15rem] font-bold text-ink">알아 두세요</h2>
          <p>내가 적은 개인 필기는 이 기기에만 저장됩니다. 다른 기기에서는 보이지 않고, 브라우저 기록을 지우면 함께 지워집니다.</p>
          <p className="mt-2">
            이 사이트는 운영을 위해 접속 기록(기기 종류, 대략적인 지역, 접속 시각, 본 화면과 머문 시간)을 저장하며 총
            관리자만 볼 수 있습니다.
          </p>
          <Link href="/preview" className="btn btn-secondary btn-sm mt-4 w-full">
            휴대폰, 패드, 노트북 화면 미리보기
          </Link>
        </section>
      </div>
    </>
  );
}
