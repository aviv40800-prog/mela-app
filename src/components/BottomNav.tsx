"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Flame, Gem, MessageCircleHeart, UserRound } from "lucide-react";
import { haptic } from "@/lib/client";

const TABS = [
  { href: "/discover", label: "גילוי", Icon: Flame },
  { href: "/picks", label: "בחירות היום", Icon: Gem },
  { href: "/matches", label: "התאמות", Icon: MessageCircleHeart },
  { href: "/profile", label: "פרופיל", Icon: UserRound },
];

/** For free members only, in the middle: the way to the plans. Premium members keep the four tabs. */
const PREMIUM_HREF = "/onboarding/plan?from=nav";

function PremiumTab() {
  return (
    <Link
      href={PREMIUM_HREF}
      onClick={() => haptic(8)}
      className="press relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[10.5px] font-semibold tracking-[0.01em] text-gold-2"
    >
      <span className="relative -mt-5 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold text-[#2a1c12] shadow-[0_0_22px_rgba(184,137,43,0.55)] ring-4 ring-ink-2">
        <Crown size={22} strokeWidth={2} fill="currentColor" fillOpacity={0.25} />
      </span>
      <span className="relative">Premium</span>
    </Link>
  );
}

export function BottomNav({ unread = 0, profileDot = false, premium = false }: { unread?: number; profileDot?: boolean; premium?: boolean }) {
  const path = usePathname();
  if (/^\/matches\/\d+/.test(path)) return null; // full-screen chat

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      aria-label="ניווט ראשי"
    >
      <div className="relative flex items-center justify-around rounded-[30px] border border-fg/[0.08] bg-ink-2/75 px-1.5 py-1.5 shadow-[0_24px_60px_-20px_rgba(90,52,26,0.3),inset_0_1px_0_rgba(70,42,24,0.05)] backdrop-blur-2xl backdrop-saturate-150">
        {TABS.map(({ href, label, Icon }, i) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Fragment key={href}>
              {!premium && i === 2 && <PremiumTab />}
              <Link
                key={href}
                href={href}
                onClick={() => !active && haptic(6)}
                aria-current={active ? "page" : undefined}
                className={`press relative flex flex-1 flex-col items-center gap-0.5 rounded-[24px] py-2 text-[10.5px] tracking-[0.01em] transition-colors duration-300 ${
                  active ? "font-semibold text-gold-2" : "text-mute hover:text-cream"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-[24px] bg-gradient-to-b from-gold/[0.16] to-gold/[0.04] shadow-[inset_0_0_0_1px_rgba(184,137,43,0.25)]"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  />
                )}
                <motion.span
                  key={active ? "on" : "off"}
                  initial={active ? { scale: 0.6, y: 4 } : false}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 600, damping: 14 }}
                  className="relative grid h-7 place-items-center"
                >
                  <Icon size={22} strokeWidth={active ? 2.1 : 1.7} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.22 : 0} />
                </motion.span>
                <span className="relative">{label}</span>

                {href === "/profile" && profileDot && !active && (
                  <span
                    className="absolute top-1.5 left-[calc(50%-16px)] h-2.5 w-2.5 animate-pulse rounded-full bg-gold-2 ring-2 ring-ink-2"
                    aria-label="שאלות חדשות לשיפור הפרופיל"
                  />
                )}
                <AnimatePresence>
                  {href === "/matches" && unread > 0 && (
                    <motion.span
                      key={unread}
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.3, 1] }}
                      exit={{ scale: 0 }}
                      className="tabular absolute top-1 left-[calc(50%-22px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold px-1 text-[10px] font-bold text-[#2a1c12] shadow-[0_0_12px_rgba(184,137,43,0.7)] ring-2 ring-ink-2"
                    >
                      {unread > 9 ? "9+" : unread}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
