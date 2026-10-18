import "server-only";
import { db } from "./db";
import type { LookingFor, MaritalStatus, PartnerReligiosity, Religiosity } from "./content";

export type Gender = "male" | "female";
export type Seeking = Gender | "everyone";

export type User = {
  id: number;
  email: string | null;
  /** Legacy sign-in identifier; new members sign in by email and have none. */
  phone_number: string | null;
  /** The member proved they own `email` with an emailed code. */
  email_verified: boolean;
  full_name: string | null;
  age: number | null;
  gender: Gender | null;
  seeking: Seeking;
  location: string | null;
  bio: string | null;
  occupation: string | null;
  photos: string[];
  is_verified: boolean;
  is_demo: boolean;
  is_banned: boolean;
  last_seen_at: string | null;
  pref_age_min: number | null;
  pref_age_max: number | null;
  pref_distance_km: number | null;
  religiosity: Religiosity | null;
  partner_religiosity: PartnerReligiosity | null;
  marital_status: MaritalStatus | null;
  looking_for: LookingFor | null;
  /** Sign-in name (unique, case-insensitive); null until the member sets one. */
  username: string | null;
  /** Whether a password is set. The hash itself never leaves lib/auth. */
  has_password: boolean;
  created_at: string;
};

export type Prompt = { question_key: string; answer_text: string };

/** Public view of a profile — never exposes phone/email to other members. */
export type PublicProfile = {
  id: number;
  full_name: string;
  age: number | null;
  location: string | null;
  occupation: string | null;
  bio: string | null;
  photos: string[];
  is_verified: boolean;
  /** Seeded sample profile (shown with a "sample profile" label). */
  is_demo: boolean;
  religiosity: Religiosity | null;
  marital_status: MaritalStatus | null;
  looking_for: LookingFor | null;
  prompts: Prompt[];
};

type Row = Omit<User, "photos" | "is_verified" | "is_demo" | "is_banned" | "email_verified" | "has_password"> & {
  photos: string;
  is_verified: number;
  is_demo: number;
  is_banned: number;
  email_verified: number;
  password_hash: string | null;
  failed_logins: number;
  locked_until: number | null;
  code_verified_at: number | null;
};

function hydrate(row: Row): User {
  // credentials stay in the database: User objects reach pages and API responses
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, failed_logins, locked_until, code_verified_at, ...rest } = row;
  return {
    ...rest,
    has_password: !!password_hash,
    photos: JSON.parse(row.photos),
    is_verified: !!row.is_verified,
    is_demo: !!row.is_demo,
    is_banned: !!row.is_banned,
    email_verified: !!row.email_verified,
  };
}

export function getUser(id: number): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
  return row ? hydrate(row) : null;
}

export function getUserByPhone(phone: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE phone_number = ?").get(phone) as Row | undefined;
  return row ? hydrate(row) : null;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function getUserByEmail(email: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(normalizeEmail(email)) as Row | undefined;
  return row ? hydrate(row) : null;
}

/** Called after a correct emailed code: the address is now proven to belong to this member. */
export function markEmailVerified(userId: number, email: string) {
  db.prepare("UPDATE users SET email = ?, email_verified = 1, is_verified = 1 WHERE id = ?").run(normalizeEmail(email), userId);
}

export function createEmailUser(email: string): User {
  const { lastInsertRowid } = db.prepare("INSERT INTO users (email, email_verified, is_verified) VALUES (?, 1, 1)").run(normalizeEmail(email));
  return getUser(Number(lastInsertRowid))!;
}

export function createVerifiedUser(phone: string): User {
  const { lastInsertRowid } = db.prepare("INSERT INTO users (phone_number, is_verified) VALUES (?, 1)").run(phone);
  return getUser(Number(lastInsertRowid))!;
}

export function getPrompts(userId: number): Prompt[] {
  return db
    .prepare("SELECT question_key, answer_text FROM cultural_prompts WHERE user_id = ? ORDER BY id")
    .all(userId) as Prompt[];
}

export function toPublic(user: User): PublicProfile {
  return {
    id: user.id,
    full_name: user.full_name ?? "",
    age: user.age,
    location: user.location,
    occupation: user.occupation,
    bio: user.bio,
    photos: user.photos,
    is_verified: user.is_verified,
    is_demo: user.is_demo,
    religiosity: user.religiosity,
    marital_status: user.marital_status,
    looking_for: user.looking_for,
    prompts: getPrompts(user.id),
  };
}

export type ProfileInput = {
  full_name: string;
  email?: string | null;
  age: number;
  gender: Gender;
  seeking: Seeking;
  location: string;
  occupation: string;
  bio: string;
  photos: string[];
  prompts: Prompt[];
  religiosity?: Religiosity;
  partner_religiosity?: PartnerReligiosity;
  marital_status?: MaritalStatus;
  looking_for?: LookingFor;
} & Partial<Preferences>;

export type Preferences = { seeking: Seeking; pref_age_min: number | null; pref_age_max: number | null; pref_distance_km: number | null };

export function updatePreferences(userId: number, p: Preferences) {
  db.prepare("UPDATE users SET seeking = ?, pref_age_min = ?, pref_age_max = ?, pref_distance_km = ? WHERE id = ?").run(
    p.seeking,
    p.pref_age_min,
    p.pref_age_max,
    p.pref_distance_km,
    userId,
  );
}

export function updateProfile(userId: number, p: ProfileInput) {
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE users SET full_name = ?, email = CASE WHEN email_verified = 1 THEN email ELSE ? END, age = ?, gender = ?, seeking = ?, location = ?, occupation = ?, bio = ?, photos = ?
       WHERE id = ?`,
    ).run(p.full_name, p.email ? p.email.trim().toLowerCase() : null, p.age, p.gender, p.seeking, p.location, p.occupation, p.bio, JSON.stringify(p.photos), userId);
    if (p.pref_age_min !== undefined || p.pref_age_max !== undefined || p.pref_distance_km !== undefined) {
      db.prepare("UPDATE users SET pref_age_min = ?, pref_age_max = ?, pref_distance_km = ? WHERE id = ?").run(
        p.pref_age_min ?? null,
        p.pref_age_max ?? null,
        p.pref_distance_km ?? null,
        userId,
      );
    }
    if (p.religiosity && p.partner_religiosity) {
      db.prepare("UPDATE users SET religiosity = ?, partner_religiosity = ? WHERE id = ?").run(p.religiosity, p.partner_religiosity, userId);
    }
    if (p.marital_status && p.looking_for) {
      db.prepare("UPDATE users SET marital_status = ?, looking_for = ? WHERE id = ?").run(p.marital_status, p.looking_for, userId);
    }
    db.prepare("DELETE FROM cultural_prompts WHERE user_id = ?").run(userId);
    const ins = db.prepare("INSERT INTO cultural_prompts (user_id, question_key, answer_text) VALUES (?, ?, ?)");
    for (const pr of p.prompts) ins.run(userId, pr.question_key, pr.answer_text);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function isProfileComplete(u: User): boolean {
  return !!(u.full_name && u.age && u.gender && u.location && u.occupation && u.bio && getPrompts(u.id).length >= 2); // a photo is encouraged, not required
}

export function touchLastSeen(userId: number) {
  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < datetime('now', '-5 minutes'))").run(userId);
}
