import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedDemoData } from "./seed";
import { DB_PATH } from "./paths";

export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE,
  phone_number  TEXT UNIQUE, -- optional since sign-in moved to email codes
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
  phone_number TEXT PRIMARY KEY, -- the sign-in identifier: a normalised email (or a legacy phone number)
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

-- Free-text answers to interest-pause questions ("or write your own").
CREATE TABLE IF NOT EXISTS open_answers (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  answer_text  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, question_key)
);

-- AI-guided sign-up: the conversation so far and the profile draft built from it.
CREATE TABLE IF NOT EXISTS onboarding_chats (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  messages   TEXT NOT NULL,
  draft      TEXT NOT NULL,
  turns      INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per AI call (sign-up chat): tokens and estimated cost, for the admin dashboard and the daily cap.
CREATE TABLE IF NOT EXISTS ai_usage (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  model              TEXT NOT NULL,
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd           REAL NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON ai_usage(created_at);

-- "What would you ask the other side?" — questions members suggest; approved ones become chat ideas.
CREATE TABLE IF NOT EXISTS community_questions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  text        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_community_status ON community_questions(status, id);

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

-- A member blocked another: they never see each other again and any match/chat between them is closed.
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Member reports for the admin to review. The chat between them is copied in, so it survives a block.
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reported_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  details     TEXT,
  chat        TEXT NOT NULL DEFAULT '[]',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, id);

-- A checkout started on the payment provider's page. The id travels to the provider and back; the
-- amounts are fixed here, so a notify that doesn't match them is rejected.
CREATE TABLE IF NOT EXISTS payment_orders (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  plan_type    TEXT NOT NULL,
  first_sum    REAL NOT NULL,
  recur_sum    REAL NOT NULL,
  trial        INTEGER NOT NULL DEFAULT 0,
  recur_start  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  confirmation TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at      TEXT
);

-- Standing orders the admin still has to stop in Tranzila (member canceled, or deleted the account).
CREATE TABLE IF NOT EXISTS provider_cancels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  label      TEXT NOT NULL,
  plan_type  TEXT NOT NULL,
  last4      TEXT,
  reason     TEXT NOT NULL CHECK (reason IN ('canceled', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at    TEXT
);

-- Every notification the payment provider sends, kept as received, for the admin and for auditing.
CREATE TABLE IF NOT EXISTS payment_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT,
  accepted    INTEGER NOT NULL DEFAULT 0,
  note        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  // Demo members stop being created once the admin removed them (or with MELA_DEMO_MODE=off).
  if (!process.env.MELA_SKIP_SEED && process.env.MELA_DEMO_MODE !== "off" && !demoRemoved(db)) {
    seedDemoData(db);
    // Demo members get a spread of observance levels so the opening questionnaire shows up in discovery.
    db.exec(`UPDATE users SET
       religiosity = CASE id % 3 WHEN 0 THEN 'secular' WHEN 1 THEN 'traditional' ELSE 'religious' END,
       partner_religiosity = CASE id % 4 WHEN 0 THEN 'traditional_up' ELSE 'any' END
     WHERE is_demo = 1 AND religiosity IS NULL`);
    db.exec(`UPDATE users SET
       marital_status = CASE WHEN id % 7 = 0 THEN 'divorced' ELSE 'single' END,
       looking_for = CASE id % 5 WHEN 0 THEN 'open' WHEN 1 THEN 'casual' ELSE 'serious' END
     WHERE is_demo = 1 AND marital_status IS NULL`);
  }
  return db;
}

/** Set once the admin removed all demo members, so a restart doesn't bring them back. */
export function demoRemoved(d: DatabaseSync): boolean {
  return !!d.prepare("SELECT 1 FROM app_settings WHERE key = 'demo_removed'").get();
}

/** Additive, idempotent migrations for databases created by older versions. */
export function migrate(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
  // Email sign-in: phone_number used to be NOT NULL. SQLite can't drop a constraint in place, so rebuild the
  // table once (same columns, same ids — child tables keep pointing at the right rows).
  const phoneCol = (db.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number }[]).find((c) => c.name === "phone_number");
  if (phoneCol?.notnull) {
    const { sql } = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get() as { sql: string };
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    try {
      db.exec(sql.replace(/CREATE TABLE (IF NOT EXISTS )?"?users"?/, "CREATE TABLE users_rebuild").replace(/phone_number\s+TEXT\s+NOT NULL\s+UNIQUE/, "phone_number TEXT UNIQUE"));
      db.exec("INSERT INTO users_rebuild SELECT * FROM users; DROP TABLE users; ALTER TABLE users_rebuild RENAME TO users;");
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {
      db.exec("PRAGMA foreign_keys = ON");
    }
  }
  const cols = new Set((db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name));
  // Set once the member proved they own the address with an emailed code (only then does it count for sign-in/admin).
  if (!cols.has("email_verified")) db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("is_banned")) db.exec("ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("last_seen_at")) db.exec("ALTER TABLE users ADD COLUMN last_seen_at TEXT");
  // Discovery preferences: who the member wants to see (NULL = no limit).
  if (!cols.has("pref_age_min")) db.exec("ALTER TABLE users ADD COLUMN pref_age_min INTEGER");
  if (!cols.has("pref_age_max")) db.exec("ALTER TABLE users ADD COLUMN pref_age_max INTEGER");
  if (!cols.has("pref_distance_km")) db.exec("ALTER TABLE users ADD COLUMN pref_distance_km INTEGER");
  // When the member last completed a "improve your profile" question batch.
  if (!cols.has("last_checkin_at")) db.exec("ALTER TABLE users ADD COLUMN last_checkin_at TEXT");
  if (!cols.has("checkin_batch")) db.exec("ALTER TABLE users ADD COLUMN checkin_batch TEXT"); // JSON keys of the open batch
  // Opening questionnaire: own observance + what matters in a partner.
  if (!cols.has("religiosity")) db.exec("ALTER TABLE users ADD COLUMN religiosity TEXT");
  if (!cols.has("partner_religiosity")) db.exec("ALTER TABLE users ADD COLUMN partner_religiosity TEXT");
  if (!cols.has("marital_status")) db.exec("ALTER TABLE users ADD COLUMN marital_status TEXT");
  // Username + password sign-in (the emailed code is only for sign-up and "forgot password").
  if (!cols.has("username")) db.exec("ALTER TABLE users ADD COLUMN username TEXT");
  if (!cols.has("password_hash")) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  if (!cols.has("failed_logins")) db.exec("ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("locked_until")) db.exec("ALTER TABLE users ADD COLUMN locked_until INTEGER");
  // When the member last proved their email with a code: allows setting a new password for a short while.
  if (!cols.has("code_verified_at")) db.exec("ALTER TABLE users ADD COLUMN code_verified_at INTEGER");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)");
  if (!cols.has("looking_for")) db.exec("ALTER TABLE users ADD COLUMN looking_for TEXT");
  // Invite a friend: the member's personal invite code, who invited them, and bonus likes banked from invites.
  if (!cols.has("referral_code")) db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)");
  if (!cols.has("referred_by")) db.exec("ALTER TABLE users ADD COLUMN referred_by INTEGER");
  if (!cols.has("bonus_likes")) db.exec("ALTER TABLE users ADD COLUMN bonus_likes INTEGER NOT NULL DEFAULT 0");
  // "Your next match is on its way": email me when someone new who fits joins (at most once a day).
  if (!cols.has("match_alerts")) db.exec("ALTER TABLE users ADD COLUMN match_alerts INTEGER NOT NULL DEFAULT 0");
  if (!cols.has("match_alert_at")) db.exec("ALTER TABLE users ADD COLUMN match_alert_at TEXT");
  // "Only a few minutes left" — one reminder to members who verified but didn't finish their profile.
  if (!cols.has("signup_reminder_at")) db.exec("ALTER TABLE users ADD COLUMN signup_reminder_at TEXT");
  // Personal matchmaking: the team suggests two members to each other, each with a note on why.
  db.exec(`CREATE TABLE IF NOT EXISTS match_suggestions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_a     TEXT NOT NULL,
    note_b     TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    seen_a_at  TEXT,
    seen_b_at  TEXT,
    UNIQUE (user_a, user_b)
  )`);
  // Second chance: a passed profile offered again after the member sharpened their answers — once per person.
  db.exec(
    "CREATE TABLE IF NOT EXISTS second_chances (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, target_id))",
  );
  // Card metadata only (never the number): brand, last 4 digits, expiry — for display and the PSP seam.
  const subCols = new Set((db.prepare("PRAGMA table_info(subscriptions)").all() as { name: string }[]).map((c) => c.name));
  // Provider-billed subscriptions: the date the recurring charges start from.
  // Tranzila notify: the caller's IP (to learn and then pin Tranzila's servers), and the transaction a cancel refers to.
  const evCols = new Set((db.prepare("PRAGMA table_info(payment_events)").all() as { name: string }[]).map((c) => c.name));
  if (!evCols.has("source_ip")) db.exec("ALTER TABLE payment_events ADD COLUMN source_ip TEXT");
  const pcCols = new Set((db.prepare("PRAGMA table_info(provider_cancels)").all() as { name: string }[]).map((c) => c.name));
  if (!pcCols.has("txn_ref")) db.exec("ALTER TABLE provider_cancels ADD COLUMN txn_ref TEXT");
  if (!subCols.has("billing_anchor")) db.exec("ALTER TABLE subscriptions ADD COLUMN billing_anchor TEXT");
  if (!subCols.has("payment_brand")) db.exec("ALTER TABLE subscriptions ADD COLUMN payment_brand TEXT");
  if (!subCols.has("payment_last4")) db.exec("ALTER TABLE subscriptions ADD COLUMN payment_last4 TEXT");
  if (!subCols.has("payment_exp")) db.exec("ALTER TABLE subscriptions ADD COLUMN payment_exp TEXT");
  // Share-for-likes: invites shared today and the bonus likes they unlocked.
  const usageCols = new Set((db.prepare("PRAGMA table_info(daily_usage)").all() as { name: string }[]).map((c) => c.name));
  if (!usageCols.has("shares")) db.exec("ALTER TABLE daily_usage ADD COLUMN shares INTEGER NOT NULL DEFAULT 0");
  if (!usageCols.has("bonus")) db.exec("ALTER TABLE daily_usage ADD COLUMN bonus INTEGER NOT NULL DEFAULT 0");
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
