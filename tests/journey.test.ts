import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createVerifiedUser, getUser, updateProfile, type Gender } from "@/lib/users";
import { discoverFeed, swipe } from "@/lib/matching";
import { FREE_DAILY_LIKES, getQuota, recordLike } from "@/lib/quota";
import { REFERRAL_BONUS_LIKES, applyReferral, referralCode, referralStats } from "@/lib/referral";
import { decideSecondChance, isSecondChance, secondChanceDeck } from "@/lib/second-chance";
import { alertWaitingMembers, setMatchAlerts } from "@/lib/match-alerts";
import { blockUser } from "@/lib/safety";

let seq = 3000000;
function member(name: string, gender: Gender) {
  const u = createVerifiedUser(`+97252${seq++}`);
  updateProfile(u.id, {
    full_name: name,
    age: 29,
    gender,
    seeking: gender === "male" ? "female" : "male",
    location: "תל אביב",
    occupation: "x",
    bio: "ביו לבדיקה ארוכה מספיק",
    photos: [],
    prompts: [
      { question_key: "buna", answer_text: "א" },
      { question_key: "sigd", answer_text: "ב" },
    ],
  });
  return getUser(u.id)!;
}

beforeEach(() => {
  db.exec("DELETE FROM users; DELETE FROM daily_usage;");
});

describe("invite a friend", () => {
  it("credits the inviter once per friend, and the banked likes are used after the day's own", () => {
    const me = member("אביב", "male");
    const code = referralCode(me.id);
    expect(referralCode(me.id)).toBe(code); // stable
    const friend = createVerifiedUser("+972529999001");
    expect(applyReferral(friend.id, code.toUpperCase())).toBe(me.id);
    expect(applyReferral(friend.id, code)).toBeNull(); // already referred
    expect(applyReferral(me.id, code)).toBeNull(); // not yourself
    expect(applyReferral(createVerifiedUser("+972529999002").id, "nosuchcode")).toBeNull();
    expect(referralStats(me.id)).toMatchObject({ joined: 1, earned: REFERRAL_BONUS_LIKES });

    expect(getQuota(me.id).left).toBe(FREE_DAILY_LIKES + REFERRAL_BONUS_LIKES);
    for (let i = 0; i < FREE_DAILY_LIKES; i++) recordLike(me.id);
    expect(getQuota(me.id)).toMatchObject({ left: REFERRAL_BONUS_LIKES, banked: REFERRAL_BONUS_LIKES });
    recordLike(me.id);
    expect(getQuota(me.id)).toMatchObject({ left: REFERRAL_BONUS_LIKES - 1, banked: REFERRAL_BONUS_LIKES - 1 });
  });
});

describe("second chance", () => {
  it("offers a passed profile once, and a like reopens it", () => {
    const me = member("דני", "male");
    const a = member("רותם", "female");
    const b = member("שירה", "female");
    const c = member("מיכל", "female");
    swipe(me.id, a.id, "pass");
    swipe(me.id, b.id, "pass");
    swipe(me.id, c.id, "pass");
    swipe(c.id, me.id, "like"); // she swiped after my pass — not offered again
    blockUser(b.id, me.id); // she blocked me
    expect(secondChanceDeck(me).map((x) => x.id)).toEqual([a.id]);

    expect(isSecondChance(me, a.id)).toBe(true);
    decideSecondChance(me.id, a.id, true);
    expect(isSecondChance(me, a.id)).toBe(false);
    expect(swipe(me.id, a.id, "like")).toMatchObject({ status: "pending", recorded: true });
  });
});

describe("match alerts", () => {
  it("emails opted-in members a newcomer fits, at most once a day", () => {
    const waiting = member("נועה", "female");
    db.prepare("UPDATE users SET email = 'noa@example.com', email_verified = 1 WHERE id = ?").run(waiting.id);
    setMatchAlerts(waiting.id, true);
    const other = member("ליה", "female"); // not opted in
    expect(other.id).toBeTruthy();
    const newcomer = member("יוסי", "male");
    expect(alertWaitingMembers(newcomer)).toBe(1);
    expect(alertWaitingMembers(member("משה", "male"))).toBe(0); // already alerted today
    expect(alertWaitingMembers(member("רונית", "female"))).toBe(0); // not who she's looking for
  });

  it("skips members who already decided on the newcomer (they won't see them in Discover)", () => {
    const waiting = member("שני", "female");
    db.prepare("UPDATE users SET email = 'shani@example.com', email_verified = 1 WHERE id = ?").run(waiting.id);
    setMatchAlerts(waiting.id, true);
    const newcomer = member("אבי", "male");
    swipe(waiting.id, newcomer.id, "pass");
    expect(alertWaitingMembers(newcomer)).toBe(0);
  });
});

