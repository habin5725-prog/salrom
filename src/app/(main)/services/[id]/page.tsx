import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { ServiceDetail } from "@/components/ServiceDetail";
import { getViewer } from "@/lib/auth";
import { getService } from "@/lib/data/services";
import { todayISO } from "@/lib/dates";
import { canEditServices } from "@/lib/permissions";

// 알림을 누르면 이 화면으로 온다.
export default function ServicePage({ params }: PageProps<"/services/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <ServiceContent params={params} />
    </Suspense>
  );
}

async function ServiceContent({ params }: { params: PageProps<"/services/[id]">["params"] }) {
  const { id } = await params;
  const viewer = await getViewer();

  const service = await getService(id);
  if (!service) notFound();

  return (
    <>
      <PageHeader
        title={service.title}
        back={service.date < todayISO() ? { href: "/history", label: "지난 예배" } : { href: "/", label: "홈" }}
      />
      <ServiceDetail service={service} canEdit={canEditServices(viewer.role)} />
    </>
  );
}
