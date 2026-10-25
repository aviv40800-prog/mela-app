import "server-only";
import { db, tx } from "./db";
import { COMPATIBLE, compatibility, toCandidate, type Candidate } from "./matching";
import { rankScore, type Taste } from "./taste";
import { getUser, isProfileComplete, type User } from "./users";
import { mailMember } from "./member-mail";

/**
 * Personal matchmaking: the team (later, maybe the AI) suggests two members to each other. Each sees the other
 * first in Discover with a "personal suggestion from MELA" note, and gets an email. Liking stays mutual as always.
 * Note `note_a` is shown to user_a (about user_b), `note_b` to user_b.
 */
type Row = { id: number; user_a: number; user_b: number; note_a: string; note_b: string; created_at: string; seen_a_at: string | null; seen_b_at: string | null; nudge_a_at: string | null; nudge_b_at: string | null };

const blocked = (a: number, b: number) =>
  !!db.prepare("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)").get(a, b, b, a);

function swipeOf(from: number, to: number): string | null {
  return (db.prepare("SELECT status FROM matches WHERE user_1_id = ? AND user_2_id = ?").get(from, to) as { status: string } | undefined)?.status ?? null;
}

function matchBetween(a: number, b: number): number | null {
  const row = db
    .prepare("SELECT id FROM matches WHERE status = 'matched' AND ((user_1_id = ? AND user_2_id = ?) OR (user_1_id = ? AND user_2_id = ?))")
    .get(a, b, b, a) as { id: number } | undefined;
  return row?.id ?? null;
}

function chatState(matchId: number | null): SuggestionView["chat"] {
  if (!matchId) return { by: "none" };
  const senders = (db.prepare("SELECT DISTINCT sender_id FROM messages WHERE match_id = ?").all(matchId) as { sender_id: number }[]).map((r) => r.sender_id);
  if (senders.length === 0) return { by: "none" };
  if (senders.length > 1) return { by: "both" };
  const sender = getUser(senders[0]);
  return { by: "one", senderId: senders[0], label: `${first(sender?.full_name ?? null)} ${sender?.gender === "female" ? "שלחה" : "שלח"} הודעה` };
}

function sentLine(matchId: number, u: User): string {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE match_id = ? AND sender_id = ?").get(matchId, u.id) as { n: number };
  return `${first(u.full_name)} ${u.gender === "female" ? "שלחה" : "שלח"} ${n} עד כה`;
}

function findPair(a: number, b: number): Row | undefined {
  return db.prepare("SELECT * FROM match_suggestions WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)").get(a, b, b, a) as Row | undefined;
}

/** Why a member can't get a suggestion yet (null = ready). */
export function notReadyReason(u: User | null): string | null {
  if (!u) return "המשתמש/ת לא נמצא/ה";
  if (u.is_banned) return "החשבון מושעה";
  if (!u.gender || !isProfileComplete(u)) return "עוד לא סיים/ה למלא פרופיל";
  return null;
}

export type SuggestionCandidate = {
  id: number;
  name: string;
  age: number | null;
  location: string | null;
  photo: string | null;
  compatibility: number;
  /** They already liked this member (waiting for an answer). */
  likedThem: boolean;
  /** This member already liked them (waiting for their answer). */
  memberLiked: boolean;
};

