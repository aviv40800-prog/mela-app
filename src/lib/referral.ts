import "server-only";
import { randomInt } from "node:crypto";
import { db, tx } from "./db";
import { mailMember } from "./member-mail";
import { SITE_URL } from "./site";

/** Likes a member earns for each friend who signs up with their invite link. */
export const REFERRAL_BONUS_LIKES = 10;
/** Invites rewarded per member — a ceiling against made-up sign-ups. */
export const REFERRAL_MAX_REWARDED = 20;
/** The invite code travels from the link to sign-up in this cookie. */
export const REF_COOKIE = "mela_ref";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const normalizeRefCode = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);

/** The member's personal invite code, created on first use. */
export function referralCode(userId: number): string {
  const row = db.prepare("SELECT referral_code FROM users WHERE id = ?").get(userId) as { referral_code: string | null } | undefined;
  if (row?.referral_code) return row.referral_code;
  for (;;) {
    const code = Array.from({ length: 7 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    try {
      db.prepare("UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL").run(code, userId);
      return (db.prepare("SELECT referral_code FROM users WHERE id = ?").get(userId) as { referral_code: string }).referral_code;
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e; // taken — try another
    }
  }
}

export const referralLink = (userId: number) => `${SITE_URL}/?ref=${referralCode(userId)}`;

/**
 * A new member signed up through an invite link: remember who invited them and reward the inviter with
 * REFERRAL_BONUS_LIKES (up to REFERRAL_MAX_REWARDED friends). Returns the inviter's id, or null.
 */
export function applyReferral(newUserId: number, rawCode: string): number | null {
  const code = normalizeRefCode(rawCode);
  if (!code) return null;
  const inviter = db.prepare("SELECT id FROM users WHERE referral_code = ? AND is_banned = 0").get(code) as { id: number } | undefined;
  if (!inviter || inviter.id === newUserId) return null;
  const rewarded = tx(() => {
    const set = db.prepare("UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL").run(inviter.id, newUserId);
    if (!set.changes) return null;
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM users WHERE referred_by = ?").get(inviter.id) as { n: number };
    if (n > REFERRAL_MAX_REWARDED) return false;
    db.prepare("UPDATE users SET bonus_likes = bonus_likes + ? WHERE id = ?").run(REFERRAL_BONUS_LIKES, inviter.id);
    return true;
  });
  if (rewarded === null) return null;
  if (rewarded)
    mailMember(inviter.id, {
      subject: `🎁 קיבלת ${REFERRAL_BONUS_LIKES} לייקים במתנה ב-MELA`,
      lines: ["חבר/ה שהזמנת הצטרף/ה עכשיו ל-MELA 🤎", `כתודה, הוספנו לך ${REFERRAL_BONUS_LIKES} לייקים נוספים — הם מחכים לך ולא פגים.`],
      link: "/discover",
      cta: "להמשיך להכיר",
    });
  return inviter.id;
}

export type ReferralStats = { link: string; joined: number; earned: number; bonus: number; max: number };

export function referralStats(userId: number): ReferralStats {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users WHERE referred_by = ?").get(userId) as { n: number };
  return {
    link: referralLink(userId),
    joined: n,
    earned: Math.min(n, REFERRAL_MAX_REWARDED) * REFERRAL_BONUS_LIKES,
    bonus: REFERRAL_BONUS_LIKES,
    max: REFERRAL_MAX_REWARDED,
  };
}
