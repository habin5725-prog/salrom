import { Suspense, type ReactNode } from "react";
import { Loading } from "@/components/Loading";
import { SiteGate } from "@/components/SiteGate";

// 악보 화면은 메뉴 없이 악보가 화면 전체를 쓴다.
export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading label="악보를 여는 중입니다" />}>
      <SiteGate>{children}</SiteGate>
    </Suspense>
  );
}
