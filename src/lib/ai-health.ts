import "server-only";
import { db } from "./db";
import { notifyAiDown } from "./notify";

/**
 * Whether the AI (Anthropic API) is answering. A failed call marks it down: new sign-up chats go straight to the form
 * for a while instead of greeting members with an error, and the team gets one email per outage (e.g. out of credit).
 * After RETRY_MIN it is tried again; the first call that works clears it.
 */
const RETRY_MIN = 15;
const get = (key: string) => (db.prepare("SELECT value, updated_at FROM app_settings WHERE key = ?").get(key) as { value: string; updated_at: string } | undefined) ?? null;
const set = (key: string, value: string) =>
  db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").run(key, value);
const del = (key: string) => db.prepare("DELETE FROM app_settings WHERE key = ?").run(key);

export function markAiOk() {
  set("ai_last_ok", new Date().toISOString());
  if (get("ai_down_since")) {
    del("ai_down_since");
    del("ai_down_alerted");
  }
}

export function markAiDown(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  set("ai_last_error", msg.slice(0, 300));
  set("ai_last_fail", new Date().toISOString());
  if (!get("ai_down_since")) set("ai_down_since", new Date().toISOString());
  if (!get("ai_down_alerted")) {
    set("ai_down_alerted", "1");
    notifyAiDown(msg);
  }
}

/** Down, and the last failure is recent: don't start new AI chats for now. */
export function aiResting(): boolean {
  if (!get("ai_down_since")) return false;
  const last = get("ai_last_fail");
  return !!last && Date.now() - new Date(last.value).getTime() < RETRY_MIN * 60_000;
}

export function aiHealth() {
  return {
    down: !!get("ai_down_since"),
    downSince: get("ai_down_since")?.value ?? null,
    lastOk: get("ai_last_ok")?.value ?? null,
    lastError: get("ai_last_error")?.value ?? null,
  };
}
