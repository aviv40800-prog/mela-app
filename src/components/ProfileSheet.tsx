"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ProfileCard } from "./ProfileCard";
import type { Candidate } from "@/lib/types";

/** A member's full card over the screen (own preview, a match from the chat, an admirer from Picks). */
export function ProfileSheet({ profile, title, onClose, children }: { profile: Candidate | null; title: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <AnimatePresence>
      {profile && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
          className="fixed inset-0 z-50 mx-auto max-w-md overflow-y-auto bg-ink px-3 pt-[max(env(safe-area-inset-top),12px)] pb-12"
        >
          <div className="sticky top-0 z-10 mb-3 flex items-center justify-between bg-ink/80 px-2 py-2 backdrop-blur-xl">
            <span className="eyebrow">{title}</span>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-fg/[0.06] text-mute transition hover:text-cream" aria-label="סגירה">
              <X size={18} />
            </button>
          </div>
          <ProfileCard c={profile} />
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
