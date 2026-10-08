import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getAdmin } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { UserList } from "./UserList";

export const metadata: Metadata = { title: "사용자 관리" };

export default function UsersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UsersContent />
    </Suspense>
  );
}

async function UsersContent() {
  const admin = await getAdmin();
  if (!admin) return null;

  const supabase = await getServerSupabase();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, role, instrument, created_at")
    .order("created_at");

  return (
    <>
      <PageHeader title="사용자 관리" back={{ href: "/settings", label: "설정" }} />
      <UserList currentUserId={admin.id} profiles={profiles ?? []} />
    </>
  );
}
