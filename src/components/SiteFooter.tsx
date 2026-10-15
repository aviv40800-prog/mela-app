import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LEGAL_LINKS, SITE } from "@/lib/site";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" />
    </svg>
  );
}

/** The public site footer: brand, legal pages, contact and social links. */
export function SiteFooter({ className = "" }: { className?: string }) {
  const social = "grid h-10 w-10 place-items-center rounded-full border border-line-2 text-cream/80 transition hover:border-gold/50 hover:text-gold";
  return (
    <footer className={`border-t border-line ${className}`}>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 pt-10 pb-10 text-[13px] text-mute md:grid-cols-[1fr_auto] md:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>אהבה עם שורשים</span>
          </div>
          <p className="max-w-sm leading-relaxed">פלטפורמת ההיכרויות הראשונה שנבנתה במיוחד עבור בני העדה.</p>
          <div className="flex items-center gap-2">
            <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" aria-label="MELA באינסטגרם" className={social}>
              <InstagramIcon />
            </a>
            <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" aria-label="MELA בפייסבוק" className={social}>
              <FacebookIcon />
            </a>
            <a href={`mailto:${SITE.email}`} aria-label="שליחת מייל ל־MELA" className={social}>
              <Mail size={17} />
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label="מידע משפטי" className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-cream">
                {l.label}
              </Link>
            ))}
          </nav>
          <p>
            צור קשר:{" "}
            <a href={`mailto:${SITE.email}`} className="text-cream/90 hover:text-gold" dir="ltr">
              {SITE.email}
            </a>
          </p>
          <span className="text-mute-2">© {new Date().getFullYear()} MELA · כל הזכויות שמורות</span>
        </div>
      </div>
    </footer>
  );
}
