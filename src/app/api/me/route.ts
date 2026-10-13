import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { getPrompts, getUser, updateProfile } from "@/lib/users";
import { getSubscription } from "@/lib/billing";
import { CULTURAL_PROMPTS } from "@/lib/content";
import { seedDemoLikes } from "@/lib/demo";
import { nextOnboardingStep } from "@/lib/onboarding";

const promptKeys = CULTURAL_PROMPTS.map((p) => p.key) as [string, ...string[]];

const Profile = z.object({
  full_name: z.string().trim().min(2).max(60),
  email: z.union([z.email(), z.literal("")]).optional(),
  age: z.number().int().min(18).max(99),
  gender: z.enum(["male", "female"]),
  seeking: z.enum(["male", "female", "everyone"]),
  location: z.string().trim().min(2, "נא לכתוב עיר").max(60),
  occupation: z.string().trim().min(2).max(80),
  bio: z.string().trim().min(10).max(500),
  photos: z
    .array(z.string().regex(/^\/api\/photos\/[\w-]+\.(jpg|png|webp)$/))
    .min(1)
    .max(6),
  pref_age_min: z.number().int().min(18).max(99).nullable().optional(),
  pref_age_max: z.number().int().min(18).max(99).nullable().optional(),
  pref_distance_km: z.number().int().min(1).max(500).nullable().optional(),
  religiosity: z.enum(["secular", "traditional", "religious"], "נא לבחור איך את/ה מגדיר/ה את עצמך"),
  partner_religiosity: z.enum(["any", "traditional_up", "religious"], "נא לבחור מה חשוב לך בצד השני"),
  prompts: z
    .array(z.object({ question_key: z.enum(promptKeys), answer_text: z.string().trim().min(2).max(200) }))
    .min(2)
    .max(3)
    .refine((ps) => new Set(ps.map((p) => p.question_key)).size === ps.length, "שאלה כפולה"),
});

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ user, prompts: getPrompts(user.id), subscription: getSubscription(user.id) });
});

export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Profile.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "פרטים חסרים");
  try {
    updateProfile(user.id, parsed.data);
  } catch (e) {
    if (String(e).includes("UNIQUE constraint failed: users.email")) return error("האימייל הזה כבר בשימוש בחשבון אחר", 409);
    throw e;
  }
  const updated = getUser(user.id)!;
  seedDemoLikes(updated);
  return json({ ok: true, next: nextOnboardingStep(updated) });
});
