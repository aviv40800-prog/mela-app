import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Sparkles, HeartHandshake, Coffee } from "lucide-react";
import { Logo } from "@/components/Logo";
import { HeroVisual } from "@/components/HeroVisual";
import { getSessionUserId } from "@/lib/session";
import { getUser } from "@/lib/users";
import { nextOnboardingStep } from "@/lib/onboarding";

export default async function Landing() {
  const id = await getSessionUserId();
  const user = id ? getUser(id) : null;
  if (user) redirect(nextOnboardingStep(user));

  return (
    <main className="relative flex min-h-dvh flex-col px-6 pt-[max(env(safe-area-inset-top),24px)] pb-40">
      <header className="flex items-center justify-between">
        <Logo size="sm" />
        <Link href="/onboarding/phone" className="text-sm text-mute hover:text-cream">
          כניסה
        </Link>
      </header>

      <HeroVisual />

      <section className="animate-rise mt-2 text-center" style={{ animationDelay: "120ms" }}>
        <p className="mb-3 text-xs tracking-[0.3em] text-gold/80">אהבה עם שורשים</p>
        <h1 className="font-display text-[2.6rem] leading-[1.05] font-bold">
          המקום שבו
          <br />
          <span className="gold-text animate-shimmer">הסיפור שלכם</span> מתחיל
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-mute">
          קהילה סגורה ומאומתת לצעירים וצעירות מהקהילה האתיופית־ישראלית שמחפשים קשר אמיתי. בלי משחקים.
        </p>
      </section>

      <div className="tilet my-8" />

      <ul className="grid grid-cols-2 gap-3 text-sm">
        {[
          { Icon: ShieldCheck, t: "כל פרופיל מאומת", d: "אימות טלפון לכל חבר/ה" },
          { Icon: Sparkles, t: "3 בחירות ביום", d: "אוצרות לפי ערכים משותפים" },
          { Icon: Coffee, t: "שאלות מהבית", d: "בונה, סיגד, משפחה ומה שביניהם" },
          { Icon: HeartHandshake, t: "קשר רציני", d: "לאנשים שמחפשים את האחד/ת" },
        ].map(({ Icon, t, d }, i) => (
          <li key={t} className="glass animate-rise rounded-2xl p-4" style={{ animationDelay: `${200 + i * 70}ms` }}>
            <Icon size={20} className="mb-2 text-gold" />
            <div className="font-semibold">{t}</div>
            <div className="mt-0.5 text-xs text-mute">{d}</div>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t from-ink via-ink/95 to-transparent px-6 pt-10 pb-[max(env(safe-area-inset-bottom),20px)]">
        <Link href="/onboarding/phone" className="btn-gold w-full text-lg">
          מתחילים — 7 ימים חינם
        </Link>
        <p className="mt-3 text-center text-xs text-mute">₪0 היום · ביטול בכל עת</p>
      </div>
    </main>
  );
}
