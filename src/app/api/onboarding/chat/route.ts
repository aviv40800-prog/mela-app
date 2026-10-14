import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { aiOnboardingEnabled, ChatError, chatTurn, FIELD_ORDER, getChat } from "@/lib/ai-onboarding";

const Input = z.union([
  z.object({ text: z.string().min(1).max(1000) }),
  z.object({ choice: z.object({ field: z.enum(FIELD_ORDER), value: z.string().max(40), label: z.string().max(80) }) }),
  z.object({ photos: z.array(z.string().max(120)).min(1).max(6) }),
  z.object({ bio: z.enum(["accept", "other"]), text: z.string().max(500).optional() }),
]);

export const GET = handle(async () => {
  const user = await requireUser();
  if (!aiOnboardingEnabled()) return json({ enabled: false });
  return json({ enabled: true, ...getChat(user) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (!aiOnboardingEnabled()) return error("ההרשמה בשיחה לא זמינה כרגע", 404);
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("הודעה לא תקינה");
  try {
    return json({ enabled: true, ...(await chatTurn(user, parsed.data)) });
  } catch (e) {
    if (e instanceof ChatError) return error(e.message, 422);
    throw e;
  }
});
