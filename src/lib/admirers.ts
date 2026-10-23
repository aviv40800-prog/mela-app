import "server-only";
import { db, tx } from "./db";
import { getUser } from "./users";
import { publish } from "./events";
import { triggerMatchWhatsApp } from "./whatsapp";
import { toCandidate } from "./matching";
import type { Candidate } from "./types";

export type AdmirerKind = "match" | "liked" | "passed";
export type Admirer =
  | { id: number; kind: AdmirerKind; at: string; locked: false; matchId: number | null; card: Candidate }
  /** Who it is stays hidden: no id, name or photo leaves the server (a blurred placeholder card is shown). */
  | { id: number; kind: "liked"; at: string; locked: true };

type Row = { id: number; status: string; user_1_id: number; user_2_id: number; at: string };

/**
 * "People who liked you" in Picks, newest first: likes waiting for an answer, and likes the member passed on
 * (so they can give someone a second chance). Matches live in the Matches tab. Without the people they removed,
 * blocked, or who left.
 */
export function admirers(meId: number, premium: boolean): Admirer[] {
  const rows = db
    .prepare(
      `SELECT m.id, m.status, m.user_1_id, m.user_2_id, COALESCE(m.declined_at, m.created_at) AS at FROM matches m
       WHERE (m.user_2_id = :me AND m.status = 'pending')
          OR (m.user_2_id = :me AND m.status = 'rejected' AND m.declined_at IS NOT NULL)
       ORDER BY at DESC, m.id DESC`,
    )
    .all({ me: meId }) as Row[];
  const hidden = new Set((db.prepare("SELECT other_id FROM admirers_hidden WHERE user_id = ?").all(meId) as { other_id: number }[]).map((r) => r.other_id));
  const blocked = db.prepare("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)");
  return rows.flatMap((r): Admirer[] => {
    const otherId = r.user_1_id === meId ? r.user_2_id : r.user_1_id;
    const other = getUser(otherId);
    if (!other || other.is_banned || hidden.has(otherId) || blocked.get(meId, otherId, otherId, meId)) return [];
    if ((db.prepare("SELECT is_test FROM users WHERE id = ?").get(otherId) as { is_test: number }).is_test) return [];
    const kind: AdmirerKind = r.status === "matched" ? "match" : r.status === "pending" ? "liked" : "passed";
    // Free members see their matches, and how many others liked them — who they are is Premium.
    if (kind !== "match" && !premium) return [{ id: -r.id, kind: "liked", at: r.at, locked: true }];
    return [{ id: otherId, kind, at: r.at, locked: false, matchId: kind === "match" ? r.id : null, card: toCandidate(meId, otherId) }];
  });
}

/** "Remove": take someone out of the member's "people who liked you". */
export function hideAdmirer(meId: number, otherId: number) {
  db.prepare("INSERT OR IGNORE INTO admirers_hidden (user_id, other_id) VALUES (?, ?)").run(meId, otherId);
}

/**
 * "Give it a chance": the member had passed on someone who liked them — now it's a match after all.
 * Returns the match id, or null if there's nothing to reopen.
 */
export function reopenPassed(meId: number, otherId: number): number | null {
  const row = db
    .prepare("SELECT id FROM matches WHERE user_1_id = ? AND user_2_id = ? AND status = 'rejected' AND declined_at IS NOT NULL")
    .get(otherId, meId) as { id: number } | undefined;
  if (!row) return null;
  tx(() => {
    db.prepare("UPDATE matches SET status = 'matched', matched_at = datetime('now'), declined_at = NULL WHERE id = ?").run(row.id);
    db.prepare("DELETE FROM matches WHERE user_1_id = ? AND user_2_id = ?").run(meId, otherId); // a stray pass of mine, if any
  });
  publish(meId, { type: "match", matchId: row.id, withUserId: otherId });
  publish(otherId, { type: "match", matchId: row.id, withUserId: meId });
  void triggerMatchWhatsApp(row.id, getUser(meId)!, getUser(otherId)!);
  return row.id;
}
