import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { swipe } from "@/lib/matching";
import { getUser, toPublic } from "@/lib/users";
import { getQuota, recordLike, recordPass } from "@/lib/quota";
import { decideSecondChance, isSecondChance } from "@/lib/second-chance";
import { isOpenSuggestion, markSuggestionSeen } from "@/lib/suggestions";
import { isTestUser } from "@/lib/test-account";

const Body = z.object({
  targetId: z.number().int().positive(),
  action: z.enum(["like", "pass"]),
  comment: z
    .object({ text: z.string().trim().min(1).max(300), promptKey: z.string().max(40).optional() })
    .optional(),
  /** A card from "second chance": a profile the member passed on before. */
  secondChance: z.boolean().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser({ requireProfile: true });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  const { targetId, action, comment, secondChance } = parsed.data;
  if (isTestUser(user.id)) return error("חשבון טסט: לא שולחים לייקים למשתמשים אמיתיים", 403);
  if (targetId === user.id || !getUser(targetId)) return error("פרופיל לא נמצא", 404);
  if (secondChance && !isSecondChance(user, targetId)) return error("הפרופיל כבר לא זמין", 404);
  // Free tier: a fixed number of likes and of passes per Israel calendar day.
  // A personal suggestion from the team, and a second look at someone passed before, don't use them up.
  const suggested = isOpenSuggestion(user.id, targetId);
  const counted = !suggested && !secondChance;
  if (counted) {
    const quota = getQuota(user.id);
    if (action === "like" && quota.left === 0) return error("נגמרו הלייקים להיום", 429, { code: "like_limit", quota });
    if (action === "pass" && quota.passesLeft === 0) return error("נגמרו הדילוגים להיום", 429, { code: "pass_limit", quota });
  }
  if (secondChance) {
    decideSecondChance(user.id, targetId, action === "like");
    // Passing again leaves the earlier pass as it was.
    if (action === "pass") return json({ status: "rejected", matchId: 0, isNewMatch: false, recorded: false, quota: getQuota(user.id) });
  }
  const result = swipe(user.id, targetId, action, comment);
  markSuggestionSeen(user.id, targetId);
  if (result.recorded && counted && !getQuota(user.id).premium) (action === "like" ? recordLike : recordPass)(user.id);
  return json({ ...result, quota: getQuota(user.id), other: result.isNewMatch ? toPublic(getUser(targetId)!) : undefined });
});