describe("discover deck", () => {
  it("shows only complete profiles", () => {
    const me = member("גלית", "female");
    const half = createVerifiedUser("+972521111222");
    db.prepare("UPDATE users SET full_name = 'חצי', gender = 'male', seeking = 'female' WHERE id = ?").run(half.id); // stopped mid-signup
    expect(discoverFeed(me, 1000).candidates.map((c) => c.id)).not.toContain(half.id);
  });
});

import { createSuggestion, suggestedCards, suggestionCandidates, suggestionsFor, isOpenSuggestion, nudgeToChat } from "@/lib/suggestions";

describe("personal match suggestions", () => {
  it("pins each to the other, reopens earlier passes, and tracks the outcome", () => {
    const admin = member("מנהל", "male");
    const shiran = member("שירן", "female");
    const berhan = member("ברהן", "male");
    const other = member("דני", "male");
    swipe(berhan.id, shiran.id, "pass"); // he passed on her before
    expect(suggestionCandidates(shiran).map((c) => c.id)).toEqual(expect.arrayContaining([berhan.id, other.id]));

    const { id } = createSuggestion(admin.id, shiran.id, berhan.id, "שניכם אוהבים משפחה", "שניכם אוהבים משפחה");
    expect(id).toBeGreaterThan(0);
    expect(() => createSuggestion(admin.id, berhan.id, shiran.id, "שוב פעם אחת", "שוב פעם אחת")).toThrow();
    expect(suggestionCandidates(shiran).map((c) => c.id)).not.toContain(berhan.id);

    const cards = suggestedCards(berhan);
    expect(cards[0]).toMatchObject({ id: shiran.id, suggestion: { note: "שניכם אוהבים משפחה" } });
    expect(isOpenSuggestion(berhan.id, shiran.id)).toBe(true);
    expect(swipe(berhan.id, shiran.id, "like").status).toBe("pending"); // the old pass no longer blocks
    expect(suggestedCards(berhan)).toHaveLength(0);
    expect(swipe(shiran.id, berhan.id, "like").isNewMatch).toBe(true);
    expect(suggestionsFor(shiran.id)[0]).toMatchObject({ matched: true, seenTheirs: true, seenMine: true, mine: "liked", theirs: "liked" }); // she liked without seeing the card

    // "Time to write" email from the admin page: only after a match, only to a verified address.
    expect(() => nudgeToChat(id, berhan.id)).toThrow(); // no verified email
    db.prepare("UPDATE users SET email = 'b@x.co', email_verified = 1 WHERE id = ?").run(berhan.id);
    expect(nudgeToChat(id, berhan.id)).toEqual({ emailed: true });
    expect(suggestionsFor(shiran.id)[0]).toMatchObject({ chat: { by: "none" }, nudgedTheirs: expect.any(String), nudgedMine: null });
    expect(() => nudgeToChat(id, other.id)).toThrow(); // not part of this suggestion

    // Chat status: one side wrote → waiting for a reply; both wrote → they're talking.
    const matchId = suggestionsFor(shiran.id)[0].matchId!;
    const say = (from: number) => db.prepare("INSERT INTO messages (match_id, sender_id, text_content) VALUES (?, ?, 'היי')").run(matchId, from);
    say(berhan.id);
    expect(suggestionsFor(shiran.id)[0].chat).toEqual({ by: "one", senderId: berhan.id, label: "ברהן שלח הודעה" });
    say(shiran.id);
    expect(suggestionsFor(shiran.id)[0].chat).toEqual({ by: "both" });
    say(berhan.id);
    expect(suggestionsFor(shiran.id)[0].sent).toEqual(["שירן שלחה 1 עד כה", "ברהן שלח 2 עד כה"]);
  });
});

import { sendSignupReminders } from "@/lib/reminders";
import { createEmailUser, markEmailVerified } from "@/lib/users";

