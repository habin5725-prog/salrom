import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { deviceLabel, geoFrom, isUuid } from "@/lib/request-context";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { labelForPath } from "@/lib/track-labels";

// 접속 기록. 화면을 열면 start, 열어 두는 동안 30초마다 ping 을 보낸다.
// 머문 시간 = 마지막 ping 시각 - 시작 시각. 30분 넘게 쉬었다가 오면 새 접속으로 본다.

const SESSION_GAP_MS = 30 * 60_000;

type Body = {
  event?: unknown;
  deviceId?: unknown;
  path?: unknown;
  viewId?: unknown;
  name?: unknown;
};

// 기록은 부가 기능이므로 서버 쪽 문제(설치 전, 일시 오류)는 브라우저 오류가 나지 않게 200으로 조용히 끝낸다.
const quiet = () => NextResponse.json({ ok: false });

export async function POST(request: NextRequest) {
  try {
    return await handle(request);
  } catch {
    return quiet();
  }
}

async function handle(request: NextRequest) {
  const admin = getAdminSupabase();
  if (!admin) return quiet();

  let body: Body;
  try {
    body = JSON.parse(await request.text()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const deviceId = body.deviceId;
  if (!isUuid(deviceId)) return NextResponse.json({ ok: false }, { status: 400 });
  const now = new Date().toISOString();

  if (body.event === "start") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith("/") || path.length > 200) return NextResponse.json({ ok: false }, { status: 400 });

    const device = deviceLabel(request.headers.get("user-agent") ?? "");
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 40) : undefined;
    await admin
      .from("visitors")
      .upsert({ id: deviceId, device, last_seen: now, ...(name ? { name } : {}) }, { onConflict: "id" });

    const mode = (await getViewer()).mode;
    const { data: recent } = await admin
      .from("visit_sessions")
      .select("id, mode")
      .eq("visitor_id", deviceId)
      .gte("last_seen_at", new Date(Date.now() - SESSION_GAP_MS).toISOString())
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionId = recent?.id;
    if (sessionId) {
      // 접속 중에 리더나 총 관리자 모드로 들어가면 접속 기록에도 표시한다.
      const update = recent?.mode === "visitor" && mode !== "visitor" ? { last_seen_at: now, mode } : { last_seen_at: now };
      await admin.from("visit_sessions").update(update).eq("id", sessionId);
    } else {
      const geo = geoFrom(request.headers);
      const { data: created } = await admin
        .from("visit_sessions")
        .insert({ visitor_id: deviceId, mode, ...geo })
        .select("id")
        .single();
      sessionId = created?.id;
    }
    if (!sessionId) return quiet();

    const { data: view } = await admin
      .from("page_views")
      .insert({ session_id: sessionId, path, label: await labelForPath(path) })
      .select("id")
      .single();
    return NextResponse.json({ ok: true, viewId: view?.id ?? null });
  }

  if (body.event === "ping") {
    const viewId = body.viewId;
    if (!isUuid(viewId)) return NextResponse.json({ ok: false }, { status: 400 });
    // 다른 기기의 기록을 고치지 못하도록 이 기기의 기록인지 확인한다.
    const { data: view } = await admin
      .from("page_views")
      .select("id, session_id, visit_sessions!inner(visitor_id)")
      .eq("id", viewId)
      .eq("visit_sessions.visitor_id", deviceId)
      .maybeSingle();
    if (!view) return quiet();
    await Promise.all([
      admin.from("page_views").update({ last_seen_at: now }).eq("id", view.id),
      admin.from("visit_sessions").update({ last_seen_at: now }).eq("id", view.session_id),
      admin.from("visitors").update({ last_seen: now }).eq("id", deviceId),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (body.event === "name") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    await admin
      .from("visitors")
      .upsert(
        { id: deviceId, name: name || null, device: deviceLabel(request.headers.get("user-agent") ?? ""), last_seen: now },
        { onConflict: "id" },
      );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
