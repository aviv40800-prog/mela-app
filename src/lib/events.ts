import "server-only";
import { EventEmitter } from "node:events";

// In-process pub/sub that feeds the Server-Sent Events stream.
// Single-instance only: for multiple instances swap this for Redis pub/sub or Postgres LISTEN/NOTIFY.

export type RealtimeEvent =
  | { type: "message"; matchId: number; message: ChatMessage }
  | { type: "read"; matchId: number; readerId: number }
  | { type: "typing"; matchId: number; userId: number }
  | { type: "match"; matchId: number; withUserId: number };

export type ChatMessage = {
  id: number;
  match_id: number;
  sender_id: number;
  text_content: string;
  is_read: boolean;
  sent_at: string;
};

const g = globalThis as unknown as { __melaBus?: EventEmitter };
const bus = g.__melaBus ?? (g.__melaBus = new EventEmitter().setMaxListeners(0));

export function publish(userId: number, event: RealtimeEvent) {
  bus.emit(`user:${userId}`, event);
}

export function subscribe(userId: number, listener: (e: RealtimeEvent) => void): () => void {
  bus.on(`user:${userId}`, listener);
  return () => bus.off(`user:${userId}`, listener);
}
