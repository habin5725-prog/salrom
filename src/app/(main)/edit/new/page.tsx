import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getLeader } from "@/lib/auth";
import { todayISO, upcomingSundayISO } from "@/lib/dates";
import { NewServiceForm } from "./NewServiceForm";

export const metadata: Metadata = { title: "새 예배" };

export default function NewServicePage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewServiceContent />
    </Suspense>
  );
}

async function NewServiceContent() {
  const user = await getLeader("/edit/new");
  if (!user) return null;

  return (
    <>
      <PageHeader title="새 예배 만들기" back={{ href: "/edit", label: "예배 관리" }} />
      <NewServiceForm defaultDate={upcomingSundayISO(todayISO())} />
    </>
  );
}
