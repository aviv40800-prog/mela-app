import "server-only";
import { NextResponse } from "next/server";
import { getSessionUserId } from "./session";
import { getUser, touchLastSeen, type User } from "./users";
import { isAdmin } from "./admin";
import { isProfileComplete } from "./users";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const error = (message: string, status = 400, extra?: Record<string, unknown>) => NextResponse.json({ error: message, ...extra }, { status });

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Current user or 401. With `requireProfile`, the member must have finished onboarding (409). */
export async function requireUser(opts: { requireProfile?: boolean } = {}): Promise<User> {
  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  if (!user) throw new HttpError(401, "לא מחובר/ת");
  if (user.is_banned) throw new HttpError(403, "החשבון הושעה");
  touchLastSeen(user.id);
  if (opts.requireProfile && !isProfileComplete(user)) throw new HttpError(409, "יש להשלים את הפרופיל");
  return user;
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return error(e.message, e.status);
      console.error(e);
      return error("שגיאת שרת", 500);
    }
  };
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new HttpError(403, "אין הרשאה");
  return user;
}
