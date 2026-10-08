import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { isApproved } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ReloadButton } from "./ReloadButton";
import { SignOutButton } from "./SignOutButton";

/** 로그인과 승인 여부를 확인한 뒤에만 화면을 보여준다. */
export async function AccessGate({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isApproved(user.role)) return <PendingNotice name={user.name} />;

  return <>{children}</>;
}

function PendingNotice({ name }: { name: string }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6 text-center">
      <h1 className="text-xl font-bold">관리자 승인을 기다리고 있습니다</h1>
      <p className="mt-3 text-muted break-keep">
        {name ? `${name}님, ` : ""}가입이 완료되었습니다. 찬양팀 관리자가 승인하면 악보를 볼 수 있습니다.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <ReloadButton label="다시 확인하기" />
        <SignOutButton />
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="card mx-auto mt-10 max-w-md p-6">
      <h1 className="text-xl font-bold">처음 설정이 필요합니다</h1>
      <p className="mt-3 text-muted break-keep">
        서버 연결 정보가 아직 입력되지 않았습니다. 관리자는 README의 설치 안내에 따라 환경 변수를 입력해 주세요.
      </p>
    </div>
  );
}
