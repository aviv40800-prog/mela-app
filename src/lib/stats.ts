import "server-only";
import { db } from "./db";
import { genderSplit, overview, signupsByDay } from "./admin-data";
import { signupFunnel } from "./signup-stage";
import { departures } from "./departures";
import { featuredResults } from "./checkin";
import { aiUsageStats } from "./ai-onboarding";
import { FREE_DAILY_LIKES } from "./quota";

/**
 * Numbers only, for the read-only stats endpoint (GET /api/admin/stats with MELA_STATS_TOKEN): how the community
 * grows, where sign-up stops, and where the money comes from and stops. Never names, contact details, cities of a
 * single person or message content — every row below is a count, a sum, or an anonymous per-payer summary.
 */
const all = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).all(...args) as T[];
const one = <T>(sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args) as T;
const n = (sql: string, ...args: (string | number)[]) => one<{ n: number }>(sql, ...args).n;
const REAL = "u.is_demo = 0 AND u.is_test = 0";

/** First paid order per member, with what happened before it — the "what makes people pay" picture. */
function payers() {
  const rows = all<{ user_id: number; plan_type: string; first_sum: number; paid_at: string; created_at: string; gender: string | null; age: number | null }>(
    `SELECT o.user_id, o.plan_type, o.first_sum, o.paid_at, u.created_at, u.gender, u.age FROM payment_orders o JOIN users u ON u.id = o.user_id
     WHERE o.status = 'paid' AND ${REAL} AND o.paid_at = (SELECT MIN(paid_at) FROM payment_orders WHERE user_id = o.user_id AND status = 'paid')`,
  );
  return rows.map((r) => {
    const before = (sql: string) => n(sql, r.user_id, r.paid_at);
    const sub = one<{ status: string } | undefined>("SELECT status FROM subscriptions WHERE user_id = ?", r.user_id);
    return {
      gender: r.gender,
      ageBand: r.age ? `${Math.floor(r.age / 5) * 5}–${Math.floor(r.age / 5) * 5 + 4}` : null,
      plan: r.plan_type,
      paid: r.first_sum,
      daysFromSignup: Math.round(((Date.parse(r.paid_at.replace(" ", "T") + "Z") - Date.parse(r.created_at.replace(" ", "T") + "Z")) / 86_400_000) * 10) / 10,
      likesSentBefore: before("SELECT COUNT(*) AS n FROM matches WHERE user_1_id = ? AND status <> 'rejected' AND created_at < ?"),
      likesReceivedBefore: before("SELECT COUNT(*) AS n FROM matches WHERE user_2_id = ? AND created_at < ?"),
      matchesBefore: before("SELECT COUNT(*) AS n FROM matches m WHERE status = 'matched' AND (user_1_id = ?1 OR user_2_id = ?1) AND matched_at < ?2"),
      hitLikeLimitBefore: !!before(`SELECT COUNT(*) AS n FROM daily_usage WHERE user_id = ? AND likes >= ${FREE_DAILY_LIKES} AND day <= substr(?, 1, 10)`),
      subscriptionNow: sub?.status ?? null,
    };
  });
}

/** Free → paid: how many reached each step that tends to come before paying. */
function moneyFunnel() {
  const complete = n(`SELECT COUNT(*) AS n FROM users u WHERE ${REAL} AND full_name IS NOT NULL AND bio IS NOT NULL`);
  return {
    completeProfiles: complete,
    likedSomeone: n(`SELECT COUNT(DISTINCT m.user_1_id) AS n FROM matches m JOIN users u ON u.id = m.user_1_id WHERE ${REAL} AND m.status <> 'rejected'`),
    gotALike: n(`SELECT COUNT(DISTINCT m.user_2_id) AS n FROM matches m JOIN users u ON u.id = m.user_2_id WHERE ${REAL}`),
    gotAMatch: n(
      `SELECT COUNT(*) AS n FROM users u WHERE ${REAL} AND EXISTS (SELECT 1 FROM matches m WHERE m.status = 'matched' AND (m.user_1_id = u.id OR m.user_2_id = u.id))`,
    ),
    hitDailyLikeLimit: n(`SELECT COUNT(DISTINCT d.user_id) AS n FROM daily_usage d JOIN users u ON u.id = d.user_id WHERE ${REAL} AND d.likes >= ${FREE_DAILY_LIKES}`),
    startedCheckout: n(`SELECT COUNT(DISTINCT o.user_id) AS n FROM payment_orders o JOIN users u ON u.id = o.user_id WHERE ${REAL}`),
    paid: n(`SELECT COUNT(DISTINCT o.user_id) AS n FROM payment_orders o JOIN users u ON u.id = o.user_id WHERE ${REAL} AND o.status = 'paid'`),
    freeDailyLikes: FREE_DAILY_LIKES,
  };
}

