import "server-only";
import { db } from "./db";
import { draftToProfile, loadChat, missingFields, resetChat } from "./ai-onboarding";
import { getUser, isProfileComplete, updateProfile, type User } from "./users";
import { seedDemoLikes } from "./demo";
import { alertWaitingMembers } from "./match-alerts";

/**
 * Save the profile the sign-up chat built, as the profile form would. Runs as soon as the chat has everything
 * (not only on the last button), so a member who closes the site on the "ready" screen is still in Discover.
 * `notify`: tell members waiting for someone like them (off for the one-time catch-up of older chats).
 */
export function saveChatProfile(user: User, { notify = true } = {}): boolean {
  const { draft } = loadChat(user.id);
  if (missingFields(draft).length) return false;
  const profile = draftToProfile(draft, user.email);
  if (!profile) return false;
  const wasComplete = isProfileComplete(user);
  try {
    updateProfile(user.id, profile);
  } catch (e) {
    if (String(e).includes("UNIQUE constraint failed: users.email")) updateProfile(user.id, { ...profile, email: "" });
    else throw e;
  }
  const updated = getUser(user.id)!;
  if (notify && !wasComplete && isProfileComplete(updated)) {
    seedDemoLikes(updated);
    alertWaitingMembers(updated);
  }
  return true;
}

/**
 * One-time catch-up: members who finished the sign-up chat before the profile was saved automatically, and closed
 * the site on the last screen. Their profile is saved as they built it — no emails to them or to anyone else.
 */
export function saveStuckChats(): number {
  if (db.prepare("SELECT 1 FROM app_settings WHERE key = 'stuck_chats_saved'").get()) return 0;
  db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('stuck_chats_saved', '1')").run();
  const ids = db.prepare("SELECT c.user_id AS id FROM onboarding_chats c JOIN users u ON u.id = c.user_id WHERE u.is_banned = 0").all() as { id: number }[];
  let saved = 0;
  for (const { id } of ids) {
    const u = getUser(id);
    if (!u || isProfileComplete(u)) continue;
    try {
      if (saveChatProfile(u, { notify: false })) {
        resetChat(id);
        saved++;
      }
    } catch (e) {
      console.error("[chat-save] catch-up failed for", id, (e as Error).message);
    }
  }
  return saved;
}
