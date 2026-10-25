import "server-only";
import { db } from "./db";
import { getUser, type User } from "./users";

/**
 * What a member actually goes for, learned from who they liked (not only from what they said): ages, places,
 * observance, photos. Used to order Discover and the matchmaker's suggestions — never shown to members.
 */
export type Taste = { likes: number; ageLo: number | null; ageHi: number | null; cities: Map<string, number>; religiosity: Map<string, number>; photoShare: number };

/** Fewer likes than this and there's nothing to learn yet. */
export const MIN_LIKES = 3;

/** Everyone the member liked: a pending or matched like they sent, or a like they gave back. */
function likedIds(userId: number): number[] {
  const rows = db
    .prepare(
      `SELECT user_2_id AS id FROM matches WHERE user_1_id = ? AND (status IN ('pending', 'matched') OR (status = 'rejected' AND declined_at IS NOT NULL))
       UNION SELECT user_1_id AS id FROM matches WHERE user_2_id = ? AND status = 'matched'`,
    )
    .all(userId, userId) as { id: number }[];
  return rows.map((r) => r.id);
}

export function tasteOf(userId: number): Taste | null {
  const liked = likedIds(userId)
    .map((id) => getUser(id))
    .filter((u): u is User => !!u);
  if (liked.length < MIN_LIKES) return null;
  const ages = liked.map((u) => u.age).filter((a): a is number => a !== null).sort((a, b) => a - b);
  const share = (key: (u: User) => string | null) => {
    const m = new Map<string, number>();
    for (const u of liked) {
      const k = key(u);
      if (k) m.set(k, (m.get(k) ?? 0) + 1 / liked.length);
    }
    return m;
  };
  return {
    likes: liked.length,
    // the middle of the range, so one outlier doesn't stretch it
    ageLo: ages.length ? ages[Math.floor(ages.length * 0.2)] : null,
    ageHi: ages.length ? ages[Math.min(ages.length - 1, Math.ceil(ages.length * 0.8) - 1)] : null,
    cities: share((u) => u.location),
    religiosity: share((u) => u.religiosity),
    photoShare: liked.filter((u) => u.photos.length > 0).length / liked.length,
  };
}

/** How well `u` fits a taste: about −12 (far from everything they like) to +14 (right in it). 0 without a taste. */
export function tasteFit(t: Taste | null, u: User): number {
  if (!t) return 0;
  let fit = 0;
  if (u.age !== null && t.ageLo !== null && t.ageHi !== null) {
    const off = u.age < t.ageLo - 1 ? t.ageLo - 1 - u.age : u.age > t.ageHi + 1 ? u.age - t.ageHi - 1 : 0;
    fit += off === 0 ? 5 : -Math.min(8, off * 1.5);
  }
  if (u.location) fit += Math.round((t.cities.get(u.location) ?? 0) * 6);
  if (u.religiosity) fit += Math.round((t.religiosity.get(u.religiosity) ?? 0) * 3);
  if (t.photoShare >= 0.8 && u.photos.length === 0) fit -= 4;
  // more likes → more confidence in what we learned
  return Math.round(fit * Math.min(1, t.likes / 8 + 0.4));
}

/** Seen lately → more likely to answer. Gone for a month → to the back. */
export function activityBoost(u: User): number {
  if (!u.last_seen_at) return -2;
  const days = (Date.now() - new Date(u.last_seen_at.replace(" ", "T") + "Z").getTime()) / 86_400_000;
  return days <= 3 ? 4 : days <= 14 ? 1 : days <= 30 ? -2 : -8;
}

/**
 * The order to show `cand` to `me`: compatibility, plus my taste, plus the chance they'd like me back (their taste,
 * or a like already waiting), plus how active they are. Tastes are cached per call site via `cache`.
 */
export function rankScore(me: User, cand: User, compatibility: number, likedYou: boolean, cache: Map<number, Taste | null> = new Map()): number {
  const taste = (id: number) => (cache.has(id) ? cache.get(id)! : (cache.set(id, tasteOf(id)), cache.get(id)!));
  return compatibility + tasteFit(taste(me.id), cand) + 0.7 * tasteFit(taste(cand.id), me) + (likedYou ? 25 : 0) + activityBoost(cand);
}
