import { handle, json, error, requireUser } from "@/lib/api";
import { draftToProfile, loadChat, missingFields, resetChat } from "@/lib/ai-onboarding";
import { getUser, isProfileComplete, updateProfile } from "@/lib/users";
import { seedDemoLikes } from "@/lib/demo";
import { nextOnboardingStep } from "@/lib/onboarding";
import { alertWaitingMembers } from "@/lib/match-alerts";

/** The member approved the profile the conversation built — save it like the profile form would. */
export const POST = handle(async () => {
  const user = await requireUser();
  const { draft } = loadChat(user.id);
  const profile = draftToProfile(draft, user.email);
  if (!profile) return error(`חסרים עוד פרטים: ${missingFields(draft).join(", ")}`, 422);
  const wasComplete = isProfileComplete(user);
  try {
    updateProfile(user.id, profile);
  } catch (e) {
    if (String(e).includes("UNIQUE constraint failed: users.email")) updateProfile(user.id, { ...profile, email: "" });
    else throw e;
  }
  resetChat(user.id);
  const updated = getUser(user.id)!;
  seedDemoLikes(updated);
  // A new face in the community: let members waiting for someone like them know.
  if (!wasComplete && isProfileComplete(updated)) alertWaitingMembers(updated);
  return json({ ok: true, next: nextOnboardingStep(updated) });
});
