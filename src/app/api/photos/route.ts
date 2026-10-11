import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { handle, json, error, requireUser } from "@/lib/api";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 8 * 1024 * 1024;

// Local-disk storage for development. In production point this at S3 / R2 / Cloudinary.
export const POST = handle(async (req: Request) => {
  await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return error("לא נבחרה תמונה");
  const ext = TYPES[file.type];
  if (!ext) return error("פורמט נתמך: JPG, PNG, WEBP");
  if (file.size > MAX_BYTES) return error("התמונה גדולה מדי (עד 8MB)");

  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return json({ url: `/api/photos/${name}` });
});
