"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/client";

/** Segmented control with a gliding gold thumb. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="label px-1">{label}</span>
      <div className="flex gap-1 rounded-2xl border border-line-2 bg-fg/[0.03] p-1">
        {options.map(([v, text]) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                haptic(6);
                onChange(v);
              }}
              className={`relative flex-1 rounded-xl py-3 text-sm transition-colors duration-200 ${active ? "font-semibold text-[#2a1c12]" : "text-mute hover:text-cream"}`}
            >
              {active && (
                <motion.span
                  layoutId={`seg-${id}`}
                  className="absolute inset-0 rounded-xl bg-gradient-to-b from-gold-2 to-gold shadow-[0_6px_18px_-8px_rgba(184,137,43,0.9)]"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <span className="relative">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
