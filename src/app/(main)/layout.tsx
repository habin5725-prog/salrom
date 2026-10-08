import { Suspense, type ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { Loading } from "@/components/Loading";
import { SiteGate } from "@/components/SiteGate";
import { TopBar } from "@/components/TopBar";
import { WelcomeSheet } from "@/components/WelcomeSheet";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl px-4 pt-5 pb-32 lg:max-w-4xl lg:pb-16">
        <Suspense fallback={<Loading />}>
          <SiteGate>{children}</SiteGate>
        </Suspense>
      </main>
      <BottomNav />
      <WelcomeSheet />
    </>
  );
}
