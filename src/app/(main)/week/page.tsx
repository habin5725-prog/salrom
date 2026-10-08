import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { ServiceDetail } from "@/components/ServiceDetail";
import { getMember } from "@/lib/auth";
import { getUpcomingService } from "@/lib/data/services";
import { canEditServices } from "@/lib/permissions";

export const metadata: Metadata = { title: "이번 주" };

export default function WeekPage() {
  return (
    <Suspense fallback={<Loading />}>
      <WeekContent />
    </Suspense>
  );
}

async function WeekContent() {
  const user = await getMember();
  if (!user) return null;
  const service = await getUpcomingService();

  return (
    <>
      <PageHeader title="이번 주 순서" />
      {service ? (
        <ServiceDetail service={service} canEdit={canEditServices(user.role)} />
      ) : (
        <section className="card px-5 py-8 text-center">
          <p className="text-[1.1rem] font-semibold">아직 이번 주 찬양이 올라오지 않았습니다.</p>
        </section>
      )}
      <Link href="/history" className="btn btn-secondary mt-3 w-full">
        지난 예배 보기
      </Link>
    </>
  );
}
