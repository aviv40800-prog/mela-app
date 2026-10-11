"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, X } from "lucide-react";
import { promptQuestion } from "@/lib/content";
import type { Prompt } from "@/lib/types";

/** Bottom sheet for liking a specific prompt with a personal comment (Hinge-style). */
export function CommentSheet({
  name,
  prompt,
  onClose,
  onSend,
}: {
  name: string;
  prompt: Prompt;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass animate-rise mx-auto w-full max-w-md rounded-t-[32px] bg-ink-2/95 p-6 pb-[max(env(safe-area-inset-bottom),24px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-gold/90">{promptQuestion(prompt.question_key)}</div>
            <p className="font-display mt-1.5 text-xl leading-snug">{prompt.answer_text}</p>
          </div>
          <button onClick={onClose} className="text-mute" aria-label="סגירה">
            <X size={20} />
          </button>
        </div>
        <textarea
          ref={ref}
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder={`כתוב/י משהו ל${name.split(" ")[0]}...`}
          className="field mt-5 min-h-24 resize-none"
        />
        <button className="btn-gold mt-4 w-full" disabled={!text.trim()} onClick={() => onSend(text.trim())}>
          <Heart size={18} className="fill-current" /> שליחת לייק עם תגובה
        </button>
      </div>
    </div>
  );
}
