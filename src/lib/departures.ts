import "server-only";
import { db } from "./db";
import { getSubscription } from "./billing";
import { isProfileComplete, type User } from "./users";
import { isTestUser } from "./test-account";
import type { DepartureReason } from "./content";

const n = (sql: string, ...args: number[]) => (db.prepare(sql).get(...args) as { n: number }).n;

/**
 * A member is deleting their own account: keep a few anonymous numbers about their time on MELA
 * (never the name, contact details or city), so the team can see where people drop off.
 */
export function recordDeparture(u: User, why?: { reason: DepartureReason; text?: string }) {
  if (u.is_demo || isTestUser(u.id)) return;
  const sub = getSubscription(u.id);
  db.prepare(
    `INSERT INTO departures (gender, age, signed_up_at, profile_complete, likes, passes, matches, messages, premium, reason, reason_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    u.gender,
    u.age,
    u.created_at,
    isProfileComplete(u) ? 1 : 0,
    n("SELECT COUNT(*) AS n FROM matches WHERE user_1_id = ? AND status <> 'rejected'", u.id),
    n("SELECT COUNT(*) AS n FROM matches WHERE user_1_id = ? AND status = 'rejected'", u.id),
    n("SELECT COUNT(*) AS n FROM matches WHERE status = 'matched' AND (user_1_id = ? OR user_2_id = ?)", u.id, u.id),
    n("SELECT COUNT(*) AS n FROM messages WHERE sender_id = ?", u.id),
    sub && sub.status !== "canceled" ? 1 : 0,
    why?.reason ?? null,
    why?.reason === "other" ? why.text?.trim().slice(0, 300) || null : null,
  );
}

export type Departure = {
  id: number;
  gender: string | null;
  age: number | null;
  signed_up_at: string | null;
  left_at: string;
  profile_complete: number;
  likes: number;
  passes: number;
  matches: number;
  messages: number;
  premium: number;
  reason: DepartureReason | null;
  reason_text: string | null;
};

/** For the admin overview: how many left lately, and the latest ones. */
export function departures(limit = 8) {
  return {
    week: n("SELECT COUNT(*) AS n FROM departures WHERE left_at >= datetime('now', '-7 days')"),
    month: n("SELECT COUNT(*) AS n FROM departures WHERE left_at >= datetime('now', '-30 days')"),
    total: n("SELECT COUNT(*) AS n FROM departures"),
    reasons: db.prepare("SELECT reason, COUNT(*) AS n FROM departures WHERE reason IS NOT NULL GROUP BY reason ORDER BY n DESC").all() as { reason: DepartureReason; n: number }[],
    recent: db.prepare("SELECT * FROM departures ORDER BY id DESC LIMIT ?").all(limit) as Departure[],
  };
}
