import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { PhoneAuth } from "@/components/PhoneAuth";
import { getSessionUserId } from "@/lib/session";
import { getUser } from "@/lib/users";
import { nextOnboardingStep } from "@/lib/onboarding";

export const metadata: Metadata = { title: "כניסה" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Already signed in → straight in (sessions last 30 days).
  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  if (user && !user.is_banned) {
    const { next } = await searchParams;
    const step = nextOnboardingStep(user);
    redirect(next?.startsWith("/") && !next.startsWith("//") && step === "/discover" ? next : step);
  }
  return (
    <AuthShell>
      <Suspense>
        <PhoneAuth mode="login" />
      </Suspense>
    </AuthShell>
  );
}
