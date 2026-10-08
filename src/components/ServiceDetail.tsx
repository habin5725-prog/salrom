import Link from "next/link";
import type { ServiceWithSetlist } from "@/lib/data/services";
import { formatServiceDate } from "@/lib/dates";
import { PencilIcon } from "./icons";
import { DraftBadge, Setlist } from "./Setlist";

/** 이번 주 화면과 지난 예배 화면에서 함께 쓰는 예배 곡 목록 */
export function ServiceDetail({ service, canEdit }: { service: ServiceWithSetlist; canEdit: boolean }) {
  const first = service.songs[0];

  return (
    <>
      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          {service.status === "draft" && (
            <div className="mb-2">
              <DraftBadge />
            </div>
          )}
          <p className="text-[1.35rem] font-bold">{formatServiceDate(service.date, { withYear: true })}</p>
          <p className="text-muted">
            {service.title} · {service.songs.length}곡
          </p>
        </div>
        <Setlist songs={service.songs} />
      </section>

      {first && (
        <Link href={`/play/${first.id}`} className="btn btn-primary mt-4 w-full">
          첫 곡부터 악보 보기
        </Link>
      )}

      {canEdit && (
        <Link href={`/edit/${service.id}`} className="btn btn-secondary mt-3 w-full">
          <PencilIcon size={22} />
          이 예배 편집
        </Link>
      )}
    </>
  );
}
