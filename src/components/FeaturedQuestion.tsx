"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { InterestPause } from "./InterestPause";

type Question = { key: string; cat: string; a: string; b: string; title?: string };

/** The question of the week: pops once (a short beat after the page opens) for a member who hasn't answered it. */
export function FeaturedQuestion({ question }: { question: Question | null }) {
  const [open, setOpen] = useState(false);
  const seenKey = question ? `mela:featured-seen:${question.key}` : "";

  useEffect(() => {
    if (!question) return;
    try {
      if (localStorage.getItem(seenKey)) return;
    } catch {}
    // wait out the first-visit swipe tutorial rather than pop up behind it
    const t = setInterval(() => {
      if (document.querySelector("[data-swipe-tutorial]")) return;
      clearInterval(t);
      setOpen(true);
    }, 1200);
    return () => clearInterval(t);
  }, [question, seenKey]);

  function close() {
    try {
      localStorage.setItem(seenKey, "1");
    } catch {}
    setOpen(false);
  }

  return <AnimatePresence>{open && question && <InterestPause pause={{ kind: "quiz", questions: [question], featured: true }} onClose={close} />}</AnimatePresence>;
}