/** Who could be suggested to `me`: mutually compatible, complete, real profiles not already matched, blocked or suggested. */
export function suggestionCandidates(me: User, limit = 40): SuggestionCandidate[] {
  const rows = db
    .prepare(
      `SELECT u.id FROM users u
       WHERE ${COMPATIBLE} AND u.is_demo = 0 AND u.bio IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.status = 'matched' AND ((m.user_1_id = :me AND m.user_2_id = u.id) OR (m.user_1_id = u.id AND m.user_2_id = :me)))
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = :me AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = :me))
         AND NOT EXISTS (SELECT 1 FROM match_suggestions s WHERE (s.user_a = :me AND s.user_b = u.id) OR (s.user_a = u.id AND s.user_b = :me))`,
    )
    .all({ me: me.id, seeking: me.seeking, gender: me.gender }) as { id: number }[];
  const tastes = new Map<number, Taste | null>();
  return rows
    .map((r) => getUser(r.id)!)
    .filter((u) => isProfileComplete(u))
    .map((u) => ({ u, compatibility: compatibility(me.id, u.id) }))
    .map(({ u, compatibility }) => ({
      id: u.id,
      name: u.full_name ?? "",
      age: u.age,
      location: u.location,
      photo: u.photos[0] ?? null,
      compatibility,
      likedThem: swipeOf(u.id, me.id) === "pending",
      memberLiked: swipeOf(me.id, u.id) === "pending",
      rank: rankScore(me, u, compatibility, swipeOf(u.id, me.id) === "pending", tastes),
    }))
    .sort((a, b) => Number(b.likedThem) - Number(a.likedThem) || b.rank - a.rank)
    .slice(0, limit)
    .map(({ rank: _rank, ...c }) => c);
}

export type SuggestionView = {
  id: number;
  createdAt: string;
  other: { id: number; name: string; photo: string | null };
  /** The note this member got, and the one the other side got. */
  noteMine: string;
  noteTheirs: string;
  seenMine: boolean;
  seenTheirs: boolean;
  /** "liked" | "passed" | null for each side, and whether it became a match. */
  mine: string | null;
  theirs: string | null;
  matched: boolean;
  /** The match row (when matched), whether they've written to each other, and when each side got the "time to write" email. */
  matchId: number | null;
  /** Who has written so far: nobody, only one side (by id), or both. */
  chat: { by: "none" | "both" } | { by: "one"; senderId: number; label: string };
  nudgedMine: string | null;
  nudgedTheirs: string | null;
  /** Messages each side has sent so far (counts only, never the content), e.g. "נתנאל שלח 6 עד כה". */
  sent: string[];
};

const decision = (status: string | null) => (status === "pending" || status === "matched" ? "liked" : status === "rejected" ? "passed" : null);

/** Suggestions involving a member, newest first — for the admin page. */
export function suggestionsFor(userId: number): SuggestionView[] {
  const rows = db.prepare("SELECT * FROM match_suggestions WHERE user_a = ? OR user_b = ? ORDER BY id DESC").all(userId, userId) as Row[];
  return rows.flatMap((r) => {
    const mineIsA = r.user_a === userId;
    const otherId = mineIsA ? r.user_b : r.user_a;
    const other = getUser(otherId);
    if (!other) return [];
    const mineSwipe = swipeOf(userId, otherId);
    const theirSwipe = swipeOf(otherId, userId);
    // A match lives in one row (whoever liked first), so it counts as a like from both.
    const matched = mineSwipe === "matched" || theirSwipe === "matched";
    const matchId = matched ? matchBetween(userId, otherId) : null;
    return [
      {
        id: r.id,
        createdAt: r.created_at,
        other: { id: other.id, name: other.full_name ?? "", photo: other.photos[0] ?? null },
        noteMine: mineIsA ? r.note_a : r.note_b,
        noteTheirs: mineIsA ? r.note_b : r.note_a,
        // Deciding on them means they saw the suggestion, even if it never showed as a Discover card.
        seenMine: !!(mineIsA ? r.seen_a_at : r.seen_b_at) || matched || mineSwipe !== null,
        seenTheirs: !!(mineIsA ? r.seen_b_at : r.seen_a_at) || matched || theirSwipe !== null,
        mine: matched ? "liked" : decision(mineSwipe),
        theirs: matched ? "liked" : decision(theirSwipe),
        matched,
        matchId,
        chat: chatState(matchId),
        nudgedMine: mineIsA ? r.nudge_a_at : r.nudge_b_at,
        nudgedTheirs: mineIsA ? r.nudge_b_at : r.nudge_a_at,
        sent: matchId ? [getUser(userId)!, other].map((u) => sentLine(matchId, u)) : [],
      },
    ];
  });
}

const first = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

