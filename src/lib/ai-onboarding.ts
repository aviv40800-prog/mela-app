import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { db } from "./db";
import { CULTURAL_PROMPTS, LOOKING_FOR, MARITAL_STATUS, PARTNER_RELIGIOSITY, RELIGIOSITY } from "./content";
import { ProfileSchema } from "./profile-schema";
import type { User } from "./users";

/**
 * AI-guided sign-up: instead of a form, a new member chats with MELA's host. Each turn the model replies in
 * Hebrew and returns what it learned as structured data; the server validates every value against the same
 * schema as the profile form and keeps the draft. Enum answers (status, observance, intentions) are offered
 * as tap-to-answer chips and set directly, never guessed. Photos and the bio are confirmed by the member.
 *
 * Enabled when ANTHROPIC_API_KEY is set; otherwise sign-up uses the regular form.
 */
export const aiOnboardingEnabled = () => !!process.env.ANTHROPIC_API_KEY && process.env.MELA_AI_ONBOARDING !== "off";
const MODEL = () => process.env.MELA_AI_MODEL || "claude-opus-5-5";
/** New AI sign-up chats per day (MELA_AI_DAILY_LIMIT, default 50); beyond it new members get the form. 0 = no limit. */
export const dailyLimit = () => {
  const v = Number(process.env.MELA_AI_DAILY_LIMIT ?? 50);
  return Number.isFinite(v) && v >= 0 ? v : 50;
};

// $ per million tokens [input, output] — cache reads ~0.1x input, cache writes 1.25x input.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
export function costUsd(model: string, u: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): number {
  const [i, o] = PRICES[model] ?? PRICES[Object.keys(PRICES).find((k) => model.startsWith(k.replace(/-\d+-\d+$/, ""))) ?? "claude-opus-5-5"];
  return ((u.input_tokens ?? 0) * i + (u.cache_read_input_tokens ?? 0) * i * 0.1 + (u.cache_creation_input_tokens ?? 0) * i * 1.25 + (u.output_tokens ?? 0) * o) / 1e6;
}

