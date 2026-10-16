import "server-only";
import { db, tx } from "./db";
import { isAdmin } from "./admin";
import { getUser } from "./users";
import { deleteOwnAccount } from "./safety";

/**
 * Going live: the admin removes every demo member at once (and they don't come back on restart), and can
 * delete a chosen set of test accounts.
 */
export function removeDemoMembers(): number {
  const ids = (db.prepare("SELECT id FROM users WHERE is_demo = 1").all() as { id: number }[]).map((r) => r.id);
  tx(() => {
    for (const id of ids) deleteOwnAccount(id);
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('demo_removed', '1') ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')").run();
  });
  return ids.length;
}

export type BulkDeleteResult = { deleted: number[]; skipped: { id: number; reason: string }[] };

/** Deletes the given accounts like a self-delete (photos removed, a live standing order queued to be stopped). Admins are never deleted. */
export function deleteUsers(ids: number[], adminId: number): BulkDeleteResult {
  const out: BulkDeleteResult = { deleted: [], skipped: [] };
  tx(() => {
    for (const id of [...new Set(ids)]) {
      const u = getUser(id);
      if (!u) out.skipped.push({ id, reason: "לא נמצא" });
      else if (id === adminId || isAdmin(u)) out.skipped.push({ id, reason: "חשבון מנהל" });
      else {
        deleteOwnAccount(id);
        out.deleted.push(id);
      }
    }
  });
  return out;
}
