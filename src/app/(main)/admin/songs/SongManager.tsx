"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { renameSong } from "@/app/actions/admin";
import { confirmAndDeleteSong } from "@/components/DeleteSongButton";
import { SearchIcon } from "@/components/icons";
import { searchSongs } from "@/lib/hangul";

type Song = { id: string; title: string; sheetCount: number; used: boolean };

export function SongManager({ songs }: { songs: Song[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const results = searchSongs(songs, deferred);

  async function save(song: Song) {
    setBusy(true);
    const r = await renameSong(song.id, title);
    setMessage({ ok: r.ok, text: r.message });
    setBusy(false);
    if (r.ok) {
      setEditing(null);
      router.refresh();
    }
  }

  async function remove(song: Song) {
    setBusy(true);
    const r = await confirmAndDeleteSong(song);
    if (r) setMessage({ ok: r.ok, text: r.message });
    setBusy(false);
    if (r?.ok) router.refresh();
  }

  return (
    <>
      <div className="relative mb-3">
        <SearchIcon size={22} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          className="input pl-12"
          placeholder="곡명 또는 초성"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="곡 찾기"
        />
      </div>
      {message && (
        <p role="status" className={`mb-3 rounded-xl px-4 py-3 ${message.ok ? "bg-accent-soft text-accent-strong" : "bg-red-50 text-danger"}`}>
          {message.text}
        </p>
      )}
      <ul className="card divide-y divide-line overflow-hidden">
        {results.map((song) => (
          <li key={song.id} className="px-4 py-3">
            {editing === song.id ? (
              <div className="flex flex-col gap-2">
                <input className="input" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} aria-label="새 곡명" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>
                    취소
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => save(song)}>
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-keep">{song.title}</span>
                  <span className="block text-[0.9rem] text-muted">
                    악보 {song.sheetCount}개{song.used ? " · 예배에 사용함" : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditing(song.id);
                    setTitle(song.title);
                  }}
                >
                  이름 바꾸기
                </button>
                <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(song)}>
                  지우기
                </button>
              </div>
            )}
          </li>
        ))}
        {results.length === 0 && <li className="px-4 py-6 text-center text-muted">곡이 없습니다.</li>}
      </ul>
    </>
  );
}