describe("signup reminders", () => {
  it("reminds once, an hour after verifying, only those who didn't finish", () => {
    const stuck = createEmailUser("stuck@example.com");
    markEmailVerified(stuck.id, "stuck@example.com");
    const done = member("גלית", "female");
    db.prepare("UPDATE users SET email = 'done@example.com', email_verified = 1 WHERE id = ?").run(done.id);
    const fresh = createEmailUser("fresh@example.com");
    markEmailVerified(fresh.id, "fresh@example.com");
    db.prepare("UPDATE users SET created_at = datetime('now', '-2 hours') WHERE id IN (?, ?)").run(stuck.id, done.id);
    expect(sendSignupReminders()).toBe(1); // only "stuck": "done" finished, "fresh" verified a minute ago
    expect(sendSignupReminders()).toBe(0); // never twice
  });
});

import { isTestUser, startTestAccount } from "@/lib/test-account";
import { discoveryDeck } from "@/lib/matching";

describe("sandbox test accounts", () => {
  it("are hidden from members and replaced on each new run", () => {
    const real = member("אורי", "male");
    const t1 = startTestAccount();
    updateProfile(t1.id, {
      full_name: "טסט", age: 29, gender: "female", seeking: "male", location: "תל אביב", occupation: "x", bio: "ביו לבדיקה ארוכה מספיק", photos: [],
      prompts: [{ question_key: "buna", answer_text: "א" }, { question_key: "sigd", answer_text: "ב" }],
    });
    expect(isTestUser(t1.id)).toBe(true);
    expect(discoveryDeck(real).map((c) => c.id)).not.toContain(t1.id);
    const t2 = startTestAccount();
    expect(getUser(t1.id)).toBeNull();
    expect(isTestUser(t2.id)).toBe(true);
  });
});

import { unseenCount } from "@/lib/matching";

describe("unseen profiles (admin)", () => {
  it("counts who the member hasn't swiped on yet", () => {
    const me = member("יונתן", "male");
    const a = member("הדס", "female");
    member("ליאת", "female");
    expect(unseenCount(me)).toEqual({ inRange: 2, all: 2 });
    swipe(me.id, a.id, "pass");
    expect(unseenCount(me).inRange).toBe(1);
  });
});

import { departures, recordDeparture } from "@/lib/departures";
import { deleteOwnAccount } from "@/lib/safety";

describe("departures (admin)", () => {
  it("keeps anonymous numbers about a member who deleted their account", () => {
    const her = member("יעל", "female");
    for (const name of ["א", "ב", "ג"]) swipe(her.id, member(name, "male").id, "pass");
    const before = departures().total;
    recordDeparture(getUser(her.id)!);
    deleteOwnAccount(her.id);
    const d = departures();
    expect(d.total).toBe(before + 1);
    expect(d.recent[0]).toMatchObject({ gender: "female", age: 29, passes: 3, likes: 0, matches: 0, profile_complete: 1 });
    expect(Object.keys(d.recent[0])).not.toContain("full_name");
  });
});

import { admirers, hideAdmirer, reopenPassed } from "@/lib/admirers";

describe("people who liked you (Picks)", () => {
  it("lists waiting likes and likes I passed on; free sees how many, not who; remove and second chance work", () => {
    const me = member("מירב", "female");
    const waiting = member("אלון", "male");
    const passed = member("בני", "male");
    const matched = member("גיל", "male");
    const theyPassed = member("דור", "male");
    swipe(waiting.id, me.id, "like");
    swipe(passed.id, me.id, "like");
    swipe(me.id, passed.id, "pass"); // I said no to someone who liked me
    swipe(matched.id, me.id, "like");
    swipe(me.id, matched.id, "like");
    swipe(theyPassed.id, me.id, "pass"); // their own pass is not a like

    const all = admirers(me.id, true);
    const kinds = Object.fromEntries(all.map((a) => [a.id, a.kind]));
    expect(kinds).toEqual({ [waiting.id]: "liked", [passed.id]: "passed" }); // matches live in the Matches tab
    expect(matched.id).toBeTruthy();

    const free = admirers(me.id, false);
    expect(free).toHaveLength(2); // they see how many…
    expect(free.every((a) => a.locked && a.id < 0 && !("card" in a))).toBe(true); // …but not who

    expect(reopenPassed(me.id, passed.id)).toBeGreaterThan(0);
    expect(admirers(me.id, true).map((a) => a.id)).not.toContain(passed.id); // now a match
    expect(reopenPassed(me.id, theyPassed.id)).toBeNull();

    hideAdmirer(me.id, waiting.id);
    expect(admirers(me.id, true).map((a) => a.id)).not.toContain(waiting.id);
  });
});

