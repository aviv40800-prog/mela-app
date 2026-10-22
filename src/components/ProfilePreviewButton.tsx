"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { ProfileSheet } from "./ProfileSheet";
import type { Candidate } from "@/lib/types";

/** "How others see me" — full-screen preview of the member's own card. */
export function ProfilePreviewButton({ profile }: { profile: Candidate }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost py-3 text-sm">
        <Eye size={16} /> תצוגה מקדימה
      </button>
      <ProfileSheet profile={open ? profile : null} title="כך אחרים רואים אותך" onClose={() => setOpen(false)} />
    </>
  );
}
