import "server-only";
import { db } from "./db";
import { ALL_QUESTIONS, BONUS_QUESTIONS, QUIZ_QUESTIONS } from "./content";

/** A new batch of "improve your profile" questions opens every CHECKIN_EVERY_DAYS days. */
export const CHECKIN_EVERY_DAYS = 3;
export const CHECKIN_BATCH = 3;

type Q = (typeof ALL_QUESTIONS)[number];
export type Checkin = { questions: Q[]; nextAt: string | null; answered: number; total: number };

function answeredKeys(userId: number): Set<string> {
  // A free-text answer ("or write your own") counts as answered too, so the question isn't asked again.
  const rows = db
    .prepare("SELECT question_key FROM quiz_answers WHERE user_id = ? UNION SELECT question_key FROM open_answers WHERE user_id = ?")
    .all(userId, userId) as { question_key: string }[];
  return new Set(rows.map((r) => r.question_key));
}

/**
 * "Smart" pick: favour the areas the member has told us least about (values, relationship, lifestyle,
 * culture), taking one question per area in turn, so every batch rounds out the picture.
 */
function smartPick(answered: Set<string>, n: number, pool: readonly Q[] = BONUS_QUESTIONS): Q[] {
  const remaining = pool.filter((q) => !answered.has(q.key));
  const cats = [...new Set(remaining.map((q) => q.cat))];
  const answeredIn = (cat: string) => ALL_QUESTIONS.filter((q) => q.cat === cat && answered.has(q.key)).length;
  cats.sort((a, b) => answeredIn(a) - answeredIn(b));
  const queues = cats.map((c) => remaining.filter((q) => q.cat === c));
  const out: Q[] = [];
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift()!);
  return out;
}

/**
 * The open batch is persisted when it opens (so answering it doesn't pull the next questions forward) and
 * closes itself once every question in it is answered; the next batch opens CHECKIN_EVERY_DAYS later.
 */
export function getCheckin(userId: number): Checkin {
  const answered = answeredKeys(userId);
  const row = db.prepare("SELECT last_checkin_at, checkin_batch FROM users WHERE id = ?").get(userId) as
    | { last_checkin_at: string | null; checkin_batch: string | null }
    | undefined;
  let last = row?.last_checkin_at ? new Date(row.last_checkin_at.replace(" ", "T") + "Z").getTime() : null;
  let batch: string[] = row?.checkin_batch ? JSON.parse(row.checkin_batch) : [];
  const total = ALL_QUESTIONS.length;
  const done = () => ALL_QUESTIONS.filter((q) => answered.has(q.key)).length;

  if (batch.length && batch.every((k) => answered.has(k))) {
    // batch finished → close it and start the waiting period
    db.prepare("UPDATE users SET last_checkin_at = datetime('now'), checkin_batch = NULL WHERE id = ?").run(userId);
    last = Date.now();
    batch = [];
  }
  const nextMs = last === null ? Date.now() : last + CHECKIN_EVERY_DAYS * 86_400_000;
  if (!batch.length && nextMs <= Date.now()) {
    batch = smartPick(answered, CHECKIN_BATCH).map((q) => q.key);
    if (batch.length) db.prepare("UPDATE users SET checkin_batch = ? WHERE id = ?").run(JSON.stringify(batch), userId);
  }
  const questions = batch.map((k) => BONUS_QUESTIONS.find((q) => q.key === k)!).filter(Boolean);
  const exhausted = BONUS_QUESTIONS.every((q) => answered.has(q.key));
  return {
    questions,
    nextAt: questions.length || exhausted ? null : new Date(Math.max(nextMs, Date.now())).toISOString(),
    answered: done(),
    total,
  };
}

/** Labels of the answers two members share (heritage first) — shown on cards as "what you have in common". */
export function sharedAnswers(me: number, other: number, limit = 3): string[] {
  const rows = db
    .prepare(
      `SELECT a.question_key, a.choice FROM quiz_answers a
       JOIN quiz_answers b ON b.question_key = a.question_key AND b.choice = a.choice AND b.user_id = ?
       WHERE a.user_id = ?`,
    )
    .all(other, me) as { question_key: string; choice: "a" | "b" }[];
  const order = ["culture", "values", "relationship", "lifestyle", "general"];
  return rows
    .map((r) => ({ r, q: ALL_QUESTIONS.find((q) => q.key === r.question_key) }))
    .filter((x) => x.q)
    .sort((x, y) => order.indexOf(x.q!.cat) - order.indexOf(y.q!.cat))
    .slice(0, limit)
    .map((x) => x.q![x.r.choice]);
}

/**
 * The next few questions offered while swiping ("3 more for better matches"): the core this-or-that
 * questions first (most are skipped at sign-up), then the deeper ones — always the least-covered areas.
 */
export function nextQuestions(userId: number, n = 3): { questions: Q[]; remaining: number } {
  const answered = answeredKeys(userId);
  const core = smartPick(answered, n, QUIZ_QUESTIONS);
  const questions = core.length >= n ? core : [...core, ...smartPick(answered, n - core.length, BONUS_QUESTIONS)];
  return { questions, remaining: ALL_QUESTIONS.filter((q) => !answered.has(q.key)).length };
}
