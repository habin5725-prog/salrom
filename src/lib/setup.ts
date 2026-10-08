import "server-only";

import { Client } from "pg";
import { SCHEMA_SQL } from "./schema.generated";
import { ensureDefaults } from "./settings";
import { getAdminSupabase } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/env";

// 처음 설치 도우미.
// Vercel에서 Supabase를 연결하면 데이터베이스 주소(POSTGRES_URL_NON_POOLING 등)가 자동으로 들어오므로,
// 사이트를 처음 열었을 때 버튼 한 번으로 표와 권한 정책을 만든다.

export type SetupState = "ready" | "needs-schema" | "not-configured";

let ready = false;

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
    ready = true;
    await ensureDefaults();
  }
  return "ready";
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

  const client = new Client(connectionOptions(url));
  try {
    await client.connect();
    // 여러 문장을 한 번에 보내면 하나의 트랜잭션으로 실행되어, 중간에 실패하면 아무것도 바뀌지 않는다.
    await client.query(SCHEMA_SQL);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists/i.test(message)) {
      // 다른 사람이 먼저 준비를 끝낸 경우
    } else {
      return { ok: false, message: `준비하지 못했습니다: ${message.slice(0, 200)}` };
    }
  } finally {
    await client.end().catch(() => {});
  }

  // API 서버가 새 표를 알아볼 때까지 잠시 기다린다.
  for (let i = 0; i < 30; i++) {
    if ((await getSetupState()) === "ready") return { ok: true, message: "사이트를 준비했습니다." };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return { ok: false, message: "표는 만들었지만 아직 반영되지 않았습니다. 잠시 후 새로고침해 주세요." };
}
