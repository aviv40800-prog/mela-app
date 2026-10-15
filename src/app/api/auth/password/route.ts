import { z } from "zod";
import { handle, json, error, requireUser } from "@/lib/api";
import { setCredentials, usernameProblem, usernameTaken } from "@/lib/auth";
import { getUser } from "@/lib/users";
import { nextOnboardingStep } from "@/lib/onboarding";
import { isAdmin } from "@/lib/admin";

const Body = z.object({ username: z.string().trim().max(40).optional(), password: z.string().max(200) });

/** Set the username + password: once at sign-up, and again right after a "forgot password" code. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error("נא למלא שם משתמש וסיסמה");
  const r = setCredentials(user.id, parsed.data);
  if (!r.ok) return error(r.error);
  const updated = getUser(user.id)!;
  return json({ ok: true, next: isAdmin(updated) ? "/admin" : nextOnboardingStep(updated) });
});

/** Is this username free? (for the form, as the member types) */
export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const u = new URL(req.url).searchParams.get("username")?.trim() ?? "";
  const problem = usernameProblem(u);
  if (problem) return json({ ok: false, error: problem });
  return json(usernameTaken(u, user.id) ? { ok: false, error: "שם המשתמש הזה כבר תפוס" } : { ok: true });
});
