import "server-only";
import { db } from "./db";
import { getPrompts, getUser, type User } from "./users";
import { getSubscription } from "./billing";

const one = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args) as T;
const count = (sql: string, ...args: (string | number)[]) => one<{ n: number }>(sql, ...args).n;

export function overview() {
  const real = "is_demo = 0";
  const subs = db
    .prepare(
      `SELECT s.status, s.plan_type, COUNT(*) AS n FROM subscriptions s JOIN users u ON u.id = s.user_id
       WHERE u.is_demo = 0 GROUP BY s.status, s.plan_type`,
    )
    .all() as { status: string; plan_type: string; n: number }[];
  const by = (status: string) => subs.filter((s) => s.status === status).reduce((a, s) => a + s.n, 0);
  // Monthly recurring revenue if every active subscription renews (quarterly plan normalised to a month).
  const mrr = subs
    .filter((s) => s.status === "active")
    .reduce((a, s) => a + s.n * (s.plan_type === "monthly_49" ? 49 : 119 / 3), 0);
  // What trials would add if they all convert.
  const trialMrr = subs
    .filter((s) => s.status === "trialing")
    .reduce((a, s) => a + s.n * (s.plan_type === "monthly_49" ? 49 : 119 / 3), 0);

  return {
    users: count(`SELECT COUNT(*) AS n FROM users WHERE ${real}`),
    demoUsers: count("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1"),
    newToday: count(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND created_at >= datetime('now', 'start of day')`),
    new7d: count(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND created_at >= datetime('now', '-7 days')`),
    active7d: count(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND last_seen_at >= datetime('now', '-7 days')`),
    incomplete: count(`SELECT COUNT(*) AS n FROM users WHERE ${real} AND (full_name IS NULL OR photos = '[]')`),
    banned: count(`SELECT COUNT(*) AS n FROM users WHERE is_banned = 1`),
    trialing: by("trialing"),
    active: by("active"),
    canceled: by("canceled"),
    pastDue: by("past_due"),
    mrr: Math.round(mrr),
    trialMrr: Math.round(trialMrr),
    matches: count("SELECT COUNT(*) AS n FROM matches WHERE status = 'matched'"),
    matches7d: count("SELECT COUNT(*) AS n FROM matches WHERE status = 'matched' AND matched_at >= datetime('now', '-7 days')"),
    likes24h: count("SELECT COUNT(*) AS n FROM matches WHERE created_at >= datetime('now', '-1 day') AND status <> 'rejected'"),
    messages24h: count("SELECT COUNT(*) AS n FROM messages WHERE sent_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')"),
    webhookFailures7d: count(
      "SELECT COUNT(*) AS n FROM webhook_deliveries WHERE created_at >= datetime('now', '-7 days') AND (status_code IS NULL OR status_code >= 400)",
    ),
  };
}

/** Real (non-demo) signups per day for the last `days` days, oldest first, zero-filled. */
export function signupsByDay(days = 14): { day: string; n: number }[] {
  const rows = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS n FROM users
       WHERE is_demo = 0 AND created_at >= date('now', ?) GROUP BY day`,
    )
    .all(`-${days - 1} days`) as { day: string; n: number }[];
  const map = new Map(rows.map((r) => [r.day, r.n]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day: d, n: map.get(d) ?? 0 };
  });
}

export type AdminUserRow = {
  id: number;
  full_name: string | null;
  phone_number: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  location: string | null;
  photo: string | null;
  is_verified: boolean;
  is_demo: boolean;
  is_banned: boolean;
  created_at: string;
  last_seen_at: string | null;
  sub_status: string | null;
  plan_type: string | null;
  matches: number;
};

export const USER_FILTERS = {
  all: { label: "כולם", where: "1 = 1" },
  real: { label: "אמיתיים", where: "u.is_demo = 0" },
  trialing: { label: "בניסיון", where: "s.status = 'trialing'" },
  active: { label: "משלמים", where: "s.status = 'active' AND u.is_demo = 0" },
  incomplete: { label: "פרופיל חלקי", where: "(u.full_name IS NULL OR u.photos = '[]')" },
  demo: { label: "דמו", where: "u.is_demo = 1" },
  banned: { label: "מושעים", where: "u.is_banned = 1" },
} as const;
export type UserFilter = keyof typeof USER_FILTERS;

