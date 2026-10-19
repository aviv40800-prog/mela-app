import "server-only";
import { db, tx } from "./db";
import { getSubscription, hasAccess } from "./billing";

/** Likes per day on the free tier (no card). Passes are always unlimited. */
export const FREE_DAILY_LIKES = Math.max(1, Number(process.env.MELA_FREE_DAILY_LIKES) || 5);
/** Daily picks a free member can open (of 3). */
export const FREE_DAILY_PICKS = 1;

/** Out of likes? Share MELA with this many friends to unlock SHARE_BONUS_LIKES more — once a day. */
export const SHARES_FOR_BONUS = 3;
export const SHARE_BONUS_LIKES = 5;

export type Quota = {
  premium: boolean;
  limit: number | null;
  used: number;
  left: number | null;
  resetsAt: string;
  /** Extra likes earned by inviting friends: used once the day's likes run out, and they never expire. */
  banked?: number;
  /** Today's share-for-likes progress (free members only). */
  share?: { shares: number; needed: number; bonus: number; claimed: boolean };
};

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
  const row = db.prepare("SELECT likes, shares, bonus FROM daily_usage WHERE user_id = ? AND day = ?").get(userId, israelDay()) as
    | { likes: number; shares: number; bonus: number }
    | undefined;
  const used = row?.likes ?? 0;
  const bonus = row?.bonus ?? 0;
  const banked = bankedLikes(userId);
  const left = Math.max(0, FREE_DAILY_LIKES + bonus - used) + banked;
  return {
    premium: false,
    limit: used + left,
    used,
    left,
    resetsAt,
    banked,
    share: { shares: Math.min(row?.shares ?? 0, SHARES_FOR_BONUS), needed: SHARES_FOR_BONUS, bonus: SHARE_BONUS_LIKES, claimed: bonus > 0 },
  };
}

/**
 * Count one invite share for today. The third share unlocks SHARE_BONUS_LIKES extra likes, once per day.
 * (Shares happen in the member's own share sheet / WhatsApp, so this is trust-based by design — capped daily.)
 */
export function recordShare(userId: number): Quota {
  const day = israelDay();
  db.prepare(
    `INSERT INTO daily_usage (user_id, day, likes, shares) VALUES (?, ?, 0, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET shares = MIN(shares + 1, ?)`,
  ).run(userId, day, SHARES_FOR_BONUS);
  db.prepare("UPDATE daily_usage SET bonus = ? WHERE user_id = ? AND day = ? AND shares >= ? AND bonus = 0").run(
    SHARE_BONUS_LIKES,
    userId,
    day,
    SHARES_FOR_BONUS,
  );
  return getQuota(userId);
}

export function bankedLikes(userId: number): number {
  return (db.prepare("SELECT bonus_likes FROM users WHERE id = ?").get(userId) as { bonus_likes: number } | undefined)?.bonus_likes ?? 0;
}

/** Counts a like; once the day's own likes are spent, it comes out of the banked invite likes. */
export function recordLike(userId: number) {
  const day = israelDay();
  tx(() => {
    const row = db.prepare("SELECT likes, bonus FROM daily_usage WHERE user_id = ? AND day = ?").get(userId, day) as { likes: number; bonus: number } | undefined;
    if ((row?.likes ?? 0) >= FREE_DAILY_LIKES + (row?.bonus ?? 0)) {
      db.prepare("UPDATE users SET bonus_likes = MAX(0, bonus_likes - 1) WHERE id = ?").run(userId);
    }
    db.prepare(
      "INSERT INTO daily_usage (user_id, day, likes) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET likes = likes + 1",
    ).run(userId, day);
  });
}
