"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Heart, Loader2, MessageCircle, X } from "lucide-react";
import { Photo } from "./Photo";
import { ProfileSheet } from "./ProfileSheet";
import { LikeLimitSheet, type Quota } from "./LikeLimitSheet";
import { MatchModal, type MiniProfile } from "./MatchModal";
import { ApiError, api, haptic } from "@/lib/client";
import type { Candidate, PublicProfile } from "@/lib/types";

type Kind = "match" | "liked" | "passed";
type Item =
  | { id: number; kind: Kind; at: string; locked: false; matchId: number | null; card: Candidate }
  | { id: number; kind: Kind; at: string; locked: true };

const BADGE: Record<Kind, string> = { match: "התאמה 💛", liked: "אהב/ה אותך", passed: "דילגת" };

/**
 * Picks: "people who liked you", side by side (no swiping): likes waiting for an answer, and likes the member passed
 * on — maybe today's "no" is tomorrow's "let's see". Free members see how many; Premium sees who.
 */
export function AdmirersGallery({ me }: { me: MiniProfile }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [open, setOpen] = useState<Extract<Item, { locked: false }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<{ other: PublicProfile; matchId: number } | null>(null);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    api<{ items: Item[]; quota: Quota }>("/api/admirers")
      .then((d) => {
        setItems(d.items);
        setQuota(d.quota);
      })
      .catch(() => setItems([]));
  }, []);

  function remove(id: number) {
    haptic(8);
    setItems((xs) => xs?.filter((x) => x.id !== id) ?? xs);
    setOpen(null);
    api("/api/admirers", { method: "POST", json: { action: "hide", otherId: id } }).catch(() => {});
  }

  // A like back (they're waiting) or a second chance (I had passed): both end in a match.
  async function like(it: Extract<Item, { locked: false }>) {
    setBusy(true);
    try {
      const res =
        it.kind === "passed"
          ? await api<{ matchId: number; other: PublicProfile; quota: Quota }>("/api/admirers", { method: "POST", json: { action: "reopen", otherId: it.id } })
          : await api<{ isNewMatch: boolean; matchId: number; other?: PublicProfile; quota: Quota }>("/api/swipe", { method: "POST", json: { targetId: it.id, action: "like" } });
      setQuota(res.quota);
      haptic([20, 60, 20, 60, 40]);
      setItems((xs) => xs?.map((x) => (x.id === it.id && !x.locked ? { ...x, kind: "match" as const, matchId: res.matchId } : x)) ?? xs);
      setOpen(null);
      if (res.other) setMatch({ other: res.other, matchId: res.matchId });
    } catch (e) {
      if (e instanceof ApiError && e.code === "like_limit") {
        setQuota((q) => (q ? { ...q, left: 0 } : q));
        setOpen(null);
        setPaywall(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (items === null || items.length === 0) {
    return items === null ? null : (
      <section className="mt-8">
        <h2 className="font-display px-1 text-[1.45rem] font-bold">אנשים שאהבו אותך</h2>
        <div className="glass mt-3 rounded-3xl p-6 text-center text-sm text-mute">כשמישהו יעשה לך לייק, הוא יופיע כאן 💛</div>
      </section>
    );
  }

  const locked = items.filter((x) => x.locked).length;
  return (
    <section className="mt-8">
      <div className="flex items-end justify-between px-1">
        <div>
          <p className="eyebrow">אפשר לחזור לכל אחד מהם</p>
          <h2 className="font-display mt-1 text-[1.45rem] font-bold">אנשים שאהבו אותך</h2>
        </div>
        <span className="tabular text-[13px] text-mute">{items.length}</span>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.div
              key={it.id}
              layout
              exit={{ opacity: 0, scale: 0.85 }}
              className="on-dark relative aspect-[3/4] w-[42%] shrink-0 snap-start overflow-hidden rounded-[24px] shadow-[var(--shadow-float)] ring-1 ring-fg/5"
            >
              {it.locked ? (
                <Link href="/onboarding/plan" className="block h-full w-full" aria-label="לראות מי אהב/ה אותך עם Premium">
                  <div className="h-full w-full bg-[radial-gradient(circle_at_50%_35%,rgba(233,182,92,0.35),rgba(120,30,45,0.6)_45%,rgba(30,8,12,0.95))] blur-md" />
                  <span className="absolute inset-0 grid place-items-center bg-ink/40">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-[#2a1c12] shadow-[0_0_24px_rgba(184,137,43,0.55)]">
                      <Crown size={19} />
                    </span>
                  </span>
                </Link>
              ) : (
                <button onClick={() => setOpen(it)} className="block h-full w-full text-right" aria-label={`לצפייה בפרופיל של ${it.card.full_name.split(" ")[0]}`}>
                  <Photo src={it.card.photos[0]} name={it.card.full_name} className="h-full w-full" rounded="rounded-[24px]" />
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/55 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-3">
                    <span className="block text-[1.05rem] leading-tight font-bold">
                      {it.card.full_name.split(" ")[0]} <span className="font-light text-cream/85">{it.card.age}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-cream/75">{it.card.location}</span>
                  </span>
                </button>
              )}
              <span
                className={`pointer-events-none absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold backdrop-blur-md ${
                  it.kind === "match" ? "bg-gold text-[#2a1c12]" : it.kind === "passed" ? "bg-black/45 text-cream/85" : "border border-gold/40 bg-black/40 text-gold-2"
                }`}
              >
                {BADGE[it.kind]}
              </span>
              {!it.locked && (
                <button onClick={() => remove(it.id)} className="absolute top-2 left-2 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-cream/80 backdrop-blur-md transition hover:text-cream" aria-label="להסיר מהרשימה">
                  <X size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {locked > 0 && (
        <Link href="/onboarding/plan" className="mx-1 mt-1 flex items-center justify-center gap-2 rounded-2xl border border-gold/30 bg-gold/[0.07] px-4 py-3 text-[14px] font-semibold text-gold-2">
          <Crown size={16} /> {locked === 1 ? "מישהו/י אהב/ה אותך" : `${locked} אנשים אהבו אותך`} · לגלות מי עם Premium
        </Link>
      )}

      <ProfileSheet profile={open?.card ?? null} title={open ? BADGE[open.kind] : ""} onClose={() => setOpen(null)}>
        {open && (
          <div className="sticky bottom-0 z-10 -mx-3 mt-4 flex flex-col gap-1 bg-gradient-to-t from-ink via-ink/95 to-transparent px-5 pt-10 pb-[max(env(safe-area-inset-bottom),16px)]">
            {open.kind === "match" && open.matchId ? (
              <Link href={`/matches/${open.matchId}`} className="btn-gold w-full text-[16px]">
                <MessageCircle size={18} /> לצ׳אט
              </Link>
            ) : (
              <button onClick={() => like(open)} disabled={busy} className="btn-gold w-full text-[16px]">
                {busy ? <Loader2 className="animate-spin" size={18} /> : <Heart size={18} className="fill-current" />}
                {open.kind === "passed" ? "לתת הזדמנות" : "להחזיר לייק"}
              </button>
            )}
            <button onClick={() => remove(open.id)} className="py-2 text-[14px] text-mute transition hover:text-cream">
              להסיר מהרשימה
            </button>
          </div>
        )}
      </ProfileSheet>
      <AnimatePresence>{match && <MatchModal me={me} {...match} onClose={() => setMatch(null)} />}</AnimatePresence>
      <AnimatePresence>{paywall && quota && <LikeLimitSheet quota={quota} onQuota={setQuota} onClose={() => setPaywall(false)} />}</AnimatePresence>
    </section>
  );
}
