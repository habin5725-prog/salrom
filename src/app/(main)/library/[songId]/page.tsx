import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteSongButton } from "@/components/DeleteSongButton";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getViewer } from "@/lib/auth";
import { getSongDetail } from "@/lib/data/songs";
import { formatServiceDate } from "@/lib/dates";
import { KIND_LABEL } from "@/lib/files";
import { canDeleteLibraryItems } from "@/lib/permissions";

export default function SongPage({ params }: PageProps<"/library/[songId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <SongContent params={params} />
    </Suspense>
  );
}

function formatUploaded(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" }).format(
    new Date(iso),
  );
}

async function SongContent({ params }: { params: PageProps<"/library/[songId]">["params"] }) {
  const { songId } = await params;

  const [song, viewer] = await Promise.all([getSongDetail(songId), getViewer()]);
  if (!song) notFound();

  return (
    <>
      <PageHeader title={song.title} back={{ href: "/library", label: "악보함" }} />

      <section className="mb-6">
        <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">악보와 파일</h2>
        {song.sheets.length === 0 ? (
          <p className="card px-5 py-6 text-center text-muted">등록된 악보가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {song.sheets.map((sheet) => {
              const older = sheet.versions.filter((v) => v.version !== sheet.currentVersion);
              return (
                <li key={sheet.id} className="card px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.1rem] font-semibold">{sheet.name}</span>
                      <span className="block text-[0.95rem] text-muted">
                        {KIND_LABEL[sheet.kind].name}
                        {sheet.currentVersion > 1 ? ` · ${sheet.currentVersion}번째 파일` : ""}
                      </span>
                    </span>
                    {sheet.currentVersion > 0 && (
                      <Link href={`/sheet/${sheet.id}`} className="btn btn-sm btn-primary shrink-0">
                        {KIND_LABEL[sheet.kind].open}
                      </Link>
                    )}
                  </div>
                  {older.length > 0 && (
                    <details className="mt-3 rounded-xl bg-page px-3 py-2">
                      <summary className="min-h-10 cursor-pointer py-2 text-[0.95rem] font-semibold text-muted">
                        이전 파일 {older.length}개
                      </summary>
                      <ul className="pb-1">
                        {older.map((v) => (
                          <li key={v.version}>
                            <Link
                              href={`/sheet/${sheet.id}?v=${v.version}`}
                              className="flex min-h-11 items-center justify-between gap-2 text-[0.95rem]"
                            >
                              <span>
                                {v.version}번째 {KIND_LABEL[v.kind].name} · {formatUploaded(v.createdAt)}
                              </span>
                              <span className="font-semibold text-accent">보기</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">사용 기록</h2>
        {song.usage.length === 0 ? (
          <p className="card px-5 py-6 text-center text-muted">아직 예배에 사용하지 않았습니다.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {song.usage.map((u) => (
              <li key={`${u.serviceId}-${u.songKey}`}>
                <Link href={`/services/${u.serviceId}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                  <span>
                    {formatServiceDate(u.date, { withYear: true })}
                    <span className="ml-1 text-[0.9rem] text-muted">{u.title}</span>
                  </span>
                  <span className="font-semibold text-accent-strong">{u.songKey ? `Key ${u.songKey}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canDeleteLibraryItems(viewer.role) && (
        <section className="mt-8">
          <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">곡 지우기(총 관리자)</h2>
          <p className="mb-3 px-1 text-[0.95rem] text-muted break-keep">
            악보와 올린 파일, 공용 필기가 모두 지워집니다. 예배 순서에 들어 있는 곡이면 한 번 더 확인한 뒤 그 예배
            순서에서도 뺍니다.
          </p>
          <DeleteSongButton songId={song.id} title={song.title} />
        </section>
      )}
    </>
  );
}
