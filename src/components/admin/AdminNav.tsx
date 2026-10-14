"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, LayoutDashboard, LogOut, MessageCircleQuestion, Users } from "lucide-react";
import { api } from "@/lib/client";
import { Logo } from "../Logo";

const LINKS = [
  { href: "/admin", label: "סקירה", Icon: LayoutDashboard },
  { href: "/admin/users", label: "משתמשים", Icon: Users },
  { href: "/admin/questions", label: "שאלות", Icon: MessageCircleQuestion },
];

export function AdminNav({ name, superAdmin = false }: { name: string; superAdmin?: boolean }) {
  const path = usePathname();
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  };
  return (
    <aside className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur-xl lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-l">
      <div className="flex flex-col gap-2 px-4 py-3 lg:gap-8 lg:px-5 lg:py-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-gold-2">{superAdmin ? "Super Admin" : "ניהול"}</span>
          </div>
          {/* mobile: always-visible way out */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <Link href="/" className="rounded-full border border-line-2 px-3 py-1.5 text-[12.5px] text-mute transition hover:text-cream">
              דף הבית
            </Link>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-rose/40 px-3 py-1.5 text-[12.5px] text-cream transition hover:bg-rose/10">
              <LogOut size={14} /> התנתקות
            </button>
          </div>
        </div>
        <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:flex-col lg:overflow-visible">
          {LINKS.map(({ href, label, Icon }) => {
            const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${active ? "text-gold-2" : "text-mute hover:text-cream"}`}>
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
          <Link href="/" className="mt-3 flex items-center gap-1 text-gold-2 hover:underline">
            <ArrowRight size={13} /> לדף הבית
          </Link>
          <Link href="/discover" className="mt-2 flex items-center gap-1 text-gold-2 hover:underline">
            <ArrowRight size={13} /> לאפליקציה
          </Link>
          <button onClick={logout} className="mt-3 flex items-center gap-1.5 rounded-full border border-rose/40 px-3 py-1.5 text-cream transition hover:bg-rose/10">
            <LogOut size={13} /> התנתקות
          </button>
        </div>
      </div>
    </aside>
  );
}
