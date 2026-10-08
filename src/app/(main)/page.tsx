import Link from "next/link";
import { Suspense } from "react";
import { PencilIcon } from "@/components/icons";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { DraftBadge, Setlist } from "@/components/Setlist";
import { APP_NAME } from "@/lib/app";
import { getMember } from "@/lib/auth";
import { getUpcomingService } from "@/lib/data/services";
import { formatServiceDate, relativeDayLabel, todayISO } from "@/lib/dates";
import { canEditServices } from "@/lib/permissions";

export default function HomePage() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const user = await getMember();
  if (!user) return null;

  const service = await getUpcomingService();
  const isLeader = canEditServices(user.role);

  return (
    <>
      <PageHeader eyebrow={APP_NAME} title="이번 주 찬양" />

      {service ? (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge bg-accent-soft text-accent-strong">{relativeDayLabel(service.date, todayISO())}</span>
              {service.status === "draft" && <DraftBadge />}
            </div>
            <p className="mt-2 text-[1.35rem] font-bold">{formatServiceDate(service.date)}</p>
            <p className="text-muted">{service.title}</p>
          </div>
          <Setlist songs={service.songs} />
        </section>
      ) : (
        <section className="card px-5 py-8 text-center">
          <p className="text-[1.1rem] font-semibold">아직 이번 주 찬양이 올라오지 않았습니다.</p>
          <p className="mt-1 text-muted">리더가 올리면 여기에 바로 보입니다.</p>
        </section>
      )}

      {isLeader && (
        <Link href={service ? `/edit/${service.id}` : "/edit/new"} className="btn btn-primary mt-4 w-full">
          <PencilIcon size={22} />
          {service ? "이번 주 편집" : "이번 주 찬양 만들기"}
        </Link>
      )}

      <Link href="/history" className="btn btn-secondary mt-3 w-full">
        지난 예배 보기
      </Link>
    </>
  );
}
