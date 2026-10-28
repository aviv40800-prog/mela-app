import "server-only";
import { db } from "./db";

/**
 * The email provider's daily cap (Brevo's free plan: 300/day) is shared by everything — sign-in codes included.
 * So emails are counted per Israel day and kind, and the nice-to-have ones stop early to keep room for codes.
 */
export type EmailKind = "code" | "team" | "suggestion" | "message" | "reminder" | "alert" | "other";

/** The provider's daily cap (MELA_EMAIL_DAILY_CAP, default 300). */
export const dailyCap = () => Math.max(1, Number(process.env.MELA_EMAIL_DAILY_CAP) || 300);
/** Under this total, every kind goes; from here only codes, the team's mail and suggestions. */
const NICE_TO_HAVE_SHARE = 220 / 300;
const IMPORTANT_SHARE = 280 / 300;
const NICE_TO_HAVE: EmailKind[] = ["message", "reminder", "alert", "other"];

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

export function emailsToday(): {
  total: number;
  cap: number;
  byKind: Partial<Record<EmailKind, number>>;
} {
  const rows = db.prepare("SELECT kind, n FROM email_counts WHERE day = ?").all(today()) as { kind: EmailKind; n: number }[];
  return {
    total: rows.reduce((a, r) => a + r.n, 0),
    cap: dailyCap(),
    byKind: Object.fromEntries(rows.map((r) => [r.kind, r.n])),
  };
}

/** Whether an email of this kind may still go out today. Sign-in codes always may. */
export function emailAllowed(kind: EmailKind): boolean {
  if (kind === "code") return true;
  const { total, cap } = emailsToday();
  return total < Math.floor(cap * (NICE_TO_HAVE.includes(kind) ? NICE_TO_HAVE_SHARE : IMPORTANT_SHARE));
}

export function countEmail(kind: EmailKind) {
  db.prepare("INSERT INTO email_counts (day, kind, n) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET n = n + 1").run(today(), kind);
}