function suggestionEmail(to: User, other: User, note: string) {
  const she = to.gender === "female";
  const otherIsHe = other.gender === "male";
  const about = [first(other.full_name), other.age, other.location ? `מ${other.location}` : null].filter(Boolean).join(", ");
  mailMember(to.id, {
    subject: `💛 השדכנית של MELA מצאה ${otherIsHe ? "בשבילך מישהו" : "בשבילך מישהי"}`,
    lines: [
      `היי ${first(to.full_name)},`,
      `עברנו על הפרופיל שלך, ויש ${otherIsHe ? "מישהו" : "מישהי"} שאנחנו ממש רוצים ${she ? "שתכירי" : "שתכיר"}: ${about}.`,
      "",
      "למה חשבנו עליכם:",
      note,
      "",
      `אם גם ${she ? "את מרגישה" : "אתה מרגיש"} שיש פה משהו, ${she ? "עשי" : "עשה"} ${otherIsHe ? "לו" : "לה"} לייק. אם ${otherIsHe ? "גם הוא יעשה" : "גם היא תעשה"} לך, תיפתח ביניכם שיחה.`,
      "",
      "בהצלחה,",
      "צוות MELA",
    ],
    link: "/discover",
    cta: `לצפייה בפרופיל של ${first(other.full_name)} 💛`,
  });
}

export class SuggestionError extends Error {}

/**
 * From the admin page: after a suggestion became a match, email one side that the other liked them back and it's
 * time to write the first message. Returns whether it could be emailed (verified address).
 */
export function nudgeToChat(suggestionId: number, toId: number): { emailed: boolean } {
  const r = db.prepare("SELECT * FROM match_suggestions WHERE id = ?").get(suggestionId) as Row | undefined;
  if (!r || (r.user_a !== toId && r.user_b !== toId)) throw new SuggestionError("ההצעה לא נמצאה");
  const toIsA = r.user_a === toId;
  const to = getUser(toId);
  const other = getUser(toIsA ? r.user_b : r.user_a);
  if (!to || !other) throw new SuggestionError("המשתמש/ת לא נמצא/ה");
  const matchId = matchBetween(to.id, other.id);
  if (!matchId) throw new SuggestionError("הם עוד לא בהתאמה");
  if (!(to.email && to.email_verified) || to.is_banned) throw new SuggestionError("אין לו/ה מייל מאומת");

  const she = to.gender === "female";
  const otherIsHe = other.gender === "male";
  const name = first(other.full_name);
  // The match row belongs to whoever liked first: if that's the recipient, the other one "liked back".
  const likedBack = (db.prepare("SELECT user_1_id FROM matches WHERE id = ?").get(matchId) as { user_1_id: number }).user_1_id === to.id;
  const liked = likedBack ? (otherIsHe ? "החזיר לך לייק" : "החזירה לך לייק") : otherIsHe ? "עשה לך לייק" : "עשתה לך לייק";
  const note = toIsA ? r.note_a : r.note_b;
  mailMember(to.id, {
    subject: `${first(to.full_name)}, ${name} ${liked} 💛`,
    lines: [
      `היי ${first(to.full_name)},`,
      `יש לנו חדשות טובות: ${name} ${liked}, ואתם עכשיו התאמה ב-MELA 🎉`,
      "",
      "תזכורת קטנה למה חשבנו עליכם:",
      `״${note}״`,
      "",
      `עכשיו הכדור אצלך. טיפ מהשדכנית: הודעה ראשונה שעובדת היא קצרה, אישית ונגמרת בשאלה. משהו שכתוב בפרופיל ${otherIsHe ? "שלו" : "שלה"} הוא פתיחה הרבה יותר טובה מ״היי, מה נשמע?״.`,
      `ואל ${she ? "תחכי" : "תחכה"} יותר מדי: הרגע הכי טוב לכתוב הוא עכשיו, כשההתרגשות עוד טרייה.`,
      "",
      "מחזיקים לכם אצבעות,",
      "צוות MELA",
    ],
    link: `/matches/${matchId}`,
    cta: `לכתוב ל${name} הודעה ראשונה 💬`,
  });
  db.prepare(`UPDATE match_suggestions SET ${toIsA ? "nudge_a_at" : "nudge_b_at"} = datetime('now') WHERE id = ?`).run(r.id);
  return { emailed: true };
}

