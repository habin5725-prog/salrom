import { Suspense, type ReactNode } from "react";
import { AccessGate } from "@/components/AccessGate";
import { Loading } from "@/components/Loading";

// 악보 화면은 하단 메뉴 없이 악보가 화면 전체를 쓴다.
export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loading label="악보를 여는 중입니다" />}>
      <AccessGate>{children}</AccessGate>
    </Suspense>
  );
}
