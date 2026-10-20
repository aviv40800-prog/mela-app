import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { createEmailUser, type User } from "./users";
import { deleteOwnAccount } from "./safety";

/**
 * Sandbox accounts for the team: walk through sign-up exactly as a member would, without an email code.
 * They're never shown to members, can't send likes, get no emails (no verified address), and each new one
 * replaces the previous ones.
 */
export const isTestUser = (id: number) => !!(db.prepare("SELECT is_test FROM users WHERE id = ?").get(id) as { is_test: number } | undefined)?.is_test;

export function startTestAccount(): User {
  for (const { id } of db.prepare("SELECT id FROM users WHERE is_test = 1").all() as { id: number }[]) deleteOwnAccount(id);
  const user = createEmailUser(`test-${randomBytes(4).toString("hex")}@test.meladate.co.il`);
  db.prepare("UPDATE users SET is_test = 1 WHERE id = ?").run(user.id);
  return user;
}
