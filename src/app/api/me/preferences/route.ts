import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { getUser, updatePreferences } from "@/lib/users";

export const Prefs = z
  .object({
    seeking: z.enum(["male", "female", "everyone"]),
    pref_age_min: z.number().int().min(18).max(99).nullable(),
    pref_age_max: z.number().int().min(18).max(99).nullable(),
    pref_distance_km: z.number().int().min(1).max(500).nullable(),
  })
  .refine((p) => p.pref_age_min === null || p.pref_age_max === null || p.pref_age_min <= p.pref_age_max, "טווח גילאים לא תקין");

/** Discovery preferences — changeable at any time from Discover or the profile. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Prefs.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "העדפות לא תקינות");
  updatePreferences(user.id, parsed.data);
  const u = getUser(user.id)!;
  return json({ seeking: u.seeking, pref_age_min: u.pref_age_min, pref_age_max: u.pref_age_max, pref_distance_km: u.pref_distance_km });
});
