import "server-only";
import { db } from "./db";

export type Gender = "male" | "female";
export type Seeking = Gender | "everyone";

export type User = {
  id: number;
  email: string | null;
  phone_number: string;
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
  prompts: Prompt[];
};

type Row = Omit<User, "photos" | "is_verified" | "is_demo"> & { photos: string; is_verified: number; is_demo: number };

function hydrate(row: Row): User {
  return { ...row, photos: JSON.parse(row.photos), is_verified: !!row.is_verified, is_demo: !!row.is_demo };
}

export function getUser(id: number): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
  return row ? hydrate(row) : null;
}

export function getUserByPhone(phone: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE phone_number = ?").get(phone) as Row | undefined;
  return row ? hydrate(row) : null;
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
};

export function updateProfile(userId: number, p: ProfileInput) {
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE users SET full_name = ?, email = ?, age = ?, gender = ?, seeking = ?, location = ?, occupation = ?, bio = ?, photos = ?
       WHERE id = ?`,
    ).run(p.full_name, p.email || null, p.age, p.gender, p.seeking, p.location, p.occupation, p.bio, JSON.stringify(p.photos), userId);
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
  return !!(u.full_name && u.age && u.gender && u.location && u.occupation && u.bio && u.photos.length > 0 && getPrompts(u.id).length >= 2);
}
