import { Suspense, type ReactNode } from "react";
import { AccessGate } from "@/components/AccessGate";
import { BottomNav } from "@/components/BottomNav";
import { Loading } from "@/components/Loading";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-32">
        <Suspense fallback={<Loading />}>
          <AccessGate>{children}</AccessGate>
        </Suspense>
      </main>
      <BottomNav />
    </>
  );
}
