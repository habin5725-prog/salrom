"use server";

import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { formatServiceDate } from "@/lib/dates";
import { canEditServices, isApproved } from "@/lib/permissions";
import { isPushConfigured, sendPush, type PushPayload } from "@/lib/push";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 같은 예배 알림이 실수로 연달아 나가지 않도록 최소 간격을 둔다.
const NOTIFY_INTERVAL_MS = 60_000;

async function requireLeaderAction(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && canEditServices(user.role) ? user : null;
}

type ServiceRow = { id: string; service_date: string; title: string; status: "draft" | "published"; notified_at: string | null };

/** 팀원 전체(보내는 사람 제외)에게 알림을 보내고 알림 시각을 기록한다. */
async function notifyTeam(sender: CurrentUser, service: ServiceRow, payload: PushPayload): Promise<string> {
  const admin = getAdminSupabase();
  if (!admin || !isPushConfigured()) return "알림 기능이 아직 설정되지 않아 알림은 보내지 않았습니다.";

  if (service.notified_at && Date.now() - new Date(service.notified_at).getTime() < NOTIFY_INTERVAL_MS) {
    return "방금 알림을 보냈습니다. 1분 뒤에 다시 보낼 수 있습니다.";
  }

  const { data: targets, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, subscription, user_id, profiles!inner(role)")
    .neq("user_id", sender.id)
    .in("profiles.role", ["member", "leader", "admin"]);
  if (error) return "알림 대상을 불러오지 못했습니다.";

  const result = await sendPush(targets ?? [], payload);
  if (result.expired.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", result.expired);
  }

  const supabase = await getServerSupabase();
  await supabase.from("services").update({ notified_at: new Date().toISOString() }).eq("id", service.id);

  if (result.sent === 0) return "알림을 받을 수 있는 팀원 기기가 아직 없습니다.";
  return `팀원 기기 ${result.sent}대에 알림을 보냈습니다.`;
}

function describe(service: ServiceRow, songCount: number): string {
  return `${formatServiceDate(service.service_date)} ${service.title} · ${songCount}곡`;
}

async function countSongs(serviceId: string): Promise<number> {
  const supabase = await getServerSupabase();
  const { count } = await supabase
    .from("service_songs")
    .select("id", { count: "exact", head: true })
    .eq("service_id", serviceId);
  return count ?? 0;
}

/**
 * 이번 주 찬양 공개. 초안에서 공개로 바뀌는 순간에만 알림을 보낸다.
 * 이미 공개된 예배를 다시 공개해도 알림은 다시 나가지 않는다.
 */
export async function publishService(serviceId: string, notify: boolean): Promise<ActionResult> {
  const user = await requireLeaderAction();
  if (!user) return { ok: false, message: "리더만 공개할 수 있습니다." };
  if (!UUID.test(serviceId)) return { ok: false, message: "잘못된 요청입니다." };

  const supabase = await getServerSupabase();
  const { data: service, error } = await supabase
    .from("services")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", serviceId)
    .eq("status", "draft")
    .select("id, service_date, title, status, notified_at")
    .maybeSingle();

  if (error) return { ok: false, message: "공개하지 못했습니다. 다시 시도해 주세요." };
  if (!service) return { ok: true, message: "이미 공개된 예배입니다." };

  if (!notify) return { ok: true, message: "공개했습니다. 알림은 보내지 않았습니다." };

  const note = await notifyTeam(user, service, {
    title: "이번 주 찬양이 올라왔습니다",
    body: describe(service, await countSongs(service.id)),
    url: `/services/${service.id}`,
    tag: `service-${service.id}`,
  });
  return { ok: true, message: `공개했습니다. ${note}` };
}

/** 공개를 취소하고 초안으로 되돌린다(팀원에게 다시 보이지 않는다). */
export async function unpublishService(serviceId: string): Promise<ActionResult> {
  const user = await requireLeaderAction();
  if (!user) return { ok: false, message: "리더만 바꿀 수 있습니다." };
  if (!UUID.test(serviceId)) return { ok: false, message: "잘못된 요청입니다." };

  const supabase = await getServerSupabase();
  const { error } = await supabase.from("services").update({ status: "draft" }).eq("id", serviceId);
  if (error) return { ok: false, message: "바꾸지 못했습니다." };
  return { ok: true, message: "초안으로 되돌렸습니다. 팀원에게는 보이지 않습니다." };
}

/** Key 변경, 곡 추가와 삭제, 악보 교체 같은 중요한 수정 뒤에 리더가 직접 보내는 알림 */
export async function notifyServiceChange(serviceId: string, note: string): Promise<ActionResult> {
  const user = await requireLeaderAction();
  if (!user) return { ok: false, message: "리더만 알림을 보낼 수 있습니다." };
  if (!UUID.test(serviceId)) return { ok: false, message: "잘못된 요청입니다." };

  const supabase = await getServerSupabase();
  const { data: service } = await supabase
    .from("services")
    .select("id, service_date, title, status, notified_at")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { ok: false, message: "예배를 찾을 수 없습니다." };
  if (service.status !== "published") return { ok: false, message: "공개된 예배만 알림을 보낼 수 있습니다." };

  const trimmed = note.trim().slice(0, 100);
  const message = await notifyTeam(user, service, {
    title: "이번 주 찬양이 변경되었습니다",
    body: trimmed || `${describe(service, await countSongs(service.id))} 순서를 확인해 주세요.`,
    url: `/services/${service.id}`,
    tag: `service-${service.id}`,
  });
  return { ok: true, message };
}

/** 설정 화면의 시험 알림. 내 기기로만 보낸다. */
export async function sendTestPush(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !isApproved(user.role)) return { ok: false, message: "로그인이 필요합니다." };
  if (!isPushConfigured()) return { ok: false, message: "알림 기능이 아직 설정되지 않았습니다." };

  const supabase = await getServerSupabase();
  const { data: targets } = await supabase.from("push_subscriptions").select("endpoint, subscription");
  const result = await sendPush(targets ?? [], {
    title: "시험 알림",
    body: "알림이 잘 도착했습니다.",
    url: "/settings",
    tag: "test",
  });
  if (result.expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", result.expired);
  }
  return result.sent > 0
    ? { ok: true, message: "시험 알림을 보냈습니다. 잠시 후 도착합니다." }
    : { ok: false, message: "알림을 보내지 못했습니다. 알림을 껐다가 다시 켜 보세요." };
}
