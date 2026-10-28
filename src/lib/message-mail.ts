import "server-only";
import { db } from "./db";
import { isOnline } from "./events";
import { mailMember } from "./member-mail";
import { getUser } from "./users";

/**
 * "You got a new message" by email — without the sender's name or the text. One per chat until the member reads it,
 * and at most one an hour across all their chats. Sent right away when they're not on the site; a sweep catches
 * messages left unread for a while by someone whose tab was open in the background.
 */
const HOUR_MS = 60 * 60_000;
/** A message unread this long gets its email even if the member's tab is open somewhere. */
const SWEEP_AFTER_MIN = 10;

/** Whether `toId` should get an email now about chat `matchId` (rules only: not who's online, not the budget). */
export function messageMailDue(matchId: number, toId: number, now = Date.now()): boolean {
  const match = db.prepare("SELECT status FROM matches WHERE id = ? AND (user_1_id = ? OR user_2_id = ?)").get(matchId, toId, toId) as
    | { status: string }
    | undefined;
  if (match?.status !== "matched") return false;
  const unread = db
    .prepare("SELECT MIN(sent_at) AS first FROM messages WHERE match_id = ? AND sender_id <> ? AND is_read = 0")
    .get(matchId, toId) as { first: string | null };
  if (!unread.first) return false;
  // already emailed about this chat and still hasn't read what that email was about
  const last = db.prepare("SELECT notified_at FROM message_mail WHERE match_id = ? AND user_id = ?").get(matchId, toId) as
    | { notified_at: string }
    | undefined;
  if (last && unread.first <= last.notified_at) return false;
  // one an hour, all chats together
  const recent = db.prepare("SELECT MAX(notified_at) AS at FROM message_mail WHERE user_id = ?").get(toId) as { at: string | null };
  return !(recent.at && now - Date.parse(recent.at) < HOUR_MS);
}

function send(matchId: number, toId: number, fromId: number): boolean {
  const to = getUser(toId);
  const from = getUser(fromId);
  if (!to || !from) return false;
  const sentByHer = from.gender === "female";
  const ok = mailMember(toId, {
    kind: "message",
    subject: "💬 קיבלת הודעה חדשה ב־MELA",
    lines: [
      `היי ${(to.full_name ?? "").split(/\s+/)[0]},`,
      `${sentByHer ? "מישהי שלחה" : "מישהו שלח"} לך הודעה חדשה ב־MELA 💛`,
      "כדאי לענות כל עוד השיחה חמה 😉",
      "",
      "צוות MELA",
    ],
    link: `/matches/${matchId}`,
    cta: "לקריאת ההודעה",
  });
  if (ok) record(matchId, toId);
  return ok;
}

export function record(matchId: number, toId: number, at = new Date().toISOString()) {
  db.prepare(
    "INSERT INTO message_mail (match_id, user_id, notified_at) VALUES (?, ?, ?) ON CONFLICT(match_id, user_id) DO UPDATE SET notified_at = excluded.notified_at",
  ).run(matchId, toId, at);
}

/** Right after a message is sent: email the other side if they're not on the site. */
export function notifyNewMessage(matchId: number, fromId: number, toId: number) {
  try {
    if (!isOnline(toId) && messageMailDue(matchId, toId)) send(matchId, toId, fromId);
  } catch (e) {
    console.error("[message-mail] failed", (e as Error).message);
  }
}

/** Every few minutes: messages unread for a while (the member's tab was open but nobody looked). */
export function sweepUnreadMessages(): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT m.id AS match_id, CASE WHEN msg.sender_id = m.user_1_id THEN m.user_2_id ELSE m.user_1_id END AS to_id, msg.sender_id AS from_id
       FROM messages msg JOIN matches m ON m.id = msg.match_id
       WHERE m.status = 'matched' AND msg.is_read = 0 AND msg.sent_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)
         AND msg.sent_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')`,
    )
    .all(`-${SWEEP_AFTER_MIN} minutes`) as {
    match_id: number;
    to_id: number;
    from_id: number;
  }[];
  let sent = 0;
  for (const r of rows) if (messageMailDue(r.match_id, r.to_id) && send(r.match_id, r.to_id, r.from_id)) sent++;
  return sent;
}
