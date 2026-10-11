"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Sparkles, MessageCircleHeart, UserRound } from "lucide-react";

const TABS = [
  { href: "/discover", label: "גילוי", Icon: Flame },
  { href: "/picks", label: "בחירות היום", Icon: Sparkles },
  { href: "/matches", label: "התאמות", Icon: MessageCircleHeart },
  { href: "/profile", label: "פרופיל", Icon: UserRound },
];

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  if (/^\/matches\/\d+/.test(path)) return null; // full-screen chat
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="glass flex items-center justify-around rounded-[28px] px-2 py-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]">
        {TABS.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[11px] transition-colors ${
                active ? "text-gold-2" : "text-mute hover:text-cream"
              }`}
            >
              <span className={`grid h-8 w-12 place-items-center rounded-full transition-all ${active ? "bg-gold/12 glow" : ""}`}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.7} />
              </span>
              {label}
              {href === "/matches" && unread > 0 && (
                <span className="absolute top-1 left-1/2 -translate-x-[-14px] min-w-4 rounded-full bg-gold px-1 text-center text-[10px] leading-4 font-bold text-ink">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
