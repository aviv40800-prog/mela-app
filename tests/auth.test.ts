import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createEmailUser, getUser } from "@/lib/users";
import { canSetPassword, hashPassword, loginWithPassword, markCodeVerified, setCredentials, suggestUsername, verifyPassword } from "@/lib/auth";
import { nextOnboardingStep } from "@/lib/onboarding";

beforeEach(() => db.exec("DELETE FROM users"));

describe("passwords", () => {
  it("hashes with a random salt and verifies", () => {
    const a = hashPassword("Sod12345");
    expect(a).not.toBe(hashPassword("Sod12345"));
    expect(verifyPassword("Sod12345", a)).toBe(true);
    expect(verifyPassword("sod12345", a)).toBe(false);
  });

  it("the hash never appears on User objects", () => {
    const u = createEmailUser("hash@test.com");
    setCredentials(u.id, { username: "hasher", password: "Sod12345" });
    const user = getUser(u.id)! as unknown as Record<string, unknown>;
    expect(user.password_hash).toBeUndefined();
    expect(user.has_password).toBe(true);
    expect(JSON.stringify(user)).not.toContain("scrypt");
  });
});

describe("sign-up and sign-in", () => {
  it("a new member sets a username + password first, then signs in with either username or email", () => {
    const u = createEmailUser("dana@test.com");
    expect(nextOnboardingStep(getUser(u.id)!)).toBe("/onboarding/account");
    expect(setCredentials(u.id, { username: "dana.k", password: "short" })).toMatchObject({ ok: false });
    expect(setCredentials(u.id, { username: "dana.k", password: "abcdefgh" })).toMatchObject({ ok: false }); // no digits
    expect(setCredentials(u.id, { username: "1dana", password: "Abcdef12" })).toMatchObject({ ok: false }); // must start with a letter
    expect(setCredentials(u.id, { username: "dana.k", password: "Abcdef12" })).toEqual({ ok: true });
    expect(nextOnboardingStep(getUser(u.id)!)).not.toBe("/onboarding/account");
    expect(loginWithPassword("DANA.K", "Abcdef12").ok).toBe(true);
    expect(loginWithPassword(" dana@test.com ", "Abcdef12").ok).toBe(true);
    expect(loginWithPassword("dana.k", "wrong123")).toEqual({ ok: false, reason: "invalid" });
    expect(loginWithPassword("nobody", "Abcdef12")).toEqual({ ok: false, reason: "invalid" });
  });

  it("usernames are unique regardless of case", () => {
    const a = createEmailUser("a@test.com");
    const b = createEmailUser("b@test.com");
    setCredentials(a.id, { username: "Avi", password: "Abcdef12" });
    expect(setCredentials(b.id, { username: "avi", password: "Abcdef12" })).toEqual({ ok: false, error: "שם המשתמש הזה כבר תפוס" });
    expect(suggestUsername("avi@x.com")).not.toMatch(/^avi$/i);
  });

  it("members from before passwords are told to set one", () => {
    createEmailUser("old@test.com");
    expect(loginWithPassword("old@test.com", "whatever1")).toEqual({ ok: false, reason: "no_password" });
  });

  it("locks the account after 5 wrong passwords", () => {
    const u = createEmailUser("lock@test.com");
    setCredentials(u.id, { username: "locky", password: "Abcdef12" });
    for (let i = 0; i < 4; i++) expect(loginWithPassword("locky", "nope1234").ok).toBe(false);
    expect(loginWithPassword("locky", "nope1234")).toMatchObject({ ok: false, reason: "locked" });
    expect(loginWithPassword("locky", "Abcdef12")).toMatchObject({ ok: false, reason: "locked" });
  });

  it("a password can be changed only right after an emailed code", () => {
    const u = createEmailUser("reset@test.com");
    setCredentials(u.id, { username: "resetter", password: "Abcdef12" });
    expect(canSetPassword(u.id)).toBe(false);
    expect(setCredentials(u.id, { password: "Newpass12" }).ok).toBe(false);
    markCodeVerified(u.id);
    expect(setCredentials(u.id, { password: "Newpass12" })).toEqual({ ok: true });
    expect(canSetPassword(u.id)).toBe(false); // the window closes once used
    expect(loginWithPassword("resetter", "Newpass12").ok).toBe(true);
    expect(getUser(u.id)!.username).toBe("resetter");
  });
});
