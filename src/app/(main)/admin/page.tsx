import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { Loading } from "@/components/Loading";
import { PageHeader } from "@/components/PageHeader";
import { getAdmin } from "@/lib/auth";
import { EVENT_LABEL, durationText, getDashboard, modeText, type VisitRow } from "@/lib/data/admin";
import { formatDateTime, formatTime } from "@/lib/dates";
import { usingDefaultCode } from "@/lib/settings";
import { AutoRefresh } from "./AutoRefresh";

export const metadata: Metadata = { title: "관리자 화면" };

export default function AdminPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminContent />
    </Suspense>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[0.9rem] text-muted">{label}</p>
      <p className="text-[1.6rem] font-bold">{value}</p>
    </div>
  );
}

function VisitItem({ visit, live }: { visit: VisitRow; live?: boolean }) {
  const current = visit.views[visit.views.length - 1];
  return (
    <li>
      <Link href={`/admin/visits/${visit.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-page">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {visit.who}
            {visit.mode !== "visitor" && (
              <span className="badge ml-2 bg-ink/10 text-ink">{modeText(visit.mode)}</span>
            )}
          </span>
          <span className="block text-[0.9rem] text-muted">
            {visit.device} · {visit.place}
          </span>
          <span className="block text-[0.9rem] text-muted">
            {live
              ? `지금 보는 화면: ${current?.label ?? "-"}`
              : `${formatDateTime(visit.startedAt)} · ${durationText(visit.minutes)} · 화면 ${visit.views.length}개`}
          </span>
        </span>
        <ChevronRightIcon className="shrink-0 text-faint" />
      </Link>
    </li>
  );
}

async function AdminContent() {
  await getAdmin();
  const [dashboard, leaderDefault, adminDefault] = await Promise.all([
    getDashboard(),
    usingDefaultCode("leader"),
    usingDefaultCode("admin"),
  ]);

  return (
    <>
      <PageHeader title="관리자 화면" />
      <AutoRefresh seconds={30} />

      {(leaderDefault || adminDefault) && (
        <Link href="/admin/settings" className="mb-4 block rounded-2xl bg-amber-50 px-4 py-3 text-amber-900 break-keep">
          처음 비밀번호({leaderDefault ? "리더 1234" : ""}
          {leaderDefault && adminDefault ? ", " : ""}
          {adminDefault ? "총 관리자 1221" : ""})를 쓰고 있습니다. 다른 사람이 짐작하기 쉬우니 바꾸는 것을 권합니다. →
        </Link>
      )}

      <div className="mb-5 grid grid-cols-3 gap-2">
        <Stat label="지금 접속" value={`${dashboard.live.length}명`} />
        <Stat label="오늘 방문" value={`${dashboard.todayVisitors}명`} />
        <Stat label="최근 7일" value={`${dashboard.weekVisitors}명`} />
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        <Link href="/edit" className="btn btn-primary">
          예배 관리
        </Link>
        <Link href="/admin/songs" className="btn btn-secondary">
          곡 관리
        </Link>
        <Link href="/admin/settings" className="btn btn-secondary">
          비밀번호와 기록 설정
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">지금 접속 중 ({dashboard.live.length})</h2>
          {dashboard.live.length === 0 ? (
            <p className="card px-5 py-5 text-center text-muted">지금 보고 있는 사람이 없습니다.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {dashboard.live.map((v) => (
                <VisitItem key={v.id} visit={v} live />
              ))}
            </ul>
          )}

          <h2 className="mt-6 mb-2 px-1 text-[1.05rem] font-bold text-muted">많이 본 악보 (최근 30일)</h2>
          {dashboard.topSheets.length === 0 ? (
            <p className="card px-5 py-5 text-center text-muted">아직 기록이 없습니다.</p>
          ) : (
            <ol className="card divide-y divide-line overflow-hidden">
              {dashboard.topSheets.map((s, i) => (
                <li key={s.label} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-6 text-center font-bold text-accent-strong">{i + 1}</span>
                  <span className="min-w-0 flex-1 break-keep">{s.label}</span>
                  <span className="shrink-0 text-[0.9rem] text-muted">
                    {durationText(s.minutes)} · {s.views}번
                  </span>
                </li>
              ))}
            </ol>
          )}

          <h2 className="mt-6 mb-2 px-1 text-[1.05rem] font-bold text-muted">관리 기록</h2>
          {dashboard.events.length === 0 ? (
            <p className="card px-5 py-5 text-center text-muted">아직 기록이 없습니다.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {dashboard.events.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <p className={`font-semibold ${e.kind === "login_fail" ? "text-danger" : ""}`}>
                    {EVENT_LABEL[e.kind] ?? e.kind}
                    {e.detail && <span className="ml-1 font-normal text-muted">{e.detail}</span>}
                  </p>
                  <p className="text-[0.9rem] text-muted">
                    {formatDateTime(e.createdAt)} · {e.who} · {e.place}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-muted">최근 접속 기록</h2>
          {dashboard.recent.length === 0 ? (
            <p className="card px-5 py-5 text-center text-muted">아직 기록이 없습니다.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {dashboard.recent.map((v) => (
                <VisitItem key={v.id} visit={v} />
              ))}
            </ul>
          )}
          <p className="mt-2 px-1 text-[0.85rem] text-muted">
            30초마다 자동으로 새로 고칩니다. 마지막 확인 {formatTime(new Date().toISOString())}
          </p>
        </section>
      </div>
    </>
  );
}
