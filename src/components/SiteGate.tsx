import { connection } from "next/server";
import type { ReactNode } from "react";
import { getSetupState } from "@/lib/setup";
import { SetupPanel } from "./SetupPanel";

/** 처음 설치가 끝났는지 확인한다. 끝났으면 누구나 그대로 화면을 본다(로그인 없음). */
export async function SiteGate({ children }: { children: ReactNode }) {
  // 빌드할 때가 아니라 접속할 때마다 확인한다(설치 상태가 빌드 결과에 굳지 않도록).
  await connection();
  const state = await getSetupState();
  if (state === "ready") return <>{children}</>;

  if (state === "needs-schema") {
    return (
      <div className="card mx-auto mt-10 max-w-md p-6">
        <h1 className="text-xl font-bold">사이트를 처음 준비합니다</h1>
        <p className="mt-3 text-muted break-keep">
          아래 버튼을 한 번 누르면 악보와 예배 정보를 저장할 공간을 만듭니다. 1분 정도 걸릴 수 있습니다.
        </p>
        <SetupPanel />
      </div>
    );
  }

  return (
    <div className="card mx-auto mt-10 max-w-md p-6">
      <h1 className="text-xl font-bold">서버 연결이 필요합니다</h1>
      <p className="mt-3 text-muted break-keep">
        아직 Supabase(데이터 저장소)가 연결되지 않았습니다. 안내서(README)의 &quot;설치하기&quot; 순서대로 Vercel에서
        Supabase를 연결한 뒤 다시 배포해 주세요.
      </p>
    </div>
  );
}
