import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { getUser, normalizeEmail, type User } from "./users";

/**
 * Username + password sign-in. The emailed code proves the address once (sign-up) and again only when a
 * password is forgotten; right after a code, the member may set a new password for CODE_WINDOW_MS.
 *
 * Passwords are hashed with scrypt (random salt per password). After MAX_FAILS wrong passwords the account
 * is locked for LOCK_MS.
 */

const CODE_WINDOW_MS = 20 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = crypto.scryptSync(password, Buffer.from(salt, "base64"), want.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
  return crypto.timingSafeEqual(want, got);
}

/** 3–20 characters: English letters, digits, dot and underscore; starts with a letter. */
export const USERNAME_RE = /^[A-Za-z][A-Za-z0-9._]{2,19}$/;

export function usernameProblem(username: string): string | null {
  if (!USERNAME_RE.test(username)) return "שם משתמש: 3–20 תווים באנגלית, ספרות, נקודה או קו תחתון, שמתחיל באות";
  return null;
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "הסיסמה צריכה להכיל לפחות 8 תווים";
  if (password.length > 200) return "הסיסמה ארוכה מדי";
  if (!/[A-Za-z֐-׿]/.test(password) || !/\d/.test(password)) return "הסיסמה צריכה להכיל גם אותיות וגם ספרות";
  return null;
}

export function usernameTaken(username: string, exceptUserId?: number): boolean {
  return !!db.prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id <> ?").get(username, exceptUserId ?? -1);
}

/** A free username based on the email's local part, offered as a default. */
export function suggestUsername(email: string | null): string {
  const base = (email ?? "").split("@")[0].replace(/[^A-Za-z0-9._]/g, "").replace(/^[^A-Za-z]+/, "").slice(0, 16) || "mela";
  const stem = base.length >= 3 ? base : `${base}mela`;
  if (!usernameTaken(stem)) return stem;
  for (let i = 0; i < 50; i++) {
    const candidate = `${stem.slice(0, 16)}${crypto.randomInt(10, 9999)}`;
    if (!usernameTaken(candidate)) return candidate;
  }
  return `${stem.slice(0, 12)}${Date.now() % 1e8}`;
}

/** Called after an emailed code is verified: opens the window for setting a (new) password. */
export function markCodeVerified(userId: number) {
  db.prepare("UPDATE users SET code_verified_at = ? WHERE id = ?").run(Date.now(), userId);
}

/** Whether this member may set a password now: they have none yet, or just proved their email with a code. */
export function canSetPassword(userId: number): boolean {
  const row = db.prepare("SELECT password_hash, code_verified_at FROM users WHERE id = ?").get(userId) as
    | { password_hash: string | null; code_verified_at: number | null }
    | undefined;
  if (!row) return false;
  return !row.password_hash || (!!row.code_verified_at && Date.now() - row.code_verified_at < CODE_WINDOW_MS);
}

export type SetCredentialsResult = { ok: true } | { ok: false; error: string };

export function setCredentials(userId: number, input: { username?: string; password: string }): SetCredentialsResult {
  const user = getUser(userId);
  if (!user) return { ok: false, error: "משתמש לא נמצא" };
  if (!canSetPassword(userId)) return { ok: false, error: "כדי לשנות סיסמה, בקשו קוד במסך \"שכחתי סיסמה\"" };
  const username = input.username?.trim() || user.username;
  if (!username) return { ok: false, error: "נא לבחור שם משתמש" };
  if (username !== user.username) {
    const problem = usernameProblem(username);
    if (problem) return { ok: false, error: problem };
    if (usernameTaken(username, userId)) return { ok: false, error: "שם המשתמש הזה כבר תפוס" };
  }
  const pw = passwordProblem(input.password);
  if (pw) return { ok: false, error: pw };
  db.prepare("UPDATE users SET username = ?, password_hash = ?, code_verified_at = NULL, failed_logins = 0, locked_until = NULL WHERE id = ?").run(
    username,
    hashPassword(input.password),
    userId,
  );
  return { ok: true };
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "no_password" | "locked" | "banned"; minutes?: number };

/** Sign in with an email or a username, and a password. */
export function loginWithPassword(identifier: string, password: string): LoginResult {
  const id = identifier.trim();
  const row = (
    id.includes("@")
      ? db.prepare("SELECT id, password_hash, failed_logins, locked_until, is_banned FROM users WHERE email = ?").get(normalizeEmail(id))
      : db.prepare("SELECT id, password_hash, failed_logins, locked_until, is_banned FROM users WHERE username = ? COLLATE NOCASE").get(id)
  ) as { id: number; password_hash: string | null; failed_logins: number; locked_until: number | null; is_banned: number } | undefined;
  if (!row) {
    hashPassword(password); // same work as a real check, so timing doesn't reveal which accounts exist
    return { ok: false, reason: "invalid" };
  }
  if (row.locked_until && row.locked_until > Date.now()) return { ok: false, reason: "locked", minutes: Math.ceil((row.locked_until - Date.now()) / 60000) };
  if (!row.password_hash) return { ok: false, reason: "no_password" };
  if (!verifyPassword(password, row.password_hash)) {
    const fails = row.failed_logins + 1;
    db.prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?").run(fails >= MAX_FAILS ? 0 : fails, fails >= MAX_FAILS ? Date.now() + LOCK_MS : null, row.id);
    return fails >= MAX_FAILS ? { ok: false, reason: "locked", minutes: LOCK_MS / 60000 } : { ok: false, reason: "invalid" };
  }
  if (row.is_banned) return { ok: false, reason: "banned" };
  db.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(row.id);
  return { ok: true, user: getUser(row.id)! };
}
