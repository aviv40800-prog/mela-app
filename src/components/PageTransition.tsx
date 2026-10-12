"use client";

import { motion } from "framer-motion";

/** Enter transition for every route (used from template.tsx files, which re-mount on navigation). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      // Only opacity + translate: both settle to "none", so position:fixed children (sheets, action bars)
      // stay anchored to the viewport once the transition ends.
      initial={{ opacity: 0, y: 14, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ opacity: { duration: 0.35, ease: "easeOut" }, default: { type: "spring", stiffness: 260, damping: 32, mass: 0.9 } }}
    >
      {children}
    </motion.div>
  );
}
