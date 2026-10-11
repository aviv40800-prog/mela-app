import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { swipe } from "@/lib/matching";
import { getUser, toPublic } from "@/lib/users";

const Body = z.object({
  targetId: z.number().int().positive(),
  action: z.enum(["like", "pass"]),
  comment: z
    .object({ text: z.string().trim().min(1).max(300), promptKey: z.string().max(40).optional() })
    .optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser({ requireSubscription: true });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  const { targetId, action, comment } = parsed.data;
  if (targetId === user.id || !getUser(targetId)) return error("פרופיל לא נמצא", 404);
  const result = swipe(user.id, targetId, action, comment);
  return json({ ...result, other: result.isNewMatch ? toPublic(getUser(targetId)!) : undefined });
});
