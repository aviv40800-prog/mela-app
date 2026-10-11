import "server-only";
import { NextResponse } from "next/server";
import { getSessionUserId } from "./session";
import { getUser, type User } from "./users";
import { getSubscription, hasAccess } from "./billing";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const error = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Current user or 401. With `requireSubscription`, also enforces an active trial/subscription (402). */
export async function requireUser(opts: { requireSubscription?: boolean } = {}): Promise<User> {
  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  if (!user) throw new HttpError(401, "לא מחובר/ת");
  if (opts.requireSubscription && !hasAccess(getSubscription(user.id))) throw new HttpError(402, "נדרש מנוי פעיל");
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
