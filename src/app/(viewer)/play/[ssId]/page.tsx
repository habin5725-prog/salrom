import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { SheetViewer } from "@/components/viewer/SheetViewer";
import { getMember } from "@/lib/auth";
import { getPlayData } from "@/lib/data/viewer";
import { canWriteGlobalNotes } from "@/lib/permissions";

export const metadata: Metadata = { title: "악보" };

export default function PlayPage({ params }: PageProps<"/play/[ssId]">) {
  return (
    <Suspense fallback={<Loading label="악보를 여는 중입니다" />}>
      <PlayContent params={params} />
    </Suspense>
  );
}

async function PlayContent({ params }: { params: PageProps<"/play/[ssId]">["params"] }) {
  const { ssId } = await params;
  const user = await getMember();
  if (!user) return null;

  const data = await getPlayData(ssId);
  if (!data) notFound();

  // 곡이 바뀌면 화면 상태(확대, 필기 도구)를 새로 시작한다.
  return <SheetViewer key={ssId} {...data} userId={user.id} canWriteGlobal={canWriteGlobalNotes(user.role)} />;
}
