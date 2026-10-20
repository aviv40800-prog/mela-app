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
  pending?: "partner"; // the partner question was asked; the next free-text answer is its answer
  photos?: string[];
  photos_skipped?: boolean; // chose to join without a photo for now
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
  "seeking",
  "age",
  "location",
  "occupation",
  "looking_for",
  "marital_status",
  "religiosity",
  "partner_religiosity",
  "prompts",
  "partner",
  "bio",
  "photos",
] as const;
export type Field = (typeof FIELD_ORDER)[number];

/** Tap-to-answer choices for the enum fields. */
export const CHOICES: Partial<Record<Field, Record<string, string>>> = {
  gender: { female: "אישה", male: "גבר" },
  seeking: { male: "גברים", female: "נשים" },
  looking_for: LOOKING_FOR,
  marital_status: MARITAL_STATUS,
  religiosity: RELIGIOSITY,
  partner_religiosity: PARTNER_RELIGIOSITY,
};

const ok = <T extends z.ZodTypeAny>(schema: T, v: unknown): v is z.infer<T> => v !== undefined && v !== null && schema.safeParse(v).success;
const S = ProfileSchema.shape;

/** The last question before the profile is built: what matters in a future partner (stored as this prompt). */
export const PARTNER_PROMPT = "dealbreaker";

/** Answered together on one quick-choice card instead of five separate questions. */
export const DETAILS_FIELDS = ["gender", "seeking", "looking_for", "marital_status", "religiosity", "partner_religiosity"] as const;
export type DetailsField = (typeof DETAILS_FIELDS)[number];
const DETAILS_LABELS: Record<DetailsField, string> = {
  gender: "לשון פנייה",
  seeking: "מי מעניין אותך?",
  looking_for: "מה את/ה מחפש/ת",
  marital_status: "סטטוס",
  religiosity: "דת ומסורת",
  partner_religiosity: "כמה חשוב לך שהצד השני יהיה דתי/ה",
};

const detailsMissing = (d: Draft): DetailsField[] => DETAILS_FIELDS.filter((f) => !ok(S[f], d[f]));

/** The quick-choice card comes as question 3: once the member said what they do (or answered three times). */
const detailsDue = (d: Draft, answers: number) => detailsMissing(d).length > 0 && (!!d.occupation || answers >= 3);

/** The partner question comes last, after the details card and the weekend / first-date questions. */
function partnerDue(d: Draft, answers: number): boolean {
  if (detailsMissing(d).length || d.prompts?.some((p) => p.question_key === PARTNER_PROMPT)) return false;
  const others = (d.prompts ?? []).filter((p) => p.question_key !== PARTNER_PROMPT).length;
  return others >= 2 || answers >= 5;
}

/** "What matters to you in your future wife / husband" — in the member's own terms. */
export function partnerQuestion(d: Draft): string {
  const seeking = d.seeking ?? (d.gender === "male" ? "female" : d.gender === "female" ? "male" : undefined);
  const [whom, find] =
    seeking === "female" ? ["באשתך לעתיד", "את האישה המתאימה"] : seeking === "male" ? ["בבעלך לעתיד", "את האיש המתאים"] : ["בבן/בת הזוג לעתיד", "את ההתאמה הנכונה"];
  return `שאלה אחרונה לפני שאני מקימה לך את הפרופיל: מה הכי חשוב לך ${whom}? ככה אדע מה לחפש כשאני יוצאת למצוא לך ${find}.`;
}

const answersIn = (messages: ChatMsg[]) => messages.filter((m) => m.role === "user").length;

