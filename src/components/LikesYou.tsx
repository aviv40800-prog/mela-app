"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, X } from "lucide-react";
import { Photo } from "./Photo";
import { api, haptic } from "@/lib/client";

type Liker = { id: number; name: string; age: number | null; location: string | null; photo: string | null; comment: string | null };

/** Premium: everyone who liked you, with their opening comment — like back to match instantly. */
export function LikesYou({ likes }: { likes: Liker[] }) {
  const router = useRouter();
  const [gone, setGone] = useState<number[]>([]);

  async function answer(id: number, action: "like" | "pass") {
    haptic(action === "like" ? [12, 30, 18] : 8);
    setGone((g) => [...g, id]);
    const res = await api<{ isNewMatch: boolean; matchId: number }>("/api/swipe", { method: "POST", json: { targetId: id, action } }).catch(() => null);
    if (res?.isNewMatch) router.push(`/matches/${res.matchId}`);
    else router.refresh();
  }

  return (
    <ul className="surface overflow-hidden rounded-[24px]">
      <AnimatePresence initial={false}>
        {likes
          .filter((l) => !gone.includes(l.id))
          .map((l, i) => (
            <motion.li key={l.id} layout exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              {i > 0 && <div className="hairline mr-[76px]" />}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-gold/50 ring-offset-2 ring-offset-ink-3">
                  <Photo src={l.photo} name={l.name} className="h-full w-full" rounded="rounded-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {l.name.split(" ")[0]}, <span className="font-light">{l.age}</span>
                    <span className="mr-1.5 text-xs font-normal text-mute">{l.location}</span>
                  </div>
                  {l.comment && <p className="mt-0.5 line-clamp-2 text-[12.5px] whitespace-pre-line text-cream/75">{l.comment.replace(/^💬 על ״[^״]*״\n/, "")}</p>}
                </div>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => answer(l.id, "pass")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-fg/12 text-mute" aria-label="דילוג">
                  <X size={18} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => answer(l.id, "like")}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-b from-gold-3 to-gold text-ink shadow-[0_8px_20px_-8px_rgba(180,87,58,0.9)]"
                  aria-label="לייק בחזרה"
                >
                  <Heart size={19} className="fill-current" />
                </motion.button>
              </div>
            </motion.li>
          ))}
      </AnimatePresence>
    </ul>
  );
}
