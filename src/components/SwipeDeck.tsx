"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import { Heart, Moon, RotateCcw, Share2, Sprout, X } from "lucide-react";
import { ProfileCard } from "./ProfileCard";
import { CommentSheet } from "./CommentSheet";
import { MatchModal, type MiniProfile } from "./MatchModal";
import { CardSkeleton } from "./ui/Skeleton";
import { ApiError, api, haptic } from "@/lib/client";
import { LikeLimitSheet, type Quota } from "./LikeLimitSheet";
import { QuizOfferSheet, countSwipeForOffer } from "./QuizOfferSheet";
import type { Candidate, Prompt, PublicProfile } from "@/lib/types";

type SwipeResponse = { status: string; matchId: number; isNewMatch: boolean; other?: PublicProfile; quota: Quota };
type Action = "like" | "pass";

const DISTANCE = 110; // px past which a release counts as a decision
const VELOCITY = 650; // px/s flick that counts as a decision regardless of distance

export function SwipeDeck({ source, me }: { source: "discover" | "picks"; me: MiniProfile }) {
  const [deck, setDeck] = useState<Candidate[] | null>(null);
  const [sheet, setSheet] = useState<Prompt | null>(null);
  const [match, setMatch] = useState<{ other: PublicProfile; matchId: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [widened, setWidened] = useState(false);
  const [swipes, setSwipes] = useState<number | null>(null);
  const [offer, setOffer] = useState<{ key: string; cat: string; a: string; b: string }[] | null>(null);
  const [paywall, setPaywall] = useState(false);
  const busy = useRef(false);
  const x = useMotionValue(0);

  const load = useCallback(async () => {
    setDeck(null);
    setError(null);
    try {
      const url = source === "discover" ? "/api/discover" : "/api/daily-picks";
      const data = await api<{ candidates?: Candidate[]; picks?: Candidate[]; quota?: Quota; widened?: boolean; swipes?: number }>(url);
      setDeck(data.candidates ?? data.picks ?? []);
      setWidened(!!data.widened);
      if (data.swipes !== undefined) setSwipes(data.swipes);
      if (data.quota) setQuota(data.quota);
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
      // Free tier out of likes: don't throw the card — spring it back and offer Premium. Passes stay free.
      if (action === "like" && quota && quota.left === 0) {
        haptic([30, 40, 30]);
        setSheet(null);
        setPaywall(true);
        animate(x, 0, { type: "spring", stiffness: 520, damping: 30, velocity: opts.velocity ?? 0 });
        return;
      }
      busy.current = true;
      setSheet(null);
      haptic(action === "like" ? [12, 30, 18] : 8);
      if (action === "like") setBurst((b) => b + 1);
      const target = top;
      if (action === "like" && quota && quota.left !== null) setQuota({ ...quota, left: Math.max(0, quota.left - 1), used: quota.used + 1 });

      const request = api<SwipeResponse>("/api/swipe", { method: "POST", json: { targetId: target.id, action, comment: opts.comment } })
        .then((res) => {
          setQuota(res.quota);
          if (res.isNewMatch && res.other) {
            haptic([20, 60, 20, 60, 40]);
            setMatch({ other: res.other, matchId: res.matchId });
          }
          return true;
        })
        .catch((e) => {
          if (e instanceof ApiError && e.code === "like_limit") {
            setQuota((q) => (q ? { ...q, left: 0 } : q));
            setPaywall(true);
            return false; // the like didn't happen — put the card back
          }
          setError((e as Error).message);
          return true;
        });

      // Fly the card off-screen, carrying the release velocity so it feels thrown, not animated.
      const dirn = action === "like" ? 1 : -1;
      await animate(x, dirn * (window.innerWidth + 200), {
        type: "spring",
        stiffness: 260,
        damping: 32,
        velocity: opts.velocity ?? dirn * 900,
        restDelta: 40,
      });
      const kept = await request;
      setDeck((d) => (kept ? (d?.slice(1) ?? null) : d));
      x.set(0);
      busy.current = false;
      if (kept) setSwipes((n) => (n ?? 0) + 1);
      // Every few swipes, offer three more questions (optional) to sharpen the matches.
      if (kept && source === "discover" && countSwipeForOffer()) {
        api<{ questions: { key: string; cat: string; a: string; b: string }[] }>("/api/quiz/next")
          .then((r) => r.questions.length && setOffer(r.questions))
          .catch(() => {});
      }
    },
    [top, x, quota, source],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || match || offer || (e.target as HTMLElement).closest("input,textarea")) return;
      if (e.key === "ArrowRight") void decide("like");
      if (e.key === "ArrowLeft") void decide("pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, sheet, match, offer]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    if (offset.x > DISTANCE || velocity.x > VELOCITY) return void decide("like", { velocity: velocity.x });
    if (offset.x < -DISTANCE || velocity.x < -VELOCITY) return void decide("pass", { velocity: velocity.x });
    animate(x, 0, { type: "spring", stiffness: 520, damping: 30, velocity: velocity.x });
  }

  if (deck === null) return <CardSkeleton />;

  if (!top) {
    // A member who hasn't swiped yet and sees nobody isn't "done" — the community is still growing.
    const fresh = source === "discover" && swipes === 0;
    const invite = async () => {
      const url = window.location.origin;
      const text = "הצטרפו אליי ל־MELA — אפליקציית ההיכרויות של הקהילה. אהבה עם שורשים 🤎";
      try {
        if (navigator.share) return void (await navigator.share({ title: "MELA", text, url }));
      } catch {
        return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
    };
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex h-[calc(100dvh-196px)] flex-col items-center justify-center px-8 text-center">
        <div className="relative mb-7">
          <div className="absolute inset-0 animate-pulse-ring rounded-full" />
          <div className="glow grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-gold/20 to-gold/5 text-gold">
            {fresh ? <Sprout size={34} strokeWidth={1.5} /> : <Moon size={32} strokeWidth={1.5} />}
          </div>
        </div>
        <h2 className="font-display text-[1.7rem] font-bold">{source === "picks" ? "ראית את כל הבחירות" : fresh ? "את/ה מהראשונים כאן" : "עברת על כולם להיום"}</h2>
        <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-mute">
          {source === "picks"
            ? "3 בחירות חדשות יחכו לך מחר בבוקר."
            : fresh
              ? "הקהילה של MELA רק מתחילה, ועוד אין מספיק פרופילים שמתאימים לחיפוש שלך. כל יום מצטרפים חדשים — ככל שתזמינו יותר חברים, כך תגיעו מהר יותר להתאמה."
              : "פרופילים חדשים מצטרפים כל יום. אפשר גם להרחיב את טווח הגילאים או המרחק בכפתור הסינון למעלה."}
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-9 flex w-full flex-col gap-3">
          {source === "discover" && (
            <button onClick={invite} className="btn-gold">
              <Share2 size={17} /> להזמין חברים ל־MELA
            </button>
          )}
          {source === "discover" && !fresh && (
            <Link href="/picks" className="btn-ghost">
              לבחירות היום
            </Link>
          )}
          <button onClick={load} className="btn-ghost">
            <RotateCcw size={16} /> רענון
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative">
      <div className="relative h-[calc(100dvh-196px)]">
        <AnimatePresence>
          {widened && (
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => setWidened(false)}
              className="on-dark absolute inset-x-0 top-14 z-20 mx-auto w-fit max-w-[88%] rounded-full border border-gold/30 bg-black/60 px-4 py-2 text-center text-[12px] leading-snug text-cream/90 backdrop-blur-md"
            >
              אין עדיין אנשים בטווח שבחרת — מציגים גם מעט מחוץ לו
            </motion.button>
          )}
        </AnimatePresence>
        {deck[1] && <BackCard key={deck[1].id} c={deck[1]} x={x} />}
        <TopCard key={top.id} c={top} x={x} onDragEnd={onDragEnd} onPromptLike={setSheet} />
      </div>

      <ActionBar x={x} burst={burst} quota={quota} onPass={() => decide("pass")} onLike={() => decide("like")} />
      <AnimatePresence>{paywall && quota && <LikeLimitSheet quota={quota} onQuota={setQuota} onClose={() => setPaywall(false)} />}</AnimatePresence>

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
      <AnimatePresence>{offer && !match && <QuizOfferSheet questions={offer} onClose={() => setOffer(null)} onAnswered={load} />}</AnimatePresence>
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
        className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[inset_0_0_0_3px_rgba(229,56,59,0.95),inset_0_0_70px_rgba(229,56,59,0.3),0_0_50px_-6px_rgba(229,56,59,0.6)]"
      />
      <motion.div
        style={{ opacity: passGlow }}
        className="pointer-events-none absolute inset-0 rounded-[32px] shadow-[inset_0_0_0_2px_rgba(245,241,232,0.7),inset_0_0_60px_rgba(229,103,90,0.25),0_0_40px_-8px_rgba(229,103,90,0.5)]"
      />

      {/* stamps: a right swipe is a like (stamp on the trailing left edge), a left swipe a pass */}
      <motion.div
        style={{ opacity: likeGlow, scale: likeStamp }}
        className="pointer-events-none absolute top-12 left-7 -rotate-[14deg] rounded-2xl border-[3px] border-[#ff4d55] bg-black/25 px-4 py-1.5 text-3xl font-black text-[#ff5a61] shadow-[0_0_24px_rgba(229,56,59,0.55)] backdrop-blur-sm"
      >
        אהבתי
      </motion.div>
      <motion.div
        style={{ opacity: passGlow, scale: passStamp }}
        className="on-dark pointer-events-none absolute top-12 right-7 rotate-[14deg] rounded-2xl border-[3px] border-cream/80 bg-black/20 px-4 py-1.5 text-3xl font-black text-cream/90 backdrop-blur-sm"
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

function ActionBar({ x, burst, quota, onPass, onLike }: { x: MotionValue<number>; burst: number; quota: Quota | null; onPass: () => void; onLike: () => void }) {
  const likeScale = useTransform(x, [0, 160], [1, 1.16]);
  const passScale = useTransform(x, [-160, 0], [1.16, 1]);
  const likeHalo = useTransform(x, [0, 160], [0.55, 1]);
  return (
    // dir=ltr: pass (✕) sits on the left and like (♥) on the right — the same sides as the swipes.
    <div dir="ltr" className="pointer-events-none fixed inset-x-0 bottom-[100px] z-30 mx-auto flex max-w-md items-center justify-center gap-7">
      <motion.button
        style={{ scale: passScale }}
        whileTap={{ scale: 0.82 }}
        onClick={onPass}
        className="pointer-events-auto grid h-[62px] w-[62px] place-items-center rounded-full border border-fg/15 bg-ink-3/80 text-cream/85 shadow-[0_14px_34px_-12px_rgba(90,52,26,0.285)] backdrop-blur-xl transition-colors hover:text-cream"
        aria-label="דילוג"
      >
        <X size={28} strokeWidth={2.4} />
      </motion.button>
      <motion.button
        style={{ scale: likeScale }}
        whileTap={{ scale: 0.82 }}
        onClick={onLike}
        className="pointer-events-auto relative isolate grid h-[74px] w-[74px] place-items-center rounded-full bg-gradient-to-b from-[#ff6b70] via-[#e5383b] to-[#b8141c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(90,0,8,0.25)]"
        aria-label="לייק"
      >
        <motion.span style={{ opacity: likeHalo }} className="absolute inset-0 -z-10 rounded-full shadow-[0_14px_44px_-6px_rgba(229,56,59,0.85)]" />
        {/* a soft heartbeat every few seconds, so the button feels alive */}
        <motion.span
          animate={{ scale: [1, 1.18, 1, 1.12, 1] }}
          transition={{ duration: 1.1, times: [0, 0.15, 0.3, 0.45, 0.7], repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
          className="grid place-items-center drop-shadow-[0_2px_4px_rgba(90,0,8,0.35)]"
        >
          <Heart size={32} className="fill-current" />
        </motion.span>
        {quota && !quota.premium && (
          <motion.span
            key={quota.left ?? 0}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 600, damping: 18 }}
            aria-label={quota.left === 0 ? "נגמרו הלייקים להיום" : `נותרו ${quota.left} לייקים היום`}
            className={`tabular absolute -top-1 -left-1 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-bold ring-2 ring-ink ${
              quota.left === 0 ? "bg-ink-4 text-mute" : "bg-white text-[#b8141c]"
            }`}
          >
            {quota.left}
          </motion.span>
        )}
        <AnimatePresence>
          {burst > 0 && <Burst key={burst} />}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

/** A burst of little red hearts from the like button. */
function Burst() {
  return (
    <span className="pointer-events-none absolute inset-0">
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-[#ff4d55]"
        initial={{ scale: 1, opacity: 0.9 }}
        animate={{ scale: 2.1, opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 -mt-1.5 -ml-1.5 text-[#ff4d55]"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6, rotate: 0 }}
            animate={{ x: Math.cos(a) * 64, y: Math.sin(a) * 64 - 10, opacity: 0, scale: 1.1, rotate: (i % 2 ? 1 : -1) * 25 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <Heart size={12} className="fill-current" />
          </motion.span>
        );
      })}
    </span>
  );
}
