"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import { Heart, RotateCcw, Sparkles, X } from "lucide-react";
import { ProfileCard } from "./ProfileCard";
import { CommentSheet } from "./CommentSheet";
import { MatchModal, type MiniProfile } from "./MatchModal";
import { CardSkeleton } from "./ui/Skeleton";
import { api, haptic } from "@/lib/client";
import type { Candidate, Prompt, PublicProfile } from "@/lib/types";

type SwipeResponse = { status: string; matchId: number; isNewMatch: boolean; other?: PublicProfile };
type Action = "like" | "pass";

const DISTANCE = 110; // px past which a release counts as a decision
const VELOCITY = 650; // px/s flick that counts as a decision regardless of distance

export function SwipeDeck({ source, me }: { source: "discover" | "picks"; me: MiniProfile }) {
  const [deck, setDeck] = useState<Candidate[] | null>(null);
  const [sheet, setSheet] = useState<Prompt | null>(null);
  const [match, setMatch] = useState<{ other: PublicProfile; matchId: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const x = useMotionValue(0);

  const load = useCallback(async () => {
    setDeck(null);
    setError(null);
    try {
      const url = source === "discover" ? "/api/discover" : "/api/daily-picks";
      const data = await api<{ candidates?: Candidate[]; picks?: Candidate[] }>(url);
      setDeck(data.candidates ?? data.picks ?? []);
    } catch (e) {
      setError((e as Error).message);
      setDeck([]);
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const top = deck?.[0];

  const decide = useCallback(
    async (action: Action, opts: { velocity?: number; comment?: { text: string; promptKey?: string } } = {}) => {
      if (!top || busy.current) return;
      busy.current = true;
      setSheet(null);
      haptic(action === "like" ? [12, 30, 18] : 8);
      if (action === "like") setBurst((b) => b + 1);

      api<SwipeResponse>("/api/swipe", { method: "POST", json: { targetId: top.id, action, comment: opts.comment } })
        .then((res) => {
          if (res.isNewMatch && res.other) {
            haptic([20, 60, 20, 60, 40]);
            setMatch({ other: res.other, matchId: res.matchId });
          }
        })
        .catch((e) => setError((e as Error).message));

      // Fly the card off-screen, carrying the release velocity so it feels thrown, not animated.
      const dirn = action === "like" ? 1 : -1;
      await animate(x, dirn * (window.innerWidth + 200), {
        type: "spring",
        stiffness: 260,
        damping: 32,
        velocity: opts.velocity ?? dirn * 900,
        restDelta: 40,
      });
      setDeck((d) => d?.slice(1) ?? null);
      x.set(0);
      busy.current = false;
    },
    [top, x],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || match || (e.target as HTMLElement).closest("input,textarea")) return;
      if (e.key === "ArrowRight") void decide("like");
      if (e.key === "ArrowLeft") void decide("pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, sheet, match]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.x > DISTANCE || velocity.x > VELOCITY) return void decide("like", { velocity: velocity.x });
    if (offset.x < -DISTANCE || velocity.x < -VELOCITY) return void decide("pass", { velocity: velocity.x });
    animate(x, 0, { type: "spring", stiffness: 520, damping: 30, velocity: velocity.x });
  }

  if (deck === null) return <CardSkeleton />;

  if (!top)
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex h-[calc(100dvh-196px)] flex-col items-center justify-center px-8 text-center">
        <div className="relative mb-7">
          <div className="absolute inset-0 animate-pulse-ring rounded-full" />
          <div className="glow grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-gold/20 to-gold/5 text-gold">
            <Sparkles size={34} />
          </div>
        </div>
        <h2 className="font-display text-[1.7rem] font-bold">{source === "picks" ? "ראית את כל הבחירות" : "זהו להיום ✨"}</h2>
        <p className="mt-2 max-w-xs text-[15px] text-mute">
          {source === "picks" ? "3 בחירות חדשות יחכו לך מחר בבוקר." : "פרופילים חדשים מצטרפים כל יום. בינתיים — בחירות היום והחידון מחכים לך."}
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-9 flex w-full flex-col gap-3">
          {source === "discover" && (
            <Link href="/picks" className="btn-gold">
              לבחירות היום
            </Link>
          )}
          <button onClick={load} className="btn-ghost">
            <RotateCcw size={16} /> רענון
          </button>
        </div>
      </motion.div>
    );

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative">
      <div className="relative h-[calc(100dvh-196px)]">
        {deck[1] && <BackCard key={deck[1].id} c={deck[1]} x={x} />}
        <TopCard key={top.id} c={top} x={x} onDragEnd={onDragEnd} onPromptLike={setSheet} />
      </div>

      <ActionBar x={x} burst={burst} onPass={() => decide("pass")} onLike={() => decide("like")} />

      <AnimatePresence>
        {sheet && (
          <CommentSheet
            name={top.full_name}
            prompt={sheet}
            onClose={() => setSheet(null)}
            onSend={(text) => decide("like", { comment: { text, promptKey: sheet.question_key } })}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{match && <MatchModal me={me} {...match} onClose={() => setMatch(null)} />}</AnimatePresence>
    </motion.div>
  );
}

function TopCard({
  c,
  x,
  onDragEnd,
  onPromptLike,
}: {
  c: Candidate;
  x: MotionValue<number>;
  onDragEnd: (e: unknown, info: PanInfo) => void;
  onPromptLike: (p: Prompt) => void;
}) {
  const rotate = useTransform(x, [-300, 0, 300], [-13, 0, 13]);
  const likeGlow = useTransform(x, [15, DISTANCE], [0, 1]);
  const passGlow = useTransform(x, [-15, -DISTANCE], [0, 1]);
  const likeStamp = useTransform(x, [20, DISTANCE], [0.6, 1]);
  const passStamp = useTransform(x, [-20, -DISTANCE], [0.6, 1]);
  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate, transformOrigin: "50% 110%" }}
      drag="x"
      dragDirectionLock
      dragElastic={1}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.015 }}
      // The back card has already grown to full size underneath, so the hand-off needs no entrance.
      initial={false}
    >
      <div className="surface no-scrollbar relative h-full overflow-y-auto overscroll-contain rounded-[32px] pb-28">
        <ProfileCard c={c} onPromptLike={onPromptLike} variant="deck" />
      </div>

      {/* reactive edge glows */}
      <motion.div
        style={{ opacity: likeGlow }}
        className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[inset_0_0_0_2px_rgba(229,193,88,0.95),inset_0_0_60px_rgba(212,175,55,0.35),0_0_50px_-6px_rgba(212,175,55,0.65)]"
      />
      <motion.div
        style={{ opacity: passGlow }}
        className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[inset_0_0_0_2px_rgba(245,241,232,0.7),inset_0_0_60px_rgba(229,103,90,0.25),0_0_40px_-8px_rgba(229,103,90,0.5)]"
      />

      {/* stamps (like on the left edge = the side the card travels away from in RTL) */}
      <motion.div
        style={{ opacity: likeGlow, scale: likeStamp }}
        className="pointer-events-none absolute top-12 left-7 -rotate-[14deg] rounded-2xl border-[3px] border-gold-2 bg-black/20 px-4 py-1.5 text-3xl font-black text-gold-2 shadow-[0_0_24px_rgba(229,193,88,0.5)] backdrop-blur-sm"
      >
        אהבתי
      </motion.div>
      <motion.div
        style={{ opacity: passGlow, scale: passStamp }}
        className="pointer-events-none absolute top-12 right-7 rotate-[14deg] rounded-2xl border-[3px] border-cream/80 bg-black/20 px-4 py-1.5 text-3xl font-black text-cream/90 backdrop-blur-sm"
      >
        לא הפעם
      </motion.div>
    </motion.div>
  );
}

