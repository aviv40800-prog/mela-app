"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Mobile-only floating "join" button. It appears once the hero is scrolled past and steps aside whenever
 * one of the page's own CTAs (marked `data-cta`) is on screen, so two gold buttons never stack.
 */
export function StickyCta() {
  const [scrolled, setScrolled] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setCtaVisible(visible.size > 0);
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    document.querySelectorAll("[data-cta]").forEach((el) => io.observe(el));
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  const show = scrolled && !ctaVisible;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 110, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 110, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink via-ink/95 to-transparent px-5 pt-8 safe-bottom md:hidden"
        >
          <Link href="/signup" className="btn-gold w-full text-[17px]">
            הצטרפות חינם
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
