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
  it("builds a validated profile in six questions: chat, details card, partner question, bio and photos", async () => {
    const ai = await import("@/lib/ai-onboarding");
    const { nextOnboardingStep } = await import("@/lib/onboarding");
    const u = withPassword(createEmailUser("chat@example.com"));
    expect(nextOnboardingStep(u)).toBe("/onboarding/chat");
    expect(ai.getChat(u).messages).toHaveLength(2); // greeting

    // 1. Invalid values from the model are ignored (age 15, unknown enum), valid ones kept.
    turns.push({ reply: "נעים מאוד! ובמה את עוסקת?", extracted: { ...empty, full_name: "דנה", age: 15, location: "מודיעין", religiosity: "nope" }, bio_draft: null, ask: "occupation" });
    let v = await ai.chatTurn(u, { text: "אני דנה ממודיעין" });
    expect(v.draft).toMatchObject({ full_name: "דנה", location: "מודיעין" });
    expect(v.draft.age).toBeUndefined();
    expect(v.draft.religiosity).toBeUndefined();
    expect(v.ask).toBe("occupation");
    expect(v.details).toEqual([]);

    // 2. Once the occupation is known, the quick-choice card shows the details still missing.
    turns.push({ reply: "וואו, אחות! כמה פרטים קצרים בלחיצה 👇", extracted: { ...empty, occupation: "אחות", age: 27, gender: "female" }, bio_draft: null, ask: "details" });
    v = await ai.chatTurn(u, { text: "אחות, בת 27" });
    expect(v.ask).toBe("details");
    expect(v.details.map((r) => r.field)).toEqual(["looking_for", "marital_status", "religiosity", "partner_religiosity"]);

    // 3. The card sets the fields directly and must be complete; when the model is down, a fixed question follows.
    await expect(ai.chatTurn(u, { details: { looking_for: "serious" } })).rejects.toThrow(/בכל שורה/);
    await expect(ai.chatTurn(u, { details: { looking_for: "serious", marital_status: "pirate", religiosity: "traditional", partner_religiosity: "any" } })).rejects.toThrow();
    turns.push(new Error("overloaded"));
    v = await ai.chatTurn(u, { details: { looking_for: "serious", marital_status: "single", religiosity: "traditional", partner_religiosity: "any" } });
    expect(v.draft).toMatchObject({ looking_for: "serious", marital_status: "single", religiosity: "traditional", partner_religiosity: "any" });
    expect(v.messages.at(-2)?.text).toMatch(/^.+ · רווק\/ה · מסורתי\/ת · לא משנה לי$/);
    expect(v.messages.at(-1)?.text).toBe("על מה את יכולה לדבר שעות?"); // in her gender, once known

    // 4–5. Weekend and first date fill the prompts; then the partner question is asked word for word.
    turns.push({ reply: "חחח מושלם. ואיך נראה דייט ראשון מושלם?", extracted: { ...empty, prompt_answers: [{ question_key: "perfect_weekend", answer_text: "ים, בונה ומשפחה" }] }, bio_draft: null, ask: "prompts" });
    v = await ai.chatTurn(u, { text: "ים, בונה ומשפחה" });
    turns.push({ reply: "איזה כיף. ומה עוד?", extracted: { ...empty, prompt_answers: [{ question_key: "first_date", answer_text: "קפה ושיחה ארוכה" }] }, bio_draft: null, ask: "prompts" });
    v = await ai.chatTurn(u, { text: "קפה ושיחה ארוכה" });
    expect(v.messages.at(-1)?.text).toBe(ai.partnerQuestion(v.draft));
    expect(v.messages.at(-1)?.text).toContain("בבעלך לעתיד");
    expect(v.ask).toBe("partner");

    // 6. The answer is stored as the partner prompt even if the model misses it; then the bio.
    turns.push({ reply: "כתבתי לך טיוטה", extracted: empty, bio_draft: "אחות ממודיעין, אוהבת ים, בונה ושיחות ארוכות.", ask: "bio" });
    v = await ai.chatTurn(u, { text: "שיהיה משפחתי ועם לב טוב" });
    expect(v.draft.prompts?.at(-1)).toEqual({ question_key: "dealbreaker", answer_text: "שיהיה משפחתי ועם לב טוב" });
    expect(v.draft.prompts).toHaveLength(3);
    expect(v.ask).toBe("bio");
    expect(v.missing).toEqual(["bio", "photos"]);
    expect(ai.loadChat(u.id).messages.filter((m) => m.role === "user")).toHaveLength(6);

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

  it("lets a member finish without a photo and add one later", async () => {
    const ai = await import("@/lib/ai-onboarding");
    const { isProfileComplete } = await import("@/lib/users");
    const u = withPassword(createEmailUser("nophoto@example.com"));
    db.prepare("INSERT INTO onboarding_chats (user_id, messages, draft, turns) VALUES (?, '[]', ?, 1)").run(
      u.id,
      JSON.stringify({ full_name: "יוסי", age: 30, gender: "male", location: "רחובות", occupation: "מהנדס", looking_for: "serious", marital_status: "single", religiosity: "traditional", partner_religiosity: "any", bio: "מהנדס מרחובות, אוהב ים ומשפחה.", prompts: [{ question_key: "first_date", answer_text: "קפה וים" }, { question_key: "dealbreaker", answer_text: "לב טוב" }] }),
    );
    expect(ai.loadChat(u.id).draft.photos).toBeUndefined();
    turns.push({ reply: "מוכן!", extracted: empty, bio_draft: null, ask: "none" });
    const v = await ai.chatTurn(u, { photos: [] });
    expect(v.done).toBe(true);
    expect(v.messages.find((m) => m.role === "user")?.text).toBe("(אוסיף תמונה אחר כך)");
    const profile = ai.draftToProfile(v.draft, "nophoto@example.com");
    expect(profile?.photos).toEqual([]);
    const { updateProfile, getUser } = await import("@/lib/users");
    updateProfile(u.id, profile!);
    expect(isProfileComplete(getUser(u.id)!)).toBe(true);
    await expect(ai.chatTurn(u, { photos: ["javascript:alert(1)"] })).rejects.toThrow(/תמונה/);
  });

  it("keeps the words in step with the screen, and the city out of the name (David from Yavne)", async () => {
    const ai = await import("@/lib/ai-onboarding");
    const u = withPassword(createEmailUser("david@example.com"));
    ai.getChat(u);
    // the model folds the city into the name
    turns.push({ reply: "נעים מאוד! ואיפה אתה גר?", extracted: { ...empty, full_name: "דוד מיבנה", age: 30, gender: "male" }, bio_draft: null, ask: "location" });
    let v = await ai.chatTurn(u, { text: "דוד מיבנה 30" });
    turns.push({ reply: "יבנה, יפה! מה אתה עושה בימים?", extracted: { ...empty, location: "יבנה" }, bio_draft: null, ask: "occupation" });
    v = await ai.chatTurn(u, { text: "גר ביבנה" });
    expect(v.draft.full_name).toBe("דוד");
    expect(v.ask).toBe("occupation"); // two answers, no job yet: no card yet
    // the job arrives; the model asks something else, but the card is what shows — so that's what she says
    turns.push({ reply: "מרלוג תרופות, מעניין! ומה אתה מחפש?", extracted: { ...empty, occupation: "מרלוג תרופות" }, bio_draft: null, ask: "looking_for" });
    v = await ai.chatTurn(u, { text: "עובד במרלוג תרופות בטבע" });
    expect(v.ask).toBe("details");
    expect(v.messages.at(-1)?.text).toBe("מרלוג תרופות, מעניין! כמה פרטים קצרים בלחיצה 👇");
    // after the card, a "pick below 👇" with nothing to pick becomes the next real question
    turns.push({ reply: "קיבלתי! עכשיו כמה פרטים קצרים בלחיצה 👇", extracted: empty, bio_draft: null, ask: "details" });
    v = await ai.chatTurn(u, { details: { looking_for: "serious", marital_status: "single", religiosity: "traditional", partner_religiosity: "any" } });
    expect(v.ask).not.toBe("details");
    expect(v.messages.at(-1)?.text).toBe("קיבלתי! על מה אתה יכול לדבר שעות?");
  });

  it("asks men about their future wife", async () => {
    const ai = await import("@/lib/ai-onboarding");
    expect(ai.partnerQuestion({ gender: "male" })).toContain("באשתך לעתיד");
    expect(ai.partnerQuestion({ gender: "male" })).toContain("את האישה המתאימה");
    expect(ai.partnerQuestion({})).toContain("בבן/בת הזוג");
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
