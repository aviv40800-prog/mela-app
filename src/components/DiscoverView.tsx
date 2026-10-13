"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { Logo } from "./Logo";
import { SwipeDeck } from "./SwipeDeck";
import { PreferencesSheet } from "./PreferencesSheet";
import { SwipeTutorial } from "./SwipeTutorial";
import type { MiniProfile } from "./MatchModal";
import type { Prefs } from "./PreferencesFields";

// \u2066…\u2069 isolates the number range as left-to-right inside the Hebrew line ("22–33", not "33–22").
function summary(p: Prefs) {
  const age = p.pref_age_min || p.pref_age_max ? `\u2066${p.pref_age_min ?? 18}–${p.pref_age_max ?? "70+"}\u2069` : "כל הגילאים";
  const dist = p.pref_distance_km ? `עד ${p.pref_distance_km} ק״מ` : "כל הארץ";
  return `${age} · ${dist}`;
}

export function DiscoverView({ me, prefs: initial }: { me: MiniProfile; prefs: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <>
      <header className="flex h-14 items-center justify-between px-2">
        <Logo size="sm" />
        <button
          onClick={() => setOpen(true)}
          className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] text-cream/85 transition hover:text-cream"
          aria-label="שינוי העדפות חיפוש"
        >
          <SlidersHorizontal size={13} className="text-gold" /> <span className="tabular">{summary(prefs)}</span>
        </button>
      </header>
      {/* Remount → reload the deck with the new preferences */}
      <SwipeDeck key={version} source="discover" me={me} />
      {/* First visit: a short walkthrough of which way is like and which is pass */}
      <SwipeTutorial />
      <AnimatePresence>
        {open && (
          <PreferencesSheet
            initial={prefs}
            onClose={() => setOpen(false)}
            onSaved={(p) => {
              setPrefs(p);
              setOpen(false);
              setVersion((v) => v + 1);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
