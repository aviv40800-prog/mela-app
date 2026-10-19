"use client";

import { useEffect } from "react";

/** Arrived through a friend's invite link (?ref=…): keep the code until sign-up, so the friend gets the credit. */
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
      if (ref) document.cookie = `mela_ref=${ref}; max-age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
    } catch {}
  }, []);
  return null;
}
