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
