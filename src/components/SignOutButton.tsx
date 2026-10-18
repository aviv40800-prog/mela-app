"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

/** Leaves sign-up (or switches account): signs out and goes home. What was filled in so far is kept. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/");
        router.refresh();
      }}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] text-mute transition hover:text-cream ${className}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} יציאה
    </button>
  );
}
