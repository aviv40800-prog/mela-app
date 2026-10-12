import Link from "next/link";
import { Logo } from "./Logo";
import { PageTransition } from "./PageTransition";

/** Narrow, centred frame shared by signup, login and onboarding. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),20px)] pb-8">
      <header className="mb-6 flex justify-center">
        <Link href="/" aria-label="MELA — דף הבית">
          <Logo size="sm" />
        </Link>
      </header>
      <PageTransition>
        <div className="flex flex-1 flex-col">{children}</div>
      </PageTransition>
    </main>
  );
}
