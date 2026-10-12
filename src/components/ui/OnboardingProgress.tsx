"use client";

import { motion } from "framer-motion";

export const ONBOARDING_STEPS = 7; // phone, code, photos, basics, about, prompts, plan

/** Sleek continuous progress bar for the signup wizard. */
export function OnboardingProgress({ step, label }: { step: number; label?: string }) {
  const pct = Math.min(1, step / ONBOARDING_STEPS);
  return (
    <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={ONBOARDING_STEPS} aria-valuenow={step} aria-label={label}>
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="font-medium text-gold-2">{label}</span>
        <span className="tabular text-mute">
          {step}/{ONBOARDING_STEPS}
        </span>
      </div>
      <div className="relative h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-gold-3 via-gold-2 to-gold shadow-[0_0_12px_rgba(229,193,88,0.8)]"
          initial={false}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}
