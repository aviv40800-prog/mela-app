import { z } from "zod";
import { CULTURAL_PROMPTS } from "./content";

/** The complete-profile contract — shared by the profile form (PUT /api/me) and the AI onboarding chat. */
export const promptKeys = CULTURAL_PROMPTS.map((p) => p.key) as [string, ...string[]];

export const ProfileSchema = z.object({
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
  marital_status: z.enum(["single", "divorced", "widowed"], "נא לבחור סטטוס"),
  looking_for: z.enum(["serious", "open", "casual"], "נא לבחור מה את/ה מחפש/ת"),
  prompts: z
    .array(z.object({ question_key: z.enum(promptKeys), answer_text: z.string().trim().min(2).max(200) }))
    .min(2)
    .max(3)
    .refine((ps) => new Set(ps.map((p) => p.question_key)).size === ps.length, "שאלה כפולה"),
});

export type ProfileData = z.infer<typeof ProfileSchema>;