export function listUsers({ q = "", filter = "all", page = 1, perPage = 25 }: { q?: string; filter?: UserFilter; page?: number; perPage?: number }) {
  const where: string[] = [USER_FILTERS[filter]?.where ?? "1 = 1"];
  const params: (string | number)[] = [];
  const term = q.trim();
  if (term) {
    where.push("(u.full_name LIKE ? OR u.phone_number LIKE ? OR u.email LIKE ? OR u.location LIKE ? OR u.occupation LIKE ?)");
    const like = `%${term.replace(/[%_]/g, "")}%`;
    const digits = term.replace(/\D/g, "").replace(/^0/, "");
    params.push(like, digits ? `%${digits}%` : like, like, like, like);
  }
  const from = `FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id WHERE ${where.join(" AND ")}`;
  const total = count(`SELECT COUNT(*) AS n ${from}`, ...params);
  const rows = db
    .prepare(
      `SELECT u.*, s.status AS sub_status, s.plan_type,
         (SELECT COUNT(*) FROM matches m WHERE m.status = 'matched' AND (m.user_1_id = u.id OR m.user_2_id = u.id)) AS matches
       ${from} ORDER BY u.is_demo ASC, u.created_at DESC, u.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, perPage, (page - 1) * perPage) as (Omit<AdminUserRow, "photo" | "is_verified" | "is_demo" | "is_banned"> & {
    photos: string;
    is_verified: number;
    is_demo: number;
    is_banned: number;
  })[];
  return {
    total,
    pages: Math.max(1, Math.ceil(total / perPage)),
    rows: rows.map(
      (r): AdminUserRow => ({
        id: r.id,
        full_name: r.full_name,
        phone_number: r.phone_number,
        email: r.email,
        age: r.age,
        gender: r.gender,
        location: r.location,
        photo: (JSON.parse(r.photos) as string[])[0] ?? null,
        is_verified: !!r.is_verified,
        is_demo: !!r.is_demo,
        is_banned: !!r.is_banned,
        created_at: r.created_at,
        last_seen_at: r.last_seen_at,
        sub_status: r.sub_status,
        plan_type: r.plan_type,
        matches: r.matches,
      }),
    ),
  };
}

export function userDetail(id: number) {
  const user = getUser(id);
  if (!user) return null;
  const stats = {
    likesSent: count("SELECT COUNT(*) AS n FROM matches WHERE user_1_id = ? AND status <> 'rejected'", id),
    likesReceived: count("SELECT COUNT(*) AS n FROM matches WHERE user_2_id = ? AND status <> 'rejected'", id),
    passes: count("SELECT COUNT(*) AS n FROM matches WHERE user_1_id = ? AND status = 'rejected'", id),
    matches: count("SELECT COUNT(*) AS n FROM matches WHERE status = 'matched' AND (user_1_id = ? OR user_2_id = ?)", id, id),
    messagesSent: count("SELECT COUNT(*) AS n FROM messages WHERE sender_id = ?", id),
    quizAnswers: count("SELECT COUNT(*) AS n FROM quiz_answers WHERE user_id = ?", id),
  };
  const matches = (
    db
      .prepare(
        `SELECT m.id, m.matched_at, CASE WHEN m.user_1_id = ? THEN m.user_2_id ELSE m.user_1_id END AS other_id,
           (SELECT COUNT(*) FROM messages WHERE match_id = m.id) AS messages
         FROM matches m WHERE m.status = 'matched' AND (m.user_1_id = ? OR m.user_2_id = ?) ORDER BY m.matched_at DESC LIMIT 20`,
      )
      .all(id, id, id) as { id: number; matched_at: string; other_id: number; messages: number }[]
  ).map((m) => ({ ...m, other: getUser(m.other_id) as User }));
  return { user, prompts: getPrompts(id), subscription: getSubscription(id), stats, matches };
}

export function recentSignups(limit = 8) {
  return listUsers({ filter: "real", perPage: limit }).rows;
}

export function recentMatches(limit = 8) {
  return (
    db
      .prepare("SELECT id, user_1_id, user_2_id, matched_at FROM matches WHERE status = 'matched' ORDER BY matched_at DESC LIMIT ?")
      .all(limit) as { id: number; user_1_id: number; user_2_id: number; matched_at: string }[]
  ).map((m) => ({ ...m, a: getUser(m.user_1_id)!, b: getUser(m.user_2_id)! }));
}

export function recentWebhooks(limit = 8) {
  return db.prepare("SELECT * FROM webhook_deliveries ORDER BY id DESC LIMIT ?").all(limit) as {
    id: number;
    event: string;
    match_id: number | null;
    target: string;
    status_code: number | null;
    error: string | null;
    created_at: string;
  }[];
}
