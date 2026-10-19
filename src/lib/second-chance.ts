import "server-only";
import { db, tx } from "./db";
import { COMPATIBLE, toCandidate, type Candidate } from "./matching";
import type { User } from "./users";

/**
 * Profiles the member passed on that may come back once: the other side hasn't swiped on them (or blocked),
 * and they weren't offered a second chance before.
 */
function eligibleIds(me: User, targetId?: number): number[] {
  const rows = db
    .prepare(
      `SELECT u.id FROM matches m JOIN users u ON u.id = m.user_2_id
       WHERE m.user_1_id = :me AND m.status = 'rejected' AND ${COMPATIBLE}
         AND (:target IS NULL OR u.id = :target)
         AND NOT EXISTS (SELECT 1 FROM matches r WHERE r.user_1_id = u.id AND r.user_2_id = :me)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = :me AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = :me))
         AND NOT EXISTS (SELECT 1 FROM second_chances s WHERE s.user_id = :me AND s.target_id = u.id)
       ORDER BY m.id DESC LIMIT 200`,
    )
    .all({ me: me.id, seeking: me.seeking, gender: me.gender, target: targetId ?? null }) as { id: number }[];
  return rows.map((r) => r.id);
}

/** Passed profiles, best compatibility first (the client compares with the scores from before the chat). */
export function secondChanceDeck(me: User, limit = 30): Candidate[] {
  return eligibleIds(me)
    .map((id) => toCandidate(me.id, id))
    .sort((a, b) => b.compatibility - a.compatibility)
    .slice(0, limit);
}

export const isSecondChance = (me: User, targetId: number) => eligibleIds(me, targetId).length > 0;

/** The member decided on a second-chance card: it won't be offered again; a like reopens the pass. */
export function decideSecondChance(meId: number, targetId: number, reopen: boolean) {
  tx(() => {
    db.prepare("INSERT OR IGNORE INTO second_chances (user_id, target_id) VALUES (?, ?)").run(meId, targetId);
    if (reopen) db.prepare("DELETE FROM matches WHERE user_1_id = ? AND user_2_id = ? AND status = 'rejected'").run(meId, targetId);
  });
}