/** The next card waits underneath and rises to meet the finger as the top card is dragged away. */
function BackCard({ c, x }: { c: Candidate; x: MotionValue<number> }) {
  const progress = useTransform(x, (v) => Math.min(1, Math.abs(v) / 260));
  const scale = useTransform(progress, [0, 1], [0.93, 1]);
  const y = useTransform(progress, [0, 1], [18, 0]);
  const dim = useTransform(progress, [0, 1], [0.55, 0]);
  return (
    <motion.div style={{ scale, y }} className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="surface h-full overflow-hidden rounded-[32px]">
        <ProfileCard c={c} variant="deck" />
      </div>
      <motion.div style={{ opacity: dim }} className="absolute inset-0 rounded-[32px] bg-ink" />
    </motion.div>
  );
}

function ActionBar({ x, burst, onPass, onLike }: { x: MotionValue<number>; burst: number; onPass: () => void; onLike: () => void }) {
  const likeScale = useTransform(x, [0, 160], [1, 1.16]);
  const passScale = useTransform(x, [-160, 0], [1.16, 1]);
  const likeHalo = useTransform(x, [0, 160], [0.55, 1]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-30 mx-auto flex max-w-md items-center justify-center gap-7">
      <motion.button
        style={{ scale: passScale }}
        whileTap={{ scale: 0.82 }}
        onClick={onPass}
        className="pointer-events-auto grid h-[62px] w-[62px] place-items-center rounded-full border border-white/15 bg-ink-3/80 text-cream/85 shadow-[0_14px_34px_-12px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-colors hover:text-cream"
        aria-label="דילוג"
      >
        <X size={28} strokeWidth={2.4} />
      </motion.button>
      <motion.button
        style={{ scale: likeScale }}
        whileTap={{ scale: 0.82 }}
        onClick={onLike}
        className="pointer-events-auto relative grid h-[74px] w-[74px] place-items-center rounded-full bg-gradient-to-b from-gold-3 via-gold-2 to-gold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
        aria-label="לייק"
      >
        <motion.span style={{ opacity: likeHalo }} className="absolute inset-0 -z-10 rounded-full shadow-[0_14px_44px_-6px_rgba(212,175,55,0.85)]" />
        <Heart size={32} className="fill-current" />
        <AnimatePresence>
          {burst > 0 && <Burst key={burst} />}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

/** Gold particle burst from the like button. */
function Burst() {
  return (
    <span className="pointer-events-none absolute inset-0">
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-gold-2"
        initial={{ scale: 1, opacity: 0.9 }}
        animate={{ scale: 2.1, opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full bg-gold-2"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 56, y: Math.sin(a) * 56, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </span>
  );
}