/**
 * Suggest `a` and `b` to each other. Earlier passes between them are cleared so each can still like the other
 * (a like is still needed from both). Emails both.
 */
export function createSuggestion(adminId: number, aId: number, bId: number, noteA: string, noteB: string): { id: number; emailed: { a: boolean; b: boolean } } {
  const a = getUser(aId);
  const b = getUser(bId);
  for (const u of [a, b]) {
    const why = notReadyReason(u);
    if (why) throw new SuggestionError(`${u?.full_name ?? ""}: ${why}`);
  }
  if (aId === bId) throw new SuggestionError("אי אפשר להציע משתמש/ת לעצמו/ה");
  const fits = (x: User, y: User) => x.seeking === "everyone" || x.seeking === y.gender;
  if (!fits(a!, b!) || !fits(b!, a!)) throw new SuggestionError("הם לא מחפשים אחד את השני (מגדר)");
  if (blocked(aId, bId)) throw new SuggestionError("אחד מהם חסם את השני");
  if (swipeOf(aId, bId) === "matched" || swipeOf(bId, aId) === "matched") throw new SuggestionError("הם כבר בהתאמה");
  if (findPair(aId, bId)) throw new SuggestionError("כבר הצעתם אותם אחד לשני");

  const id = tx(() => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO match_suggestions (user_a, user_b, note_a, note_b, created_by) VALUES (?, ?, ?, ?, ?)")
      .run(aId, bId, noteA.trim(), noteB.trim(), adminId);
    db.prepare(
      "DELETE FROM matches WHERE status = 'rejected' AND ((user_1_id = ? AND user_2_id = ?) OR (user_1_id = ? AND user_2_id = ?))",
    ).run(aId, bId, bId, aId);
    return Number(lastInsertRowid);
  });
  suggestionEmail(a!, b!, noteA.trim());
  suggestionEmail(b!, a!, noteB.trim());
  const canEmail = (u: User) => !!(u.email && u.email_verified);
  return { id, emailed: { a: canEmail(a!), b: canEmail(b!) } };
}

/** Suggestions waiting for this member's decision, as Discover cards (first in the deck). Marks them seen. */
export function suggestedCards(me: User): (Candidate & { suggestion: { note: string } })[] {
  const rows = db
    .prepare(
      `SELECT * FROM match_suggestions s WHERE (s.user_a = :me OR s.user_b = :me)
         AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.user_1_id = :me AND m.user_2_id = CASE WHEN s.user_a = :me THEN s.user_b ELSE s.user_a END)
       ORDER BY s.id DESC`,
    )
    .all({ me: me.id }) as Row[];
  return rows.flatMap((r) => {
    const mineIsA = r.user_a === me.id;
    const otherId = mineIsA ? r.user_b : r.user_a;
    const other = getUser(otherId);
    // Gone, blocked, or the other side already said no: nothing to offer.
    if (!other || other.is_banned || blocked(me.id, otherId) || swipeOf(otherId, me.id) === "rejected") return [];
    db.prepare(`UPDATE match_suggestions SET ${mineIsA ? "seen_a_at" : "seen_b_at"} = COALESCE(${mineIsA ? "seen_a_at" : "seen_b_at"}, datetime('now')) WHERE id = ?`).run(r.id);
    return [{ ...toCandidate(me.id, otherId), suggestion: { note: mineIsA ? r.note_a : r.note_b } }];
  });
}

/** Records that a member saw their suggestion (e.g. they liked or passed on that profile from anywhere). */
export function markSuggestionSeen(meId: number, otherId: number) {
  const r = findPair(meId, otherId);
  if (!r) return;
  const col = r.user_a === meId ? "seen_a_at" : "seen_b_at";
  db.prepare(`UPDATE match_suggestions SET ${col} = COALESCE(${col}, datetime('now')) WHERE id = ?`).run(r.id);
}

/** A like on a personal suggestion is on the house — it doesn't use up the daily likes. */
export function isOpenSuggestion(meId: number, otherId: number): boolean {
  return !!findPair(meId, otherId) && swipeOf(meId, otherId) === null;
}
