"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <ul className="surface divide-y divide-line overflow-hidden rounded-[26px]">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <li key={it.q}>
            <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right transition-colors hover:bg-fg/[0.02]">
              <span className="text-[16px] font-medium">{it.q}</span>
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/30 text-gold-2">
                <Plus size={16} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                  <p className="px-6 pb-5 text-[15px] leading-relaxed text-mute">{it.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
