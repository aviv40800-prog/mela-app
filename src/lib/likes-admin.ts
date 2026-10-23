import "server-only";
import { db } from "./db";
import { getUser } from "./users";

/** For the admin page: who a member liked and who liked them — to suggest matches in their taste. Never messages. */
export type LikeState = "waiting" | "match" | "declined";
export type LikeRow = { id: number; name: string; age: number | null; location: string | null; photo: string | null; state: LikeState; at: string };

type M = { id: number; user_1_id: number; user_2_id: number; status: string; declined_at: string | null; created_at: string; matched_at: string | null };

function rows(userId: number): M[] {
  return db
    .prepare("SELECT id, user_1_id, user_2_id, status, declined_at, created_at, matched_at FROM matches WHERE user_1_id = ? OR user_2_id = ? ORDER BY id DESC")
    .all(userId, userId) as M[];
}

function person(id: number, state: LikeState, at: string): LikeRow[] {
  const u = getUser(id);
  if (!u) return [];
  return [{ id, name: u.full_name ?? "", age: u.age, location: u.location, photo: u.photos[0] ?? null, state, at }];
}

/**
 * Likes the member gave: waiting for an answer, a match, or declined by the other side. (A like that answered someone
 * else's like is a match too.) Passes aren't likes and aren't listed.
 */
export function likesSent(userId: number): LikeRow[] {
  return rows(userId).flatMap((m) => {
    if (m.user_1_id === userId) {
      if (m.status === "pending") return person(m.user_2_id, "waiting", m.created_at);
      if (m.status === "matched") return person(m.user_2_id, "match", m.matched_at ?? m.created_at);
      if (m.status === "rejected" && m.declined_at) return person(m.user_2_id, "declined", m.declined_at);
      return [];
    }
    return m.status === "matched" ? person(m.user_1_id, "match", m.matched_at ?? m.created_at) : [];
  });
}

/** Likes the member got: waiting for their answer, a match, or one they passed on ("declined" = they said no). */
export function likesReceived(userId: number): LikeRow[] {
  return rows(userId).flatMap((m) => {
    if (m.user_2_id === userId) {
      if (m.status === "pending") return person(m.user_1_id, "waiting", m.created_at);
      if (m.status === "matched") return person(m.user_1_id, "match", m.matched_at ?? m.created_at);
      if (m.status === "rejected" && m.declined_at) return person(m.user_1_id, "declined", m.declined_at);
      return [];
    }
    return m.status === "matched" ? person(m.user_2_id, "match", m.matched_at ?? m.created_at) : [];
  });
}

/** One line on what the member goes for: age range, top places, how many had a photo. Null with fewer than 3 likes. */
export function tasteSummary(sent: LikeRow[]): string | null {
  if (sent.length < 3) return null;
  const ages = sent.map((r) => r.age).filter((a): a is number => a !== null).sort((a, b) => a - b);
  const parts: string[] = [];
  if (ages.length) {
    // the middle of the range, so one outlier doesn't stretch it
    const lo = ages[Math.floor(ages.length * 0.2)];
    const hi = ages[Math.min(ages.length - 1, Math.ceil(ages.length * 0.8) - 1)];
    parts.push(lo === hi ? `בעיקר בני/ות ${lo}` : `בעיקר גילאי ${lo}–${hi}`);
  }
  const places = new Map<string, number>();
  for (const r of sent) if (r.location) places.set(r.location, (places.get(r.location) ?? 0) + 1);
  const top = [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => p);
  if (top.length) parts.push(`מ${top.join(" ומ")}`);
  const withPhoto = Math.round((sent.filter((r) => r.photo).length / sent.length) * 100);
  parts.push(`${withPhoto}% עם תמונה`);
  return `עושה לייק ${parts.join(", ")} (${sent.length} לייקים)`;
}
