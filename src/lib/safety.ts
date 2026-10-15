import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db, tx } from "./db";
import { UPLOAD_DIR } from "./paths";
import { getUser } from "./users";

/** Why a member can report someone. Keys are stored; labels are shown. */
export const REPORT_REASONS = {
  harassment: "הטרדה או התנהגות פוגענית",
  fake: "פרופיל מזויף או התחזות",
  scam: "בקשת כסף או ניסיון הונאה",
  sexual: "תוכן מיני לא רצוי",
  underage: "נראה/ית מתחת לגיל 18",
  other: "סיבה אחרת",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

/** The match row between two members, whichever of them liked first. */
function pairMatch(a: number, b: number) {
  return db
    .prepare("SELECT id, status FROM matches WHERE (user_1_id = ? AND user_2_id = ?) OR (user_1_id = ? AND user_2_id = ?)")
    .get(a, b, b, a) as { id: number; status: string } | undefined;
}

export function isBlockedEitherWay(a: number, b: number): boolean {
  return !!db.prepare("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)").get(a, b, b, a);
}

/**
 * Block: the two never see each other again. Any like, match or chat between them is closed (the match row
 * becomes 'rejected', which already keeps both out of each other's discovery, picks and matches, and chat
 * only opens on 'matched'). Messages are kept so a report can still be reviewed.
 */
export function blockUser(meId: number, otherId: number) {
  if (meId === otherId) throw new Error("self");
  tx(() => {
    db.prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)").run(meId, otherId);
    const m = pairMatch(meId, otherId);
    if (m) db.prepare("UPDATE matches SET status = 'rejected' WHERE id = ?").run(m.id);
    else db.prepare("INSERT INTO matches (user_1_id, user_2_id, status) VALUES (?, ?, 'rejected')").run(meId, otherId);
    db.prepare("DELETE FROM daily_picks WHERE (user_id = ? AND pick_user_id = ?) OR (user_id = ? AND pick_user_id = ?)").run(meId, otherId, otherId, meId);
  });
}

/** Report a member to the admin, with a copy of the chat between them (last 60 messages). */
export function reportUser(meId: number, otherId: number, reason: ReportReason, details: string | null) {
  const m = pairMatch(meId, otherId);
  const chat = m
    ? (
        db
          .prepare("SELECT sender_id, text_content, sent_at FROM messages WHERE match_id = ? ORDER BY id DESC LIMIT 60")
          .all(m.id) as { sender_id: number; text_content: string; sent_at: string }[]
      ).reverse()
    : [];
  db.prepare("INSERT INTO reports (reporter_id, reported_id, reason, details, chat) VALUES (?, ?, ?, ?, ?)").run(
    meId,
    otherId,
    reason,
    details,
    JSON.stringify(chat),
  );
}

export type ReportRow = {
  id: number;
  reporter_id: number | null;
  reported_id: number | null;
  reporter_name: string | null;
  reported_name: string | null;
  reported_banned: number | null;
  reason: ReportReason;
  details: string | null;
  chat: { sender_id: number; text_content: string; sent_at: string }[];
  status: "open" | "handled";
  created_at: string;
  times_reported: number;
};

export function listReports(status: "open" | "handled"): ReportRow[] {
  const rows = db
    .prepare(
      `SELECT r.*, a.full_name AS reporter_name, b.full_name AS reported_name, b.is_banned AS reported_banned,
              (SELECT COUNT(*) FROM reports r2 WHERE r2.reported_id = r.reported_id) AS times_reported
       FROM reports r LEFT JOIN users a ON a.id = r.reporter_id LEFT JOIN users b ON b.id = r.reported_id
       WHERE r.status = ? ORDER BY r.id DESC LIMIT 200`,
    )
    .all(status) as (Omit<ReportRow, "chat"> & { chat: string })[];
  return rows.map((r) => ({ ...r, chat: JSON.parse(r.chat) }));
}

export function openReportsCount(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").get() as { n: number }).n;
}

export function setReportStatus(id: number, status: "open" | "handled") {
  db.prepare("UPDATE reports SET status = ?, handled_at = CASE WHEN ? = 'handled' THEN datetime('now') END WHERE id = ?").run(status, status, id);
}

/**
 * A member deletes their own account: the profile, photos, likes, matches and messages go (ON DELETE CASCADE);
 * their photo files are removed from disk. Reports they made or received stay, without the link to the account.
 */
export function deleteOwnAccount(userId: number) {
  const user = getUser(userId);
  if (!user) return;
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  for (const url of user.photos) {
    const name = /^\/api\/photos\/([\w-]+\.(?:jpg|png|webp))$/.exec(url)?.[1];
    if (name) fs.promises.unlink(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name)).catch(() => {});
  }
}
