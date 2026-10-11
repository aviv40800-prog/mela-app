import "server-only";
import { db, tx } from "./db";
import { getUser, toPublic, type PublicProfile, type User } from "./users";
import { publish } from "./events";
import { triggerMatchWhatsApp } from "./whatsapp";
import { insertMessage } from "./chat";
import { promptQuestion } from "./content";

export type MatchStatus = "pending" | "matched" | "rejected";
type MatchRow = { id: number; user_1_id: number; user_2_id: number; status: MatchStatus; created_at: string; matched_at: string | null };

export type Candidate = PublicProfile & { compatibility: number; likedYou: boolean };

/** SQL fragment: other users that are mutually compatible by gender preference with :me. */
const COMPATIBLE = `
  u.id <> :me AND u.full_name IS NOT NULL AND u.gender IS NOT NULL
  AND (:seeking = 'everyone' OR u.gender = :seeking)
  AND (u.seeking = 'everyone' OR u.seeking = :gender)
`;

/** Compatibility 50–99: "This or That" agreement, same city, age proximity. */
export function compatibility(me: number, other: number): number {
  const { agree, total } = db
    .prepare(
      `SELECT SUM(a.choice = b.choice) AS agree, COUNT(*) AS total FROM quiz_answers a
       JOIN quiz_answers b ON b.question_key = a.question_key AND b.user_id = ? WHERE a.user_id = ?`,
    )
    .get(other, me) as { agree: number | null; total: number };
  const u1 = getUser(me)!;
  const u2 = getUser(other)!;
  let score = total > 0 ? 55 + Math.round(((agree ?? 0) / total) * 30) : 68;
  if (u1.location && u1.location === u2.location) score += 8;
  if (u1.age && u2.age) score -= Math.min(10, Math.max(0, Math.abs(u1.age - u2.age) - 3) * 2);
  return Math.max(50, Math.min(99, score));
}

function candidateIds(me: User, limit: number): number[] {
  const rows = db
    .prepare(
      `SELECT u.id FROM users u
       WHERE ${COMPATIBLE}
         AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.user_1_id = :me AND m.user_2_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.user_1_id = u.id AND m.user_2_id = :me AND m.status <> 'pending')
       ORDER BY u.id DESC LIMIT :limit`,
    )
    .all({ me: me.id, seeking: me.seeking, gender: me.gender, limit }) as { id: number }[];
  return rows.map((r) => r.id);
}

function likedMe(me: number, other: number): boolean {
  return !!db.prepare("SELECT 1 FROM matches WHERE user_1_id = ? AND user_2_id = ? AND status = 'pending'").get(other, me);
}

function toCandidate(me: number, id: number): Candidate {
  return { ...toPublic(getUser(id)!), compatibility: compatibility(me, id), likedYou: likedMe(me, id) };
}

export function discoveryDeck(me: User, limit = 20): Candidate[] {
  return candidateIds(me, 200)
    .map((id) => toCandidate(me.id, id))
    .sort((a, b) => b.compatibility - a.compatibility)
    .slice(0, limit);
}

