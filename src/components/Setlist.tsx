import Link from "next/link";
import type { SetlistItem } from "@/lib/data/services";
import { KIND_LABEL } from "@/lib/files";

/** 예배 곡 목록. 각 곡에는 순서, 곡명, Key, 악보 보기만 크게 보여준다. */
export function Setlist({ songs }: { songs: SetlistItem[] }) {
  if (songs.length === 0) {
    return <p className="px-5 py-8 text-center text-muted">아직 곡이 없습니다.</p>;
  }

  return (
    <ol className="divide-y divide-line">
      {songs.map((song, index) => (
        <li key={song.id}>
          <Link href={`/play/${song.id}`} className="flex min-h-[4.75rem] items-center gap-3 px-4 py-3 active:bg-page">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[1.05rem] font-bold text-accent-strong">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[1.15rem] font-semibold leading-snug break-keep">{song.title}</span>
              <span className="mt-0.5 block text-[0.95rem] text-muted">
                {song.songKey ? (
                  <>
                    Key <strong className="font-bold text-ink">{song.songKey}</strong>
                  </>
                ) : (
                  "Key 미정"
                )}
              </span>
            </span>
            {song.sheetId ? (
              <span className="btn btn-sm btn-soft shrink-0">{KIND_LABEL[song.fileKind ?? "pdf"].open}</span>
            ) : (
              <span className="shrink-0 text-[0.95rem] text-faint">악보 없음</span>
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function DraftBadge() {
  return <span className="badge bg-amber-100 text-amber-800">초안 · 팀원에게 아직 안 보임</span>;
}
