import "server-only";
import { db } from "./db";
import { sharedAnswers } from "./checkin";
import { aiOnboardingEnabled } from "./ai-onboarding";
import { draftSuggestionNotes } from "./suggestion-draft";
import { SuggestionError, createSuggestion, suggestionCandidates, type SuggestionCandidate } from "./suggestions";
import { getUser, isProfileComplete, type User } from "./users";

/**
 * The AI matchmaker. Every evening it picks, for active members, the two people who fit them best (what they said,
 * who they like, who'd like them back) and drafts the "why we thought of you" notes. Nothing reaches a member until
 * the team approves it on /admin/suggestions.
 */
export const autoSuggestEnabled = () => process.env.MELA_AUTO_SUGGEST !== "off";
/** Most drafts per night (MELA_AUTO_SUGGEST_MAX, default 20) — keeps the review list and the AI cost small. */
const maxPerRun = () => Math.max(0, Number(process.env.MELA_AUTO_SUGGEST_MAX ?? 20) || 0);
const PER_MEMBER = 2;
/** Below this compatibility, a pair isn't worth the team's time. */
const MIN_COMPATIBILITY = 65;
/** Israel time, from which the nightly run starts. */
const RUN_HOUR = 19;

const first = (u: User) => (u.full_name ?? "").split(/\s+/)[0];
const daysSince = (at: string | null) => (at ? (Date.now() - new Date(at.replace(" ", "T") + "Z").getTime()) / 86_400_000 : Infinity);
const isPremium = (id: number) =>
  !!db.prepare("SELECT 1 FROM subscriptions WHERE user_id = ? AND status IN ('active', 'trialing') AND (current_period_end IS NULL OR current_period_end > datetime('now'))").get(id);

/** Active members with a complete profile who aren't waiting on a draft or a fresh suggestion. Premium first. */
function membersToSuggestFor(): User[] {
  const ids = db
    .prepare(
      `SELECT u.id FROM users u
       WHERE u.is_demo = 0 AND u.is_test = 0 AND u.is_banned = 0 AND u.gender IS NOT NULL
         AND u.last_seen_at >= datetime('now', '-14 days')
         AND NOT EXISTS (SELECT 1 FROM suggestion_queue q WHERE q.status = 'pending' AND (q.member_id = u.id OR q.candidate_id = u.id))
         AND NOT EXISTS (SELECT 1 FROM match_suggestions s WHERE (s.user_a = u.id OR s.user_b = u.id) AND s.created_at >= datetime('now', '-3 days'))
       ORDER BY u.last_seen_at DESC`,
    )
    .all() as { id: number }[];
  return ids
    .map((r) => getUser(r.id)!)
    .filter((u) => u && isProfileComplete(u))
    .sort((a, b) => Number(isPremium(b.id)) - Number(isPremium(a.id)));
}

/** Already drafted (either way, any outcome) or one of them passed on the other: don't offer it again. */
function pairTaken(a: number, b: number): boolean {
  return !!db
    .prepare(
      `SELECT 1 FROM suggestion_queue WHERE (member_id = ? AND candidate_id = ?) OR (member_id = ? AND candidate_id = ?)
       UNION ALL SELECT 1 FROM matches WHERE status = 'rejected' AND ((user_1_id = ? AND user_2_id = ?) OR (user_1_id = ? AND user_2_id = ?))`,
    )
    .get(a, b, b, a, a, b, b, a);
}

/** One line for the team: why this pair came up. */
function whyLine(m: User, c: User, cand: SuggestionCandidate): string {
  const parts = [`${cand.compatibility}% התאמה`];
  if (cand.likedThem) parts.push(`${first(c)} כבר עשה/תה לייק ל${first(m)}`);
  if (cand.memberLiked) parts.push(`${first(m)} כבר עשה/תה לייק ל${first(c)}`);
  if (m.location && m.location === c.location) parts.push(`שניהם מ${m.location}`);
  if (m.looking_for && m.looking_for === c.looking_for) parts.push("מחפשים אותו דבר");
  const shared = sharedAnswers(m.id, c.id, 2);
  if (shared.length) parts.push(`בחרו אותו דבר: ${shared.join(", ")}`);
  return parts.join(" · ");
}

/** Without the AI (no key, or it failed): a short, factual note from what they share. */
export function fallbackNotes(a: User, b: User): { noteA: string; noteB: string } {
  const shared = sharedAnswers(a.id, b.id, 2);
  const reasons = [a.location && a.location === b.location ? `שניכם מ${a.location}` : null, shared.length ? `שניכם בחרתם ${shared.join(" ו")}` : null].filter(Boolean);
  const tail = reasons.length ? `: ${reasons.join(", ")}` : "";
  return {
    noteA: `חשבנו עליך ועל ${first(b)} 💛 יש ביניכם התאמה גבוהה${tail}.`,
    noteB: `חשבנו עליך ועל ${first(a)} 💛 יש ביניכם התאמה גבוהה${tail}.`,
  };
}

let running = false;

