"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { usePrefs } from "@/lib/prefs";

/** App-wide animation defaults; honours the OS setting and the in-app "reduce motion" preference. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = usePrefs();
  useEffect(() => {
    document.documentElement.toggleAttribute("data-reduce-motion", reduceMotion);
  }, [reduceMotion]);
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
      {children}
    </MotionConfig>
  );
}
