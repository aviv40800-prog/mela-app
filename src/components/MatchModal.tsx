"use client";

import Link from "next/link";
import { Photo } from "./Photo";
import type { PublicProfile } from "@/lib/types";

export function MatchModal({ other, matchId, onClose }: { other: PublicProfile; matchId: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/90 px-8 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_40%,rgba(212,175,55,0.25),transparent)]" />
      <div className="relative w-full max-w-sm text-center">
        <p className="animate-rise text-xs tracking-[0.35em] text-gold/80">יש התאמה</p>
        <h2 className="font-display gold-text animate-shimmer animate-pop mt-2 text-5xl font-bold">It&apos;s a Match</h2>
        <p className="animate-rise mt-3 text-sm text-mute" style={{ animationDelay: "120ms" }}>
          את/ה ו{other.full_name.split(" ")[0]} אהבתם אחד את השנייה. הודעת וואטסאפ בדרך 💛
        </p>
        <div className="animate-pop mx-auto mt-8 h-56 w-44" style={{ animationDelay: "180ms" }}>
          <div className="glow h-full overflow-hidden rounded-[28px] border border-gold/40">
            <Photo src={other.photos[0]} name={other.full_name} className="h-full w-full" rounded="rounded-[28px]" />
          </div>
        </div>
        <div className="animate-rise mt-10 space-y-3" style={{ animationDelay: "260ms" }}>
          <Link href={`/matches/${matchId}`} className="btn-gold w-full">
            שליחת הודעה ראשונה
          </Link>
          <button onClick={onClose} className="btn-ghost w-full">
            להמשיך לגלות
          </button>
        </div>
      </div>
    </div>
  );
}
