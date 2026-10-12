"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Gem, MessageCircleHeart, UserRound } from "lucide-react";
import { haptic } from "@/lib/client";

const TABS = [
  { href: "/discover", label: "גילוי", Icon: Flame },
  { href: "/picks", label: "בחירות היום", Icon: Gem },
  { href: "/matches", label: "התאמות", Icon: MessageCircleHeart },
  { href: "/profile", label: "פרופיל", Icon: UserRound },
];

export function BottomNav({ unread = 0, profileDot = false }: { unread?: number; profileDot?: boolean }) {
  const path = usePathname();
  if (/^\/matches\/\d+/.test(path)) return null; // full-screen chat

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }} aria-label="ניווט ראשי">
      <div className="relative flex items-center justify-around rounded-[30px] border border-white/[0.08] bg-ink-2/75 px-1.5 py-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl backdrop-saturate-150">
        {TABS.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
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
                  className="absolute inset-0 rounded-[24px] bg-gradient-to-b from-gold/[0.16] to-gold/[0.04] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.25)]"
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
                <span className="absolute top-1.5 left-[calc(50%-16px)] h-2.5 w-2.5 animate-pulse rounded-full bg-gold-2 ring-2 ring-ink-2" aria-label="שאלות חדשות לשיפור הפרופיל" />
              )}
              <AnimatePresence>
                {href === "/matches" && unread > 0 && (
                  <motion.span
                    key={unread}
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.3, 1] }}
                    exit={{ scale: 0 }}
                    className="tabular absolute top-1 left-[calc(50%-22px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold px-1 text-[10px] font-bold text-ink shadow-[0_0_12px_rgba(212,175,55,0.7)] ring-2 ring-ink-2"
                  >
                    {unread > 9 ? "9+" : unread}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
