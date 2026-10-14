import "server-only";
import { db } from "./db";

export type CommunityStatus = "pending" | "approved" | "rejected";
export type CommunityQuestion = { id: number; user_id: number | null; text: string; status: CommunityStatus; created_at: string; author: string | null };

/** Members can suggest at most this many questions a day (keeps the review queue sane). */
export const DAILY_SUGGESTIONS = 3;

/** Starter inspiration, shown until the community has approved questions of its own. */
export const SEED_INSPIRATION = ["איך נראה אצלך חג בבית?", "מה למדת מההורים שלך?", "מה המאכל של סבתא שהכי חסר לך?", "איפה תהיה/י בעוד 5 שנים?"];

const clean = (t: string) => t.replace(/\s+/g, " ").trim();

export function suggestQuestion(userId: number, text: string): { ok: true; id: number } | { ok: false; reason: "short" | "long" | "limit" | "duplicate" } {
  const t = clean(text);
  if (t.length < 8) return { ok: false, reason: "short" };
  if (t.length > 160) return { ok: false, reason: "long" };
  const today = db.prepare("SELECT COUNT(*) AS n FROM community_questions WHERE user_id = ? AND created_at >= datetime('now', '-1 day')").get(userId) as { n: number };
  if (today.n >= DAILY_SUGGESTIONS) return { ok: false, reason: "limit" };
  const dup = db.prepare("SELECT 1 FROM community_questions WHERE lower(text) = lower(?)").get(t);
  if (dup) return { ok: false, reason: "duplicate" };
  const { lastInsertRowid } = db.prepare("INSERT INTO community_questions (user_id, text) VALUES (?, ?)").run(userId, t);
  return { ok: true, id: Number(lastInsertRowid) };
}

export function listCommunityQuestions(status: CommunityStatus | "all" = "pending", limit = 200): CommunityQuestion[] {
  return db
    .prepare(
      `SELECT q.id, q.user_id, q.text, q.status, q.created_at, u.full_name AS author
       FROM community_questions q LEFT JOIN users u ON u.id = q.user_id
       ${status === "all" ? "" : "WHERE q.status = ?"} ORDER BY q.id DESC LIMIT ${Math.max(1, Math.min(500, limit))}`,
    )
    .all(...(status === "all" ? [] : [status])) as CommunityQuestion[];
}

export function countByStatus(): Record<CommunityStatus, number> {
  const rows = db.prepare("SELECT status, COUNT(*) AS n FROM community_questions GROUP BY status").all() as { status: CommunityStatus; n: number }[];
  return { pending: 0, approved: 0, rejected: 0, ...Object.fromEntries(rows.map((r) => [r.status, r.n])) };
}

export function reviewQuestion(id: number, status: CommunityStatus, text?: string): boolean {
  const res = db
    .prepare("UPDATE community_questions SET status = ?, text = COALESCE(?, text), reviewed_at = datetime('now') WHERE id = ?")
    .run(status, text ? clean(text) : null, id);
  return res.changes > 0;
}

/** Approved questions, newest first — the pool for chat "idea for a question" and pause inspiration. */
export function approvedQuestions(limit = 60): string[] {
  return (db.prepare("SELECT text FROM community_questions WHERE status = 'approved' ORDER BY id DESC LIMIT ?").all(limit) as { text: string }[]).map((r) => r.text);
}
