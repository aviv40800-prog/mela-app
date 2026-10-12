import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedDemoData } from "./seed";
import { DB_PATH } from "./paths";

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE,
  phone_number  TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  age           INTEGER,
  gender        TEXT CHECK (gender IN ('male', 'female')),
  seeking       TEXT NOT NULL DEFAULT 'everyone' CHECK (seeking IN ('male', 'female', 'everyone')),
  location      TEXT,
  bio           TEXT,
  occupation    TEXT,
  photos        TEXT NOT NULL DEFAULT '[]',
  is_verified   INTEGER NOT NULL DEFAULT 0,
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_type          TEXT NOT NULL CHECK (plan_type IN ('monthly_49', 'quarterly_119')),
  status             TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'canceled', 'past_due')),
  trial_ends_at      TEXT,
  current_period_end TEXT NOT NULL,
  provider_ref       TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cultural_prompts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  answer_text  TEXT NOT NULL,
  UNIQUE (user_id, question_key)
);

CREATE TABLE IF NOT EXISTS matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_1_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_2_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'matched', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  matched_at TEXT,
  UNIQUE (user_1_id, user_2_id),
  CHECK (user_1_id <> user_2_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id     INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL,
  is_read      INTEGER NOT NULL DEFAULT 0,
  sent_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id, id);

CREATE TABLE IF NOT EXISTS otp_codes (
  phone_number TEXT PRIMARY KEY,
  code_hash    TEXT NOT NULL,
  expires_at   INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  choice       TEXT NOT NULL CHECK (choice IN ('a', 'b')),
  PRIMARY KEY (user_id, question_key)
);

CREATE TABLE IF NOT EXISTS daily_picks (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pick_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pick_date    TEXT NOT NULL,
  score        INTEGER NOT NULL,
  PRIMARY KEY (user_id, pick_user_id, pick_date)
);

-- Free-tier usage counters, one row per member per Israel calendar day.
CREATE TABLE IF NOT EXISTS daily_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT NOT NULL,
  likes   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event       TEXT NOT NULL,
  match_id    INTEGER,
  target      TEXT NOT NULL,
  status_code INTEGER,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function open(): DatabaseSync {
  const file = DB_PATH;
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file, { timeout: 5000 });
  plainRows(db);
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  migrate(db);
  if (!process.env.MELA_SKIP_SEED) seedDemoData(db);
  return db;
}

/** Additive, idempotent migrations for databases created by older versions. */
function migrate(db: DatabaseSync) {
  const cols = new Set((db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("is_banned")) db.exec("ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("last_seen_at")) db.exec("ALTER TABLE users ADD COLUMN last_seen_at TEXT");
  // Discovery preferences: who the member wants to see (NULL = no limit).
  if (!cols.has("pref_age_min")) db.exec("ALTER TABLE users ADD COLUMN pref_age_min INTEGER");
  if (!cols.has("pref_age_max")) db.exec("ALTER TABLE users ADD COLUMN pref_age_max INTEGER");
  if (!cols.has("pref_distance_km")) db.exec("ALTER TABLE users ADD COLUMN pref_distance_km INTEGER");
  // When the member last completed a "improve your profile" question batch.
  if (!cols.has("last_checkin_at")) db.exec("ALTER TABLE users ADD COLUMN last_checkin_at TEXT");
  if (!cols.has("checkin_batch")) db.exec("ALTER TABLE users ADD COLUMN checkin_batch TEXT"); // JSON keys of the open batch
  // Card metadata only (never the number): brand, last 4 digits, expiry — for display and the PSP seam.
  const subCols = new Set((db.prepare("PRAGMA table_info(subscriptions)").all() as { name: string }[]).map((c) => c.name));
  if (!subCols.has("payment_brand")) db.exec("ALTER TABLE subscriptions ADD COLUMN payment_brand TEXT");
  if (!subCols.has("payment_last4")) db.exec("ALTER TABLE subscriptions ADD COLUMN payment_last4 TEXT");
  if (!subCols.has("payment_exp")) db.exec("ALTER TABLE subscriptions ADD COLUMN payment_exp TEXT");
}

/**
 * node:sqlite returns null-prototype row objects, which React refuses to serialise from Server to
 * Client Components. Normalise every row to a plain object once, here.
 */
function plainRows(db: DatabaseSync) {
  const prepare = db.prepare.bind(db);
  db.prepare = (sql: string) => {
    const stmt = prepare(sql);
    const get = stmt.get.bind(stmt);
    const all = stmt.all.bind(stmt);
    stmt.get = ((...args: Parameters<typeof get>) => {
      const row = get(...args);
      return row ? { ...row } : row;
    }) as typeof stmt.get;
    stmt.all = ((...args: Parameters<typeof all>) => all(...args).map((row) => ({ ...row }))) as typeof stmt.all;
    return stmt;
  };
}

// Opened lazily on first query (not at import, so `next build` workers never touch the file) and
// reused across hot reloads in dev.
const g = globalThis as unknown as { __melaDb?: DatabaseSync };
const connection = () => g.__melaDb ?? (g.__melaDb = open());

export const db = new Proxy({} as DatabaseSync, {
  get(_, prop) {
    const real = connection();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