/** Draft tonight's suggestions. Returns how many were added to the review list. */
export async function buildQueue(max = maxPerRun()): Promise<{ created: number }> {
  if (running) return { created: 0 };
  running = true;
  let created = 0;
  try {
    const ins = db.prepare("INSERT OR IGNORE INTO suggestion_queue (member_id, candidate_id, score, why, note_a, note_b, ai) VALUES (?, ?, ?, ?, ?, ?, ?)");
    // up to PER_MEMBER drafts per person per night (as the member or as the one suggested), so nobody is flooded
    const used = new Map<number, number>();
    const room = (id: number) => (used.get(id) ?? 0) < PER_MEMBER;
    for (const m of membersToSuggestFor()) {
      if (created >= max) break;
      if (!room(m.id)) continue;
      const picks = suggestionCandidates(m, 40)
        .filter((c) => c.compatibility >= MIN_COMPATIBILITY && !pairTaken(m.id, c.id))
        .map((c) => ({ c, u: getUser(c.id)! }))
        .filter(({ u }) => daysSince(u.last_seen_at) <= 30);
      for (const { c, u } of picks) {
        if (created >= max || !room(m.id)) break;
        if (!room(u.id)) continue;
        let notes = fallbackNotes(m, u);
        let ai = 0;
        if (aiOnboardingEnabled()) {
          try {
            notes = await draftSuggestionNotes(m.id, m.id, u.id);
            ai = 1;
          } catch (e) {
            console.error("[auto-suggest] AI draft failed, using a plain note", (e as Error).message);
          }
        }
        if (ins.run(m.id, u.id, c.compatibility, whyLine(m, u, c), notes.noteA, notes.noteB, ai).changes) {
          created++;
          for (const id of [m.id, u.id]) used.set(id, (used.get(id) ?? 0) + 1);
        }
      }
    }
  } finally {
    running = false;
  }
  return { created };
}

const israelDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
const israelHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", hourCycle: "h23" }).format(d));

/** Called every few minutes by the server: runs once a day, from the evening (Israel time). */
export async function maybeRunNightly(now = new Date()): Promise<number> {
  if (!autoSuggestEnabled() || israelHour(now) < RUN_HOUR) return 0;
  const day = israelDay(now);
  const done = db.prepare("SELECT value FROM app_settings WHERE key = 'auto_suggest_day'").get() as { value: string } | undefined;
  if (done?.value === day) return 0;
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('auto_suggest_day', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").run(day);
  return (await buildQueue()).created;
}

export type Person = { id: number; name: string; age: number | null; location: string | null; photo: string | null; premium: boolean };
export type QueueItem = { id: number; member: Person; candidate: Person; score: number; why: string; noteA: string; noteB: string; ai: boolean; createdAt: string };

const person = (u: User): Person => ({ id: u.id, name: u.full_name ?? "", age: u.age, location: u.location, photo: u.photos[0] ?? null, premium: isPremium(u.id) });

/** The review list: drafts waiting for the team, newest first. */
export function pendingQueue(): QueueItem[] {
  const rows = db.prepare("SELECT * FROM suggestion_queue WHERE status = 'pending' ORDER BY id DESC").all() as {
    id: number;
    member_id: number;
    candidate_id: number;
    score: number;
    why: string;
    note_a: string;
    note_b: string;
    ai: number;
    created_at: string;
  }[];
  return rows.flatMap((r) => {
    const m = getUser(r.member_id);
    const c = getUser(r.candidate_id);
    if (!m || !c) return [];
    return [{ id: r.id, member: person(m), candidate: person(c), score: r.score, why: r.why, noteA: r.note_a, noteB: r.note_b, ai: !!r.ai, createdAt: r.created_at }];
  });
}

export const pendingCount = () => (db.prepare("SELECT COUNT(*) AS n FROM suggestion_queue WHERE status = 'pending'").get() as { n: number }).n;

/** The team's OK: send it as a regular suggestion (with their edits). A pair that's no longer possible is dropped. */
export function approveQueued(adminId: number, id: number, noteA: string, noteB: string): { emailed: { a: boolean; b: boolean } } {
  const row = db.prepare("SELECT member_id, candidate_id FROM suggestion_queue WHERE id = ? AND status = 'pending'").get(id) as
    | { member_id: number; candidate_id: number }
    | undefined;
  if (!row) throw new SuggestionError("ההצעה כבר טופלה");
  try {
    const { emailed } = createSuggestion(adminId, row.member_id, row.candidate_id, noteA, noteB);
    db.prepare("UPDATE suggestion_queue SET status = 'sent', note_a = ?, note_b = ?, decided_at = datetime('now') WHERE id = ?").run(noteA.trim(), noteB.trim(), id);
    return { emailed };
  } catch (e) {
    if (e instanceof SuggestionError) rejectQueued(id); // e.g. they matched on their own meanwhile
    throw e;
  }
}

export function rejectQueued(id: number) {
  db.prepare("UPDATE suggestion_queue SET status = 'rejected', decided_at = datetime('now') WHERE id = ? AND status = 'pending'").run(id);
}
