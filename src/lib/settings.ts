import "server-only";

import crypto from "node:crypto";
import webpush from "web-push";
import type { Json } from "./database.types";
import { getAdminSupabase } from "./supabase/admin";

// 앱 설정은 app_settings 표에 저장하고 서버만 읽는다.
// 비밀번호는 원문을 저장하지 않고 scrypt 해시로 저장한다.

export type CodeRole = "leader" | "admin";

/** 처음 설치했을 때의 비밀번호(관리자 화면에서 바꿀 수 있다) */
export const DEFAULT_CODES: Record<CodeRole, string> = { leader: "1234", admin: "1221" };

const CODE_KEY: Record<CodeRole, string> = { leader: "leader_code", admin: "admin_code" };

export function hashCode(code: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(code, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyCode(code: string, stored: string): boolean {
  const [kind, saltText, hashText] = stored.split("$");
  if (kind !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = crypto.scryptSync(code, Buffer.from(saltText, "base64url"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** 비밀번호 규칙: 숫자나 영문 4~20자 */
export function isValidCode(code: string): boolean {
  return /^[0-9A-Za-z]{4,20}$/.test(code);
}

async function readSetting(key: string): Promise<Json | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function writeSetting(key: string, value: Json): Promise<boolean> {
  const admin = getAdminSupabase();
  if (!admin) return false;
  const { error } = await admin
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return !error;
}

/** 비어 있는 설정(비밀번호, 알림 키)을 처음 값으로 채운다. 이미 있으면 그대로 둔다. */
export async function ensureDefaults(): Promise<void> {
  const admin = getAdminSupabase();
  if (!admin) return;
  const { data } = await admin.from("app_settings").select("key");
  const existing = new Set((data ?? []).map((row) => row.key));
  const rows: { key: string; value: Json }[] = [];
  for (const role of ["leader", "admin"] as const) {
    if (!existing.has(CODE_KEY[role])) rows.push({ key: CODE_KEY[role], value: { hash: hashCode(DEFAULT_CODES[role]) } });
  }
  if (!existing.has("vapid") && !process.env.VAPID_PRIVATE_KEY) {
    const keys = webpush.generateVAPIDKeys();
    rows.push({ key: "vapid", value: { publicKey: keys.publicKey, privateKey: keys.privateKey } });
  }
  if (rows.length > 0) {
    // 동시에 두 번 실행되어도 먼저 들어간 값을 지킨다.
    await admin.from("app_settings").upsert(rows, { onConflict: "key", ignoreDuplicates: true });
  }
}

async function storedHash(role: CodeRole): Promise<string | null> {
  const value = await readSetting(CODE_KEY[role]);
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.hash === "string") return value.hash;
  return null;
}

/** 입력한 비밀번호가 어느 모드인지. 맞는 것이 없으면 null */
export async function matchCode(code: string): Promise<CodeRole | null> {
  if (!code) return null;
  await ensureDefaults();
  for (const role of ["admin", "leader"] as const) {
    const hash = await storedHash(role);
    if (hash && verifyCode(code, hash)) return role;
  }
  return null;
}

/** 비밀번호를 바꾼다. 리더와 총 관리자 비밀번호는 서로 달라야 한다. */
export async function changeCode(role: CodeRole, code: string): Promise<{ ok: boolean; message: string }> {
  if (!isValidCode(code)) return { ok: false, message: "비밀번호는 숫자나 영문 4~20자로 정해 주세요." };
  const other = await storedHash(role === "admin" ? "leader" : "admin");
  if (other && verifyCode(code, other)) {
    return { ok: false, message: "리더 비밀번호와 총 관리자 비밀번호는 서로 달라야 합니다." };
  }
  const ok = await writeSetting(CODE_KEY[role], { hash: hashCode(code) });
  return ok ? { ok: true, message: "비밀번호를 바꿨습니다." } : { ok: false, message: "저장하지 못했습니다." };
}

/** 아직 처음 비밀번호(1234, 1221)를 쓰고 있는지 */
export async function usingDefaultCode(role: CodeRole): Promise<boolean> {
  const hash = await storedHash(role);
  return hash ? verifyCode(DEFAULT_CODES[role], hash) : true;
}

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

/** 알림 키: 환경 변수가 있으면 그것을, 없으면 설치할 때 자동으로 만든 키를 쓴다. */
export async function getVapidKeys(): Promise<VapidKeys | null> {
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject };
  }
  let value = await readSetting("vapid");
  if (!value) {
    // 설치 뒤에 지워졌으면 다시 만든다.
    await ensureDefaults();
    value = await readSetting("vapid");
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const { publicKey, privateKey } = value;
    if (typeof publicKey === "string" && typeof privateKey === "string") return { publicKey, privateKey, subject };
  }
  return null;
}
