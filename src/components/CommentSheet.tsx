"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Heart, X } from "lucide-react";
import { promptQuestion } from "@/lib/content";
import type { Prompt } from "@/lib/types";

/** Bottom sheet for liking a specific prompt with a personal comment (Hinge-style). Drag down to dismiss. */
export function CommentSheet({ name, prompt, onClose, onSend }: { name: string; prompt: Prompt; onClose: () => void; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-[6px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 500) && onClose()}
        onClick={(e) => e.stopPropagation()}
        className="surface mx-auto w-full max-w-md rounded-t-[34px] px-6 pt-3 safe-bottom"
      >
        <div className="mx-auto mb-5 h-1 w-10 cursor-grab rounded-full bg-fg/20" />
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-2xl border border-line bg-fg/[0.03] p-4">
            <div className="eyebrow">{promptQuestion(prompt.question_key)}</div>
            <p className="font-display mt-1.5 text-lg leading-snug">{prompt.answer_text}</p>
          </div>
          <button onClick={onClose} className="mt-1 text-mute transition hover:text-cream" aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        <div className="field mt-4 !p-0">
          <textarea
            ref={ref}
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder={`כתוב/י משהו ל${name.split(" ")[0]}…`}
            className="min-h-24 w-full resize-none bg-transparent px-4 py-3.5 text-[16px] outline-none placeholder:text-mute-2"
          />
        </div>
        <p className="mt-2 px-1 text-[11.5px] text-mute-2">לייק עם תגובה מקבל פי 2 יותר התאמות 💛</p>
        <button className="btn-gold mt-4 mb-2 w-full" disabled={!text.trim()} onClick={() => onSend(text.trim())}>
          <Heart size={18} className="fill-current" /> שליחת לייק עם תגובה
        </button>
      </motion.div>
    </motion.div>
  );
}
