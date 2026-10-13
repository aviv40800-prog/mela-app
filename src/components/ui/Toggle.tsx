"use client";

import { motion } from "framer-motion";
import { haptic } from "@/lib/client";

/** iOS-grade switch. In RTL the "on" position is on the left. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic(8);
        onChange(!checked);
      }}
      className={`relative flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors duration-300 ${
        checked ? "justify-end bg-gradient-to-l from-gold-2 to-gold shadow-[0_0_18px_-4px_rgba(180,87,58,0.7)]" : "justify-start bg-fg/12"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
        className={`block h-6 w-6 rounded-full shadow-[0_2px_6px_rgba(90,52,26,0.12)] ${checked ? "bg-ink" : "bg-cream"}`}
      />
    </button>
  );
}
