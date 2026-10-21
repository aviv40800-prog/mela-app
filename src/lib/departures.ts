import "server-only";
import { db } from "./db";
import { getSubscription } from "./billing";
import { isProfileComplete, type User } from "./users";
import { isTestUser } from "./test-account";

const n = (sql: string, ...args: number[]) => (db.prepare(sql).get(...args) as { n: number }).n;

/**
 * A member is deleting their own account: keep a few anonymous numbers about their time on MELA
 * (never the name, contact details or city), so the team can see where people drop off.
 */
export function recordDeparture(u: User) {
  if (u.is_demo || isTestUser(u.id)) return;
  const sub = getSubscription(u.id);
  db.prepare(
    `INSERT INTO departures (gender, age, signed_up_at, profile_complete, likes, passes, matches, messages, premium)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
};

/** For the admin overview: how many left lately, and the latest ones. */
export function departures(limit = 8) {
  return {
    week: n("SELECT COUNT(*) AS n FROM departures WHERE left_at >= datetime('now', '-7 days')"),
    month: n("SELECT COUNT(*) AS n FROM departures WHERE left_at >= datetime('now', '-30 days')"),
    total: n("SELECT COUNT(*) AS n FROM departures"),
    recent: db.prepare("SELECT * FROM departures ORDER BY id DESC LIMIT ?").all(limit) as Departure[],
  };
}
