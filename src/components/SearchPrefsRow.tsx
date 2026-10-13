"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { PreferencesSheet } from "./PreferencesSheet";
import type { Prefs } from "./PreferencesFields";

const SEEK: Record<Prefs["seeking"], string> = { female: "נשים", male: "גברים", everyone: "כולם" };

export function SearchPrefsRow({ prefs }: { prefs: Prefs }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const age = prefs.pref_age_min || prefs.pref_age_max ? `גילאי \u2066${prefs.pref_age_min ?? 18}–${prefs.pref_age_max ?? "70+"}\u2069` : "כל הגילאים";
  const dist = prefs.pref_distance_km ? `עד ${prefs.pref_distance_km} ק״מ` : "בכל הארץ";
  return (
    <>
      <button onClick={() => setOpen(true)} className="surface group flex w-full items-center gap-3.5 rounded-[24px] px-4 py-4 text-right transition-colors hover:bg-fg/[0.03]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/[0.07] text-gold-2">
          <SlidersHorizontal size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">את מי להראות לי</span>
          <span className="block truncate text-[12.5px] text-mute">
            {SEEK[prefs.seeking]} · {age} · {dist}
          </span>
        </span>
        <ChevronLeft size={18} className="shrink-0 text-mute-2 transition-transform duration-300 group-hover:-translate-x-1" />
      </button>
      <AnimatePresence>
        {open && (
          <PreferencesSheet
            initial={prefs}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
