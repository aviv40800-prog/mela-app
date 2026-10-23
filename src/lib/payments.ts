import "server-only";
import crypto from "node:crypto";
import { db, tx } from "./db";
import { PLANS, TRIAL_DAYS, trialEnabled, TRIAL_FEE, type PlanType } from "./content";
import { notifyPayment } from "./notify";

/**
 * Tranzila checkout: the member pays in Tranzila's iFrame, which also opens a standing order (My Billing)
 * for the monthly / quarterly plan. Tranzila then charges on its own every period.
 *
 *   trial (first subscription): ₪1 today to verify the card, plan price from day TRIAL_DAYS on.
 *   returning member: plan price today, then every period.
 *
 * Tranzila does not sign its notifications, so a notify is only accepted when
 *   1. it reaches the notify URL with our secret key (that URL is set in the terminal settings only, never sent
 *      to the browser),
 *   2. it names a pending order of ours and its sum, currency and terminal match that order exactly,
 *   3. Response is 000.
 */

export const isTranzilaBilling = () => process.env.BILLING_PROVIDER === "tranzila";

const IFRAME_BASE = process.env.TRANZILA_IFRAME_URL ?? "https://directng.tranzila.com";
/** recur_transaction values: 4 = monthly, 5 = quarterly. */
const RECUR: Record<PlanType, { code: string; months: number }> = {
  monthly_49: { code: "4", months: 1 },
  quarterly_119: { code: "5", months: 3 },
};

export type PaymentOrder = {
  id: string;
  user_id: number | null;
  plan_type: PlanType;
  first_sum: number;
  recur_sum: number;
  trial: number;
  recur_start: string;
  status: "pending" | "paid" | "failed";
  confirmation: string | null;
  created_at: string;
  paid_at: string | null;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

export function getOrder(id: string): PaymentOrder | null {
  return (db.prepare("SELECT * FROM payment_orders WHERE id = ?").get(id) as PaymentOrder | undefined) ?? null;
}

/** Creates a pending order and the form that opens Tranzila's iFrame for it. */
export function createCheckout(user: { id: number; full_name: string | null; email: string | null }, plan: PlanType) {
  const terminal = process.env.TRANZILA_TERMINAL;
  if (!terminal) throw new Error("TRANZILA_TERMINAL is not set");
  const p = PLANS[plan];
  const trial = trialEnabled() && !db.prepare("SELECT 1 FROM subscriptions WHERE user_id = ?").get(user.id); // one trial per member
  const now = new Date();
  const recurStart = trial ? new Date(now.getTime() + TRIAL_DAYS * 86_400_000) : addMonths(now, RECUR[plan].months);
  const order: PaymentOrder = {
    id: crypto.randomBytes(16).toString("hex"),
    user_id: user.id,
    plan_type: plan,
    first_sum: trial ? TRIAL_FEE : p.price,
    recur_sum: p.price,
    trial: trial ? 1 : 0,
    recur_start: ymd(recurStart),
    status: "pending",
    confirmation: null,
    created_at: "",
    paid_at: null,
  };
  db.prepare(
    "INSERT INTO payment_orders (id, user_id, plan_type, first_sum, recur_sum, trial, recur_start) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(order.id, user.id, plan, order.first_sum, order.recur_sum, order.trial, order.recur_start);

  const fields: Record<string, string> = {
    sum: order.first_sum.toFixed(2),
    currency: "1",
    recur_sum: order.recur_sum.toFixed(2),
    recur_transaction: RECUR[plan].code,
    recur_start_date: order.recur_start,
    pdesc: `MELA Premium · ${p.title}`,
    contact: user.full_name ?? "",
    email: user.email ?? "",
    lang: "il",
    mela_order: order.id,
  };
  return { order, action: `${IFRAME_BASE}/${encodeURIComponent(terminal)}/iframenew.php`, fields };
}

function sameKey(given: string | null) {
  const want = process.env.TRANZILA_NOTIFY_KEY ?? "";
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** What the log keeps of a notification: no full card number, ID number or token, and not our notify key (Tranzila echoes it back). */
function redact(payload: Record<string, string>): Record<string, string> {
  const key = process.env.TRANZILA_NOTIFY_KEY;
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) => {
      if (k === "TranzilaTK") return [k, `…${v.slice(-4)}`];
      if (k === "myid" || /^\d{12,19}$/.test(v)) return [k, "[redacted]"];
      return [k, key ? v.split(key).join("***") : v];
    }),
  );
}

