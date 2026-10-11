import "server-only";
import { db } from "./db";
import { publish, type ChatMessage } from "./events";

type Row = Omit<ChatMessage, "is_read"> & { is_read: number };
const hydrate = (r: Row): ChatMessage => ({ ...r, is_read: !!r.is_read });

export function insertMessage(matchId: number, senderId: number, text: string): ChatMessage {
  const { lastInsertRowid } = db.prepare("INSERT INTO messages (match_id, sender_id, text_content) VALUES (?, ?, ?)").run(matchId, senderId, text);
  return hydrate(db.prepare("SELECT * FROM messages WHERE id = ?").get(lastInsertRowid) as Row);
}

export function listMessages(matchId: number, afterId = 0): ChatMessage[] {
  return (db.prepare("SELECT * FROM messages WHERE match_id = ? AND id > ? ORDER BY id LIMIT 500").all(matchId, afterId) as Row[]).map(hydrate);
}

export function sendMessage(matchId: number, senderId: number, recipientId: number, text: string): ChatMessage {
  const msg = insertMessage(matchId, senderId, text);
  publish(recipientId, { type: "message", matchId, message: msg });
  publish(senderId, { type: "message", matchId, message: msg });
  return msg;
}

export function markRead(matchId: number, readerId: number, senderId: number) {
  const { changes } = db.prepare("UPDATE messages SET is_read = 1 WHERE match_id = ? AND sender_id <> ? AND is_read = 0").run(matchId, readerId);
  if (Number(changes) > 0) publish(senderId, { type: "read", matchId, readerId });
}
