import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { getMember } from "@/lib/auth";
import { ROLE_LABEL, canEditServices, canManageUsers } from "@/lib/permissions";
import { InstallGuide } from "./InstallGuide";
import { ProfileForm } from "./ProfileForm";
import { PushToggle } from "./PushToggle";

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
  const user = await getMember();
  if (!user) return null;

  return (
    <>
      <PageHeader title="설정" />

      <div className="flex flex-col gap-4">
        {canEditServices(user.role) && (
          <MenuLink href="/edit" title="예배 관리" description="예배 만들기, 곡 순서와 악보 올리기" />
        )}
        {canManageUsers(user.role) && (
          <MenuLink href="/settings/users" title="사용자 관리" description="가입 승인과 권한 변경" />
        )}

        <section className="card p-5">
          <h2 className="mb-1 text-[1.15rem] font-bold">내 정보</h2>
          <p className="mb-4 text-[0.95rem] text-muted">
            {user.email} · {ROLE_LABEL[user.role]}
          </p>
          <ProfileForm userId={user.id} initialName={user.name} initialInstrument={user.instrument ?? ""} />
        </section>

        <section className="card p-5">
          <h2 className="mb-1 text-[1.15rem] font-bold">알림</h2>
          <p className="mb-4 text-[0.95rem] text-muted break-keep">
            리더가 이번 주 찬양을 공개하면 이 기기로 알려 드립니다.
          </p>
          <PushToggle />
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-[1.15rem] font-bold">홈 화면에 앱 추가</h2>
          <InstallGuide />
        </section>

        <SignOutButton />
      </div>
    </>
  );
}