export function missingFields(d: Draft): Field[] {
  return FIELD_ORDER.filter((f) => {
    if (f === "prompts") return !d.prompts?.some((p) => p.question_key !== PARTNER_PROMPT);
    if (f === "partner") return !d.prompts?.some((p) => p.question_key === PARTNER_PROMPT);
    if (f === "photos") return !(d.photos?.length || d.photos_skipped);
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
  seeking: "ומי מעניין אותך, גברים או נשים?",
  age: "בן/בת כמה את/ה?",
  location: "איפה את/ה גר/ה?",
  occupation: "ובמה את/ה עוסק/ת?",
  looking_for: "ומה את/ה מחפש/ת כרגע — זוגיות רצינית או לראות לאן זה הולך?",
  marital_status: "ומה הסטטוס שלך?",
  religiosity: "איך היית מגדיר/ה את עצמך מבחינת מסורת?",
  partner_religiosity: "וכמה חשוב לך שהצד השני יהיה דתי/ה?",
  prompts: "על מה את/ה יכול/ה לדבר שעות?",
  partner: "שאלה אחרונה לפני שאני מקימה לך את הפרופיל: מה הכי חשוב לך בבן/בת הזוג לעתיד?", // replaced by partnerQuestion()
  bio: "אפשר לכתוב כמה מילים על עצמך לביו?",
  photos: "ועכשיו החלק שהכי עובד: תמונה טבעית ועם חיוך. אין כרגע? אפשר גם להוסיף אחר כך.",
  none: "תודה! הפרופיל שלך מוכן.",
};

export const GREETING: ChatMsg[] = [
  { role: "assistant", text: "היי! אני המארחת של MELA. במקום טופס משעמם — בוא/י נדבר כמה דקות, ואני אכתוב לך פרופיל שבאמת נשמע כמוך." },
  { role: "assistant", text: "נתחיל: איך קוראים לך, בן/בת כמה ומאיפה?" },
];

// ---------- the model turn ----------

const enumOrNull = <T extends Record<string, string>>(o: T) => z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]).nullable();
const promptKeys = CULTURAL_PROMPTS.map((p) => p.key) as [string, ...string[]];

