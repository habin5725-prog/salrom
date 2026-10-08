import { NextResponse, type NextRequest } from "next/server";
import type { Json } from "@/lib/database.types";
import { isUuid } from "@/lib/request-context";
import { getAdminSupabase } from "@/lib/supabase/admin";

// 기기별 알림 구독 저장과 해제. 로그인이 없으므로 기기 ID로 구분한다.

type Body =
  | { action: "subscribe"; deviceId: string; subscription: { endpoint?: unknown; keys?: unknown }; device?: string }
  | { action: "unsubscribe"; deviceId: string; endpoint: string };

export async function POST(request: NextRequest) {
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!isUuid(body.deviceId)) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.action === "subscribe") {
    const endpoint = body.subscription?.endpoint;
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // 같은 기기에서 다시 켜거나 다른 기기로 넘어간 구독은 새것으로 바꾼다.
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
    const { error } = await admin.from("push_subscriptions").insert({
      device_id: body.deviceId,
      endpoint,
      subscription: body.subscription as Json,
      device: typeof body.device === "string" ? body.device.slice(0, 120) : null,
    });
    return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
  }

  if (body.action === "unsubscribe" && typeof body.endpoint === "string") {
    await admin.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("device_id", body.deviceId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
