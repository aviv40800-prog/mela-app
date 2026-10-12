import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),20px)] pb-8">
      <header className="mb-6 flex justify-center">
        <Link href="/">
          <Logo size="sm" />
        </Link>
      </header>
      {children}
    </main>
  );
}
