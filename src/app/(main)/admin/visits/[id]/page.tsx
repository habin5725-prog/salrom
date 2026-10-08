import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getAdmin } from "@/lib/auth";
import { durationText, getVisit, getVisitorHistory, modeText } from "@/lib/data/admin";
import { formatDateTime, formatTime } from "@/lib/dates";
import { isUuid } from "@/lib/request-context";

export const metadata: Metadata = { title: "접속 기록" };

export default function VisitPage({ params }: PageProps<"/admin/visits/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <VisitContent params={params} />
    </Suspense>
  );
}

async function VisitContent({ params }: { params: PageProps<"/admin/visits/[id]">["params"] }) {
  const { id } = await params;
  await getAdmin(`/admin/visits/${id}`);
  if (!isUuid(id)) notFound();
  const visit = await getVisit(id);
  if (!visit) notFound();
  const history = (await getVisitorHistory(visit.visitorId)).filter((v) => v.id !== visit.id);

  return (
    <>
      <PageHeader title={visit.who} back={{ href: "/admin", label: "관리자 화면" }} />

      <section className="card mb-5 grid grid-cols-2 gap-3 p-5 text-[0.95rem]">
        <div>
          <p className="text-muted">언제</p>
          <p className="font-semibold">{formatDateTime(visit.startedAt)}</p>
        </div>
        <div>
          <p className="text-muted">얼마나</p>
          <p className="font-semibold">{durationText(visit.minutes)}</p>
        </div>
        <div>
          <p className="text-muted">어디서</p>
          <p className="font-semibold">{visit.place}</p>
        </div>
        <div>
          <p className="text-muted">기기</p>
          <p className="font-semibold">{visit.device}</p>
        </div>
        <div className="col-span-2">
          <p className="text-muted">모드</p>
          <p className="font-semibold">{modeText(visit.mode)}</p>
        </div>
      </section>

      <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">본 화면과 머문 시간</h2>
      <ol className="card mb-6 divide-y divide-line overflow-hidden">
        {visit.views.map((v, i) => (
          <li key={`${v.startedAt}-${i}`} className="flex items-center gap-3 px-4 py-3">
            <span className="w-16 shrink-0 text-[0.9rem] text-muted">{formatTime(v.startedAt)}</span>
            <span className="min-w-0 flex-1 break-keep">{v.label}</span>
            <span className="shrink-0 font-semibold">{durationText(v.minutes)}</span>
          </li>
        ))}
      </ol>

      {history.length > 0 && (
        <>
          <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">같은 기기의 다른 접속</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {history.map((v) => (
              <li key={v.id}>
                <Link href={`/admin/visits/${v.id}`} className="block px-4 py-3 active:bg-page">
                  <span className="block font-semibold">{formatDateTime(v.startedAt)}</span>
                  <span className="block text-[0.9rem] text-muted">
                    {durationText(v.minutes)} · 화면 {v.views.length}개 · {v.place}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
