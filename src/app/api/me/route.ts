import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { getPrompts, getUser, isProfileComplete, updateProfile } from "@/lib/users";
import { getSubscription } from "@/lib/billing";
import { ProfileSchema as Profile } from "@/lib/profile-schema";
import { seedDemoLikes } from "@/lib/demo";
import { nextOnboardingStep } from "@/lib/onboarding";
import { alertWaitingMembers } from "@/lib/match-alerts";
import { isAdmin } from "@/lib/admin";
import { deleteOwnAccount } from "@/lib/safety";
import { recordDeparture } from "@/lib/departures";
import { DEPARTURE_REASONS, type DepartureReason } from "@/lib/content";
import { destroySession } from "@/lib/session";

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ user, prompts: getPrompts(user.id), subscription: getSubscription(user.id) });
});

export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Profile.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "פרטים חסרים");
  const wasComplete = isProfileComplete(user);
  try {
    updateProfile(user.id, parsed.data);
  } catch (e) {
    if (String(e).includes("UNIQUE constraint failed: users.email")) return error("האימייל הזה כבר בשימוש בחשבון אחר", 409);
    throw e;
  }
  const updated = getUser(user.id)!;
  seedDemoLikes(updated);
  // A new face in the community: let members waiting for someone like them know.
  if (!wasComplete && isProfileComplete(updated)) alertWaitingMembers(updated);
  return json({ ok: true, next: nextOnboardingStep(updated) });
});

const DeleteBody = z.object({
  confirm: z.literal("מחיקה"),
  reason: z.enum(Object.keys(DEPARTURE_REASONS) as [DepartureReason, ...DepartureReason[]]).optional(),
  reasonText: z.string().max(300).optional(),
});

/** The member deletes their own account and everything in it. Asks for the word "מחיקה" typed in, as a safeguard. */
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser();
  if (isAdmin(user)) return error("חשבון מנהל לא נמחק מכאן", 403);
  const body = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return error("כדי למחוק, הקלד/י ״מחיקה״");
  recordDeparture(user, body.data.reason ? { reason: body.data.reason, text: body.data.reasonText } : undefined);
  deleteOwnAccount(user.id);
  await destroySession();
  return json({ ok: true });
});
