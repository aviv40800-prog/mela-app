import "server-only";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db } from "./db";
import { costUsd } from "./ai-onboarding";
import { LOOKING_FOR, MARITAL_STATUS, RELIGIOSITY, promptQuestion } from "./content";
import { sharedAnswers } from "./checkin";
import { getPrompts, getUser, type User } from "./users";

const MODEL = () => process.env.MELA_AI_MODEL || "claude-opus-5-5";

const SYSTEM = `את/ה השדכנית של MELA, פלטפורמת היכרויות לקהילה האתיופית בישראל.
צוות MELA רוצה להציע שני חברים אחד לשני, ומבקש ממך לנסח לכל אחד מהם 1–2 משפטים חמים ואישיים בעברית: "למה חשבנו עליכם".

כללים:
- כל נימוק פונה ישירות לנמען בגוף שני, בלשון שמתאימה למגדר שלו, ומדבר על הצד השני בלשון שמתאימה למגדר של הצד השני.
- להתבסס רק על מה שמופיע בנתונים (ביו, תשובות, עיר, מה מחפשים, תשובות משותפות בשאלון). לא להמציא עובדות, תחביבים או תכונות.
- להעדיף דברים משותפים קונקרטיים וערכים, על פני מחמאות כלליות.
- בלי שם משפחה, בלי פרטי קשר, בלי הבטחות ("זו האהבה של חייך"). לכל היותר אימוג'י אחד.
- טון: חם, אנושי, קצר. כמו שדכנית טובה מהקהילה, לא כמו פרסומת.`;

const Notes = z.object({
  note_for_a: z.string().describe("הנימוק שיישלח למשתמש/ת A, על B"),
  note_for_b: z.string().describe("הנימוק שיישלח למשתמש/ת B, על A"),
});

function describe(u: User, label: "A" | "B"): string {
  const lines = [
    `## ${label}: ${(u.full_name ?? "").split(/\s+/)[0]} (${u.gender === "female" ? "אישה" : "גבר"})`,
    `גיל: ${u.age ?? "?"} · עיר: ${u.location ?? "?"} · עיסוק: ${u.occupation ?? "?"}`,
    u.religiosity ? `רמת דתיות: ${RELIGIOSITY[u.religiosity]}` : null,
    u.marital_status ? `מצב משפחתי: ${MARITAL_STATUS[u.marital_status]}` : null,
    u.looking_for ? `מחפש/ת: ${LOOKING_FOR[u.looking_for]}` : null,
    u.bio ? `ביו: ${u.bio}` : null,
    ...getPrompts(u.id).map((p) => `${promptQuestion(p.question_key)} — ${p.answer_text}`),
  ];
  return lines.filter(Boolean).join("\n");
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

/** AI-drafted "why we thought of you" notes for a suggestion. The admin reviews and edits them before sending. */
export async function draftSuggestionNotes(adminId: number, aId: number, bId: number): Promise<{ noteA: string; noteB: string }> {
  const a = getUser(aId);
  const b = getUser(bId);
  if (!a || !b) throw new Error("user not found");
  const shared = sharedAnswers(aId, bId, 6);
  const input = [describe(a, "A"), describe(b, "B"), shared.length ? `## בחרו אותה תשובה בשאלון "זה או זה"\n${shared.join(" · ")}` : null]
    .filter(Boolean)
    .join("\n\n");

  const model = MODEL();
  const fallback = /haiku/.test(model) ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const res = await anthropic().beta.messages.parse({
    model,
    max_tokens: 8000,
    ...fallback,
    system: SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(Notes) },
    messages: [{ role: "user", content: input }],
  });
  try {
    const u = res.usage;
    db.prepare(
      "INSERT INTO ai_usage (user_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(adminId, res.model ?? model, u.input_tokens ?? 0, u.output_tokens ?? 0, u.cache_read_input_tokens ?? 0, u.cache_creation_input_tokens ?? 0, costUsd(res.model ?? model, u));
  } catch (e) {
    console.error("[suggestion-draft] usage log failed", e);
  }
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("לא הצלחנו לנסח טיוטה, אפשר לכתוב ידנית");
  return { noteA: res.parsed_output.note_for_a.trim(), noteB: res.parsed_output.note_for_b.trim() };
}
