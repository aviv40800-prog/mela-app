"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Crown, Heart, X } from "lucide-react";
import { CompatRing } from "./ui/CompatRing";
import { LikeLimitSheet, type Quota } from "./LikeLimitSheet";
import { Photo } from "./Photo";
import { ProfileCard } from "./ProfileCard";
import { CommentSheet } from "./CommentSheet";
import { MatchModal, type MiniProfile } from "./MatchModal";
import { Skeleton } from "./ui/Skeleton";
import { ApiError, api, haptic } from "@/lib/client";
import type { Candidate, Prompt, PublicProfile } from "@/lib/types";

function untilMidnight() {
  const il = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const mins = 24 * 60 - (il.getHours() * 60 + il.getMinutes());
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

export function PicksView({ me }: { me: MiniProfile }) {
  const [picks, setPicks] = useState<Candidate[] | null>(null);
  const [done, setDone] = useState<Record<number, "like" | "pass">>({});
  const [open, setOpen] = useState<Candidate | null>(null);
  const [sheet, setSheet] = useState<Prompt | null>(null);
  const [match, setMatch] = useState<{ other: PublicProfile; matchId: number } | null>(null);
  const [clock, setClock] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    api<{ picks: Candidate[]; quota: Quota }>("/api/daily-picks")
      .then((d) => {
        setPicks(d.picks);
        setQuota(d.quota);
      })
      .catch(() => setPicks([]));
    setClock(untilMidnight());
    const t = setInterval(() => setClock(untilMidnight()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function decide(c: Candidate, action: "like" | "pass", comment?: { text: string; promptKey?: string }) {
    if (action === "like" && quota?.left === 0) {
      setSheet(null);
      setPaywall(true);
      return;
    }
    haptic(action === "like" ? [12, 30, 18] : 8);
    setDone((d) => ({ ...d, [c.id]: action }));
    setOpen(null);
    setSheet(null);
    try {
      const res = await api<{ isNewMatch: boolean; matchId: number; other?: PublicProfile; quota: Quota }>("/api/swipe", {
        method: "POST",
        json: { targetId: c.id, action, comment },
      });
      setQuota(res.quota);
      if (res.isNewMatch && res.other) setMatch({ other: res.other, matchId: res.matchId });
    } catch (e) {
      if (e instanceof ApiError && e.code === "like_limit") {
        setDone(({ [c.id]: _, ...rest }) => rest);
        setQuota((q) => (q ? { ...q, left: 0 } : q));
        setPaywall(true);
      }
    }
  }

  return (
    <section>
      <div className="flex items-end justify-between px-1">
        <div>
          <p className="eyebrow">נבחרו במיוחד בשבילך</p>
          <h1 className="font-display mt-1 text-[2rem] leading-tight font-bold">בחירות היום</h1>
        </div>
        <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] text-gold-2">
          <span className="text-mute">מתחדש בעוד</span>
          <span className="tabular font-semibold" dir="ltr">
            {clock}
          </span>
        </div>
      </div>

      {picks === null ? (
        <div className="-mx-4 mt-5 flex gap-3 overflow-hidden px-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] w-[72%] shrink-0 !rounded-[30px]" />
          ))}
        </div>
      ) : picks.length === 0 ? (
        <div className="glass mt-5 rounded-3xl p-8 text-center text-sm text-mute">אין בחירות חדשות כרגע. נסו שוב מחר 💛</div>
      ) : (
        <div className="no-scrollbar -mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3">
          {picks.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 300, damping: 28 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => !done[c.id] && !c.locked && setOpen(c)}
              className="on-dark relative aspect-[3/4] w-[72%] shrink-0 snap-center overflow-hidden rounded-[30px] text-right shadow-[var(--shadow-float)] ring-1 ring-fg/5"
            >
              <Photo src={c.photos[0]} name={c.full_name} className="h-full w-full" rounded="rounded-[30px]" />
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/60 to-transparent" />
              <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-gold-2 backdrop-blur-md">
                <CompatRing value={c.compatibility} size={12} /> <span className="tabular">{c.compatibility}%</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="text-[1.4rem] leading-none font-bold">
                  {c.full_name.split(" ")[0]} <span className="font-light text-cream/85">{c.age}</span>
                </div>
                <div className="mt-1.5 text-[12.5px] text-cream/75">
                  {c.occupation} · {c.location}
                </div>
              </div>
              {c.locked && (
                <Link
                  href="/onboarding/plan"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 grid place-items-center bg-ink/55 backdrop-blur-xl"
                  aria-label="פתיחת הבחירה עם Premium"
                >
                  <span className="flex flex-col items-center gap-2 px-6 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-[#2a1c12] shadow-[0_0_30px_rgba(184,137,43,0.55)]">
                      <Crown size={24} />
                    </span>
                    <span className="text-[15px] font-semibold">עוד בחירה מחכה לך</span>
                    <span className="text-[12px] text-cream/75">פתחו את כל 3 הבחירות עם Premium</span>
                  </span>
                </Link>
              )}
              <AnimatePresence>
                {done[c.id] && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 grid place-items-center bg-ink/70 backdrop-blur-sm">
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.25, 1] }}
                      className={`grid h-16 w-16 place-items-center rounded-full ${done[c.id] === "like" ? "bg-gradient-to-b from-gold-2 to-gold text-[#2a1c12] shadow-[0_0_40px_rgba(184,137,43,0.6)]" : "glass"}`}
                    >
                      {done[c.id] === "like" ? <Heart className="fill-current" /> : <X />}
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key={open.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-0 z-[45] mx-auto max-w-md overflow-y-auto bg-ink px-3 pt-[max(env(safe-area-inset-top),12px)] pb-40"
          >
            <button onClick={() => setOpen(null)} className="mb-3 flex h-12 items-center gap-1 px-2 text-sm text-mute transition hover:text-cream">
              <ArrowRight size={18} /> חזרה לבחירות
            </button>
            <ProfileCard
              c={open}
              onPromptLike={setSheet}
              onBlocked={() => {
                setPicks((p) => p?.filter((c) => c.id !== open.id) ?? p);
                setOpen(null);
              }}
            />
            {/* Above the bottom nav (z-40); ✕ left and red ♥ right, like Discover */}
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto h-40 max-w-md bg-gradient-to-t from-ink via-ink/85 to-transparent" />
            <div dir="ltr" className="fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),28px)] z-50 mx-auto flex max-w-md items-center justify-center gap-7">
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={() => decide(open, "pass")}
                className="grid h-[62px] w-[62px] place-items-center rounded-full border border-fg/15 bg-ink-3/90 text-cream/85 shadow-[0_14px_34px_-12px_rgba(90,52,26,0.35)] backdrop-blur-xl"
                aria-label="דילוג"
              >
                <X size={28} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.82 }}
                onClick={() => decide(open, "like")}
                className="grid h-[74px] w-[74px] place-items-center rounded-full bg-gradient-to-b from-[#ff6b70] via-[#e5383b] to-[#b8141c] text-white shadow-[0_14px_44px_-6px_rgba(229,56,59,0.85),inset_0_1px_0_rgba(255,255,255,0.45)]"
                aria-label="לייק"
              >
                <motion.span
                  animate={{ scale: [1, 1.18, 1, 1.12, 1] }}
                  transition={{ duration: 1.1, times: [0, 0.15, 0.3, 0.45, 0.7], repeat: Infinity, repeatDelay: 2.4 }}
                  className="grid place-items-center"
                >
                  <Heart size={32} className="fill-current" />
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && sheet && (
          <CommentSheet name={open.full_name} prompt={sheet} onClose={() => setSheet(null)} onSend={(text) => decide(open, "like", { text, promptKey: sheet.question_key })} />
        )}
      </AnimatePresence>
      <AnimatePresence>{match && <MatchModal me={me} {...match} onClose={() => setMatch(null)} />}</AnimatePresence>
      <AnimatePresence>{paywall && quota && <LikeLimitSheet quota={quota} onQuota={setQuota} onClose={() => setPaywall(false)} />}</AnimatePresence>
    </section>
  );
}
