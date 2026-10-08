"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSong, type DeleteSongResult } from "@/app/actions/admin";
import { TrashIcon } from "./icons";

/**
 * 곡 지우기 확인 절차(총 관리자). 예배 순서에 쓰인 곡이면 쓰인 곳을 보여 주고 한 번 더 묻는다.
 * 취소하면 null
 */
export async function confirmAndDeleteSong(song: { id: string; title: string }): Promise<DeleteSongResult | null> {
  if (!window.confirm(`"${song.title}"을(를) 지울까요?\n악보와 올린 파일, 공용 필기가 모두 지워지며 되돌릴 수 없습니다.`)) {
    return null;
  }
  const first = await deleteSong(song.id);
  if (!first.needsConfirm) return first;
  if (!window.confirm(`${first.message}\n그래도 지울까요?`)) return null;
  return deleteSong(song.id, true);
}

/** 악보함 곡 화면의 "이 곡 지우기" 버튼 */
export function DeleteSongButton({ songId, title }: { songId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setBusy(true);
    setError("");
    const result = await confirmAndDeleteSong({ id: songId, title });
    if (result?.ok) {
      router.replace("/library");
      router.refresh();
      return;
    }
    if (result) setError(result.message);
    setBusy(false);
  }

  return (
    <div>
      <button type="button" className="btn btn-danger w-full" onClick={onClick} disabled={busy}>
        <TrashIcon size={22} />
        {busy ? "지우는 중..." : "이 곡 지우기"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
