import "server-only";
import { db } from "./db";
import { getSubscription, hasAccess } from "./billing";

/** Likes per day on the free tier (no card). Passes are always unlimited. */
export const FREE_DAILY_LIKES = Math.max(1, Number(process.env.MELA_FREE_DAILY_LIKES) || 10);
/** Daily picks a free member can open (of 3). */
export const FREE_DAILY_PICKS = 1;

export type Quota = { premium: boolean; limit: number | null; used: number; left: number | null; resetsAt: string };

const israelDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);

/** Next local midnight in Israel, as an ISO instant (handles DST by probing the offset). */
function nextIsraelMidnight(): string {
  const now = new Date();
  const today = israelDay(now);
  for (let h = 1; h <= 26; h++) {
    const t = new Date(now.getTime() + h * 3_600_000);
    if (israelDay(t) !== today) {
      // step back to the exact minute the date flipped
      let lo = now.getTime() + (h - 1) * 3_600_000;
      let hi = t.getTime();
      while (hi - lo > 60_000) {
        const mid = Math.floor((lo + hi) / 2);
        if (israelDay(new Date(mid)) === today) lo = mid;
        else hi = mid;
      }
      return new Date(hi).toISOString();
    }
  }
  return new Date(now.getTime() + 86_400_000).toISOString();
}

export function isPremium(userId: number): boolean {
  return hasAccess(getSubscription(userId));
}

export function getQuota(userId: number): Quota {
  const resetsAt = nextIsraelMidnight();
  if (isPremium(userId)) return { premium: true, limit: null, used: 0, left: null, resetsAt };
  const row = db.prepare("SELECT likes FROM daily_usage WHERE user_id = ? AND day = ?").get(userId, israelDay()) as { likes: number } | undefined;
  const used = row?.likes ?? 0;
  return { premium: false, limit: FREE_DAILY_LIKES, used, left: Math.max(0, FREE_DAILY_LIKES - used), resetsAt };
}

export function recordLike(userId: number) {
  db.prepare(
    "INSERT INTO daily_usage (user_id, day, likes) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET likes = likes + 1",
  ).run(userId, israelDay());
}
