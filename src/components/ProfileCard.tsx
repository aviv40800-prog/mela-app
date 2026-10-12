"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Briefcase, ChevronDown, Heart, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { Photo } from "./Photo";
import { promptQuestion } from "@/lib/content";
import type { Candidate, Prompt } from "@/lib/types";

/**
 * Full profile: hero photo with a deep gradient fade for legible info, then bio, prompts (each with a
 * "comment & like" action) and the remaining photos interleaved.
 * variant "deck": hero fills the swipe card; "page": hero is a 3:4 card (picks overlay, own preview).
 */
export function ProfileCard({ c, onPromptLike, variant = "page" }: { c: Candidate; onPromptLike?: (p: Prompt) => void; variant?: "deck" | "page" }) {
  const [hero, ...rest] = c.photos;
  const first = c.full_name.split(" ")[0];
  const deck = variant === "deck";

  return (
    <div className={deck ? "" : "space-y-3"}>
      <div className={`relative w-full overflow-hidden ${deck ? "h-[calc(100dvh-196px)]" : "aspect-[3/4] rounded-[32px] shadow-[var(--shadow-float)]"}`}>
        <Photo src={hero} name={c.full_name} className="h-full w-full" rounded={deck ? "rounded-none" : "rounded-[32px]"} priority />
        {/* legibility gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/70 to-transparent" />

        <div className="absolute top-4 right-4 left-4 flex flex-wrap items-start gap-2">
          <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-black/40 px-3 py-1.5 text-[12px] font-semibold text-gold-2 backdrop-blur-md">
            <Sparkles size={12} /> <span className="tabular">{c.compatibility}%</span> התאמה
          </span>
          {c.is_demo && (
            <span className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1.5 text-[11px] text-cream/75 backdrop-blur-md">פרופיל לדוגמה</span>
          )}
          {c.likedYou && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="ms-auto flex items-center gap-1 rounded-full bg-gradient-to-l from-gold-2 to-gold px-3 py-1.5 text-[12px] font-bold text-ink shadow-[0_6px_20px_-6px_rgba(212,175,55,0.8)]"
            >
              <Heart size={11} className="fill-current" /> אהב/ה אותך
            </motion.span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6">
          <h2 className="flex items-baseline gap-2.5 text-[2.1rem] leading-none font-bold tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {first}
            <span className="text-[1.7rem] font-light text-cream/85">{c.age}</span>
            {c.is_verified && <BadgeCheck size={24} className="self-center fill-gold/15 text-gold-2" aria-label="מאומת/ת" />}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
            {c.occupation && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-md">
                <Briefcase size={13} className="text-gold-2" /> {c.occupation}
              </span>
            )}
            {c.location && (
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-md">
                <MapPin size={13} className="text-gold-2" /> {c.location}
                {c.distanceKm != null && <span className="tabular text-cream/60">· {c.distanceKm < 3 ? "קרוב אליך" : `${c.distanceKm} ק״מ`}</span>}
              </span>
            )}
          </div>
          {deck && (c.bio || c.prompts.length > 0) && (
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="mt-4 flex items-center justify-center gap-1 text-[11px] text-cream/55"
            >
              <ChevronDown size={14} /> גללו להכיר את {first}
            </motion.div>
          )}
        </div>
      </div>

      <div className={deck ? "space-y-3 px-3 pt-3" : "space-y-3"}>
        {c.bio && (
          <section className="rounded-[26px] border border-line bg-white/[0.025] p-5">
            <div className="eyebrow mb-2">על {first}</div>
            <p className="text-[15.5px] leading-relaxed text-cream/90">{c.bio}</p>
          </section>
        )}

        {c.prompts.map((p, i) => (
          <div key={p.question_key} className={onPromptLike ? "space-y-3 pb-5" : "space-y-3"}>
            <section className="relative rounded-[26px] border border-line bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-6 pb-7">
              <div className="eyebrow">{promptQuestion(p.question_key)}</div>
              <p className="font-display mt-2.5 text-[1.45rem] leading-[1.3]">{p.answer_text}</p>
              {onPromptLike && (
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  whileHover={{ scale: 1.06 }}
                  onClick={() => onPromptLike(p)}
                  className="absolute -bottom-5 left-5 grid h-12 w-12 place-items-center rounded-full border border-gold/40 bg-ink-2 text-gold-2 shadow-[0_10px_26px_-8px_rgba(0,0,0,0.9),0_0_20px_-6px_rgba(212,175,55,0.5)]"
                  aria-label="תגובה ולייק על התשובה"
                >
                  <span className="relative">
                    <Heart size={19} />
                    <MessageCircle size={11} className="absolute -right-2 -bottom-1.5 fill-ink-2" />
                  </span>
                </motion.button>
              )}
            </section>
            {rest[i] && (
              <div className={`aspect-[4/5] overflow-hidden rounded-[26px] ${onPromptLike ? "!mt-8" : ""}`}>
                <Photo src={rest[i]} name={c.full_name} className="h-full w-full" rounded="rounded-[26px]" />
              </div>
            )}
          </div>
        ))}
        {rest.slice(c.prompts.length).map((src) => (
          <div key={src} className="aspect-[4/5] overflow-hidden rounded-[26px]">
            <Photo src={src} name={c.full_name} className="h-full w-full" rounded="rounded-[26px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
