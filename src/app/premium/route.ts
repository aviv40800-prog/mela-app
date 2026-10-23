import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUserId } from "@/lib/session";
import { getUser, isProfileComplete } from "@/lib/users";
import { getSubscription, hasAccess } from "@/lib/billing";
import { nextOnboardingStep } from "@/lib/onboarding";
import { PLANS } from "@/lib/content";

/** Remembers a plan chosen on the home page through sign-up, so checkout comes right after the profile is ready. */
const PLAN_COOKIE = "mela_plan";

/**
 * "Join with Premium" from the home page (?plan=…), or the way back here once the profile is ready (no ?plan:
 * the remembered one). Signs up first when needed — paying before there's a profile buys nothing.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const asked = url.searchParams.get("plan");
  const plan = asked && asked in PLANS ? asked : jar.get(PLAN_COOKIE)?.value;
  const go = (path: string) => NextResponse.redirect(new URL(path, url));
  if (!plan || !(plan in PLANS)) return go("/");

  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  const remember = (res: NextResponse) => {
    res.cookies.set(PLAN_COOKIE, plan, { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax", httpOnly: true });
    return res;
  };
  if (!user || user.is_banned) return remember(go("/signup"));
  if (!isProfileComplete(user)) return remember(go(nextOnboardingStep(user)));

  jar.delete(PLAN_COOKIE);
  if (hasAccess(getSubscription(user.id))) return go("/discover");
  return go(`/onboarding/checkout?plan=${plan}`);
}
