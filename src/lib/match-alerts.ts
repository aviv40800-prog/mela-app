import "server-only";
import { db } from "./db";
import { cityDistanceKm } from "./cities";
import { mailMember } from "./member-mail";
import type { User } from "./users";

export function matchAlertsOn(userId: number): boolean {
  return !!(db.prepare("SELECT match_alerts FROM users WHERE id = ?").get(userId) as { match_alerts: number } | undefined)?.match_alerts;
}

export function setMatchAlerts(userId: number, on: boolean) {
  db.prepare("UPDATE users SET match_alerts = ? WHERE id = ?").run(on ? 1 : 0, userId);
}

/**
 * Someone just finished their profile: email the members who asked to hear about new people and whom this
 * newcomer fits (gender both ways, their age and distance range) — at most one alert a day each.
 */
export function alertWaitingMembers(newcomer: User): number {
  if (!newcomer.gender || newcomer.is_demo || newcomer.is_banned) return 0;
  const rows = db
    .prepare(
      `SELECT u.id, u.location, u.pref_distance_km FROM users u
       WHERE u.match_alerts = 1 AND u.email_verified = 1 AND u.id <> :new AND u.is_banned = 0 AND u.gender IS NOT NULL AND u.full_name IS NOT NULL
         AND (u.seeking = 'everyone' OR u.seeking = :ngender) AND (:nseeking = 'everyone' OR u.gender = :nseeking)
         AND (:nage IS NULL OR ((u.pref_age_min IS NULL OR :nage >= u.pref_age_min) AND (u.pref_age_max IS NULL OR :nage <= u.pref_age_max)))
         AND (u.match_alert_at IS NULL OR u.match_alert_at < datetime('now', '-20 hours'))
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = :new) OR (b.blocker_id = :new AND b.blocked_id = u.id))`,
    )
    .all({ new: newcomer.id, ngender: newcomer.gender, nseeking: newcomer.seeking, nage: newcomer.age }) as {
    id: number;
    location: string | null;
    pref_distance_km: number | null;
  }[];
  const fits = rows.filter((r) => {
    if (!r.pref_distance_km) return true;
    const km = cityDistanceKm(r.location, newcomer.location);
    return km === null || km <= r.pref_distance_km;
  });
  const mark = db.prepare("UPDATE users SET match_alert_at = datetime('now') WHERE id = ?");
  for (const r of fits) {
    mark.run(r.id);
    mailMember(r.id, {
      subject: "💛 מישהו חדש שמתאים לך הצטרף ל-MELA",
      lines: ["ההתאמה הבאה שלך אולי כבר כאן:", "פרופיל חדש שמתאים לחיפוש שלך הצטרף עכשיו ל-MELA.", "", "(אפשר לכבות את ההתראות במסך ההתאמות, תחת ״ההתאמה הבאה בדרך אלייך״.)"],
      link: "/discover",
      cta: "לראות מי הצטרף/ה",
    });
  }
  return fits.length;
}
