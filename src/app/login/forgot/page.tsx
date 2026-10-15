import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { PhoneAuth } from "@/components/PhoneAuth";

export const metadata: Metadata = { title: "שכחתי סיסמה" };

export default function ForgotPage() {
  return (
    <AuthShell>
      <Suspense>
        <PhoneAuth mode="reset" />
      </Suspense>
    </AuthShell>
  );
}