const TurnSchema = z.object({
  reply: z.string().describe("Your next message to the member, in Hebrew. 1–3 short sentences. Ends with at most one question."),
  extracted: z.object({
    full_name: z.string().nullable().describe("The person's name only: first name (and last name if given). Never the city — 'דוד מיבנה' is name 'דוד', location 'יבנה'. Null if not said."),
    age: z.number().int().nullable(),
    gender: z.enum(["male", "female"]).nullable().describe("Only when clear from what they said or how they write about themselves in Hebrew."),
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
  ask: z.enum([...FIELD_ORDER, "details", "none"]).describe('The single field your reply asks about, "details" for the quick-choice card, or none.'),
});
type Turn = z.infer<typeof TurnSchema>;

const SYSTEM = `You are "המארחת של MELA" — the host of MELA, a dating app for young Ethiopian-Israelis ("אהבה עם שורשים"). A new member just verified their email. Instead of a form, you build their profile in a SHORT chat: six questions in total, no more.

Who you are: warm, sharp, a little funny, a natural matchmaker. Not a form, not a survey.

How you talk (Hebrew only):
- 1–2 short sentences per message: a brief, specific reaction to what they just said, then the next question. Exactly one question per message.
- Everyday Israeli Hebrew; light humor is welcome; never cringe or sarcastic. At most one emoji in the whole chat.
- Until you know their gender, use slash forms (את/ה). Once known, use the right gender consistently.
- Never invent facts. Never pressure.

The script — ask these, in this order, and nothing else (the <state> block tells you how many answers they have given and what is still missing):
1. (Already asked in the greeting) name, age and city.
2. What they do (work / studies) and what fills their days.
3. The quick-choice card: when the state says DETAILS_NEEDED, reply with a short reaction plus one sentence like "כמה פרטים קצרים בלחיצה 👇" and set ask to "details". The app shows buttons for gender, who they want to meet, what they're looking for, status, religiosity and the partner's religiosity — don't ask these in words, and never assume who they want to meet.
4. What fills their weekend, or what they can talk about for hours (pick what fits them).
5. Their idea of a perfect first date.
6. When the state says PARTNER_QUESTION, ask exactly that question (you may add a two-word reaction before it) and set ask to "partner".
Then the app takes over: BIO_NEEDED → write bio_draft; PHOTOS_NEEDED → ask for a photo; nothing missing → close warmly in one sentence, ask "none".

If a detail from question 1 or 2 is still missing (e.g. they didn't say their age or city), fold it into your NEXT scripted question in a few words ("…ורגע, בן כמה אתה?") — never add an extra question for it. Their Ethiopian-Israeli background is one part of who they are; don't ask about culture unless they bring it up.

Profile prompts (extract from answers 4, 5 and 6 only, short, first person, in their words). Keys:
${CULTURAL_PROMPTS.map((p) => `  - ${p.key}: ${p.question}`).join("\n")}
Answer 4 → perfect_weekend or talk_for_hours. Answer 5 → first_date. Answer 6 → ${PARTNER_PROMPT}.

bio: when the state block says BIO_NEEDED, write bio_draft — first person, in their voice, 2–3 sentences (max 300 chars), with concrete, vivid details from this chat and a hint of what they're looking for. No clichés ("אוהב/ת לטייל ולבלות", "מחפש/ת את האחת"). In reply, say you wrote a draft they can approve or tweak. Set ask to "bio".
photos: when the state block says PHOTOS_NEEDED, ask for one natural, smiling, daylight photo (it is optional; they may add it later). Set ask to "photos".

Extraction: fill "extracted" only with what they clearly said (in this message or earlier); otherwise null / empty list. Ages are numbers. Infer gender from how they write about themselves in Hebrew when it's clear.`;

function stateBlock(d: Draft, missing: Field[], answers: number): string {
  const known = Object.fromEntries(Object.entries(d).filter(([k]) => k !== "photos" && k !== "photos_skipped" && k !== "bio_draft" && k !== "pending"));
  const flags = [
    detailsDue(d, answers) ? "DETAILS_NEEDED" : null,
    partnerDue(d, answers) ? `PARTNER_QUESTION: "${partnerQuestion(d)}"` : null,
    missing.includes("bio") && missing.filter((f) => f !== "photos" && f !== "bio").length === 0 && !d.bio_draft ? "BIO_NEEDED" : null,
    missing.length === 1 && missing[0] === "photos" ? "PHOTOS_NEEDED" : null,
  ].filter(Boolean);
  const address = d.gender === "male" ? "address the member in masculine Hebrew (no slash forms)" : d.gender === "female" ? "address the member in feminine Hebrew (no slash forms)" : null;
  return `<state>\nanswers so far: ${answers}\nknown: ${JSON.stringify(known)}\nmissing (in order): ${missing.join(", ") || "nothing"}\n${[...flags, address].filter(Boolean).join("\n")}\n</state>`;
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

/** Up to two answers to the conversation prompts, plus the partner answer — at most 3, partner last. */
function mergePrompts(current: NonNullable<Draft["prompts"]>, incoming: NonNullable<Draft["prompts"]>): NonNullable<Draft["prompts"]> {
  const others = current.filter((p) => p.question_key !== PARTNER_PROMPT);
  let partner = current.find((p) => p.question_key === PARTNER_PROMPT);
  for (const p of incoming) {
    const text = p.answer_text.trim().slice(0, 200);
    if (text.length < 2 || !promptKeys.includes(p.question_key)) continue;
    if (p.question_key === PARTNER_PROMPT) {
      partner = { question_key: p.question_key, answer_text: text };
      continue;
    }
    const i = others.findIndex((q) => q.question_key === p.question_key);
    if (i >= 0) others[i] = { question_key: p.question_key, answer_text: text };
    else if (others.length < 2) others.push({ question_key: p.question_key, answer_text: text });
  }
  return partner ? [...others, partner] : others;
}

/** "דוד מיבנה" with location "יבנה" → "דוד": drops a "from <city>" word the model folded into the name. */
export function cleanName(name: string, location?: string): string {
  const loc = location?.trim();
  if (!loc) return name;
  const words = name.trim().split(/\s+/);
  const kept = words.filter((w) => !(w === loc || w === `מ${loc}` || w === `מה${loc}` || w === `מ־${loc}` || w === `מ-${loc}`));
  return kept.length ? kept.join(" ") : name;
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
  set("location", x.location, S.location);
  set("occupation", x.occupation, S.occupation);
  set("religiosity", x.religiosity, S.religiosity);
  set("partner_religiosity", x.partner_religiosity, S.partner_religiosity);
  set("marital_status", x.marital_status, S.marital_status);
  set("looking_for", x.looking_for, S.looking_for);
  out.prompts = mergePrompts(out.prompts ?? [], x.prompt_answers ?? []);
  if (out.full_name) out.full_name = cleanName(out.full_name, out.location);
  return out;
}

export type ChatView = {
  messages: ChatMsg[];
  draft: Draft;
  missing: Field[];
  ask: Field | "details" | "none";
  choices: { value: string; label: string }[];
  /** The quick-choice card: one row of options per detail still missing. */
  details: { field: DetailsField; label: string; options: { value: string; label: string }[] }[];
  done: boolean;
};

/**
 * Choice buttons appear only when the host's last message is actually about that topic — the model's "ask"
 * alone isn't enough (it can name a field while chatting about something else).
 */
const TOPIC: Partial<Record<Field, RegExp>> = {
  gender: /לשון|זכר|נקבה|גבר|אישה|בחור|בחורה/,
  looking_for: /מחפש|זוגיות|קשר|רציני|קליל|יתפתח|מטרה|מתאים לך עכשיו|כוונות/,
  marital_status: /סטטוס|רווק|גרוש|אלמן|נשוי|נשואה|מצב משפחתי/,
  religiosity: /דתי|מסורת|חילונ|דת\b|שומר|שבת|כשרות|אמונה/,
  partner_religiosity: /דתי|מסורת|חילונ|דת\b|שומר|שבת/,
};
function asksAbout(messages: ChatMsg[], field: Field): boolean {
  const last = [...messages].reverse().find((m) => m.role === "assistant")?.text ?? "";
  const re = TOPIC[field];
  if (!re || !re.test(last)) return false;
  // the partner question mentions the other side; the own-observance one doesn't
  const partner = /צד השני|בן הזוג|בת הזוג|בן\/בת הזוג|שלו|שלה|אצל(ו|ה)/.test(last);
  if (field === "partner_religiosity") return partner;
  if (field === "religiosity") return !partner;
  return true;
}

function view(messages: ChatMsg[], draft: Draft, ask: Field | "details" | "none"): ChatView {
  const missing = missingFields(draft);
  // Show the widgets whenever they're the next thing needed, whatever the model said.
  const effective: Field | "details" | "none" =
    missing.length === 0
      ? "none"
      : draft.bio_draft && !draft.bio
        ? "bio"
        : missing[0] === "photos"
          ? "photos"
          : detailsDue(draft, answersIn(messages))
            ? "details"
            : draft.pending === "partner"
              ? "partner"
              : ask === "details"
                ? (missing[0] ?? "none")
                : ask;
  const opts = effective !== "none" && effective !== "details" ? CHOICES[effective] : undefined;
  return {
    messages,
    draft,
    missing,
    ask: effective,
    choices:
      opts && effective !== "none" && effective !== "details" && missing.includes(effective) && asksAbout(messages, effective)
        ? Object.entries(opts).map(([value, label]) => ({ value, label }))
        : [],
    details:
      effective === "details"
        ? detailsMissing(draft).map((f) => ({ field: f, label: DETAILS_LABELS[f], options: Object.entries(CHOICES[f]!).map(([value, label]) => ({ value, label })) }))
        : [],
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
  | { details: Partial<Record<DetailsField, string>> }
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
  } else if ("details" in input) {
    const need = detailsMissing(draft);
    if (!need.length) throw new ChatError("הפרטים כבר נשמרו");
    const picked: Partial<Draft> = {};
    const labels: string[] = [];
    for (const f of need) {
      const v = input.details[f];
      const opts = CHOICES[f]!;
      if (!v || !(v in opts)) throw new ChatError("נא לבחור תשובה בכל שורה");
      Object.assign(picked, { [f]: v });
      labels.push(opts[v]);
    }
    draft = { ...draft, ...picked };
    userText = labels.join(" · ");
  } else if ("photos" in input) {
    const photos = input.photos.filter((u) => /^\/api\/photos\/[\w-]+\.(jpg|png|webp)$/.test(u)).slice(0, 6);
    if (!photos.length && input.photos.length) throw new ChatError("לא התקבלה תמונה");
    // an empty list = "later": the member joins without a photo and can add one from the profile
    draft = { ...draft, photos, photos_skipped: !photos.length };
    userText = !photos.length ? "(אוסיף תמונה אחר כך)" : photos.length === 1 ? "(העליתי תמונה)" : `(העליתי ${photos.length} תמונות)`;
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
    // The answer to the partner question is kept in the member's words, even if the model misses it.
    if (draft.pending === "partner") {
      draft = { ...draft, pending: undefined, prompts: mergePrompts(draft.prompts ?? [], [{ question_key: PARTNER_PROMPT, answer_text: userText }]) };
    }
  }
  messages.push({ role: "user", text: userText });

  let turn: Turn | null = null;
  try {
    turn = await callModel(user.id, messages, stateBlock(draft, missingFields(draft), answersIn(messages)));
  } catch (e) {
    console.error("[ai-onboarding] model call failed", e);
  }
  if (!turn) {
    // Keep what the member said (and any direct input) even when the model is unavailable.
    const next = view(messages, draft, missingFields(draft)[0] ?? "none").ask;
    if ("text" in input && next !== "none" && next !== "details") {
      saveChat(user.id, messages, draft, c.turns + 1);
      throw new ChatError("משהו השתבש אצלי לרגע — אפשר לנסות שוב, או להשלים בטופס");
    }
    return finishTurn(user.id, messages, draft, c.turns + 1, null, next);
  }
  draft = merge(draft, turn.extracted);
  if (turn.bio_draft && !draft.bio) draft.bio_draft = turn.bio_draft.trim().slice(0, 500);
  return finishTurn(user.id, messages, draft, c.turns + 1, turn.reply.trim(), turn.ask === "none" ? (missingFields(draft)[0] ?? "none") : turn.ask);
}

/** Slash forms ("את/ה", "עוסק/ת", "בן/בת") in the member's gender, once it's known. */
export function genderize(text: string, gender?: "male" | "female"): string {
  if (!gender) return text;
  const f = gender === "female";
  return text
    .replace(/את\/ה/g, f ? "את" : "אתה")
    .replace(/בן\/בת/g, f ? "בת" : "בן")
    .replace(/([\u0590-\u05FF]+)\/(ה|ת|ית)(?![\u0590-\u05FF])/g, (_, base: string, suf: string) => (f ? base + suf : base));
}

const CARD_LINE = "כמה פרטים קצרים בלחיצה 👇";
/** The friendly reaction at the start of a reply, without its question (or "" when there's no such part). */
function reaction(text: string): string {
  const first = text.split(/(?<=[.!])\s+/)[0] ?? "";
  return first && !first.includes("?") && !first.includes("בלחיצה") && first !== text ? `${first} ` : "";
}
function nextQuestion(field: Field | "details" | "none", d: Draft): string {
  if (field === "details") return CARD_LINE;
  const q = FALLBACK_ASK[field];
  return field === "partner_religiosity" || field === "partner" ? q : genderize(q, d.gender);
}

/** Adds the host's message (the model's, or a fixed one), and makes sure the partner question is asked word for word. */
function finishTurn(userId: number, messages: ChatMsg[], draft: Draft, turns: number, reply: string | null, ask: Field | "details" | "none"): ChatView {
  const answers = answersIn(messages);
  let text = reply;
  if (partnerDue(draft, answers)) {
    const q = partnerQuestion(draft);
    if (!text?.includes("שאלה אחרונה")) text = q;
    draft = { ...draft, pending: "partner" };
  } else if (!text) {
    text = nextQuestion(view(messages, draft, ask).ask, draft);
  } else {
    // The screen decides what comes next (the card, a widget, a question) — the words must match it:
    // no "pick below 👇" when there's nothing to pick, and no other question while the card is showing.
    const next = view(messages, draft, ask).ask;
    const saysCard = text.includes("בלחיצה");
    if (next === "details" && !saysCard) text = reaction(text) + CARD_LINE;
    else if (next !== "details" && saysCard) text = reaction(text) + nextQuestion(next, draft);
  }
  messages.push({ role: "assistant", text });
  saveChat(userId, messages, draft, turns);
  return view(messages, draft, ask);
}
