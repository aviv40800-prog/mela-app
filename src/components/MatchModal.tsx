"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Photo } from "./Photo";
import type { PublicProfile } from "@/lib/types";

export type MiniProfile = { name: string; photo?: string };

const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + (i % 2) * 0.2;
  const r = 120 + (i % 3) * 40;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r - 40, s: 3 + (i % 3) * 2, d: 0.25 + (i % 5) * 0.04 };
});

export function MatchModal({ me, other, matchId, onClose }: { me: MiniProfile; other: PublicProfile; matchId: number; onClose: () => void }) {
  const first = other.full_name.split(" ")[0];
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink/92 px-8 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="יש התאמה"
    >
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_38%_at_50%_42%,rgba(212,175,55,0.32),transparent)]"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <div className="relative w-full max-w-sm text-center">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="eyebrow">
          זה הדדי
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
          className="font-display gold-text animate-shimmer mt-1 text-[3.2rem] leading-none font-bold"
        >
          יש התאמה!
        </motion.h2>

        <div className="relative mx-auto mt-10 h-60 w-72">
          {PARTICLES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute top-1/2 left-1/2 rounded-full bg-gold-2"
              style={{ width: p.s, height: p.s }}
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{ x: p.x, y: p.y, opacity: [0, 1, 0] }}
              transition={{ duration: 1.4, delay: p.d, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
          <motion.div
            initial={{ x: 90, rotate: 0, opacity: 0 }}
            animate={{ x: 0, rotate: 8, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
            className="absolute top-0 right-2 h-52 w-40 overflow-hidden rounded-[26px] border border-gold/50 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]"
          >
            <Photo src={me.photo} name={me.name} className="h-full w-full" rounded="rounded-[26px]" />
          </motion.div>
          <motion.div
            initial={{ x: -90, rotate: 0, opacity: 0 }}
            animate={{ x: 0, rotate: -8, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
            className="absolute bottom-0 left-2 h-52 w-40 overflow-hidden rounded-[26px] border border-gold/50 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)]"
          >
            <Photo src={other.photos[0]} name={other.full_name} className="h-full w-full" rounded="rounded-[26px]" />
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="absolute top-1/2 left-1/2 z-10 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-2xl text-ink shadow-[0_0_40px_rgba(212,175,55,0.7)]"
          >
            ♥
          </motion.div>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-8 text-[15px] text-mute">
          את/ה ו{first} אהבתם אחד את השני. הודעת וואטסאפ כבר בדרך 💛
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="mt-8 space-y-3">
          <Link href={`/matches/${matchId}`} className="btn-gold w-full text-[16px]">
            שליחת הודעה ל{first}
          </Link>
          <button onClick={onClose} className="btn-ghost w-full">
            להמשיך לגלות
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
