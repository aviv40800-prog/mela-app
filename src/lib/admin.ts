import "server-only";
import { normalizeIsraeliPhone } from "./phone";
import type { User } from "./users";

/** Admins are the members whose verified phone appears in MELA_ADMIN_PHONES (comma-separated). */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const phones = (process.env.MELA_ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => normalizeIsraeliPhone(p.trim()))
    .filter(Boolean);
  return phones.includes(user.phone_number);
}
