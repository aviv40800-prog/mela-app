"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { haptic } from "@/lib/client";
import type { RealtimeEvent } from "@/lib/types";
import { BottomNav } from "./BottomNav";

type Listener = (e: RealtimeEvent) => void;
const Ctx = createContext<{ on: (l: Listener) => () => void }>({ on: () => () => {} });

export const useRealtime = (listener: Listener) => {
  const { on } = useContext(Ctx);
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => on((e) => ref.current(e)), [on]);
};

/** One EventSource per tab, shared by every screen. Also drives the unread badge and match toasts. */
export function RealtimeShell({
  meId,
  initialUnread,
  profileDot = false,
  premium = false,
  children,
}: {
  meId: number;
  initialUnread: number;
  profileDot?: boolean;
  premium?: boolean;
  children: React.ReactNode;
}) {
  const listeners = useRef(new Set<Listener>());
  const [unread, setUnread] = useState(initialUnread);
  const [toast, setToast] = useState<string | null>(null);
  const path = usePathname();
  const router = useRouter();
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as RealtimeEvent;
      listeners.current.forEach((l) => l(event));
      if (event.type === "message" && event.message.sender_id !== meId && pathRef.current !== `/matches/${event.matchId}`) {
        setUnread((n) => n + 1);
        setToast("הודעה חדשה 💬");
        haptic(15);
      }
      if (event.type === "match") {
        setToast("יש התאמה חדשה");
        router.refresh();
      }
    };
    return () => es.close();
  }, [meId, router]);

  useEffect(() => {
    if (path.startsWith("/matches")) setUnread(0);
  }, [path]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useRef({
    on: (l: Listener) => {
      listeners.current.add(l);
      return () => listeners.current.delete(l);
    },
  }).current;

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ y: -60, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="fixed inset-x-0 z-50 mx-auto w-fit"
            style={{ top: "max(env(safe-area-inset-top), 14px)" }}
            role="status"
          >
            <div className="glow rounded-full border border-gold/30 bg-ink-2/85 px-5 py-2.5 text-sm font-medium text-gold-2 backdrop-blur-xl">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>
      <BottomNav unread={unread} profileDot={profileDot} premium={premium} />
    </Ctx.Provider>
  );
}
