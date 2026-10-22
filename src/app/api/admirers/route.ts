import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { admirers, hideAdmirer, reopenPassed } from "@/lib/admirers";
import { getQuota, recordLike } from "@/lib/quota";
import { getUser, toPublic } from "@/lib/users";
import { isTestUser } from "@/lib/test-account";

/** "People who liked you" for Picks: matches, likes waiting, and likes the member passed on. */
export const GET = handle(async () => {
  const user = await requireUser({ requireProfile: true });
  const quota = getQuota(user.id);
  if (isTestUser(user.id)) return json({ items: [], quota });
  return json({ items: admirers(user.id, quota.premium), quota });
});

const Body = z.object({ action: z.enum(["hide", "reopen"]), otherId: z.number().int().positive() });

export const POST = handle(async (req: Request) => {
  const user = await requireUser({ requireProfile: true });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  const { action, otherId } = parsed.data;
  if (action === "hide") {
    hideAdmirer(user.id, otherId);
    return json({ ok: true });
  }
  // Giving someone a second chance is a like: it uses the day's likes on the free plan.
  const quota = getQuota(user.id);
  if (!quota.premium && quota.left === 0) return error("נגמרו הלייקים להיום", 429, { code: "like_limit", quota });
  const matchId = reopenPassed(user.id, otherId);
  if (!matchId) return error("הפרופיל כבר לא זמין", 404);
  if (!quota.premium) recordLike(user.id);
  return json({ ok: true, matchId, other: toPublic(getUser(otherId)!), quota: getQuota(user.id) });
});