import { signupFunnel, signupStage } from "@/lib/signup-stage";

describe("where sign-up stopped (admin)", () => {
  const chat = (id: number, draft: object, messages: object[]) =>
    db.prepare("INSERT INTO onboarding_chats (user_id, messages, draft, turns) VALUES (?, ?, ?, 2)").run(id, JSON.stringify(messages), JSON.stringify(draft));
  it("tells the stage from the account and the sign-up chat", () => {
    db.exec("DELETE FROM onboarding_chats");
    const fresh = createEmailUser("fresh@x.com");
    expect(signupStage(getUser(fresh.id)!).stage).toBe("after_code");

    const talking = createEmailUser("talking@x.com");
    chat(talking.id, { full_name: "רון", age: 30 }, [
      { role: "assistant", text: "היי! איך קוראים לך?" },
      { role: "user", text: "רון, 30" },
      { role: "assistant", text: "נעים מאוד! ומה אתה עושה בחיים?" },
    ]);
    const t = signupStage(getUser(talking.id)!);
    expect(t).toMatchObject({ stage: "chat", lastQuestion: "נעים מאוד! ומה אתה עושה בחיים?" });
    expect(t.percent).toBeGreaterThan(0);

    const card = createEmailUser("card@x.com");
    chat(card.id, { full_name: "דנה", age: 27, location: "נתניה", occupation: "אחות" }, [{ role: "user", text: "דנה" }]);
    expect(signupStage(getUser(card.id)!).stage).toBe("details");

    const bio = createEmailUser("bio@x.com");
    chat(bio.id, { full_name: "דנה", bio_draft: "טיוטה לבדיקה ארוכה מספיק" }, [{ role: "user", text: "דנה" }]);
    expect(signupStage(getUser(bio.id)!).stage).toBe("bio");

    const done = member("שלמה", "male");
    expect(signupStage(done).stage).toBe("complete");

    const f = signupFunnel();
    expect(f.reached).toMatchObject({ signedUp: 5, started: 4, complete: 1 });
    expect(f.now).toMatchObject({ after_code: 1, chat: 1, details: 1, bio: 1, complete: 1 });
  });
});

import { likesReceived, likesSent, tasteSummary } from "@/lib/likes-admin";

describe("likes on the admin page", () => {
  it("lists who a member liked and who liked them, with where each one stands", () => {
    const me = member("אורית", "female");
    const [a, b, c, d] = ["אבי", "בני", "גדי", "דני"].map((n) => member(n, "male"));
    swipe(me.id, a.id, "like"); // waiting
    swipe(me.id, b.id, "like");
    swipe(b.id, me.id, "like"); // match
    swipe(me.id, c.id, "like");
    swipe(c.id, me.id, "pass"); // c declined
    swipe(d.id, me.id, "like"); // d liked me…
    swipe(me.id, d.id, "pass"); // …and I passed
    const sent = Object.fromEntries(likesSent(me.id).map((r) => [r.id, r.state]));
    expect(sent).toEqual({ [a.id]: "waiting", [b.id]: "match", [c.id]: "declined" });
    const got = Object.fromEntries(likesReceived(me.id).map((r) => [r.id, r.state]));
    expect(got).toEqual({ [b.id]: "match", [d.id]: "declined" });
    expect(tasteSummary(likesSent(me.id))).toContain("29");
  });
});

import { genderSplit } from "@/lib/admin-data";

describe("women / men on the admin users page", () => {
  it("counts real members by gender, how many Discover shows and how many pay", () => {
    const before = genderSplit();
    member("שירה", "female");
    member("אלון", "male");
    createEmailUser("nogender@x.com");
    const after = genderSplit();
    expect(after.female.total - before.female.total).toBe(1);
    expect(after.female.visible - before.female.visible).toBe(1);
    expect(after.male.total - before.male.total).toBe(1);
    expect(after.unknown - before.unknown).toBe(1);
  });
});

import { vi } from "vitest";
import { featuredQuestion, featuredResults, nextQuestions } from "@/lib/checkin";
import { FEATURED_QUESTION } from "@/lib/content";

