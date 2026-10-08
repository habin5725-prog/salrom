import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getAdmin } from "@/lib/auth";
import { usingDefaultCode } from "@/lib/settings";
import { CodeChangeForm, LogCleanup } from "./AdminSettingsForms";

export const metadata: Metadata = { title: "관리자 설정" };

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminSettingsContent />
    </Suspense>
  );
}

async function AdminSettingsContent() {
  await getAdmin("/admin/settings");
  const [leaderDefault, adminDefault] = await Promise.all([usingDefaultCode("leader"), usingDefaultCode("admin")]);

  return (
    <>
      <PageHeader title="비밀번호와 기록 설정" back={{ href: "/admin", label: "관리자 화면" }} />
      <div className="flex flex-col gap-4">
        <CodeChangeForm role="leader" title="찬양팀 리더 비밀번호" usingDefault={leaderDefault} defaultCode="1234" />
        <CodeChangeForm role="admin" title="총 관리자 비밀번호" usingDefault={adminDefault} defaultCode="1221" />
        <LogCleanup />
      </div>
    </>
  );
}
