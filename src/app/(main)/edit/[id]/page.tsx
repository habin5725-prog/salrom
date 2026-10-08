import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getLeader } from "@/lib/auth";
import { getEditorData } from "@/lib/data/editor";
import { canDeletePublishedServices } from "@/lib/permissions";
import { ServiceEditor } from "./ServiceEditor";

export const metadata: Metadata = { title: "예배 편집" };

export default function EditServicePage({ params }: PageProps<"/edit/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <EditServiceContent params={params} />
    </Suspense>
  );
}

async function EditServiceContent({ params }: { params: PageProps<"/edit/[id]">["params"] }) {
  const { id } = await params;
  const user = await getLeader();
  if (!user) return null;

  const data = await getEditorData(id);
  if (!data) notFound();

  return (
    <>
      <PageHeader
        title="예배 편집"
        back={{ href: "/edit", label: "예배 관리" }}
        action={
          <Link href={`/services/${data.id}`} className="btn btn-sm btn-secondary">
            미리 보기
          </Link>
        }
      />
      {/* 같은 예배를 다시 열면 서버의 최신 값으로 새로 시작한다. */}
      <ServiceEditor key={data.id} initial={data} canDeletePublished={canDeletePublishedServices(user.role)} />
    </>
  );
}
