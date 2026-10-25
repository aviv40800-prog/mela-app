import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { aiOnboardingAvailable, ChatError, chatTurn, DETAILS_FIELDS, FIELD_ORDER, getChat } from "@/lib/ai-onboarding";
import { saveChatProfile } from "@/lib/chat-save";

const Input = z.union([
  z.object({ text: z.string().min(1).max(1000) }),
  z.object({ choice: z.object({ field: z.enum(FIELD_ORDER), value: z.string().max(40), label: z.string().max(80) }) }),
  z.object({ details: z.partialRecord(z.enum(DETAILS_FIELDS), z.string().max(40)) }),
  z.object({ photos: z.array(z.string().max(120)).max(6) }),
  z.object({ bio: z.enum(["accept", "other"]), text: z.string().max(500).optional() }),
]);

export const GET = handle(async () => {
  const user = await requireUser();
  if (!aiOnboardingAvailable(user.id)) return json({ enabled: false });
  return json({ enabled: true, ...getChat(user) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (!aiOnboardingAvailable(user.id)) return error("ההרשמה בשיחה לא זמינה כרגע — אפשר להשלים בטופס", 404);
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("הודעה לא תקינה");
  try {
    const view = await chatTurn(user, parsed.data);
    // The chat has everything: save the profile now, before the "ready" screen (the button there just moves on).
    if (view.done) saveChatProfile(user);
    return json({ enabled: true, ...view });
  } catch (e) {
    if (e instanceof ChatError) return error(e.message, 422);
    throw e;
  }
});
