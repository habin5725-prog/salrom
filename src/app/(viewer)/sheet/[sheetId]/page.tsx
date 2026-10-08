import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { SheetViewer } from "@/components/viewer/SheetViewer";
import { getMember } from "@/lib/auth";
import { getSheetViewData } from "@/lib/data/viewer";
import { canWriteGlobalNotes } from "@/lib/permissions";

export const metadata: Metadata = { title: "악보" };

export default function SheetPage({ params, searchParams }: PageProps<"/sheet/[sheetId]">) {
  return (
    <Suspense fallback={<Loading label="악보를 여는 중입니다" />}>
      <SheetContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SheetContent({
  params,
  searchParams,
}: {
  params: PageProps<"/sheet/[sheetId]">["params"];
  searchParams: PageProps<"/sheet/[sheetId]">["searchParams"];
}) {
  const [{ sheetId }, query] = await Promise.all([params, searchParams]);
  const user = await getMember();
  if (!user) return null;

  const v = Number(Array.isArray(query.v) ? query.v[0] : query.v);
  const data = await getSheetViewData(sheetId, Number.isInteger(v) ? v : null);
  if (!data) notFound();

  return (
    <SheetViewer
      key={`${sheetId}-${data.sheet?.version}`}
      {...data}
      userId={user.id}
      canWriteGlobal={canWriteGlobalNotes(user.role)}
    />
  );
}