/** 3 curated picks per day, fixed for the calendar day (Asia/Jerusalem). */
export function dailyPicks(me: User): Candidate[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  let ids = (
    db.prepare("SELECT pick_user_id AS id FROM daily_picks WHERE user_id = ? AND pick_date = ? ORDER BY score DESC, pick_user_id DESC").all(me.id, today) as {
      id: number;
    }[]
  ).map((r) => r.id);
  if (ids.length === 0) {
    const picks = candidateIds(me, 200)
      .map((id) => ({ id, score: compatibility(me.id, id) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const ins = db.prepare("INSERT OR IGNORE INTO daily_picks (user_id, pick_user_id, pick_date, score) VALUES (?, ?, ?, ?)");
    for (const p of picks) ins.run(me.id, p.id, today, p.score);
    ids = picks.map((p) => p.id);
  }
  return ids.map((id) => toCandidate(me.id, id));
}

export type SwipeResult = { status: MatchStatus; matchId: number; isNewMatch: boolean };

export function swipe(
  meId: number,
  targetId: number,
  action: "like" | "pass",
  comment?: { text: string; promptKey?: string },
): SwipeResult {
  if (meId === targetId) throw new Error("cannot swipe on yourself");
  const me = getUser(meId);
  const target = getUser(targetId);
  if (!me || !target) throw new Error("user not found");

  const result = tx((): SwipeResult => {
    const theirs = db.prepare("SELECT * FROM matches WHERE user_1_id = ? AND user_2_id = ?").get(targetId, meId) as MatchRow | undefined;
    const mine = db.prepare("SELECT * FROM matches WHERE user_1_id = ? AND user_2_id = ?").get(meId, targetId) as MatchRow | undefined;
    if (mine) return { status: mine.status, matchId: mine.id, isNewMatch: false };

    if (theirs) {
      if (theirs.status === "matched") return { status: "matched", matchId: theirs.id, isNewMatch: false };
      if (theirs.status === "pending") {
        const status: MatchStatus = action === "like" ? "matched" : "rejected";
        db.prepare("UPDATE matches SET status = ?, matched_at = CASE WHEN ? = 'matched' THEN datetime('now') END WHERE id = ?").run(
          status,
          status,
          theirs.id,
        );
        if (comment && action === "like") insertMessage(theirs.id, meId, formatComment(comment));
        return { status, matchId: theirs.id, isNewMatch: status === "matched" };
      }
      // They already passed: record my swipe as rejected so the card doesn't come back.
    }

    const status: MatchStatus = action === "like" && theirs?.status !== "rejected" ? "pending" : "rejected";
    const { lastInsertRowid } = db.prepare("INSERT INTO matches (user_1_id, user_2_id, status) VALUES (?, ?, ?)").run(meId, targetId, status);
    const matchId = Number(lastInsertRowid);
    if (comment && status === "pending") insertMessage(matchId, meId, formatComment(comment));
    return { status, matchId, isNewMatch: false };
  });

  if (result.isNewMatch) {
    publish(meId, { type: "match", matchId: result.matchId, withUserId: targetId });
    publish(targetId, { type: "match", matchId: result.matchId, withUserId: meId });
    void triggerMatchWhatsApp(result.matchId, me, target);
  }
  return result;
}

function formatComment(c: { text: string; promptKey?: string }) {
  return c.promptKey ? `💬 על ״${promptQuestion(c.promptKey)}״\n${c.text}` : c.text;
}

export type MatchSummary = {
  matchId: number;
  other: PublicProfile;
  matchedAt: string | null;
  lastMessage: { text: string; sentAt: string; fromMe: boolean } | null;
  unread: number;
};

export function listMatches(meId: number): MatchSummary[] {
  const rows = db
    .prepare(
      `SELECT m.id, m.matched_at, CASE WHEN m.user_1_id = :me THEN m.user_2_id ELSE m.user_1_id END AS other_id,
         (SELECT text_content FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_text,
         (SELECT sent_at FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_at,
         (SELECT sender_id FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1) AS last_sender,
         (SELECT COUNT(*) FROM messages WHERE match_id = m.id AND sender_id <> :me AND is_read = 0) AS unread
       FROM matches m
       WHERE m.status = 'matched' AND (m.user_1_id = :me OR m.user_2_id = :me)
       ORDER BY COALESCE(last_at, m.matched_at) DESC`,
    )
    .all({ me: meId }) as {
    id: number;
    matched_at: string | null;
    other_id: number;
    last_text: string | null;
    last_at: string | null;
    last_sender: number | null;
    unread: number;
  }[];
  return rows.map((r) => ({
    matchId: r.id,
    other: toPublic(getUser(r.other_id)!),
    matchedAt: r.matched_at,
    lastMessage: r.last_text ? { text: r.last_text, sentAt: r.last_at!, fromMe: r.last_sender === meId } : null,
    unread: r.unread,
  }));
}

/** Members who liked me and are waiting for my answer (with their opening comment, if any). */
export function likesReceived(meId: number): (PublicProfile & { comment: string | null })[] {
  const rows = db
    .prepare(
      `SELECT m.user_1_id AS id, (SELECT text_content FROM messages WHERE match_id = m.id ORDER BY id LIMIT 1) AS comment
       FROM matches m WHERE m.user_2_id = ? AND m.status = 'pending' ORDER BY m.id DESC`,
    )
    .all(meId) as { id: number; comment: string | null }[];
  return rows.map((r) => ({ ...toPublic(getUser(r.id)!), comment: r.comment }));
}

/** Returns the other participant if `meId` belongs to a *matched* match. */
export function matchPartner(matchId: number, meId: number): User | null {
  const m = db.prepare("SELECT * FROM matches WHERE id = ? AND status = 'matched'").get(matchId) as MatchRow | undefined;
  if (!m || (m.user_1_id !== meId && m.user_2_id !== meId)) return null;
  return getUser(m.user_1_id === meId ? m.user_2_id : m.user_1_id);
}
