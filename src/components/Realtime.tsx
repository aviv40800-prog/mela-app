"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
export function RealtimeShell({ meId, initialUnread, children }: { meId: number; initialUnread: number; children: React.ReactNode }) {
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
      }
      if (event.type === "match") {
        setToast("יש התאמה חדשה! ✨");
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
      {toast && (
        <div className="fixed inset-x-0 top-4 z-50 mx-auto w-fit animate-pop">
          <div className="glass glow rounded-full px-5 py-2.5 text-sm font-medium text-gold-2">{toast}</div>
        </div>
      )}
      <BottomNav unread={unread} />
    </Ctx.Provider>
  );
}
