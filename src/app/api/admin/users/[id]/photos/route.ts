import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { getUser } from "@/lib/users";
import { UPLOAD_DIR } from "@/lib/paths";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Ctx = { params: Promise<{ id: string }> };

/** Admin uploads a photo onto any member's profile (e.g. to dress demo profiles). Appends, max 6. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const id = Number((await params).id);
  const user = getUser(id);
  if (!user) return error("משתמש לא נמצא", 404);
  if (user.photos.length >= 6) return error("כבר יש 6 תמונות");
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return error("לא נבחרה תמונה");
  const ext = TYPES[file.type];
  if (!ext) return error("פורמט נתמך: JPG, PNG, WEBP");
  if (file.size > 8 * 1024 * 1024) return error("התמונה גדולה מדי (עד 8MB)");
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(/* turbopackIgnore: true */ UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  const photos = [...user.photos, `/api/photos/${name}`];
  db.prepare("UPDATE users SET photos = ? WHERE id = ?").run(JSON.stringify(photos), id);
  return json({ photos });
});
