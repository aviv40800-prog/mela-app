import { describe, expect, it, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { issueOtp, verifyOtp } from "@/lib/otp";
import { createVerifiedUser, updateProfile, getUser, isProfileComplete, type Gender } from "@/lib/users";
import { swipe, discoveryDeck, dailyPicks, listMatches, likesReceived, matchPartner } from "@/lib/matching";
import { getSubscription, hasAccess, startTrial, cancelSubscription } from "@/lib/billing";
import { subscribe } from "@/lib/events";
import { sendMessage, listMessages } from "@/lib/chat";

let phoneSeq = 1000000;
function member(name: string, gender: Gender, seeking: Gender | "everyone" = gender === "male" ? "female" : "male") {
  const u = createVerifiedUser(`+97250${phoneSeq++}`);
  updateProfile(u.id, {
    full_name: name,
    age: 28,
    gender,
    seeking,
    location: "תל אביב",
    occupation: "מהנדס/ת",
    bio: "ביו לבדיקה ארוכה מספיק",
    photos: ["/api/photos/x.jpg"],
    prompts: [
      { question_key: "buna", answer_text: "פופקורן" },
      { question_key: "sigd", answer_text: "ירושלים" },
    ],
  });
  return getUser(u.id)!;
}

beforeEach(() => {
  db.exec("DELETE FROM users; DELETE FROM otp_codes;");
});

describe("phone", () => {
  it("normalises Israeli mobile numbers", () => {
    expect(normalizeIsraeliPhone("050-123-4567")).toBe("+972501234567");
    expect(normalizeIsraeliPhone("+972 52 765 4321")).toBe("+972527654321");
    expect(normalizeIsraeliPhone("03-1234567")).toBeNull();
  });
});

describe("otp", () => {
  it("verifies once, rejects wrong codes and locks after 5 attempts", async () => {
    const { devCode } = await issueOtp("+972501111111");
    expect(devCode).toMatch(/^\d{6}$/);
    const wrong = devCode === "000000" ? "111111" : "000000";
    expect(verifyOtp("+972501111111", wrong)).toBe("invalid");
    expect(verifyOtp("+972501111111", devCode!)).toBe("ok");
    expect(verifyOtp("+972501111111", devCode!)).toBe("expired"); // single use

    const again = await issueOtp("+972502222222");
    for (let i = 0; i < 5; i++) verifyOtp("+972502222222", again.devCode === "000000" ? "111111" : "000000");
    expect(verifyOtp("+972502222222", again.devCode!)).toBe("locked");
  });
});

describe("matching", () => {
  it("creates a mutual match, fires realtime events and exposes the chat", () => {
    const a = member("אבי", "male");
    const b = member("ביתי", "female");
    expect(isProfileComplete(a)).toBe(true);

    const events: unknown[] = [];
    const off = subscribe(b.id, (e) => events.push(e));

    const first = swipe(a.id, b.id, "like", { text: "אהבתי!", promptKey: "buna" });
    expect(first).toMatchObject({ status: "pending", isNewMatch: false });
    expect(likesReceived(b.id).map((l) => l.id)).toEqual([a.id]);
    expect(likesReceived(b.id)[0].comment).toContain("אהבתי!");
    expect(matchPartner(first.matchId, b.id)).toBeNull(); // chat locked until mutual

    const second = swipe(b.id, a.id, "like");
    expect(second).toMatchObject({ status: "matched", isNewMatch: true, matchId: first.matchId });
    expect(events).toContainEqual({ type: "match", matchId: first.matchId, withUserId: a.id });
    expect(matchPartner(first.matchId, b.id)?.id).toBe(a.id);
    expect(listMatches(a.id)).toHaveLength(1);
    off();

    sendMessage(first.matchId, b.id, a.id, "היי 👋");
    expect(listMessages(first.matchId).map((m) => m.text_content)).toHaveLength(2);
  });

  it("pass rejects a pending like and removes both from each other's deck", () => {
    const a = member("אבי", "male");
    const b = member("ביתי", "female");
    swipe(a.id, b.id, "like");
    expect(swipe(b.id, a.id, "pass").status).toBe("rejected");
    expect(discoveryDeck(a).map((c) => c.id)).not.toContain(b.id);
    expect(discoveryDeck(b).map((c) => c.id)).not.toContain(a.id);
  });

  it("respects gender preferences in discovery and limits daily picks to 3", () => {
    const me = member("אני", "female", "male");
    const men = [1, 2, 3, 4].map((i) => member(`גבר ${i}`, "male"));
    member("אישה אחרת", "female", "male");
    member("גבר שמחפש גברים", "male", "male");
    const deck = discoveryDeck(me).map((c) => c.id);
    expect(deck.sort()).toEqual(men.map((m) => m.id).sort());
    const picks = dailyPicks(me);
    expect(picks).toHaveLength(3);
    expect(dailyPicks(me).map((p) => p.id)).toEqual(picks.map((p) => p.id)); // stable for the day
  });
});

describe("billing", () => {
  it("starts a 7-day trial once and keeps access after cancel until period end", () => {
    const u = member("משתמש", "male");
    expect(hasAccess(getSubscription(u.id))).toBe(false);
    const sub = startTrial(u.id, "quarterly_119");
    expect(sub.status).toBe("trialing");
    const days = (new Date(sub.trial_ends_at! + "Z").getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    cancelSubscription(u.id);
    expect(getSubscription(u.id)!.status).toBe("canceled");
    expect(hasAccess(getSubscription(u.id))).toBe(true);

    // Re-subscribing does not grant a second free trial window.
    const again = startTrial(u.id, "monthly_49");
    expect(again.trial_ends_at).toBe(sub.trial_ends_at);
    expect(again.plan_type).toBe("monthly_49");
  });
});

describe("whatsapp trigger", () => {
  it("posts a signed payload to the configured webhook on mutual match", async () => {
    process.env.WHATSAPP_WEBHOOK_URL = "https://hooks.example.com/mela";
    process.env.WHATSAPP_WEBHOOK_SECRET = "s3cret";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    const a = member("אבי", "male");
    const b = member("ביתי", "female");
    swipe(a.id, b.id, "like");
    const { matchId } = swipe(b.id, a.id, "like");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/mela");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ event: "match.created", match_id: matchId });
    expect(body.users.map((u: { phone_number: string }) => u.phone_number)).toEqual([b.phone_number, a.phone_number]);
    expect((init.headers as Record<string, string>)["X-Mela-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    await vi.waitFor(() =>
      expect(db.prepare("SELECT status_code FROM webhook_deliveries WHERE match_id = ?").get(matchId)).toEqual({ status_code: 200 }),
    );
    fetchMock.mockRestore();
    delete process.env.WHATSAPP_WEBHOOK_URL;
  });
});

describe("db rows", () => {
  it("are plain objects (serialisable to Client Components)", () => {
    const u = member("אבי", "male");
    const row = db.prepare("SELECT * FROM cultural_prompts WHERE user_id = ?").get(u.id)!;
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(db.prepare("SELECT 1 AS x").all()[0])).toBe(Object.prototype);
  });
});

describe("profile email", () => {
  it("rejects an email that another member already uses", () => {
    const a = member("אבי", "male");
    const b = member("בני", "male");
    const base = { full_name: "בני", age: 30, gender: "male" as const, seeking: "female" as const, location: "חיפה", occupation: "x", bio: "ביו ארוכה מספיק כאן", photos: ["/api/photos/a.jpg"], prompts: [] };
    updateProfile(a.id, { ...base, email: "same@mela.app" });
    expect(() => updateProfile(b.id, { ...base, email: "same@mela.app" })).toThrow(/UNIQUE constraint failed: users.email/);
  });
});

describe("admin & moderation", () => {
  it("hides banned members from discovery", async () => {
    const me = member("אני", "female", "male");
    const a = member("גבר א", "male");
    const b = member("גבר ב", "male");
    db.prepare("UPDATE users SET is_banned = 1 WHERE id = ?").run(b.id);
    const ids = discoveryDeck(me).map((c) => c.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  it("recognises admins from MELA_ADMIN_PHONES in any Israeli format", async () => {
    const { isAdmin } = await import("@/lib/admin");
    const u = member("מנהלת", "female");
    process.env.MELA_ADMIN_PHONES = `052-111-2222, 0${u.phone_number.slice(4, 6)}-${u.phone_number.slice(6)}`; // e.g. "050-1000005"
    expect(isAdmin(getUser(u.id))).toBe(true);
    process.env.MELA_ADMIN_PHONES = "052-111-2222";
    expect(isAdmin(getUser(u.id))).toBe(false);
    delete process.env.MELA_ADMIN_PHONES;
  });

  it("lists, searches and filters members", async () => {
    const { listUsers, overview } = await import("@/lib/admin-data");
    const a = member("תגסט אלמו", "female");
    member("דוד אברה", "male");
    startTrial(a.id, "monthly_49");
    expect(listUsers({ q: "תגסט" }).rows.map((r) => r.id)).toEqual([a.id]);
    expect(listUsers({ q: a.phone_number.slice(-7) }).total).toBe(1);
    expect(listUsers({ filter: "trialing" }).rows.map((r) => r.id)).toEqual([a.id]);
    expect(overview()).toMatchObject({ users: 2, trialing: 1, active: 0 });
  });
});

describe("demo seed", () => {
  it("is idempotent, adds missing members and assigns seed photos", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mela-seed-"));
    fs.mkdirSync(path.join(dir, "female"));
    fs.writeFileSync(path.join(dir, "female", "תמונה-1.jpg"), "x");
    fs.writeFileSync(path.join(dir, "female", "תמונה-2.jpg"), "x");
    process.env.MELA_SEED_PHOTOS_DIR = dir;
    process.env.MELA_DATA_DIR = path.join(dir, "data");
    const { seedDemoData } = await import("@/lib/seed");
    seedDemoData(db as never);
    const n = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1").get() as { n: number }).n;
    expect(n).toBeGreaterThanOrEqual(40);
    seedDemoData(db as never);
    expect((db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1").get() as { n: number }).n).toBe(n);
    const withPhotos = db.prepare("SELECT photos FROM users WHERE is_demo = 1 AND gender = 'female' AND photos <> '[]'").all() as { photos: string }[];
    expect(withPhotos.length).toBeGreaterThan(0);
    const names = new Set(withPhotos.flatMap((r) => JSON.parse(r.photos) as string[]));
    expect([...names].every((p) => /^\/api\/photos\/[\w-]+\.jpg$/.test(p))).toBe(true);
    expect(names.size).toBe(2); // two distinct files despite Hebrew-only names
    delete process.env.MELA_SEED_PHOTOS_DIR;
  });
});

describe("freemium", () => {
  it("lets a complete profile in without a subscription", async () => {
    const { nextOnboardingStep } = await import("@/lib/onboarding");
    const u = member("חינמי", "male");
    expect(getSubscription(u.id)).toBeNull();
    expect(nextOnboardingStep(u)).toBe("/discover");
  });

  it("caps free likes per day; premium is unlimited", async () => {
    const { getQuota, recordLike, FREE_DAILY_LIKES } = await import("@/lib/quota");
    const free = member("חינמי", "male");
    expect(getQuota(free.id)).toMatchObject({ premium: false, limit: FREE_DAILY_LIKES, used: 0, left: FREE_DAILY_LIKES });
    for (let i = 0; i < FREE_DAILY_LIKES; i++) recordLike(free.id);
    expect(getQuota(free.id).left).toBe(0);
    expect(new Date(getQuota(free.id).resetsAt).getTime()).toBeGreaterThan(Date.now());

    const paid = member("פרימיום", "female");
    startTrial(paid.id, "monthly_49");
    expect(getQuota(paid.id)).toMatchObject({ premium: true, left: null });
  });

  it("reports whether a swipe was actually recorded (repeat likes don't spend quota)", () => {
    const a = member("אבי", "male");
    const b = member("ביתי", "female");
    expect(swipe(a.id, b.id, "like").recorded).toBe(true);
    expect(swipe(a.id, b.id, "like").recorded).toBe(false);
    expect(swipe(b.id, a.id, "like")).toMatchObject({ recorded: true, isNewMatch: true });
  });
});

describe("discovery preferences", () => {
  it("computes approximate distances between known cities", async () => {
    const { cityDistanceKm } = await import("@/lib/cities");
    const tlvJlm = cityDistanceKm("תל אביב", "ירושלים")!;
    expect(tlvJlm).toBeGreaterThan(45);
    expect(tlvJlm).toBeLessThan(65);
    expect(cityDistanceKm("קרית גת", "קריית גת")).toBe(0); // spelling variants
    expect(cityDistanceKm("תל אביב", "כפר לא קיים")).toBeNull();
  });

  it("filters discovery by age range and distance; unknown places are kept", async () => {
    const { updatePreferences } = await import("@/lib/users");
    const me = member("אני", "female", "male");
    const near = member("קרוב", "male"); // Tel Aviv, 28
    const far = member("רחוק", "male");
    const unknown = member("לא ידוע", "male");
    const older = member("מבוגר", "male");
    db.prepare("UPDATE users SET location = 'באר שבע' WHERE id = ?").run(far.id);
    db.prepare("UPDATE users SET location = 'מושב קטן' WHERE id = ?").run(unknown.id);
    db.prepare("UPDATE users SET age = 45 WHERE id = ?").run(older.id);

    updatePreferences(me.id, { seeking: "male", pref_age_min: 25, pref_age_max: 35, pref_distance_km: 30 });
    const ids = discoveryDeck(getUser(me.id)!).map((c) => c.id);
    expect(ids).toContain(near.id);
    expect(ids).toContain(unknown.id);
    expect(ids).not.toContain(far.id);
    expect(ids).not.toContain(older.id);

    updatePreferences(me.id, { seeking: "male", pref_age_min: null, pref_age_max: null, pref_distance_km: null });
    expect(discoveryDeck(getUser(me.id)!).map((c) => c.id)).toEqual(expect.arrayContaining([near.id, far.id, unknown.id, older.id]));
  });
});

describe("improve-your-profile check-ins", () => {
  it("opens a batch of 3, closes it once answered, then waits 3 days", async () => {
    const { getCheckin } = await import("@/lib/checkin");
    const u = member("סקרנית", "female");
    const first = getCheckin(u.id);
    expect(first.questions).toHaveLength(3);
    expect(new Set(first.questions.map((q) => q.cat)).size).toBe(3); // spread across areas
    // the batch is stable until answered
    expect(getCheckin(u.id).questions.map((q) => q.key)).toEqual(first.questions.map((q) => q.key));

    const ins = db.prepare("INSERT INTO quiz_answers (user_id, question_key, choice) VALUES (?, ?, 'a')");
    first.questions.forEach((q) => ins.run(u.id, q.key));
    const after = getCheckin(u.id);
    expect(after.questions).toHaveLength(0);
    expect(new Date(after.nextAt!).getTime()).toBeGreaterThan(Date.now() + 2.9 * 86_400_000);

    db.prepare("UPDATE users SET last_checkin_at = datetime('now', '-4 days') WHERE id = ?").run(u.id);
    const next = getCheckin(u.id);
    expect(next.questions).toHaveLength(3);
    expect(next.questions.some((q) => first.questions.find((f) => f.key === q.key))).toBe(false);
  });

  it("lists answers two members share", async () => {
    const { sharedAnswers } = await import("@/lib/checkin");
    const a = member("א", "male");
    const b = member("ב", "female");
    const ins = db.prepare("INSERT INTO quiz_answers (user_id, question_key, choice) VALUES (?, ?, ?)");
    ins.run(a.id, "coffee", "a");
    ins.run(b.id, "coffee", "a");
    ins.run(a.id, "pets", "a");
    ins.run(b.id, "pets", "b");
    expect(sharedAnswers(a.id, b.id)).toEqual(["בונה בג'בנה"]);
  });

  it("free tier defaults to 5 likes a day", async () => {
    const { FREE_DAILY_LIKES } = await import("@/lib/quota");
    expect(FREE_DAILY_LIKES).toBe(5);
  });

  it("0524080073 is always a super admin", async () => {
    const { isAdmin, isSuperAdmin } = await import("@/lib/admin");
    delete process.env.MELA_ADMIN_PHONES;
    const boss = createVerifiedUser(normalizeIsraeliPhone("0524080073")!);
    expect(isAdmin(boss)).toBe(true);
    expect(isSuperAdmin(boss)).toBe(true);
    const other = member("רגיל", "male");
    expect(isAdmin(other)).toBe(false);
  });

  it("suggests three distinct, local date ideas from shared vibes", async () => {
    const { datePlan } = await import("@/lib/dates");
    const a = member("א", "male");
    const b = member("ב", "female");
    db.prepare("UPDATE users SET location = 'ירושלים' WHERE id = ?").run(b.id);
    const ins = db.prepare("INSERT INTO quiz_answers (user_id, question_key, choice) VALUES (?, ?, ?)");
    for (const [k, c] of [["coffee", "a"], ["ethiopian_food", "a"], ["vacation", "a"]] as const) {
      ins.run(a.id, k, c);
      ins.run(b.id, k, c);
    }
    const plan = datePlan(getUser(a.id)!, getUser(b.id)!);
    expect(plan.ideas).toHaveLength(3);
    expect(new Set(plan.ideas.map((i) => i.kind)).size).toBe(3);
    expect(plan.vibes[0]).toBe("heritage");
    expect(plan.distanceKm).toBeGreaterThan(40);
    expect(plan.ideas.some((i) => i.reason.includes("שניכם בחרתם"))).toBe(true);
    // Same pair, same round → stable; "more ideas" shows three new ones.
    expect(datePlan(getUser(a.id)!, getUser(b.id)!).ideas.map((i) => i.id)).toEqual(plan.ideas.map((i) => i.id));
    const more = datePlan(getUser(a.id)!, getUser(b.id)!, 1).ideas.map((i) => i.id);
    expect(more).toHaveLength(3);
    expect(more.some((id) => plan.ideas.some((i) => i.id === id))).toBe(false);
  });

  it("ranks observance fit and respects what matters to each side", async () => {
    const { compatibility } = await import("@/lib/matching");
    const me = member("מחפש", "male");
    const religious = member("דתייה", "female");
    const secular = member("חילונית", "female");
    db.prepare("UPDATE users SET religiosity = 'religious', partner_religiosity = 'religious' WHERE id = ?").run(me.id);
    db.prepare("UPDATE users SET religiosity = 'religious', partner_religiosity = 'any' WHERE id = ?").run(religious.id);
    db.prepare("UPDATE users SET religiosity = 'secular', partner_religiosity = 'any' WHERE id = ?").run(secular.id);
    expect(compatibility(me.id, religious.id)).toBeGreaterThan(compatibility(me.id, secular.id) + 15);
    expect(discoveryDeck(getUser(me.id)!).map((c) => c.id)[0]).toBe(religious.id);
  });

  it("widens the feed instead of showing an empty deck when the range is too narrow", async () => {
    const { discoverFeed } = await import("@/lib/matching");
    const me = member("חדש", "male");
    const her = member("היא", "female");
    db.prepare("UPDATE users SET pref_age_min = 40, pref_age_max = 45 WHERE id = ?").run(me.id);
    const feed = discoverFeed(getUser(me.id)!);
    expect(feed).toMatchObject({ widened: true, swipes: 0 });
    expect(feed.candidates.map((c) => c.id)).toEqual([her.id]);
    db.prepare("UPDATE users SET pref_age_min = NULL, pref_age_max = NULL WHERE id = ?").run(me.id);
    expect(discoverFeed(getUser(me.id)!).widened).toBe(false);
  });

  it("asks 3 questions at sign-up and offers the rest three at a time", async () => {
    const { ONBOARDING_QUIZ, QUIZ_QUESTIONS } = await import("@/lib/content");
    const { nextQuestions } = await import("@/lib/checkin");
    expect(ONBOARDING_QUIZ).toHaveLength(3);
    const u = member("א", "male");
    const ins = db.prepare("INSERT INTO quiz_answers (user_id, question_key, choice) VALUES (?, ?, 'a')");
    ONBOARDING_QUIZ.forEach((q) => ins.run(u.id, q.key));
    const first = nextQuestions(u.id);
    expect(first.questions).toHaveLength(3);
    expect(first.questions.every((q) => QUIZ_QUESTIONS.some((c) => c.key === q.key))).toBe(true);
    expect(first.questions.some((q) => ONBOARDING_QUIZ.some((o) => o.key === q.key))).toBe(false);
    first.questions.forEach((q) => ins.run(u.id, q.key));
    expect(nextQuestions(u.id).questions.map((q) => q.key)).not.toEqual(first.questions.map((q) => q.key));
  });

  it("puts people looking for the same thing first", async () => {
    const { compatibility } = await import("@/lib/matching");
    const me = member("רציני", "male");
    const serious = member("רצינית", "female");
    const casual = member("קלילה", "female");
    db.prepare("UPDATE users SET looking_for = 'serious', marital_status = 'single' WHERE id IN (?, ?)").run(me.id, serious.id);
    db.prepare("UPDATE users SET looking_for = 'casual', marital_status = 'divorced' WHERE id = ?").run(casual.id);
    expect(compatibility(me.id, serious.id)).toBeGreaterThan(compatibility(me.id, casual.id) + 15);
    expect(discoveryDeck(getUser(me.id)!).map((c) => [c.id, c.marital_status])[0]).toEqual([serious.id, "single"]);
  });

  it("unlocks 5 extra likes after 3 shares, once a day", async () => {
    const { getQuota, recordLike, recordShare } = await import("@/lib/quota");
    const u = member("משתף", "male");
    for (let i = 0; i < 5; i++) recordLike(u.id);
    expect(getQuota(u.id)).toMatchObject({ left: 0, limit: 5, share: { shares: 0, claimed: false } });
    recordShare(u.id);
    expect(recordShare(u.id)).toMatchObject({ left: 0, share: { shares: 2, claimed: false } });
    expect(recordShare(u.id)).toMatchObject({ left: 5, limit: 10, share: { shares: 3, claimed: true } });
    // more shares the same day don't stack
    expect(recordShare(u.id)).toMatchObject({ left: 5, limit: 10 });
  });
});
