import { z } from "zod";
import { handle, json, error, requireAdmin } from "@/lib/api";
import { draftSuggestionNotes } from "@/lib/suggestion-draft";

/** "✨ Write it for me": AI-drafted notes for both sides — returned for the admin to edit, never sent from here. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = z.object({ a: z.number().int().positive(), b: z.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("בקשה לא תקינה");
  if (!process.env.ANTHROPIC_API_KEY) return error("הטיוטה האוטומטית לא זמינה כרגע — אפשר לכתוב ידנית");
  try {
    return json(await draftSuggestionNotes(admin.id, parsed.data.a, parsed.data.b));
  } catch (e) {
    console.error("[suggestion-draft]", (e as Error).message);
    return error("לא הצלחנו לנסח טיוטה כרגע, אפשר לכתוב ידנית", 502);
  }
});
