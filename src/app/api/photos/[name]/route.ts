import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/paths";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const m = /^[\w-]+\.(jpg|png|webp)$/.exec(name);
  if (!m) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(/* turbopackIgnore: true */ UPLOAD_DIR, name));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": MIME[m[1]], "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
