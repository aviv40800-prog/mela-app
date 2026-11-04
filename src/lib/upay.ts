import "server-only";
import crypto from "node:crypto";
import { db, tx } from "./db";
import { PLANS } from "./content";
import { notifyPayment } from "./notify";
import { getUserByEmail, normalizeEmail } from "./users";

/**
 * UPay (יופיי): the monthly plan is sold through a UPay payment page with a standing order. UPay calls
 *   https://<site>/api/upay/notify?key=<UPAY_NOTIFY_KEY>
 * ("קישור לעדכון שרת") after each charge — the first one and every monthly one. We don't have UPay's field list
 * yet, so every call is kept (card numbers and tokens masked) for the admin, and fields are read loosely. Premium is
 * turned on only when the call clearly says the charge went through, for the plan's price, from a known member's
 * email; anything else waits on /admin/payments for the admin to apply by hand.
 */
export const UPAY_PLAN = "monthly_49" as const;

export type UpayEvent = {
  id: number;
  accepted: number;
  note: string;
  txid: string | null;
  email: string | null;
  sum: number | null;
  success: number | null;
  user_id: number | null;
  applied_at: string | null;
  payload: string;
  source_ip: string | null;
  received_at: string;
};

function sameKey(given: string | null) {
  const want = process.env.UPAY_NOTIFY_KEY ?? "";
  if (want.length < 16 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** No full card number or token in the log, and not our key. */
function redact(payload: Record<string, string>): Record<string, string> {
  const key = process.env.UPAY_NOTIFY_KEY;
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) => {
      if (/token|tk$/i.test(k) && v.length > 8) return [k, `…${v.slice(-4)}`];
      if (/^\d{12,19}$/.test(v) || /(^|_)(id|teudat|tz|myid)$/i.test(k)) return [k, "[redacted]"];
      return [k, key ? v.split(key).join("***") : v];
    }),
  );
}

const pick = (p: Record<string, string>, re: RegExp) => Object.entries(p).find(([k, v]) => re.test(k) && v !== "")?.[1] ?? null;

/** What we can read from a call whose exact fields we don't know yet. */
export function readUpay(p: Record<string, string>) {
  const email = pick(p, /mail/i) ?? Object.values(p).find((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) ?? null;
  const sumRaw = pick(p, /^(sum|amount|total|price|transactionsum|paymentsum)$/i) ?? pick(p, /sum|amount/i);
  const sum = sumRaw && !Number.isNaN(Number(sumRaw)) ? Number(sumRaw) : null;
  const txid = pick(p, /^(transactionid|transaction_id|cashierid|txid|tranid|index|confirmationcode|id)$/i) ?? pick(p, /trans|confirm/i);
  const status = pick(p, /^(status|success|result|response|errorcode|error_code|statuscode)$/i);
  const success = status === null ? null : /^(0|00|000|1|true|ok|success|approved|paid)$/i.test(status.trim()) ? 1 : 0;
  return { email: email ? normalizeEmail(email) : null, sum, txid, success };
}

/** Turns on (or extends by a month) the member's monthly Premium, billed by UPay. */
export function applyUpay(eventId: number, userId: number): void {
  const ev = db.prepare("SELECT * FROM upay_events WHERE id = ?").get(eventId) as UpayEvent | undefined;
  if (!ev) throw new Error("ההודעה לא נמצאה");
  if (ev.applied_at) throw new Error("כבר הופעל Premium על התשלום הזה");
  tx(() => {
    const sub = db.prepare("SELECT current_period_end FROM subscriptions WHERE user_id = ?").get(userId) as { current_period_end: string } | undefined;
    // a renewal adds a month to what's left; a new member starts today
    const from = sub && new Date(sub.current_period_end.replace(" ", "T") + "Z") > new Date() ? `'${sub.current_period_end}'` : "datetime('now')";
    const end = (db.prepare(`SELECT datetime(${from}, '+1 month') AS d`).get() as { d: string }).d;
    db.prepare(
      `INSERT INTO subscriptions (user_id, plan_type, status, current_period_end, provider_ref, billing_anchor)
       VALUES (?, ?, 'active', ?, ?, date('now'))
       ON CONFLICT(user_id) DO UPDATE SET plan_type = excluded.plan_type, status = 'active', current_period_end = excluded.current_period_end,
         provider_ref = excluded.provider_ref, billing_anchor = COALESCE(CASE WHEN subscriptions.provider_ref LIKE 'upay:%' THEN subscriptions.billing_anchor END, excluded.billing_anchor)`,
    ).run(userId, UPAY_PLAN, end, `upay:${ev.txid ?? ev.id}`);
    db.prepare("UPDATE upay_events SET user_id = ?, applied_at = datetime('now') WHERE id = ?").run(userId, eventId);
  });
  const member = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string | null } | undefined;
  notifyPayment({ userId, email: member?.email ?? null, plan: UPAY_PLAN, sum: ev.sum ?? PLANS[UPAY_PLAN].price, trial: false });
}

/** Handles one call from UPay. Never throws: the route always answers 200 so UPay doesn't keep retrying. */
export function handleUpayNotify(key: string | null, payload: Record<string, string>, ip: string | null): { ok: boolean; note: string } {
  const r = readUpay(payload);
  const log = (accepted: boolean, note: string, userId: number | null = null) => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO upay_events (accepted, note, txid, email, sum, success, user_id, payload, source_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(accepted ? 1 : 0, note, r.txid, r.email, r.sum, r.success, userId, JSON.stringify(redact(payload)), ip);
    return Number(lastInsertRowid);
  };
  if (!sameKey(key)) return (log(false, "bad key"), { ok: false, note: "bad key" });
  if (r.txid && db.prepare("SELECT 1 FROM upay_events WHERE txid = ? AND accepted = 1").get(r.txid)) return (log(false, "duplicate"), { ok: true, note: "duplicate" });
  const user = r.email ? getUserByEmail(r.email) : null;
  let note: string;
  if (r.success === 0) note = "החיוב נכשל";
  else if (r.success === null) note = "לא ברור אם החיוב עבר — לבדוק ולהפעיל ידנית";
  else if (r.sum !== PLANS[UPAY_PLAN].price) note = `סכום ₪${r.sum ?? "?"} (לא ₪${PLANS[UPAY_PLAN].price}) — לא הופעל אוטומטית`;
  else if (!user) note = "המייל לא תואם למשתמש — לשייך ידנית";
  else note = "ok";
  const id = log(true, note === "ok" ? "שולם — Premium הופעל" : note, user?.id ?? null);
  if (note === "ok") {
    try {
      applyUpay(id, user!.id);
    } catch (e) {
      db.prepare("UPDATE upay_events SET note = ? WHERE id = ?").run(`שגיאה בהפעלה: ${(e as Error).message}`, id);
    }
  }
  return { ok: true, note };
}

export function recentUpayEvents(limit = 60): UpayEvent[] {
  return db.prepare("SELECT * FROM upay_events ORDER BY id DESC LIMIT ?").all(limit) as UpayEvent[];
}
