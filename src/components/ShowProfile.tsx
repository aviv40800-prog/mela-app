"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { Heart, Loader2, MessageCircle } from "lucide-react";
import { ProfileSheet } from "./ProfileSheet";
import { MatchModal, type MiniProfile } from "./MatchModal";
import { ApiError, api, haptic } from "@/lib/client";
import type { PublicProfile } from "@/lib/types";
import type { ShowProfile as Show } from "@/lib/suggestions";

/** A profile opened straight from a link (the suggestion email), with the team's note and the next step. */
export function ShowProfile({ show, me }: { show: Show; me: MiniProfile }) {
  const [open, setOpen] = useState(true);
  const [state, setState] = useState(show.state);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [match, setMatch] = useState<{ other: PublicProfile; matchId: number } | null>(null);
  const c = show.card;
  const first = c.full_name.split(" ")[0];
  const he = show.he;

  async function decide(action: "like" | "pass") {
    if (action === "pass") {
      setOpen(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ isNewMatch: boolean; matchId: number; other?: PublicProfile }>("/api/swipe", { method: "POST", json: { targetId: c.id, action } });
      haptic([20, 60, 20]);
      if (r.isNewMatch && r.other) {
        setState("matched");
        setOpen(false);
        setMatch({ other: r.other, matchId: r.matchId });
      } else setState("liked");
    } catch (e) {
      setErr(e instanceof ApiError && e.code === "like_limit" ? "נגמרו הלייקים להיום. אפשר להמשיך מחר, או עם Premium." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ProfileSheet profile={open ? c : null} title={show.note ? "💛 הצעה אישית מ־MELA" : first} onClose={() => setOpen(false)}>
        {show.note && (
          <div className="mt-4 rounded-[20px] border border-gold/45 bg-gold/[0.07] p-4">
            <b className="block text-[14px] text-gold-2">💛 למה חשבנו עליכם</b>
            <p className="mt-1.5 text-[15px] leading-relaxed">{show.note}</p>
          </div>
        )}
        <div className="sticky bottom-0 z-10 -mx-3 mt-4 flex flex-col gap-2 bg-gradient-to-t from-ink via-ink/95 to-transparent px-5 pt-10 pb-[max(env(safe-area-inset-bottom),16px)]">
          {state === "matched" && show.matchId ? (
            <Link href={`/matches/${show.matchId}`} className="btn-gold w-full text-[16px]">
              <MessageCircle size={18} /> לצ׳אט
            </Link>
          ) : state === "liked" ? (
            <p className="rounded-2xl border border-gold/30 bg-gold/[0.07] px-4 py-3 text-center text-[15px] font-semibold text-gold-2">
              כבר עשית {he ? "לו" : "לה"} לייק 💛 מחכים {he ? "לתשובה שלו" : "לתשובה שלה"}
            </p>
          ) : state === "passed" ? (
            <p className="text-center text-[14px] text-mute">דילגת על הפרופיל הזה.</p>
          ) : (
            <>
              <button onClick={() => decide("like")} disabled={busy} className="btn-gold w-full text-[16px]">
                {busy ? <Loader2 className="animate-spin" size={18} /> : <Heart size={18} className="fill-current" />} לייק ל{first}
              </button>
              <button onClick={() => decide("pass")} disabled={busy} className="py-2 text-[14px] text-mute transition hover:text-cream">
                לא הפעם
              </button>
            </>
          )}
          {err && <p className="text-center text-sm text-danger">{err}</p>}
        </div>
      </ProfileSheet>
      <AnimatePresence>{match && <MatchModal me={me} {...match} onClose={() => setMatch(null)} />}</AnimatePresence>
    </>
  );
}