function logEvent(orderId: string | null, accepted: boolean, note: string, payload: Record<string, string>, ip: string | null) {
  db.prepare("INSERT INTO payment_events (order_id, accepted, note, payload, source_ip) VALUES (?, ?, ?, ?, ?)").run(
    orderId,
    accepted ? 1 : 0,
    note,
    JSON.stringify(redact(payload)),
    ip,
  );
}

/** TRANZILA_NOTIFY_IPS (comma separated) pins the notify to Tranzila's servers; unset = any IP (the key still applies). */
function ipAllowed(ip: string | null) {
  const list = (process.env.TRANZILA_NOTIFY_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || (!!ip && list.includes(ip));
}

export type NotifyResult = { ok: boolean; note: string };

/** Handles one notification from Tranzila. Safe to receive more than once for the same order. */
export function handleNotify(key: string | null, payload: Record<string, string>, ip: string | null = null): NotifyResult {
  const orderId = payload.mela_order ?? null;
  const done = (ok: boolean, note: string): NotifyResult => {
    logEvent(orderId, ok, note, payload, ip);
    return { ok, note };
  };
  if (!sameKey(key)) return done(false, "bad key");
  if (!ipAllowed(ip)) return done(false, `ip not allowed: ${ip ?? "?"}`);
  const order = orderId ? getOrder(orderId) : null;
  if (!order) return done(false, "unknown order");
  if (order.status === "paid") return done(true, "already paid");
  const terminal = (process.env.TRANZILA_TERMINAL ?? "").toLowerCase();
  if (payload.supplier && payload.supplier.toLowerCase() !== terminal) return done(false, `terminal mismatch: ${payload.supplier}`);
  const approved = payload.Response === "000" || payload.Response === "0";
  if (!approved) {
    db.prepare("UPDATE payment_orders SET status = 'failed' WHERE id = ? AND status = 'pending'").run(order.id);
    return done(false, `declined: Response ${payload.Response ?? "?"}`);
  }
  if (Math.abs(Number(payload.sum) - order.first_sum) > 0.001) return done(false, `sum mismatch: ${payload.sum} ≠ ${order.first_sum}`);
  if (payload.currency && payload.currency !== "1" && payload.currency.toUpperCase() !== "ILS") return done(false, `currency mismatch: ${payload.currency}`);

  tx(() => {
    db.prepare("UPDATE payment_orders SET status = 'paid', paid_at = datetime('now'), confirmation = ? WHERE id = ?").run(
      payload.index ?? payload.ConfirmationCode ?? null, // Tranzila's transaction number, to find it in their system
      order.id,
    );
    if (order.user_id) activate(order, payload);
  });
  const member = order.user_id ? (db.prepare("SELECT email FROM users WHERE id = ?").get(order.user_id) as { email: string | null } | undefined) : undefined;
  notifyPayment({ userId: order.user_id, email: member?.email ?? null, plan: order.plan_type, sum: order.first_sum, trial: !!order.trial });
  return done(true, "paid");
}

/** Opens (or renews) the member's subscription after a paid order. */
function activate(order: PaymentOrder, payload: Record<string, string>) {
  const last4 = /(\d{4})$/.exec(payload.ccno ?? "")?.[1] ?? null; // ccno comes masked, e.g. 547707******3257
  const status = order.trial ? "trialing" : "active";
  const ref = `tranzila:${order.id}`;
  db.prepare(
    `INSERT INTO subscriptions (user_id, plan_type, status, trial_ends_at, current_period_end, provider_ref, billing_anchor, payment_last4)
     VALUES (?, ?, ?, CASE WHEN ? = 'trialing' THEN ? END, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET plan_type = excluded.plan_type, status = excluded.status,
       trial_ends_at = COALESCE(excluded.trial_ends_at, subscriptions.trial_ends_at), current_period_end = excluded.current_period_end,
       provider_ref = excluded.provider_ref, billing_anchor = excluded.billing_anchor,
       payment_last4 = COALESCE(excluded.payment_last4, subscriptions.payment_last4)`,
  ).run(order.user_id, order.plan_type, status, status, `${order.recur_start} 00:00:00`, `${order.recur_start} 00:00:00`, ref, order.recur_start, last4);
  // A returning member gets a new standing order from this checkout; an older one still waiting to be stopped
  // stays on the admin's list.
}

/**
 * The date paid-for access runs until, for a Tranzila subscription canceled today: the next charge date
 * (Tranzila charges on the anchor date and every period after it).
 */
export function accessUntil(anchor: string, plan: PlanType, now = new Date()): string {
  let d = new Date(anchor + "T00:00:00Z");
  while (d <= now) d = addMonths(d, RECUR[plan].months);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export function recentPaymentEvents(limit = 100) {
  // rows logged before redaction was tightened are cleaned the first time the admin looks
  for (const r of db.prepare("SELECT id, payload FROM payment_events ORDER BY id DESC LIMIT ?").all(limit) as { id: number; payload: string }[]) {
    const clean = JSON.stringify(redact(JSON.parse(r.payload)));
    if (clean !== r.payload) db.prepare("UPDATE payment_events SET payload = ? WHERE id = ?").run(clean, r.id);
  }
  return db.prepare("SELECT * FROM payment_events ORDER BY id DESC LIMIT ?").all(limit) as {
    id: number;
    order_id: string | null;
    accepted: number;
    note: string;
    payload: string;
    source_ip: string | null;
    received_at: string;
  }[];
}

export const isProviderBilled = (providerRef: string | null) => !!providerRef?.startsWith("tranzila:");

/** Ask the admin to stop this member's standing order in Tranzila (until cancels can be sent by API). */
export function queueProviderCancel(userId: number, reason: "canceled" | "deleted") {
  const row = db
    .prepare("SELECT s.plan_type, s.payment_last4, s.provider_ref, u.full_name, u.email FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE s.user_id = ?")
    .get(userId) as { plan_type: PlanType; payment_last4: string | null; provider_ref: string | null; full_name: string | null; email: string | null } | undefined;
  if (!row || !isProviderBilled(row.provider_ref)) return;
  if (db.prepare("SELECT 1 FROM provider_cancels WHERE user_id = ? AND done_at IS NULL").get(userId)) return;
  const ref = (db.prepare("SELECT confirmation FROM payment_orders WHERE user_id = ? AND status = 'paid' ORDER BY paid_at DESC LIMIT 1").get(userId) as
    | { confirmation: string | null }
    | undefined)?.confirmation ?? null;
  db.prepare("INSERT INTO provider_cancels (user_id, label, plan_type, last4, reason, txn_ref) VALUES (?, ?, ?, ?, ?, ?)").run(
    reason === "deleted" ? null : userId,
    [row.full_name, row.email].filter(Boolean).join(" · ") || `#${userId}`,
    row.plan_type,
    row.payment_last4,
    reason,
    ref,
  );
}

/** The member changed their mind before the admin stopped the standing order: nothing to stop. Returns whether one was open. */
export function withdrawProviderCancel(userId: number): boolean {
  return db.prepare("DELETE FROM provider_cancels WHERE user_id = ? AND done_at IS NULL").run(userId).changes > 0;
}

export type ProviderCancel = {
  id: number;
  user_id: number | null;
  label: string;
  plan_type: PlanType;
  last4: string | null;
  reason: "canceled" | "deleted";
  txn_ref: string | null;
  created_at: string;
  done_at: string | null;
};

export function listProviderCancels(done: boolean): ProviderCancel[] {
  return db.prepare(`SELECT * FROM provider_cancels WHERE done_at IS ${done ? "NOT NULL" : "NULL"} ORDER BY id DESC LIMIT 200`).all() as ProviderCancel[];
}

export function markProviderCancelDone(id: number) {
  db.prepare("UPDATE provider_cancels SET done_at = datetime('now') WHERE id = ?").run(id);
}
