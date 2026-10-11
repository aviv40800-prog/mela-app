"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { ProfileCard } from "./ProfileCard";
import { CommentSheet } from "./CommentSheet";
import { MatchModal } from "./MatchModal";
import { api, haptic } from "@/lib/client";
import type { Candidate, Prompt, PublicProfile } from "@/lib/types";

type SwipeResponse = { status: string; matchId: number; isNewMatch: boolean; other?: PublicProfile };
const THRESHOLD = 110;

export function SwipeDeck({ source }: { source: "discover" | "picks" }) {
  const [deck, setDeck] = useState<Candidate[] | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<null | "like" | "pass">(null);
  const [sheet, setSheet] = useState<Prompt | null>(null);
  const [match, setMatch] = useState<{ other: PublicProfile; matchId: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gesture = useRef<{ x: number; y: number; axis: "h" | "v" | null; id: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

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
    (action: "like" | "pass", comment?: { text: string; promptKey?: string }) => {
      if (!top || exit) return;
      haptic(action === "like" ? 18 : 8);
      setExit(action);
      setSheet(null);
      const target = top;
      api<SwipeResponse>("/api/swipe", { method: "POST", json: { targetId: target.id, action, comment } })
        .then((res) => {
          if (res.isNewMatch && res.other) setMatch({ other: res.other, matchId: res.matchId });
        })
        .catch((e) => setError((e as Error).message));
      setTimeout(() => {
        setDeck((d) => d?.filter((c) => c.id !== target.id) ?? null);
        setExit(null);
        setDx(0);
        scroller.current?.scrollTo({ top: 0 });
      }, 320);
    },
    [top, exit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || match) return;
      if (e.key === "ArrowRight") decide("like");
      if (e.key === "ArrowLeft") decide("pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, sheet, match]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (exit) return;
    gesture.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (!g.axis && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      g.axis = Math.abs(mx) > Math.abs(my) ? "h" : "v";
      if (g.axis === "h") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (g.axis === "h") setDx(mx);
  };
  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.axis !== "h") return;
    setDragging(false);
    if (dx > THRESHOLD) decide("like");
    else if (dx < -THRESHOLD) decide("pass");
    else setDx(0);
  };

  if (deck === null)
    return (
      <div className="grid h-[70dvh] place-items-center">
        <Loader2 className="animate-spin text-gold" />
      </div>
    );

  if (!top)
    return (
      <div className="animate-rise flex h-[70dvh] flex-col items-center justify-center px-8 text-center">
        <div className="glow mb-6 grid h-20 w-20 place-items-center rounded-full bg-gold/10 text-gold">
          <Sparkles size={30} />
        </div>
        <h2 className="font-display text-2xl font-bold">{source === "picks" ? "ראית את כל הבחירות של היום" : "זהו להיום ✨"}</h2>
        <p className="mt-2 text-sm text-mute">
          {source === "picks" ? "3 בחירות חדשות יחכו לך מחר בבוקר." : "פרופילים חדשים מצטרפים כל יום. בינתיים — בחירות היום והחידון מחכים."}
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-8 flex w-full flex-col gap-3">
          {source === "discover" && (
            <Link href="/picks" className="btn-gold">
              לבחירות היום
            </Link>
          )}
          <button onClick={load} className="btn-ghost">
            <RotateCcw size={16} /> רענון
          </button>
        </div>
      </div>
    );

  const offset = exit === "like" ? 600 : exit === "pass" ? -600 : dx;
  const likeOpacity = Math.min(1, Math.max(0, offset / THRESHOLD));
  const passOpacity = Math.min(1, Math.max(0, -offset / THRESHOLD));

  return (
    <div className="relative">
      <div
        key={top.id}
        className="relative touch-pan-y select-none"
        style={{
          transform: `translateX(${offset}px) rotate(${offset / 22}deg)`,
          transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.32s",
          opacity: exit ? 0 : 1,
          transformOrigin: "50% 120%",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={scroller} className="no-scrollbar h-[calc(100dvh-196px)] overflow-y-auto overscroll-contain rounded-[28px] pb-24">
          <ProfileCard c={top} onPromptLike={setSheet} />
        </div>

        <div
          className="pointer-events-none absolute top-10 left-6 -rotate-12 rounded-xl border-[3px] border-gold px-4 py-1 text-3xl font-black tracking-wider text-gold"
          style={{ opacity: likeOpacity }}
        >
          LIKE
        </div>
        <div
          className="pointer-events-none absolute top-10 right-6 rotate-12 rounded-xl border-[3px] border-cream/70 px-4 py-1 text-3xl font-black tracking-wider text-cream/80"
          style={{ opacity: passOpacity }}
        >
          NOPE
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[104px] z-30 mx-auto flex max-w-md items-center justify-center gap-6">
        <button
          onClick={() => decide("pass")}
          className="glass pointer-events-auto grid h-16 w-16 place-items-center rounded-full text-cream/80 shadow-xl transition hover:text-cream active:scale-90"
          aria-label="דילוג"
        >
          <X size={28} />
        </button>
        <button
          onClick={() => decide("like")}
          className="pointer-events-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-b from-gold-2 to-gold text-ink shadow-[0_12px_40px_-8px_rgba(212,175,55,0.7)] transition active:scale-90"
          aria-label="לייק"
        >
          <Heart size={30} className="fill-current" />
        </button>
      </div>

      {sheet && (
        <CommentSheet
          name={top.full_name}
          prompt={sheet}
          onClose={() => setSheet(null)}
          onSend={(text) => decide("like", { text, promptKey: sheet.question_key })}
        />
      )}
      {match && <MatchModal {...match} onClose={() => setMatch(null)} />}
    </div>
  );
}
