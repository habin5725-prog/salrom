"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { SearchIcon } from "@/components/icons";
import type { LibrarySong } from "@/lib/data/songs";
import { formatServiceDate } from "@/lib/dates";
import { searchSongs } from "@/lib/hangul";

export function LibrarySearch({ songs }: { songs: LibrarySong[] }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = searchSongs(songs, deferred);

  return (
    <>
      <div className="relative mb-2">
        <SearchIcon size={22} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          className="input pl-12"
          placeholder="곡명 또는 초성 (예: ㅈㄴㅇ)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="곡 찾기"
        />
      </div>
      <p className="mb-3 px-1 text-[0.95rem] text-muted">
        {query ? `${results.length}곡 찾음` : `전체 ${songs.length}곡`}
      </p>

      {songs.length === 0 ? (
        <p className="card px-5 py-8 text-center text-muted break-keep">
          아직 등록된 악보가 없습니다. 리더가 매주 악보를 올리면 이곳에 계속 쌓입니다.
        </p>
      ) : results.length === 0 ? (
        <p className="card px-5 py-8 text-center text-muted">찾는 곡이 없습니다.</p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {results.map((song) => (
            <li key={song.id}>
              <Link href={`/library/${song.id}`} className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 active:bg-page">
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.1rem] font-semibold break-keep">{song.title}</span>
                  <span className="block text-[0.95rem] text-muted">
                    {song.lastUsed
                      ? `최근 ${formatServiceDate(song.lastUsed.date)}${song.lastUsed.songKey ? ` · Key ${song.lastUsed.songKey}` : ""}`
                      : "아직 예배에 사용하지 않음"}
                  </span>
                </span>
                <span className="btn btn-sm btn-soft shrink-0">보기</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
