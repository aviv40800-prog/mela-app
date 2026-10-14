import "server-only";
import { normalizeIsraeliPhone } from "./phone";
import type { User } from "./users";

/** Built-in super admins — always have access, regardless of environment configuration. */
export const SUPER_ADMIN_PHONES = ["0524080073"];
export const SUPER_ADMIN_EMAILS = ["datemela1@gmail.com"];

/** Admins: the super admin(s) plus any verified phone listed in MELA_ADMIN_PHONES (comma-separated). */
export function adminPhones(): string[] {
  return [...SUPER_ADMIN_PHONES, ...(process.env.MELA_ADMIN_PHONES ?? "").split(",")]
    .map((p) => normalizeIsraeliPhone(p.trim()))
    .filter((p): p is string => !!p);
}

/** Admin emails: the super admin(s) plus MELA_ADMIN_EMAILS (comma-separated). Only count once verified by code. */
export function adminEmails(): string[] {
  return [...SUPER_ADMIN_EMAILS, ...(process.env.MELA_ADMIN_EMAILS ?? "").split(",")].map((e) => e.trim().toLowerCase()).filter(Boolean);
}

const verifiedEmail = (user: User) => (user.email_verified && user.email ? user.email.toLowerCase() : null);

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = verifiedEmail(user);
  return (!!user.phone_number && adminPhones().includes(user.phone_number)) || (!!email && adminEmails().includes(email));
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = verifiedEmail(user);
  return (
    (!!user.phone_number && SUPER_ADMIN_PHONES.map((p) => normalizeIsraeliPhone(p)).includes(user.phone_number)) ||
    (!!email && SUPER_ADMIN_EMAILS.includes(email))
  );
}
