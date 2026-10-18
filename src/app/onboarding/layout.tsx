import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),20px)] pb-8">
      <header className="relative mb-6 flex justify-center">
        <Link href="/">
          <Logo size="sm" />
        </Link>
        <SignOutButton className="absolute top-1/2 left-0 -translate-y-1/2" />
      </header>
      {children}
    </main>
  );
}
