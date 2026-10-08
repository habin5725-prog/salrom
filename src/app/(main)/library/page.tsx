import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getMember } from "@/lib/auth";
import { listLibrarySongs } from "@/lib/data/songs";
import { LibrarySearch } from "./LibrarySearch";

export const metadata: Metadata = { title: "악보함" };

export default function LibraryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LibraryContent />
    </Suspense>
  );
}

async function LibraryContent() {
  const user = await getMember();
  if (!user) return null;
  const songs = await listLibrarySongs();

  return (
    <>
      <PageHeader title="악보함" />
      <LibrarySearch songs={songs} />
    </>
  );
}