describe("question of the week", () => {
  it("comes first until answered or until it ends, and the admin sees how people answered", () => {
    if (!FEATURED_QUESTION) return;
    const key = FEATURED_QUESTION.key;
    const end = Date.parse(FEATURED_QUESTION.until);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(end - 3_600_000);
    try {
      const u = member("מיכל", "female");
      expect(featuredQuestion(u.id)?.key).toBe(key);
      expect(nextQuestions(u.id).questions[0].key).toBe(key);
      expect(featuredQuestion(u.id, undefined, end + 1)).toBeNull(); // over

      const before = featuredResults()!;
      db.prepare("INSERT INTO quiz_answers (user_id, question_key, choice) VALUES (?, ?, 'a')").run(u.id, key);
      expect(featuredQuestion(u.id)).toBeNull();
      expect(nextQuestions(u.id).questions.map((q) => q.key)).not.toContain(key);
      expect(featuredResults()!.a - before.a).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { activityBoost, rankScore, tasteFit, tasteOf } from "@/lib/taste";
import { buildQueue, pendingQueue, approveQueued, rejectQueued, maybeRunNightly } from "@/lib/auto-suggest";

describe("learning from likes", () => {
  const set = (id: number, sql: string, ...v: (string | number)[]) => db.prepare(`UPDATE users SET ${sql} WHERE id = ?`).run(...v, id);
  it("learns the ages and places a member likes, and puts those people first in Discover", () => {
    const me = member("יונתן", "male");
    const liked = ["א", "ב", "ג", "ד"].map((n) => member(n, "female"));
    liked.forEach((u) => (set(u.id, "age = ?, location = ?", 26, "נתניה"), swipe(me.id, u.id, "like")));
    const t = tasteOf(me.id)!;
    expect(t).toMatchObject({ likes: 4, ageLo: 26, ageHi: 26 });
    const near = member("קרובה", "female");
    set(near.id, "age = ?, location = ?", 27, "נתניה");
    const far = member("רחוקה", "female");
    set(far.id, "age = ?, location = ?", 38, "אילת");
    expect(tasteFit(t, getUser(near.id)!)).toBeGreaterThan(tasteFit(t, getUser(far.id)!) + 10);
    expect(tasteOf(near.id)).toBeNull(); // not enough likes to learn from
    const deck = discoverFeed(getUser(me.id)!).candidates.map((c) => c.id);
    expect(deck.indexOf(near.id)).toBeLessThan(deck.indexOf(far.id));
  });

  it("a like waiting for you and recent activity count, a month away counts against", () => {
    const me = member("דן", "male");
    const a = member("פעילה", "female");
    const b = member("נעלמה", "female");
    set(a.id, "last_seen_at = datetime('now', '-1 day')");
    set(b.id, "last_seen_at = datetime('now', '-60 days')");
    expect(activityBoost(getUser(a.id)!)).toBeGreaterThan(activityBoost(getUser(b.id)!));
    const m = getUser(me.id)!;
    expect(rankScore(m, getUser(b.id)!, 80, true)).toBeGreaterThan(rankScore(m, getUser(b.id)!, 80, false) + 20);
  });
});

describe("AI matchmaker queue", () => {
  it("drafts suggestions for active members, sends only what the team approves, and never repeats a pair", async () => {
    delete process.env.ANTHROPIC_API_KEY; // plain notes, no AI call in tests
    db.exec("DELETE FROM suggestion_queue");
    const active = (u: { id: number }) => db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(u.id);
    const [m1, m2] = [member("עומר", "male"), member("איתי", "male")];
    const [w1, w2] = [member("שירה", "female"), member("נועה", "female")];
    [m1, m2, w1, w2].forEach(active);
    const quiet = member("ישן", "male"); // never seen → not suggested for

    const { created } = await buildQueue();
    expect(created).toBe(4); // each man with each woman: two per person per night
    const q = pendingQueue();
    const people = q.flatMap((x) => [x.member.id, x.candidate.id]);
    expect(new Set(people).size).toBe(4);
    expect(people).not.toContain(quiet.id);
    expect(q[0].noteA.length).toBeGreaterThan(10);
    expect(q.every((x) => !x.ai)).toBe(true);

    approveQueued(1, q[0].id, q[0].noteA, q[0].noteB);
    q.slice(1).forEach((x) => rejectQueued(x.id));
    expect(pendingQueue()).toHaveLength(0);
    const sent = db.prepare("SELECT COUNT(*) AS n FROM match_suggestions WHERE (user_a = ? AND user_b = ?)").get(q[0].member.id, q[0].candidate.id) as { n: number };
    expect(sent.n).toBe(1);

    // sent or rejected, a pair is never drafted again
    expect((await buildQueue()).created).toBe(0);
  });

  it("runs once an evening, Israel time", async () => {
    db.exec("DELETE FROM app_settings WHERE key = 'auto_suggest_day'");
    expect(await maybeRunNightly(new Date("2026-10-25T10:00:00Z"))).toBe(0); // 13:00 in Israel — too early
    await maybeRunNightly(new Date("2026-10-25T17:00:00Z")); // 19:00 — runs
    const day = db.prepare("SELECT value FROM app_settings WHERE key = 'auto_suggest_day'").get() as { value: string };
    expect(day.value).toBe("2026-10-25");
  });
});

import { visibilityFor } from "@/lib/visibility";

describe("why a member doesn't see more (admin)", () => {
  it("splits everyone they could be looking for into seen, unseen, incomplete and the rest", () => {
    const me = member("רחל", "female");
    const [seen, fresh, half, gay] = ["א", "ב", "ג", "ד"].map((n) => member(n, "male"));
    swipe(me.id, seen.id, "pass");
    db.prepare("UPDATE users SET bio = NULL WHERE id = ?").run(half.id);
    db.prepare("DELETE FROM cultural_prompts WHERE user_id = ?").run(half.id);
    db.prepare("UPDATE users SET seeking = 'male' WHERE id = ?").run(gay.id);
    createVerifiedUser("+972521111999"); // stopped before choosing a gender
    const v = visibilityFor(getUser(me.id)!)!;
    expect(v).toMatchObject({ total: 4, seen: 1, unseen: 1, incomplete: 1, notLookingForMe: 1, noGender: 1 });
    expect(v.missing).toEqual({ bio: 1, prompts: 1 });
    expect(discoverFeed(getUser(me.id)!).candidates.map((c) => c.id)).toEqual([fresh.id]);
  });
});

describe("why members leave", () => {
  it("keeps the optional reason (and the text only for 'other')", () => {
    db.exec("DELETE FROM departures");
    recordDeparture(member("א", "male"), { reason: "found_here", text: "לא אמור להישמר" });
    recordDeparture(member("ב", "female"), { reason: "other", text: "  יותר מדי מרחק  " });
    recordDeparture(member("ג", "female")); // skipped the question
    const d = departures();
    expect(d.total).toBe(3);
    expect(d.reasons).toEqual(expect.arrayContaining([{ reason: "found_here", n: 1 }, { reason: "other", n: 1 }]));
    expect(d.recent.map((r) => [r.reason, r.reason_text])).toEqual([[null, null], ["other", "יותר מדי מרחק"], ["found_here", null]]);
  });
});

import { secondReminderDue, sendSecondReminders } from "@/lib/reminders";

describe("second 'finish your profile' email", () => {
  it("is due from 21:00 Israel time the day after signing up", () => {
    // signed up Sunday 25.10 at 14:00 Israel (11:00 UTC)
    expect(secondReminderDue("2026-10-25 11:00:00", new Date("2026-10-25T19:00:00Z"))).toBe(false); // same evening
    expect(secondReminderDue("2026-10-25 11:00:00", new Date("2026-10-26T17:00:00Z"))).toBe(false); // Monday 19:00
    expect(secondReminderDue("2026-10-25 11:00:00", new Date("2026-10-26T19:05:00Z"))).toBe(true); // Monday 21:05
    expect(secondReminderDue("2026-10-25 11:00:00", new Date("2026-10-28T08:00:00Z"))).toBe(true); // later: already stuck
    // 23:30 Israel on Sunday is still Sunday: the next evening, not the one after
    expect(secondReminderDue("2026-10-25 21:30:00", new Date("2026-10-26T19:05:00Z"))).toBe(true);
  });

  it("goes once, only to verified members who still haven't finished", () => {
    const stuck = createVerifiedUser("+972521212121");
    const done = member("גמור", "male");
    db.prepare("UPDATE users SET email = ?, email_verified = 1, created_at = datetime('now', '-3 days') WHERE id = ?").run("stuck@x.com", stuck.id);
    db.prepare("UPDATE users SET email = ?, email_verified = 1, created_at = datetime('now', '-3 days') WHERE id = ?").run("done@x.com", done.id);
    expect(sendSecondReminders()).toBe(1);
    expect(sendSecondReminders()).toBe(0);
    const marked = db.prepare("SELECT COUNT(*) AS n FROM users WHERE signup_reminder2_at IS NOT NULL AND id IN (?, ?)").get(stuck.id, done.id) as { n: number };
    expect(marked.n).toBe(2); // the finished one is marked too, so it's never looked at again
  });
});

import { saveChatProfile, saveStuckChats } from "@/lib/chat-save";
import { PARTNER_PROMPT } from "@/lib/ai-onboarding";

describe("the sign-up chat saves the profile as soon as it's done", () => {
  const draft = {
    full_name: "נורית",
    age: 27,
    gender: "female",
    seeking: "male",
    location: "נתניה",
    occupation: "אחות",
    bio: "אוהבת משפחה, ים ובונה של שישי עם החברות",
    religiosity: "traditional",
    partner_religiosity: "any",
    marital_status: "single",
    looking_for: "serious",
    photos: [],
    photos_skipped: true,
    prompts: [
      { question_key: "talk_for_hours", answer_text: "על מוזיקה אתיופית" },
      { question_key: PARTNER_PROMPT, answer_text: "מישהו עם ערכים ולב טוב" },
    ],
  };
  const chat = (id: number, d: object) =>
    db.prepare("INSERT OR REPLACE INTO onboarding_chats (user_id, messages, draft, turns) VALUES (?, ?, ?, 8)").run(id, JSON.stringify([{ role: "user", text: "היי" }]), JSON.stringify(d));

  it("saves a finished chat, and leaves an unfinished one alone", () => {
    const done = createEmailUser("nurit@x.com");
    chat(done.id, draft);
    expect(saveChatProfile(getUser(done.id)!)).toBe(true);
    expect(getUser(done.id)).toMatchObject({ full_name: "נורית", location: "נתניה", gender: "female" });

    const half = createEmailUser("half2@x.com");
    chat(half.id, { ...draft, bio: undefined });
    expect(saveChatProfile(getUser(half.id)!)).toBe(false);
    expect(getUser(half.id)!.full_name).toBeNull();
  });

  it("catches up members who finished before this, once", () => {
    db.exec("DELETE FROM app_settings WHERE key = 'stuck_chats_saved'; DELETE FROM onboarding_chats");
    const stuck = createEmailUser("stuck2@x.com");
    chat(stuck.id, draft);
    expect(saveStuckChats()).toBe(1);
    expect(getUser(stuck.id)!.full_name).toBe("נורית");
    const later = createEmailUser("later@x.com");
    chat(later.id, draft);
    expect(saveStuckChats()).toBe(0); // one-time only
  });
});

import { statsSnapshot } from "@/lib/stats";
import { GET as statsGET } from "@/app/api/admin/stats/route";

describe("read-only stats for the team", () => {
  it("counts the money funnel and describes payers without personal details", () => {
    const m = member("משלם", "male");
    swipe(m.id, member("את", "female").id, "like");
    db.prepare("INSERT INTO payment_orders (id, user_id, plan_type, first_sum, recur_sum, recur_start, status, paid_at) VALUES ('o1', ?, 'monthly_49', 49, 49, date('now'), 'paid', datetime('now'))").run(m.id);
    const s = statsSnapshot();
    expect(s.money.funnel).toMatchObject({ likedSomeone: 1, startedCheckout: 1, paid: 1 });
    expect(s.money.revenue7d).toBe(49);
    expect(s.money.payers).toHaveLength(1);
    expect(s.money.payers[0]).toMatchObject({ gender: "male", ageBand: "25–29", likesSentBefore: 0, plan: "monthly_49" });
    const text = JSON.stringify(s);
    expect(text).not.toContain("משלם"); // no names
    expect(text).not.toContain("+97252"); // no phones
  });

  it("is closed without the right token", async () => {
    delete process.env.MELA_STATS_TOKEN;
    expect((await statsGET(new Request("http://x/api/admin/stats"))).status).toBe(404);
    process.env.MELA_STATS_TOKEN = "a-very-long-secret-token-123";
    expect((await statsGET(new Request("http://x/api/admin/stats", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
    const ok = await statsGET(new Request("http://x/api/admin/stats", { headers: { authorization: "Bearer a-very-long-secret-token-123" } }));
    expect(ok.status).toBe(200);
    delete process.env.MELA_STATS_TOKEN;
  });
});