/** Members who started an AI chat today (UTC) — the daily cap counts these. */
function chatsStartedToday(): number {
  return (db.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM ai_usage WHERE created_at >= date('now')").get() as { n: number }).n;
}

/** AI chat for this member: on, and either they already started one or today's cap isn't reached. */
export function aiOnboardingAvailable(userId: number): boolean {
  if (!aiOnboardingEnabled()) return false;
  const limit = dailyLimit();
  if (!limit) return true;
  if (db.prepare("SELECT 1 FROM onboarding_chats WHERE user_id = ? AND turns > 0").get(userId)) return true;
  return chatsStartedToday() < limit;
}

export function aiUsageStats() {
  const q = (where: string) =>
    db.prepare(`SELECT COUNT(DISTINCT user_id) AS users, COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS turns FROM ai_usage WHERE ${where}`).get() as {
      users: number;
      cost: number;
      turns: number;
    };
  const finished = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(AVG(c), 0) AS avg FROM (
         SELECT a.user_id, SUM(a.cost_usd) AS c FROM ai_usage a JOIN users u ON u.id = a.user_id
         WHERE u.full_name IS NOT NULL AND u.bio IS NOT NULL GROUP BY a.user_id)`,
    )
    .get() as { n: number; avg: number };
  return { enabled: aiOnboardingEnabled(), model: MODEL(), limit: dailyLimit(), today: q("created_at >= date('now')"), month: q("created_at >= date('now', '-30 days')"), finished };
}
const MAX_TURNS = 40;
const MAX_TEXT = 1000;

export type ChatMsg = { role: "user" | "assistant"; text: string };
export type Draft = {
  full_name?: string;
  age?: number;
  gender?: "male" | "female";
  seeking?: "male" | "female" | "everyone";
  location?: string;
  occupation?: string;
  bio?: string; // accepted bio
  bio_draft?: string; // proposed, waiting for the member
  photos?: string[];
  prompts?: { question_key: string; answer_text: string }[];
  religiosity?: keyof typeof RELIGIOSITY;
  partner_religiosity?: keyof typeof PARTNER_RELIGIOSITY;
  marital_status?: keyof typeof MARITAL_STATUS;
  looking_for?: keyof typeof LOOKING_FOR;
};

/** The fields still needed, in the order the conversation should cover them. */
export const FIELD_ORDER = [
  "full_name",
  "gender",
  "age",
  "location",
  "occupation",
  "looking_for",
  "marital_status",
  "religiosity",
  "partner_religiosity",
  "prompts",
  "bio",
  "photos",
] as const;
export type Field = (typeof FIELD_ORDER)[number];

/** Tap-to-answer choices for the enum fields. */
export const CHOICES: Partial<Record<Field, Record<string, string>>> = {
  gender: { female: "אישה", male: "גבר" },
  looking_for: LOOKING_FOR,
  marital_status: MARITAL_STATUS,
  religiosity: RELIGIOSITY,
  partner_religiosity: PARTNER_RELIGIOSITY,
};

const ok = <T extends z.ZodTypeAny>(schema: T, v: unknown): v is z.infer<T> => v !== undefined && v !== null && schema.safeParse(v).success;
const S = ProfileSchema.shape;

export function missingFields(d: Draft): Field[] {
  return FIELD_ORDER.filter((f) => {
    if (f === "prompts") return !(d.prompts && d.prompts.length >= 2);
    if (f === "photos") return !(d.photos && d.photos.length >= 1);
    return !ok(S[f], d[f]);
  });
}

/** Turns a finished draft into the exact payload PUT /api/me accepts (or null while something is missing). */
export function draftToProfile(d: Draft, email: string | null) {
  const seeking = d.seeking ?? (d.gender === "male" ? "female" : "male");
  const res = ProfileSchema.safeParse({
    full_name: d.full_name,
    email: email ?? "",
    age: d.age,
    gender: d.gender,
    seeking,
    location: d.location,
    occupation: d.occupation,
    bio: d.bio,
    photos: d.photos ?? [],
    religiosity: d.religiosity,
    partner_religiosity: d.partner_religiosity,
    marital_status: d.marital_status,
    looking_for: d.looking_for,
    prompts: (d.prompts ?? []).slice(0, 3),
  });
  return res.success ? res.data : null;
}

// ---------- persistence ----------

type Row = { messages: string; draft: string; turns: number };
export function loadChat(userId: number): { messages: ChatMsg[]; draft: Draft; turns: number } {
  const row = db.prepare("SELECT messages, draft, turns FROM onboarding_chats WHERE user_id = ?").get(userId) as Row | undefined;
  return row ? { messages: JSON.parse(row.messages), draft: JSON.parse(row.draft), turns: row.turns } : { messages: [], draft: {}, turns: 0 };
}
function saveChat(userId: number, messages: ChatMsg[], draft: Draft, turns: number) {
  db.prepare(
    `INSERT INTO onboarding_chats (user_id, messages, draft, turns, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET messages = excluded.messages, draft = excluded.draft, turns = excluded.turns, updated_at = excluded.updated_at`,
  ).run(userId, JSON.stringify(messages), JSON.stringify(draft), turns);
}
export function resetChat(userId: number) {
  db.prepare("DELETE FROM onboarding_chats WHERE user_id = ?").run(userId);
}

/** If the model is unavailable after a direct answer (chip, photo, bio), the conversation still moves on. */
const FALLBACK_ASK: Record<Field | "none", string> = {
  full_name: "איך קוראים לך?",
  gender: "ואיך לפנות אלייך — בלשון זכר או נקבה?",
  age: "בן/בת כמה את/ה?",
  location: "איפה את/ה גר/ה?",
  occupation: "ובמה את/ה עוסק/ת?",
  looking_for: "ומה הכי מתאים לך עכשיו?",
  marital_status: "ומה הסטטוס שלך?",
  religiosity: "איך היית מגדיר/ה את עצמך מבחינת מסורת?",
  partner_religiosity: "וכמה חשוב לך שהצד השני יהיה דתי/ה?",
  prompts: "שאלה אחרונה כמעט: על מה את/ה יכול/ה לדבר שעות?",
  bio: "אפשר לכתוב כמה מילים על עצמך לביו?",
  photos: "ועכשיו החלק שהכי עובד — תמונה אחת לפחות, טבעית ועם חיוך.",
  none: "תודה! הפרופיל שלך מוכן.",
};

export const GREETING: ChatMsg[] = [
  { role: "assistant", text: "היי! אני המארחת של MELA. במקום טופס משעמם — בוא/י נדבר כמה דקות, ואני אכתוב לך פרופיל שבאמת נשמע כמוך." },
  { role: "assistant", text: "ספר/י לי על עצמך כמו שהיית מספר/ת למישהו חדש שפגשת בבר: איך קוראים לך, ומה עושה לך את השבוע?" },
];

// ---------- the model turn ----------

const enumOrNull = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]).nullable();
const promptKeys = CULTURAL_PROMPTS.map((p) => p.key) as [string, ...string[]];

const TurnSchema = z.object({
  reply: z.string().describe("Your next message to the member, in Hebrew. 1–3 short sentences. Ends with at most one question."),
  extracted: z.object({
    full_name: z.string().nullable().describe("First name (and last name if given). Null if not said."),
    age: z.number().int().nullable(),
    gender: z.enum(["male", "female"]).nullable().describe("Only when clear from what they said or how they write about themselves in Hebrew."),
    seeking: z.enum(["male", "female", "everyone"]).nullable().describe("Only if they said who they want to meet."),
    location: z.string().nullable().describe("City or town in Israel."),
    occupation: z.string().nullable(),
    religiosity: enumOrNull(RELIGIOSITY),
    partner_religiosity: enumOrNull(PARTNER_RELIGIOSITY),
    marital_status: enumOrNull(MARITAL_STATUS),
    looking_for: enumOrNull(LOOKING_FOR),
    prompt_answers: z
      .array(z.object({ question_key: z.enum(promptKeys), answer_text: z.string() }))
      .describe("Profile prompt answers, in the member's own words (short, first person), for prompts their messages clearly answer."),
  }),
  bio_draft: z.string().nullable().describe("A proposed bio (Hebrew, first person, 2–3 warm sentences, max 300 chars) — only when asked for in the state block."),
  ask: z.enum([...FIELD_ORDER, "none"]).describe("The single field your reply asks about, or none."),
});
type Turn = z.infer<typeof TurnSchema>;

const SYSTEM = `You are "המארחת של MELA" — the host of MELA, a dating app for young Ethiopian-Israelis ("אהבה עם שורשים"). A new member just verified their email. Instead of a form, you chat with them for a few minutes and build their profile from the conversation.

Who you are: the friend everyone wishes they had at a party — sharp, warm, curious, a little funny, a natural matchmaker. People should leave this chat feeling *seen*, and a bit excited to meet someone. You are not a form, not a survey, not a therapist.

How you talk (Hebrew only):
- Short messages: 1–3 sentences. Exactly one question per message.
- Real curiosity: pick the most interesting, specific detail in what they just said and follow it — don't jump to a generic next topic.
  Bad: "מעניין! ומה התחביבים שלך?"
  Good: "רגע, אחות בחדר מיון ובשישי מבשלת לכל המשפחה? מתי את ישנה בכלל?"
- Every few messages, offer a short perceptive observation about them, then ask: "נשמע שאתה מישהו שדואג לכולם — מי דואג לך?"
- Light humor and everyday Israeli Hebrew (וואלה, סבבה, יאללה) are welcome; never cringe, never sarcastic about them.
- Vary your openings. Don't start messages with "מעולה", "אהבתי", "נעים מאוד", "וואו" more than once in the whole chat. Never say "השאלה הבאה", never list questions, never sound like an interview.
- Until you know their gender, use slash forms (את/ה). Once known, use the right gender consistently.
- Never invent facts. Never pressure; if they dodge something, move on lightly.
- At most one emoji in the whole conversation.

What to talk about — a real mix, the way you'd get to know someone new:
work or studies and what they love about it · what fills their evenings and weekends · something they're passionate or nerdy about · friends and humor · family and the values they carry · what they're looking for in a partner, and what's a red flag · their idea of a great first date.
Their Ethiopian-Israeli background is one part of who they are, not the theme. Don't ask about culture, food, buna, Sigd or Amharic unless THEY bring it up — and then at most one warm follow-up.

What the profile needs — the <state> block lists what's still missing. Weave these in naturally; you can combine basics into one easy question early ("ספר/י קצת — בן/בת כמה, מאיפה, ומה ממלא לך את הימים?"):
- full_name, gender, age (18+), location (city), occupation.
- looking_for, marital_status, religiosity, partner_religiosity: the app shows tap buttons when your "ask" names one of them. Ask briefly and casually in one sentence ("ורק שאדע מה להראות לך — מה את/ה מחפש/ת כרגע?"); don't dwell on them.
- prompts: at least 2 profile prompt answers. Choose prompts that fit what they ALREADY told you — often you can fill one from an earlier answer without asking. Prefer the general ones; use the heritage ones only if they talked about it. Keys:
${CULTURAL_PROMPTS.map((p) => `  - ${p.key}: ${p.question}`).join("\n")}
- bio: when the state block says BIO_NEEDED, write bio_draft — first person, in their voice, 2–3 sentences (max 300 chars), with 2–3 concrete, vivid details from this chat and a hint of what they're looking for. No clichés ("אוהב/ת לטייל ולבלות", "מחפש/ת את האחת", "חיובי/ת ואופטימי/ת"). In reply, say you wrote a draft they can approve or tweak. Set ask to "bio".
- photos: when the state block says PHOTOS_NEEDED, ask for at least one natural, smiling, daylight photo (the app shows an upload button). Set ask to "photos".
- When nothing is missing, close warmly in one sentence and set ask to "none" — the app then reveals their profile.

Aim to finish in about 10–14 messages from you; don't drag it out.

Extraction: fill "extracted" only with what they clearly said (in this message or earlier); otherwise null / empty list. Ages are numbers. Prompt answers: short, first person, in their words.`;

function stateBlock(d: Draft, missing: Field[]): string {
  const known = Object.fromEntries(Object.entries(d).filter(([k]) => k !== "photos" && k !== "bio_draft"));
  const flags = [missing.includes("bio") && missing.filter((f) => f !== "photos" && f !== "bio").length === 0 && !d.bio_draft ? "BIO_NEEDED" : null, missing.length === 1 && missing[0] === "photos" ? "PHOTOS_NEEDED" : null].filter(Boolean);
  return `<state>\nknown: ${JSON.stringify(known)}\nmissing (in order): ${missing.join(", ") || "nothing"}\n${flags.join("\n")}\n</state>`;
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

async function callModel(userId: number, history: ChatMsg[], state: string): Promise<Turn | null> {
  // The API needs the first message from the user, so the greeting is presented as context.
  const msgs: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    const last = msgs[msgs.length - 1];
    if (last && last.role === m.role) last.content = `${last.content as string}\n${m.text}`;
    else msgs.push({ role: m.role, content: m.text });
  }
  if (msgs[0]?.role === "assistant") msgs.unshift({ role: "user", content: "(הצטרפתי עכשיו)" });
  const lastUser = msgs[msgs.length - 1];
  lastUser.content = `${state}\n\n${lastUser.content as string}`;

  const model = MODEL();
  // Server-side refusal fallback exists for Opus / Sonnet / Fable; Haiku has none (sending it would fail).
  const fallback = /haiku/.test(model) ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const res = await anthropic().beta.messages.parse({
    model,
    max_tokens: 4000,
    ...fallback,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    // Effort: "medium" by default — noticeably better conversation for little extra cost (MELA_AI_EFFORT=low|medium|high).
    output_config: { effort: (["low", "medium", "high"].includes(process.env.MELA_AI_EFFORT ?? "") ? process.env.MELA_AI_EFFORT : "medium") as "low" | "medium" | "high", format: betaZodOutputFormat(TurnSchema) },
    messages: msgs,
  });
  try {
    const u = res.usage;
    db.prepare(
      "INSERT INTO ai_usage (user_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(userId, res.model ?? model, u.input_tokens ?? 0, u.output_tokens ?? 0, u.cache_read_input_tokens ?? 0, u.cache_creation_input_tokens ?? 0, costUsd(res.model ?? model, u));
  } catch (e) {
    console.error("[ai-onboarding] usage log failed", e);
  }
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
  return res.parsed_output ?? null;
}

/** Merge model-extracted values into the draft — each one only if it validates. */
function merge(d: Draft, x: Turn["extracted"]): Draft {
  const out: Draft = { ...d };
  const set = <K extends keyof Draft>(k: K, v: unknown, schema: z.ZodTypeAny) => {
    if (v !== null && v !== undefined && schema.safeParse(v).success) out[k] = schema.parse(v) as Draft[K];
  };
  set("full_name", x.full_name, S.full_name);
  set("age", x.age, S.age);
  set("gender", x.gender, S.gender);
  set("seeking", x.seeking, S.seeking);
  set("location", x.location, S.location);
  set("occupation", x.occupation, S.occupation);
  set("religiosity", x.religiosity, S.religiosity);
  set("partner_religiosity", x.partner_religiosity, S.partner_religiosity);
  set("marital_status", x.marital_status, S.marital_status);
  set("looking_for", x.looking_for, S.looking_for);
  const prompts = [...(out.prompts ?? [])];
  for (const p of x.prompt_answers ?? []) {
    const text = p.answer_text.trim().slice(0, 200);
    if (text.length < 2 || !promptKeys.includes(p.question_key)) continue;
    const i = prompts.findIndex((q) => q.question_key === p.question_key);
    if (i >= 0) prompts[i] = { question_key: p.question_key, answer_text: text };
    else if (prompts.length < 3) prompts.push({ question_key: p.question_key, answer_text: text });
  }
  out.prompts = prompts;
  return out;
}

export type ChatView = {
  messages: ChatMsg[];
  draft: Draft;
  missing: Field[];
  ask: Field | "none";
  choices: { value: string; label: string }[];
  done: boolean;
};

function view(messages: ChatMsg[], draft: Draft, ask: Field | "none"): ChatView {
  const missing = missingFields(draft);
  // Show the photo / bio widgets whenever they're the next thing needed, whatever the model said.
  const effective: Field | "none" = missing.length === 0 ? "none" : draft.bio_draft && !draft.bio ? "bio" : missing[0] === "photos" ? "photos" : ask;
  const opts = effective !== "none" ? CHOICES[effective] : undefined;
  return {
    messages,
    draft,
    missing,
    ask: effective,
    choices: opts && effective !== "none" && missing.includes(effective) ? Object.entries(opts).map(([value, label]) => ({ value, label })) : [],
    done: missing.length === 0,
  };
}

export function getChat(user: User): ChatView {
  const c = loadChat(user.id);
  if (!c.messages.length) {
    saveChat(user.id, GREETING, c.draft, 0);
    return view(GREETING, c.draft, "full_name");
  }
  return view(c.messages, c.draft, missingFields(c.draft)[0] ?? "none");
}

export type ChatInput =
  | { text: string }
  | { choice: { field: Field; value: string; label: string } }
  | { photos: string[] }
  | { bio: "accept" | "other"; text?: string };

export class ChatError extends Error {}

/** One step of the conversation. Direct inputs (chips, photos, bio approval) are applied without guessing. */
export async function chatTurn(user: User, input: ChatInput): Promise<ChatView> {
  const c = loadChat(user.id);
  if (c.turns >= MAX_TURNS) throw new ChatError("השיחה ארוכה מדי — אפשר להשלים את הפרטים בטופס");
  let draft = c.draft;
  const messages = c.messages.length ? [...c.messages] : [...GREETING];
  let userText: string;

  if ("choice" in input) {
    const opts = CHOICES[input.choice.field];
    if (!opts || !(input.choice.value in opts)) throw new ChatError("בחירה לא תקינה");
    draft = { ...draft, [input.choice.field]: input.choice.value };
    userText = opts[input.choice.value];
  } else if ("photos" in input) {
    const photos = input.photos.filter((u) => /^\/api\/photos\/[\w-]+\.(jpg|png|webp)$/.test(u)).slice(0, 6);
    if (!photos.length) throw new ChatError("לא התקבלה תמונה");
    draft = { ...draft, photos };
    userText = photos.length === 1 ? "(העליתי תמונה)" : `(העליתי ${photos.length} תמונות)`;
  } else if ("bio" in input) {
    if (input.bio === "accept") {
      const proposed = draft.bio_draft ?? "";
      const bio = (input.text ?? proposed).trim().slice(0, 500);
      if (!ok(S.bio, bio)) throw new ChatError("הביו קצר מדי — כמה מילים נוספות?");
      draft = { ...draft, bio, bio_draft: undefined };
      userText = bio !== proposed.trim() ? "(ערכתי ואישרתי את הביו)" : "(אישרתי את הביו)";
    } else {
      draft = { ...draft, bio_draft: undefined };
      userText = "אפשר נוסח אחר לביו?";
    }
  } else {
    userText = input.text.trim().slice(0, MAX_TEXT);
    if (!userText) throw new ChatError("ההודעה ריקה");
  }
  messages.push({ role: "user", text: userText });

  let turn: Turn | null = null;
  try {
    turn = await callModel(user.id, messages, stateBlock(draft, missingFields(draft)));
  } catch (e) {
    console.error("[ai-onboarding] model call failed", e);
  }
  if (!turn) {
    // Keep what the member said (and any direct input) even when the model is unavailable.
    const next = (missingFields(draft)[0] ?? "none") as Field | "none";
    if ("text" in input && next !== "none") {
      saveChat(user.id, messages, draft, c.turns + 1);
      throw new ChatError("משהו השתבש אצלי לרגע — אפשר לנסות שוב, או להשלים בטופס");
    }
    messages.push({ role: "assistant", text: FALLBACK_ASK[next] });
    saveChat(user.id, messages, draft, c.turns + 1);
    return view(messages, draft, next);
  }
  draft = merge(draft, turn.extracted);
  if (turn.bio_draft && !draft.bio) draft.bio_draft = turn.bio_draft.trim().slice(0, 500);
  messages.push({ role: "assistant", text: turn.reply.trim() });
  saveChat(user.id, messages, draft, c.turns + 1);
  return view(messages, draft, turn.ask === "none" ? (missingFields(draft)[0] ?? "none") : turn.ask);
}
