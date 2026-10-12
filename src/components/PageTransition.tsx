"use client";

import { motion } from "framer-motion";

/** Enter transition for every route (used from template.tsx files, which re-mount on navigation). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      // Only opacity + translate: both settle to "none", so position:fixed children (sheets, action bars)
      // stay anchored to the viewport once the transition ends.
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
