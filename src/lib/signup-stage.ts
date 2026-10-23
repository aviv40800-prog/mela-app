import "server-only";
import { db } from "./db";
import { getUser, isProfileComplete, type User } from "./users";
import { isAdmin } from "./admin";
import { FIELD_ORDER, detailsMissing, missingFields, type Draft } from "./ai-onboarding";

/**
 * Where a member who hasn't finished their profile stopped — for the admin page and the sign-up funnel.
 * Read from what's already stored (the account and the sign-up chat); the member's answers themselves aren't shown.
 */
export type Stage = "complete" | "after_code" | "form" | "chat" | "details" | "partner" | "bio" | "photos" | "unsaved";

export const STAGE_LABEL: Record<Stage, string> = {
  complete: "השלים/ה פרופיל",
  after_code: "אחרי הקוד, לא נכנס/ה לשיחה",
  form: "בטופס הרגיל",
  chat: "בשיחה עם MELA",
  details: "בכרטיס הפרטים בלחיצה",
  partner: "בשאלה על בן/בת הזוג",
  bio: "באישור הביו",
  photos: "בשלב התמונה",
  unsaved: "סיים/ה את השיחה, הפרופיל לא נשמר",
};

/** A few words for the users list. */
export function stageTag(i: StageInfo): string | null {
  if (i.stage === "complete") return null;
  if (i.stage === "chat") return `בשיחה · ${i.percent}%`;
  const short: Record<Exclude<Stage, "complete" | "chat">, string> = {
    after_code: "עצר/ה אחרי הקוד",
    form: "בטופס",
    details: "בכרטיס הפרטים",
    partner: "בשאלה האחרונה",
    bio: "באישור הביו",
    photos: "בשלב התמונה",
    unsaved: "הפרופיל לא נשמר",
  };
  return short[i.stage];
}

type ChatRow = { messages: string; draft: string; turns: number; updated_at: string };

export type StageInfo = { stage: Stage; label: string; percent: number | null; lastQuestion: string | null; lastAt: string | null };

function chatRow(userId: number): ChatRow | undefined {
  return db.prepare("SELECT messages, draft, turns, updated_at FROM onboarding_chats WHERE user_id = ?").get(userId) as ChatRow | undefined;
}

export function signupStage(u: User): StageInfo {
  if (isProfileComplete(u)) return { stage: "complete", label: STAGE_LABEL.complete, percent: 100, lastQuestion: null, lastAt: null };
  const row = chatRow(u.id);
  const answered = row ? (JSON.parse(row.messages) as { role: string }[]).some((m) => m.role === "user") : false;
  if (!row || !answered) {
    // no chat: either they never got past the code, or they chose the form (which saves as they go)
    const stage: Stage = u.full_name || u.age || u.location ? "form" : "after_code";
    return { stage, label: STAGE_LABEL[stage], percent: null, lastQuestion: null, lastAt: u.last_seen_at ?? null };
  }
  const draft = JSON.parse(row.draft) as Draft;
  const messages = JSON.parse(row.messages) as { role: string; text: string }[];
  const missing = missingFields(draft);
  const stage: Stage =
    missing.length === 0
      ? "unsaved"
      : draft.bio_draft && !draft.bio
        ? "bio"
        : missing[0] === "photos"
          ? "photos"
          : draft.pending === "partner"
            ? "partner"
            : detailsMissing(draft).length > 0 && (!!draft.occupation || messages.filter((m) => m.role === "user").length >= 3)
              ? "details"
              : "chat";
  const lastQuestion = stage === "chat" ? ([...messages].reverse().find((m) => m.role === "assistant")?.text ?? null) : null;
  return {
    stage,
    label: STAGE_LABEL[stage],
    percent: Math.round(((FIELD_ORDER.length - missing.length) / FIELD_ORDER.length) * 100),
    lastQuestion: lastQuestion && lastQuestion.length > 140 ? lastQuestion.slice(0, 137) + "…" : lastQuestion,
    lastAt: row.updated_at,
  };
}

/** The sign-up funnel for real members: how many reached each step, and where the unfinished ones are now. */
export function signupFunnel() {
  const ids = (db.prepare("SELECT id FROM users WHERE is_demo = 0 AND is_test = 0").all() as { id: number }[]).map((r) => r.id);
  const now: Record<Stage, number> = { complete: 0, after_code: 0, form: 0, chat: 0, details: 0, partner: 0, bio: 0, photos: 0, unsaved: 0 };
  const reached = { signedUp: 0, started: 0, details: 0, bio: 0, complete: 0 };
  for (const id of ids) {
    const u = getUser(id);
    if (!u || isAdmin(u)) continue;
    reached.signedUp++;
    const s = signupStage(u).stage;
    now[s]++;
    // each later step implies the earlier ones
    const pastDetails = s === "partner" || s === "bio" || s === "photos" || s === "unsaved" || s === "complete";
    if (s !== "after_code") reached.started++;
    if (pastDetails) reached.details++;
    if (s === "photos" || s === "unsaved" || s === "complete") reached.bio++;
    if (s === "complete") reached.complete++;
  }
  return { reached, now };
}
