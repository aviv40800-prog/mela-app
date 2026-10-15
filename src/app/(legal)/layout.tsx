import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

/** Public information pages (terms, privacy, cancellation, safety, accessibility): readable long-form text. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <Link href="/" aria-label="MELA, לדף הבית">
            <Logo size="sm" />
          </Link>
          <Link href="/" className="rounded-full px-4 py-2 text-sm text-cream/90 transition hover:bg-fg/5">
            לדף הבית
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pt-10 pb-20 text-[16px] leading-[1.85] text-cream/85 [&_a]:text-gold [&_a]:underline-offset-4 hover:[&_a]:underline [&_h1]:font-display [&_h1]:text-[2.2rem] [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:text-cream [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-cream [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-3 [&_ul]:list-disc [&_ul]:ps-6">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

