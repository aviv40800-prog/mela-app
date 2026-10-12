import "server-only";
import { normalizeIsraeliPhone } from "./phone";
import type { User } from "./users";

/** Built-in super admin — always has access, regardless of environment configuration. */
export const SUPER_ADMIN_PHONES = ["0524080073"];

/** Admins: the super admin(s) plus any verified phone listed in MELA_ADMIN_PHONES (comma-separated). */
export function adminPhones(): string[] {
  return [...SUPER_ADMIN_PHONES, ...(process.env.MELA_ADMIN_PHONES ?? "").split(",")]
    .map((p) => normalizeIsraeliPhone(p.trim()))
    .filter((p): p is string => !!p);
}

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return adminPhones().includes(user.phone_number);
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return SUPER_ADMIN_PHONES.map((p) => normalizeIsraeliPhone(p)).includes(user.phone_number);
}
