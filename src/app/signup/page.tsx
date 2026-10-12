import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { PhoneAuth } from "@/components/PhoneAuth";

export const metadata: Metadata = { title: "הרשמה · MELA" };

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense>
        <PhoneAuth mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
