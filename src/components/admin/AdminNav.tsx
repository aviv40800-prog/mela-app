"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, Users } from "lucide-react";
import { Logo } from "../Logo";

const LINKS = [
  { href: "/admin", label: "סקירה", Icon: LayoutDashboard },
  { href: "/admin/users", label: "משתמשים", Icon: Users },
];

export function AdminNav({ name }: { name: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur-xl lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-l">
      <div className="flex items-center gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-8 lg:px-5 lg:py-8">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-semibold text-gold-2">ניהול</span>
        </div>
        <nav className="flex flex-1 gap-1 lg:flex-col">
          {LINKS.map(({ href, label, Icon }) => {
            const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${active ? "text-gold-2" : "text-mute hover:text-cream"}`}>
                {active && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl bg-gold/10 ring-1 ring-gold/25" />}
                <Icon size={17} className="relative" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden text-xs text-mute lg:block">
          <div className="hairline mb-4" />
          מחובר/ת כ־<span className="text-cream">{name}</span>
          <Link href="/discover" className="mt-3 flex items-center gap-1 text-gold-2 hover:underline">
            <ArrowRight size={13} /> חזרה לאפליקציה
          </Link>
        </div>
      </div>
    </aside>
  );
}
