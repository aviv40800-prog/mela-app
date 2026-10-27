import "server-only";
import { db } from "./db";
import { cityDistanceKm } from "./cities";
import { getPrompts, getUser, type User } from "./users";
import { isAdmin } from "./admin";

/**
 * For the admin page: everyone a member could be looking for, and why each one is or isn't in their Discover —
 * so "ran out of profiles" can be told apart from "most of the community is invisible". Mirrors COMPATIBLE and
 * the Discover filters in matching.ts.
 */
export type Missing = "name" | "age" | "location" | "occupation" | "bio" | "prompts";
export const MISSING_LABEL: Record<Missing, string> = { name: "שם", age: "גיל", location: "עיר", occupation: "עיסוק", bio: "ביו", prompts: "2 שאלות פרופיל" };

export type Visibility = {
  /** "men" / "women" / "everyone" — who the member is looking for. */
  seeking: User["seeking"];
  total: number;
  seen: number;
  unseen: number;
  /** Of the unseen: they passed on the member before (shown again, after fresh faces). */
  passedOnMe: number;
  outOfRange: number;
  incomplete: number;
  missing: Partial<Record<Missing, number>>;
  notLookingForMe: number;
  banned: number;
  noGender: number;
};

function missingOf(u: User): Missing[] {
  const m: Missing[] = [];
  if (!u.full_name) m.push("name");
  if (u.age === null) m.push("age");
  if (!u.location) m.push("location");
  if (!u.occupation) m.push("occupation");
  if (!u.bio) m.push("bio");
  if (getPrompts(u.id).length < 2) m.push("prompts");
  return m;
}

export function visibilityFor(me: User): Visibility | null {
  if (!me.gender) return null;
  const ids = db.prepare("SELECT id FROM users WHERE id <> ? AND is_demo = 0 AND is_test = 0").all(me.id) as { id: number }[];
  const swiped = new Set(
    (
      db
        .prepare(
          `SELECT user_2_id AS id FROM matches WHERE user_1_id = ?
           UNION SELECT user_1_id FROM matches WHERE user_2_id = ? AND (status = 'matched' OR (status = 'rejected' AND declined_at IS NOT NULL))`,
        )
        .all(me.id, me.id) as { id: number }[]
    ).map((r) => r.id),
  );
  const blocked = new Set(
    (db.prepare("SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?").all(me.id, me.id) as { id: number }[]).map((r) => r.id),
  );
  // they passed on the member: shown again in Discover (after fresh faces), counted within "unseen"
  const passedOnMe = new Set(
    (db.prepare("SELECT user_1_id AS id FROM matches WHERE user_2_id = ? AND status = 'rejected' AND declined_at IS NULL").all(me.id) as { id: number }[]).map((r) => r.id),
  );
  const v: Visibility = { seeking: me.seeking, total: 0, seen: 0, unseen: 0, passedOnMe: 0, outOfRange: 0, incomplete: 0, missing: {}, notLookingForMe: 0, banned: 0, noGender: 0 };
  for (const { id } of ids) {
    const u = getUser(id);
    if (!u || isAdmin(u)) continue;
    if (!u.gender) {
      v.noGender++; // stopped right after the email code
      continue;
    }
    if (me.seeking !== "everyone" && u.gender !== me.seeking) continue; // not who they're looking for
    v.total++;
    // the first reason that hides them wins, in the order a member would hit it
    if (u.is_banned || blocked.has(u.id)) v.banned++;
    else if (u.seeking !== "everyone" && u.seeking !== me.gender) v.notLookingForMe++;
    else if (swiped.has(u.id)) v.seen++;
    else {
      const miss = missingOf(u);
      if (miss.length) {
        v.incomplete++;
        for (const f of miss) v.missing[f] = (v.missing[f] ?? 0) + 1;
      } else {
        const ageOk = (me.pref_age_min == null || (u.age ?? 0) >= me.pref_age_min) && (me.pref_age_max == null || (u.age ?? 0) <= me.pref_age_max);
        const km = me.pref_distance_km ? cityDistanceKm(me.location, u.location) : null;
        if (!ageOk || (km !== null && km > me.pref_distance_km!)) v.outOfRange++;
        else {
          v.unseen++;
          if (passedOnMe.has(u.id)) v.passedOnMe++;
        }
      }
    }
  }
  return v;
}