function revenue() {
  const sum = (days: number) =>
    one<{ n: number; total: number | null }>(
      `SELECT COUNT(*) AS n, SUM(o.first_sum) AS total FROM payment_orders o JOIN users u ON u.id = o.user_id
       WHERE ${REAL} AND o.status = 'paid' AND o.paid_at >= datetime('now', ?)`,
      `-${days} days`,
    );
  const d7 = sum(7);
  const d30 = sum(30);
  return {
    paidOrders7d: d7.n,
    revenue7d: d7.total ?? 0,
    paidOrders30d: d30.n,
    revenue30d: d30.total ?? 0,
    failedOrders30d: n(`SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'failed' AND created_at >= datetime('now', '-30 days')`),
    abandonedCheckouts30d: n(`SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'pending' AND created_at >= datetime('now', '-30 days')`),
    paidByDay: all<{ day: string; n: number; total: number }>(
      `SELECT date(o.paid_at) AS day, COUNT(*) AS n, SUM(o.first_sum) AS total FROM payment_orders o JOIN users u ON u.id = o.user_id
       WHERE ${REAL} AND o.status = 'paid' AND o.paid_at >= date('now', '-60 days') GROUP BY day ORDER BY day`,
    ),
    cancellations: {
      total: n("SELECT COUNT(*) AS n FROM provider_cancels WHERE reason = 'canceled'"),
      last30d: n("SELECT COUNT(*) AS n FROM provider_cancels WHERE reason = 'canceled' AND created_at >= datetime('now', '-30 days')"),
      byDeletingAccount: n("SELECT COUNT(*) AS n FROM provider_cancels WHERE reason = 'deleted'"),
    },
  };
}

function engagement() {
  return {
    likes7d: n("SELECT COUNT(*) AS n FROM matches WHERE status <> 'rejected' AND created_at >= datetime('now', '-7 days')"),
    passes7d: n("SELECT COUNT(*) AS n FROM matches WHERE status = 'rejected' AND created_at >= datetime('now', '-7 days')"),
    matches7d: n("SELECT COUNT(*) AS n FROM matches WHERE status = 'matched' AND matched_at >= datetime('now', '-7 days')"),
    chatsWithMessages: n("SELECT COUNT(DISTINCT match_id) AS n FROM messages"),
    chatsWithBothSides: n("SELECT COUNT(*) AS n FROM (SELECT match_id FROM messages GROUP BY match_id HAVING COUNT(DISTINCT sender_id) >= 2)"),
    suggestions: {
      queuedPending: n("SELECT COUNT(*) AS n FROM suggestion_queue WHERE status = 'pending'"),
      queuedSent: n("SELECT COUNT(*) AS n FROM suggestion_queue WHERE status = 'sent'"),
      queuedRejected: n("SELECT COUNT(*) AS n FROM suggestion_queue WHERE status = 'rejected'"),
      sentTotal: n("SELECT COUNT(*) AS n FROM match_suggestions"),
      becameMatch: n(
        `SELECT COUNT(*) AS n FROM match_suggestions s WHERE EXISTS (SELECT 1 FROM matches m WHERE m.status = 'matched'
           AND ((m.user_1_id = s.user_a AND m.user_2_id = s.user_b) OR (m.user_1_id = s.user_b AND m.user_2_id = s.user_a)))`,
      ),
    },
  };
}

export function statsSnapshot() {
  const o = overview();
  const ai = aiUsageStats();
  const fq = featuredResults();
  const left = departures(0);
  return {
    generatedAt: new Date().toISOString(),
    community: {
      users: o.users,
      new7d: o.new7d,
      newToday: o.newToday,
      active7d: o.active7d,
      byGender: genderSplit(),
      signupsByDay: signupsByDay(30),
      signupFunnel: signupFunnel(),
    },
    money: {
      premiumNow: o.premiumNow,
      active: o.active,
      trialing: o.trialing,
      canceled: o.canceled,
      pastDue: o.pastDue,
      mrr: o.mrr,
      conversionPct: o.conversion,
      funnel: moneyFunnel(),
      ...revenue(),
      payers: payers(),
    },
    engagement: engagement(),
    departures: { week: left.week, month: left.month, total: left.total, reasons: left.reasons },
    featuredQuestion: fq ? { key: fq.q.key, a: fq.q.a, b: fq.q.b, answeredA: fq.a, answeredB: fq.b } : null,
    aiSignup: { enabled: ai.enabled, today: ai.today, month: ai.month },
  };
}
