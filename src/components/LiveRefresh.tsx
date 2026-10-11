"use client";

import { useRouter } from "next/navigation";
import { useRealtime } from "./Realtime";

/** Re-renders the current server page when a new message or match arrives. */
export function LiveRefresh() {
  const router = useRouter();
  useRealtime((e) => {
    if (e.type === "message" || e.type === "match" || e.type === "read") router.refresh();
  });
  return null;
}
