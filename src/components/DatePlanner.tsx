"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ArrowUpLeft, Clock, Coffee, Landmark, Loader2, MapPin, Moon, RefreshCw, Trees, UtensilsCrossed, X } from "lucide-react";
import { api, haptic } from "@/lib/client";
import { DATE_PREFIX } from "@/lib/content";
import type { DateIdea, DateKind, DatePlan } from "@/lib/dates";

const KIND: Record<DateKind, { label: string; Icon: typeof Coffee }> = {
  coffee: { label: "קפה", Icon: Coffee },
  meal: { label: "ארוחה", Icon: UtensilsCrossed },
  outdoor: { label: "בחוץ", Icon: Trees },
  evening: { label: "ערב", Icon: Moon },
  culture: { label: "תרבות", Icon: Landmark },
};

export const proposalText = (i: DateIdea) => `${DATE_PREFIX}\n${i.title}\n${i.place} · ${i.when}`;

const spring = { type: "spring", stiffness: 420, damping: 36 } as const;

/**
 * Three date ideas for this pair — tap one to open it, then propose it straight into the chat.
 * "רעיונות אחרים" fetches a reshuffled set from the server.
 */
export function DatePlanner({
  matchId,
  partnerFirst,
  initial,
  onPropose,
  compact = false,
}: {
  matchId: number;
  partnerFirst: string;
  initial: DatePlan;
  onPropose: (text: string) => Promise<void> | void;
  compact?: boolean;
}) {
  const [plan, setPlan] = useState(initial);
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState<string | null>(compact ? null : initial.ideas[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function more() {
    setLoading(true);
    haptic(6);
    try {
      const next = round + 1;
      const { plan: p } = await api<{ plan: DatePlan }>(`/api/matches/${matchId}/date-ideas?round=${next}`);
      setPlan(p);
      setRound(next);
      setOpen(compact ? null : p.ideas[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function propose(i: DateIdea) {
    setSent(i.id);
    haptic([8, 40, 12]);
    await onPropose(proposalText(i));
  }

  return (
    <div className="glass-gold overflow-hidden rounded-[28px] p-[18px]">
      <div className="pointer-events-none absolute -top-20 -left-16 h-44 w-44 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">תוכנית לדייט · {plan.regionLabel}</div>
          <h3 className="font-display mt-1 text-[1.3rem] leading-tight">לאן לקחת את {partnerFirst}?</h3>
          {plan.meetCity && plan.distanceKm != null && plan.distanceKm > 8 && (
            <p className="mt-1 text-[12px] text-mute">
              <span className="tabular">{plan.distanceKm}</span> ק״מ ביניכם — {plan.meetCity} באמצע הדרך
            </p>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.9, rotate: -90 }}
          onClick={more}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line-2 bg-fg/[0.03] px-3 py-1.5 text-[12px] text-mute transition hover:border-gold/40 hover:text-gold-2"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          רעיונות אחרים
        </motion.button>
      </div>

      <LayoutGroup>
        <motion.ul layout className="relative mt-4 space-y-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {plan.ideas.map((idea, n) => {
              const { Icon, label } = KIND[idea.kind];
              const expanded = open === idea.id;
              return (
                <motion.li
                  layout
                  key={`${round}-${idea.id}`}
                  initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { ...spring, delay: n * 0.06 } }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  className={`overflow-hidden rounded-[20px] border transition-colors ${expanded ? "border-gold/35 bg-ink-3/90" : "border-line bg-fg/[0.02] hover:border-line-2"}`}
                >
                  <motion.button layout="position" onClick={() => setOpen(expanded ? null : idea.id)} className="flex w-full items-center gap-3 p-3 text-right" aria-expanded={expanded}>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] transition-colors ${expanded ? "bg-gradient-to-b from-gold-3 to-gold text-ink" : "bg-gold/[0.08] text-gold-2"}`}>
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">{idea.title}</span>
                      <span className="block truncate text-[12px] text-mute">{idea.reason}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-mute-2">{label}</span>
                  </motion.button>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}>
                        <div className="space-y-3 px-3 pb-3">
                          <p className="text-[13.5px] leading-relaxed text-cream/85">{idea.pitch}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-mute">
                            <span className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-gold-2" /> {idea.place}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock size={13} className="text-gold-2" /> {idea.when}
                            </span>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => propose(idea)}
                            disabled={sent === idea.id}
                            className="btn-gold flex w-full items-center justify-center gap-2 !py-3 text-[14px]"
                          >
                            {sent === idea.id ? "ההצעה נשלחה" : `להציע ל${partnerFirst}`}
                            {sent !== idea.id && <ArrowUpLeft size={16} />}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      </LayoutGroup>
    </div>
  );
}

/** Bottom sheet wrapper for the planner, opened from the chat header. */
export function DatePlannerSheet(props: Parameters<typeof DatePlanner>[0] & { onClose: () => void }) {
  const { onClose, ...rest } = props;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-[6px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 600) && onClose()}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-[34px] border-t border-line-2 bg-ink-2/95 px-4 pt-3 backdrop-blur-2xl safe-bottom"
        role="dialog"
        aria-label="רעיונות לדייט"
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="mx-auto h-1 w-10 rounded-full bg-fg/20" />
        </div>
        <button onClick={onClose} className="absolute top-4 left-5 text-mute transition hover:text-cream" aria-label="סגירה">
          <X size={20} />
        </button>
        <div className="pb-3">
          <DatePlanner {...rest} />
        </div>
      </motion.div>
    </motion.div>
  );
}
