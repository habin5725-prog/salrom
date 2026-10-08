import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getAdmin } from "@/lib/auth";
import { listLibrarySongs } from "@/lib/data/songs";
import { SongManager } from "./SongManager";

export const metadata: Metadata = { title: "곡 관리" };

export default function AdminSongsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminSongsContent />
    </Suspense>
  );
}

async function AdminSongsContent() {
  await getAdmin("/admin/songs");
  const songs = await listLibrarySongs();
  return (
    <>
      <PageHeader title="곡 관리" back={{ href: "/admin", label: "관리자 화면" }} />
      <p className="mb-4 px-1 text-[0.95rem] text-muted break-keep">
        곡 이름을 고치거나 곡을 악보와 올린 파일까지 함께 지울 수 있습니다. 예배 순서에 들어 있는 곡은 한 번 더 확인한 뒤
        그 예배 순서에서도 뺍니다. 악보 파일 교체는 예배 편집 화면에서 합니다.
      </p>
      <SongManager songs={songs.map((s) => ({ id: s.id, title: s.title, sheetCount: s.sheetCount, used: s.lastUsed !== null }))} />
    </>
  );
}
