import "server-only";
import { db } from "./db";

/** Where a plans-page visit came from. Only the Premium tab is tracked for now. */
export type PlanSource = "nav";

export function recordPlanView(userId: number, source: PlanSource) {
  db.prepare("INSERT OR IGNORE INTO plan_views (user_id, source, day) VALUES (?, ?, date('now'))").run(userId, source);
}

/** The Premium tab: how many free members opened the plans from it, and how many of them paid afterwards. */
export function premiumTabStats() {
  const row = (days: number | null) =>
    db
      .prepare(
        `SELECT COUNT(*) AS opened, SUM(EXISTS (SELECT 1 FROM payment_orders o WHERE o.user_id = v.user_id AND o.status = 'paid' AND o.paid_at >= v.first)) AS paid
         FROM (SELECT user_id, MIN(created_at) AS first FROM plan_views WHERE source = 'nav' ${days ? "AND created_at >= datetime('now', ?)" : ""} GROUP BY user_id) v`,
      )
      .get(...(days ? [`-${days} days`] : [])) as { opened: number; paid: number | null };
  const week = row(7);
  const all = row(null);
  return { opened7d: week.opened, paid7d: week.paid ?? 0, openedTotal: all.opened, paidTotal: all.paid ?? 0 };
}
