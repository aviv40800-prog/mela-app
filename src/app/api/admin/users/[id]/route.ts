import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { getUser } from "@/lib/users";
import { getSubscription } from "@/lib/billing";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  is_verified: z.boolean().optional(),
  is_banned: z.boolean().optional(),
  photos: z
    .array(z.string().regex(/^\/api\/photos\/[\w-]+\.(jpg|png|webp)$/))
    .max(6)
    .optional(),
  subscription: z.enum(["extend_trial_7", "grant_month", "cancel"]).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const id = Number((await params).id);
  const target = getUser(id);
  if (!target) return error("משתמש לא נמצא", 404);
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  const p = parsed.data;
  if (p.is_banned && id === admin.id) return error("אי אפשר להשעות את עצמך");

  if (p.is_verified !== undefined) db.prepare("UPDATE users SET is_verified = ? WHERE id = ?").run(p.is_verified ? 1 : 0, id);
  if (p.is_banned !== undefined) db.prepare("UPDATE users SET is_banned = ? WHERE id = ?").run(p.is_banned ? 1 : 0, id);
  if (p.photos) db.prepare("UPDATE users SET photos = ? WHERE id = ?").run(JSON.stringify(p.photos), id);

  if (p.subscription) {
    const sub = getSubscription(id);
    if (p.subscription === "cancel") {
      if (!sub) return error("אין מנוי");
      db.prepare("UPDATE subscriptions SET status = 'canceled' WHERE user_id = ?").run(id);
    } else {
      // Comp access: extend from whichever is later — now or the current end.
      const span = p.subscription === "extend_trial_7" ? "+7 days" : "+30 days";
      const status = p.subscription === "extend_trial_7" ? "trialing" : "active";
      db.prepare(
        `INSERT INTO subscriptions (user_id, plan_type, status, trial_ends_at, current_period_end, provider_ref)
         VALUES (?, 'monthly_49', ?, CASE WHEN ? = 'trialing' THEN datetime('now', ?) END, datetime('now', ?), 'admin')
         ON CONFLICT(user_id) DO UPDATE SET status = excluded.status,
           current_period_end = datetime(MAX(current_period_end, datetime('now')), ?),
           trial_ends_at = CASE WHEN excluded.status = 'trialing' THEN datetime(MAX(COALESCE(trial_ends_at, datetime('now')), datetime('now')), ?) ELSE trial_ends_at END`,
      ).run(id, status, status, span, span, span, span);
    }
  }
  return json({ ok: true, user: getUser(id), subscription: getSubscription(id) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const id = Number((await params).id);
  if (id === admin.id) return error("אי אפשר למחוק את עצמך");
  if (!getUser(id)) return error("משתמש לא נמצא", 404);
  // ON DELETE CASCADE removes prompts, subscription, matches and messages.
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return json({ ok: true });
});
