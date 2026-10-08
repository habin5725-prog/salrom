import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon } from "@/components/icons";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getLeader } from "@/lib/auth";
import { listEditableServices } from "@/lib/data/services";
import { formatServiceDate } from "@/lib/dates";

export const metadata: Metadata = { title: "예배 관리" };

export default function EditListPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EditListContent />
    </Suspense>
  );
}

async function EditListContent() {
  const user = await getLeader();
  if (!user) return null;
  const services = await listEditableServices();

  return (
    <>
      <PageHeader title="예배 관리" back={{ href: "/settings", label: "설정" }} />

      <Link href="/edit/new" className="btn btn-primary mb-5 w-full">
        <PlusIcon size={22} />새 예배 만들기
      </Link>

      <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">다가오는 예배</h2>
      {services.length === 0 ? (
        <p className="card px-5 py-6 text-center text-muted">다가오는 예배가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`/edit/${s.id}`} className="card flex min-h-[4.5rem] items-center gap-3 px-5 py-3 active:bg-page">
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.1rem] font-bold">{formatServiceDate(s.date)}</span>
                  <span className="block text-[0.95rem] text-muted">{s.title}</span>
                </span>
                {s.status === "draft" ? (
                  <span className="badge bg-amber-100 text-amber-800">초안</span>
                ) : (
                  <span className="badge bg-accent-soft text-accent-strong">공개됨</span>
                )}
                <span className="btn btn-sm btn-secondary">편집</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 px-1 text-[0.95rem] text-muted break-keep">
        지난 예배는 홈의 &quot;지난 예배 보기&quot;에서 열어 편집할 수 있습니다.
      </p>
    </>
  );
}
