import { timingSafeEqual } from "node:crypto";
import { handle, json, error } from "@/lib/api";
import { statsSnapshot } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Read-only numbers for the team's analysis (counts and sums, never personal details). Opened only with
 * `Authorization: Bearer <MELA_STATS_TOKEN>`; without the variable set, the endpoint doesn't exist.
 */
export const GET = handle(async (req: Request) => {
  const token = process.env.MELA_STATS_TOKEN ?? "";
  if (token.length < 16) return error("לא נמצא", 404);
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return error("אין הרשאה", 401);
  return json(statsSnapshot());
});
