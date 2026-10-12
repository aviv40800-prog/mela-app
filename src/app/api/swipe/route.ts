import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { swipe } from "@/lib/matching";
import { getUser, toPublic } from "@/lib/users";
import { getQuota, recordLike } from "@/lib/quota";

const Body = z.object({
  targetId: z.number().int().positive(),
  action: z.enum(["like", "pass"]),
  comment: z
    .object({ text: z.string().trim().min(1).max(300), promptKey: z.string().max(40).optional() })
    .optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser({ requireProfile: true });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  const { targetId, action, comment } = parsed.data;
  if (targetId === user.id || !getUser(targetId)) return error("פרופיל לא נמצא", 404);
  // Free tier: a fixed number of likes per Israel calendar day. Passes are never limited.
  if (action === "like") {
    const quota = getQuota(user.id);
    if (quota.left === 0) return error("נגמרו הלייקים להיום", 429, { code: "like_limit", quota });
  }
  const result = swipe(user.id, targetId, action, comment);
  if (action === "like" && result.recorded && !getQuota(user.id).premium) recordLike(user.id);
  return json({ ...result, quota: getQuota(user.id), other: result.isNewMatch ? toPublic(getUser(targetId)!) : undefined });
});
