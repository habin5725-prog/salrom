import "server-only";

import { Client } from "pg";
import { SCHEMA_PARTS } from "./schema.generated";
import { ensureDefaults } from "./settings";
import { getAdminSupabase } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/env";

// 처음 설치와 업데이트 도우미.
// Vercel에서 Supabase를 연결하면 데이터베이스 주소(POSTGRES_URL_NON_POOLING 등)가 자동으로 들어오므로,
// 사이트를 처음 열었을 때 버튼 한 번으로 표와 권한 정책을 만든다.
// 이미 설치된 사이트는 새 버전을 배포한 뒤 처음 접속할 때 아직 적용하지 않은 업데이트 파일만 자동으로 실행한다.

export type SetupState = "ready" | "needs-schema" | "not-configured";

/** 적용한 스키마 파일 목록을 app_settings 에 이 이름으로 기록한다. */
const SCHEMA_KEY = "schema";
/** 여러 서버가 동시에 설치나 업데이트를 하지 않도록 거는 잠금 번호 */
const SCHEMA_LOCK = 7_310_008;

let ready = false;
let checking: Promise<void> | null = null;
/** 자동 업데이트를 하지 못한 이유. 총 관리자 화면에 보여 준다. */
let upgradeProblem: string | null = null;

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /does not exist|could not find the table|schema cache/i.test(error.message ?? "")
  );
}

export async function getSetupState(): Promise<SetupState> {
  if (ready) return "ready";
  const admin = getAdminSupabase();
  if (!isSupabaseConfigured() || !admin) return "not-configured";
  const { error } = await admin.from("app_settings").select("key").limit(1);
  if (error && isMissingTable(error)) return "needs-schema";
  // 그 밖의 오류(일시적인 연결 문제 등)는 화면에서 따로 안내한다.
  if (!error) {
    checking ??= (async () => {
      await ensureDefaults();
      await upgradeIfNeeded();
      ready = true;
    })().finally(() => {
      checking = null;
    });
    await checking;
  }
  return "ready";
}

export function getUpgradeProblem(): string | null {
  return upgradeProblem;
}

/** 기록이 없으면 처음 설치 파일(init)만 적용된 사이트로 본다(업데이트 장치가 생기기 전에 설치한 경우). */
function appliedFrom(value: unknown): string[] {
  const applied = (value as { applied?: unknown } | null)?.applied;
  return Array.isArray(applied) ? applied.filter((v): v is string => typeof v === "string") : [SCHEMA_PARTS[0].name];
}

function pendingParts(applied: string[]) {
  return SCHEMA_PARTS.filter((part) => !applied.includes(part.name));
}

/** 이미 설치된 사이트에 새 업데이트 파일이 있으면 적용한다. 실패해도 사이트는 그대로 연다. */
async function upgradeIfNeeded(): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) return;
  const { data } = await admin.from("app_settings").select("value").eq("key", SCHEMA_KEY).maybeSingle();
  if (pendingParts(appliedFrom(data?.value ?? null)).length === 0) {
    upgradeProblem = null;
    return;
  }
  const url = databaseUrl();
  if (!url) {
    upgradeProblem = "데이터베이스 주소가 없어 사이트 업데이트를 자동으로 적용하지 못했습니다.";
    return;
  }
  const result = await applyPending(url);
  upgradeProblem = result.ok ? null : `사이트 업데이트를 자동으로 적용하지 못했습니다: ${result.message}`;
}

export function databaseUrl(): string {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    ""
  );
}

// sslmode 옵션이 있으면 인증서 검증 방식이 바뀌므로 지우고 아래 ssl 설정을 쓴다.
function connectionOptions(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  return { connectionString: parsed.toString(), ssl: local ? false : { rejectUnauthorized: false } };
}

/**
 * 아직 적용하지 않은 스키마 파일을 하나의 트랜잭션으로 실행하고 기록한다.
 * 중간에 실패하면 아무것도 바뀌지 않는다. 다른 서버가 먼저 끝냈으면 할 일이 없다.
 */
async function applyPending(url: string): Promise<{ ok: boolean; message: string }> {
  const client = new Client(connectionOptions(url));
  try {
    await client.connect();
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [SCHEMA_LOCK]);
    const installed = await client.query<{ ok: boolean }>("select to_regclass('public.app_settings') is not null as ok");
    let applied: string[] = [];
    if (installed.rows[0]?.ok) {
      const row = await client.query<{ value: unknown }>("select value from public.app_settings where key = $1", [SCHEMA_KEY]);
      applied = appliedFrom(row.rows[0]?.value ?? null);
    }
    const pending = pendingParts(applied);
    for (const part of pending) await client.query(part.sql);
    if (pending.length > 0) {
      const all = [...new Set([...applied, ...pending.map((p) => p.name)])];
      await client.query(
        `insert into public.app_settings (key, value) values ($1, $2::jsonb)
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [SCHEMA_KEY, JSON.stringify({ applied: all })],
      );
    }
    await client.query("commit");
    return { ok: true, message: pending.length > 0 ? `${pending.length}개 적용` : "적용할 것 없음" };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: message.slice(0, 200) };
  } finally {
    await client.end().catch(() => {});
  }
}

/** 표와 권한 정책을 만든다. 이미 준비되어 있으면 아무것도 하지 않는다. */
export async function runSchemaSetup(): Promise<{ ok: boolean; message: string }> {
  const state = await getSetupState();
  if (state === "ready") return { ok: true, message: "이미 준비되어 있습니다." };
  if (state === "not-configured") return { ok: false, message: "Supabase 연결 정보가 없습니다." };

  const url = databaseUrl();
  if (!url) {
    return {
      ok: false,
      message: "데이터베이스 주소가 없어 자동으로 준비할 수 없습니다. 안내서(README) 3-4의 SQL Editor 방법을 따라 주세요.",
    };
  }

  const result = await applyPending(url);
  if (!result.ok) return { ok: false, message: `준비하지 못했습니다: ${result.message}` };

  // API 서버가 새 표를 알아볼 때까지 잠시 기다린다.
  for (let i = 0; i < 30; i++) {
    if ((await getSetupState()) === "ready") return { ok: true, message: "사이트를 준비했습니다." };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { ok: false, message: "표는 만들었지만 아직 반영되지 않았습니다. 잠시 후 새로고침해 주세요." };
}
