import { handle, json, error, requireUser } from "@/lib/api";
import { loadChat, missingFields, resetChat } from "@/lib/ai-onboarding";
import { saveChatProfile } from "@/lib/chat-save";
import { getUser } from "@/lib/users";
import { nextOnboardingStep } from "@/lib/onboarding";

/** "Let's go" on the ready screen. The profile is normally saved already (when the chat finished); save it if not. */
export const POST = handle(async () => {
  const user = await requireUser();
  const { draft } = loadChat(user.id);
  if (!saveChatProfile(user)) return error(`חסרים עוד פרטים: ${missingFields(draft).join(", ")}`, 422);
  resetChat(user.id);
  return json({ ok: true, next: nextOnboardingStep(getUser(user.id)!) });
});
