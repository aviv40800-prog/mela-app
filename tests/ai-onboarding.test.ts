import { describe, expect, it, vi, beforeEach } from "vitest";

// The model is mocked: each test queues the structured turns it should "return".
const turns: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = {
      messages: {
        parse: vi.fn(async () => {
          const t = turns.shift();
          if (t instanceof Error) throw t;
          return { stop_reason: "end_turn", parsed_output: t, model: "claude-haiku-5-5", usage: { input_tokens: 2000, output_tokens: 300 } };
        }),
      },
    };
  },
}));

import { db } from "@/lib/db";
import { createEmailUser, getUser, type User } from "@/lib/users";
import { setCredentials } from "@/lib/auth";

/** Members choose a username + password right after the email code, before the chat. */
let seq = 0;
function withPassword(u: User): User {
  setCredentials(u.id, { username: `tester${++seq}`, password: "Abcdef12" });
  return getUser(u.id)!;
}

const empty = { full_name: null, age: null, gender: null, seeking: null, location: null, occupation: null, religiosity: null, partner_religiosity: null, marital_status: null, looking_for: null, prompt_answers: [] };

beforeEach(() => {
  db.exec("DELETE FROM users; DELETE FROM onboarding_chats; DELETE FROM ai_usage;");
  turns.length = 0;
  process.env.ANTHROPIC_API_KEY = "test";
});

describe("AI onboarding chat", () => {
  it("builds a validated profile from the conversation, chips, bio approval and photos", async () => {
    const ai = await import("@/lib/ai-onboarding");
    const { nextOnboardingStep } = await import("@/lib/onboarding");
    const u = withPassword(createEmailUser("chat@example.com"));
    expect(nextOnboardingStep(u)).toBe("/onboarding/chat");
    expect(ai.getChat(u).messages).toHaveLength(2); // greeting

    // Invalid values from the model are ignored (age 15, unknown enum), valid ones kept.
    turns.push({ reply: "נעים מאוד!", extracted: { ...empty, full_name: "דנה", age: 15, gender: "female", location: "מודיעין", occupation: "אחות", religiosity: "nope" }, bio_draft: null, ask: "age" });
    let v = await ai.chatTurn(u, { text: "אני דנה, אחות ממודיעין" });
    expect(v.draft).toMatchObject({ full_name: "דנה", gender: "female", location: "מודיעין", occupation: "אחות" });
    expect(v.draft.age).toBeUndefined();
    expect(v.draft.religiosity).toBeUndefined();

    // The model names a field but talks about something else → no buttons.
    turns.push({ reply: "וואלה, ומה עושה לך את הסופ״ש?", extracted: empty, bio_draft: null, ask: "looking_for" });
    v = await ai.chatTurn(u, { text: "עובדת המון" });
    expect(v.choices).toEqual([]);

    turns.push({ reply: "ומה את מחפשת?", extracted: { ...empty, age: 27 }, bio_draft: null, ask: "looking_for" });
    v = await ai.chatTurn(u, { text: "27" });
    expect(v.ask).toBe("looking_for");
    expect(v.choices.map((c) => c.value)).toEqual(["serious", "open", "casual"]);

    // Chips set the field directly; when the model is down after a direct answer, a fixed next question follows.
    turns.push(new Error("overloaded"));
    v = await ai.chatTurn(u, { choice: { field: "looking_for", value: "serious", label: "זוגיות רצינית" } });
    expect(v.draft.looking_for).toBe("serious");
    expect(v.messages.at(-1)).toEqual({ role: "assistant", text: "ומה הסטטוס שלך?" });
    await expect(ai.chatTurn(u, { choice: { field: "marital_status", value: "pirate", label: "x" } })).rejects.toThrow();
    for (const [field, value] of [["marital_status", "single"], ["religiosity", "traditional"], ["partner_religiosity", "any"]] as const) {
      turns.push({ reply: "👍", extracted: empty, bio_draft: null, ask: "none" });
      v = await ai.chatTurn(u, { choice: { field, value, label: value } });
    }

    turns.push({
      reply: "כתבתי לך טיוטה",
      extracted: { ...empty, prompt_answers: [{ question_key: "grandma_dish", answer_text: "אינג׳רה של סבתא" }, { question_key: "buna", answer_text: "בונה בשישי" }] },
      bio_draft: "אחות ממודיעין, אוהבת משפחה, בונה ושיחות ארוכות.",
      ask: "bio",
    });
    v = await ai.chatTurn(u, { text: "אינג׳רה של סבתא, ובונה בשישי" });
    expect(v.ask).toBe("bio");
    expect(v.missing).toEqual(["bio", "photos"]);

    turns.push({ reply: "ועכשיו תמונה", extracted: empty, bio_draft: null, ask: "photos" });
    v = await ai.chatTurn(u, { bio: "accept" });
    expect(v.draft.bio).toContain("אחות ממודיעין");
    expect(v.ask).toBe("photos");

    turns.push({ reply: "מוכן!", extracted: empty, bio_draft: null, ask: "none" });
    v = await ai.chatTurn(u, { photos: ["/api/photos/a.jpg", "javascript:alert(1)"] });
    expect(v.draft.photos).toEqual(["/api/photos/a.jpg"]);
    expect(v.done).toBe(true);

    const profile = ai.draftToProfile(v.draft, "chat@example.com");
    expect(profile).toMatchObject({ full_name: "דנה", age: 27, gender: "female", seeking: "male", looking_for: "serious" });
  });

  it("a failed model call on free text keeps the message and asks to retry", async () => {
    const ai = await import("@/lib/ai-onboarding");
    const u = createEmailUser("retry@example.com");
    turns.push(new Error("down"));
    await expect(ai.chatTurn(u, { text: "היי" })).rejects.toThrow(/לנסות שוב/);
    expect(ai.loadChat(u.id).messages.at(-1)).toEqual({ role: "user", text: "היי" });
  });

  it("falls back to the form without an API key", async () => {
    const { nextOnboardingStep } = await import("@/lib/onboarding");
    delete process.env.ANTHROPIC_API_KEY;
    expect(nextOnboardingStep(withPassword(createEmailUser("form@example.com")))).toBe("/onboarding/profile");
  });

  it("logs cost per call and caps new AI chats per day", async () => {
    const ai = await import("@/lib/ai-onboarding");
    expect(ai.costUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
    process.env.MELA_AI_DAILY_LIMIT = "1";
    const a = createEmailUser("a@example.com");
    const b = createEmailUser("b@example.com");
    expect(ai.aiOnboardingAvailable(a.id)).toBe(true);
    turns.push({ reply: "היי", extracted: empty, bio_draft: null, ask: "full_name" });
    await ai.chatTurn(a, { text: "היי" });
    expect(ai.aiUsageStats().today).toMatchObject({ users: 1, turns: 1 });
    expect(ai.aiUsageStats().today.cost).toBeCloseTo((2000 * 0.1 + 300 * 0.5) / 1e6);
    expect(ai.aiOnboardingAvailable(a.id)).toBe(true); // already started — keeps going
    expect(ai.aiOnboardingAvailable(b.id)).toBe(false); // cap reached — gets the form
    delete process.env.MELA_AI_DAILY_LIMIT;
  });
});
