import { describe, expect, it } from "vitest";
import { db, demoRemoved } from "@/lib/db";
import { createEmailUser, createVerifiedUser, getUser } from "@/lib/users";
import { deleteUsers, removeDemoMembers } from "@/lib/cleanup";
import { seedDemoData } from "@/lib/seed";

describe("going live cleanup", () => {
  it("removes every demo member once, and marks it so a restart doesn't seed them again", () => {
    seedDemoData(db);
    const real = createEmailUser("real@example.com");
    const demos = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1").get() as { n: number }).n;
    expect(demos).toBeGreaterThan(10);
    expect(demoRemoved(db)).toBe(false);
    expect(removeDemoMembers()).toBe(demos);
    expect((db.prepare("SELECT COUNT(*) AS n FROM users WHERE is_demo = 1").get() as { n: number }).n).toBe(0);
    expect(getUser(real.id)).not.toBeNull();
    expect(demoRemoved(db)).toBe(true);
  });

  it("deletes chosen accounts but never an admin or the admin themself", () => {
    const admin = createEmailUser("datemela1@gmail.com");
    const a = createVerifiedUser("+972500123001");
    const b = createEmailUser("b@example.com");
    const r = deleteUsers([a.id, b.id, admin.id, 999999], admin.id);
    expect(r.deleted.sort()).toEqual([a.id, b.id].sort());
    expect(r.skipped.map((s) => s.id).sort()).toEqual([admin.id, 999999].sort());
    expect(getUser(a.id)).toBeNull();
    expect(getUser(admin.id)).not.toBeNull();
  });
});
