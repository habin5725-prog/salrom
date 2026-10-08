import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getMember } from "@/lib/auth";
import { listPastServices } from "@/lib/data/services";
import { formatServiceDate } from "@/lib/dates";

export const metadata: Metadata = { title: "지난 예배" };

export default function HistoryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <HistoryContent />
    </Suspense>
  );
}

async function HistoryContent() {
  const user = await getMember();
  if (!user) return null;
  const services = await listPastServices();

  return (
    <>
      <PageHeader title="지난 예배" back={{ href: "/", label: "홈" }} />
      {services.length === 0 ? (
        <p className="card px-5 py-8 text-center text-muted">아직 지난 예배 기록이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {services.map((service) => (
            <li key={service.id}>
              <Link href={`/services/${service.id}`} className="card block px-5 py-4 active:bg-page">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[1.15rem] font-bold">{formatServiceDate(service.date, { withYear: true })}</span>
                  {service.status === "draft" && <span className="badge bg-amber-100 text-amber-800">초안</span>}
                </div>
                <p className="text-[0.95rem] text-muted">{service.title}</p>
                {service.songs.length > 0 && (
                  <ol className="mt-2 flex flex-col gap-0.5 text-[1rem]">
                    {service.songs.map((song, i) => (
                      <li key={i} className="break-keep">
                        <span className="text-muted">{i + 1}.</span> {song.title}
                        {song.songKey && <span className="ml-1 font-semibold text-accent-strong">({song.songKey})</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
