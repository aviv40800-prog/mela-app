"use client";

import { BadgeCheck, Briefcase, Heart, MapPin, MessageCircle } from "lucide-react";
import { Photo } from "./Photo";
import { promptQuestion } from "@/lib/content";
import type { Candidate, Prompt } from "@/lib/types";

/** Full profile: hero photo, prompts (each with a "comment & like" action), and the remaining photos interleaved. */
export function ProfileCard({ c, onPromptLike }: { c: Candidate; onPromptLike?: (p: Prompt) => void }) {
  const [hero, ...rest] = c.photos;
  return (
    <div className="space-y-3">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[28px]">
        <Photo src={hero} name={c.full_name} className="h-full w-full" rounded="rounded-[28px]" priority />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute top-4 right-4 flex gap-2">
          <span className="glass rounded-full px-3 py-1 text-xs font-semibold text-gold-2">{c.compatibility}% התאמה</span>
          {c.likedYou && <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-ink">אהב/ה אותך ✨</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h2 className="flex items-center gap-2 text-3xl font-bold">
            {c.full_name.split(" ")[0]}
            <span className="font-light text-cream/80">{c.age}</span>
            {c.is_verified && <BadgeCheck size={22} className="text-gold" aria-label="מאומת/ת" />}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-cream/80">
            {c.occupation && (
              <span className="flex items-center gap-1">
                <Briefcase size={14} /> {c.occupation}
              </span>
            )}
            {c.location && (
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {c.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {c.bio && <div className="glass rounded-3xl p-5 text-[15px] leading-relaxed text-cream/90">{c.bio}</div>}

      {c.prompts.map((p, i) => (
        <div key={p.question_key}>
          <div className="glass relative rounded-3xl p-5 pb-6">
            <div className="text-xs font-semibold text-gold/90">{promptQuestion(p.question_key)}</div>
            <p className="font-display mt-2 text-[1.35rem] leading-snug">{p.answer_text}</p>
            {onPromptLike && (
              <button
                onClick={() => onPromptLike(p)}
                className="glow absolute -bottom-4 left-5 grid h-11 w-11 place-items-center rounded-full bg-ink-2 text-gold transition active:scale-90"
                aria-label="תגובה ולייק על התשובה"
              >
                <span className="relative">
                  <Heart size={18} />
                  <MessageCircle size={11} className="absolute -right-2 -bottom-1.5 fill-ink-2" />
                </span>
              </button>
            )}
          </div>
          {rest[i] && (
            <div className="mt-6 aspect-[4/5] overflow-hidden rounded-[28px]">
              <Photo src={rest[i]} name={c.full_name} className="h-full w-full" rounded="rounded-[28px]" />
            </div>
          )}
        </div>
      ))}
      {rest.slice(c.prompts.length).map((src) => (
        <div key={src} className="aspect-[4/5] overflow-hidden rounded-[28px]">
          <Photo src={src} name={c.full_name} className="h-full w-full" rounded="rounded-[28px]" />
        </div>
      ))}
    </div>
  );
}
