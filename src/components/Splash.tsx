"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const HEART = "M120 212 C48 160 4 116 4 66 C4 30 32 4 66 4 C92 4 110 18 120 38 C130 18 148 4 174 4 C208 4 236 30 236 66 C236 116 192 160 120 212 Z";
// Members around the heart: [x, y, radius, has a like badge]
const NODES: [number, number, number, boolean][] = [
  [40, 120, 10, true], [95, 70, 8, false], [170, 95, 9, false], [250, 60, 10, true], [330, 110, 9, false], [360, 200, 8, false],
  [30, 250, 9, false], [365, 300, 10, true], [20, 400, 8, false], [370, 430, 9, false], [45, 520, 10, true], [345, 540, 8, false],
  [90, 610, 9, false], [300, 620, 10, true], [60, 690, 8, false], [335, 690, 9, false],
];
const C = { x: 195, y: 350 };
const thread = ([x, y]: [number, number, number, boolean], i: number) => {
  const k = i % 2 ? 0.22 : -0.22;
  const qx = (C.x + x) / 2 + (y - C.y) * k;
  const qy = (C.y + y) / 2 - (x - C.x) * k;
  return `M${C.x} ${C.y} Q${qx.toFixed(0)} ${qy.toFixed(0)} ${x} ${y}`;
};

const SEEN = "mela:splash-seen";
const SKIP_PREFIXES = ["/admin", "/api", "/suspended"];

/**
 * The animated opening screen: a glowing lattice heart that lights threads out to the members around it,
 * then the gold MELA wordmark. Once per browser session, app screens only (never the marketing page, so it
 * doesn't slow first paint for visitors). Tap anywhere to skip. A tiny inline script in the root layout
 * marks <html data-splash="skip"> before paint when it was already seen, so returning loads never flash it.
 */
export function Splash() {
  const pathname = usePathname();
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const skipRoute = pathname === "/" || SKIP_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (skipRoute || document.documentElement.dataset.splash === "skip") return setGone(true);
    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {}
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-reduce-motion");
    const t1 = setTimeout(() => setLeaving(true), reduce ? 700 : 3000);
    const t2 = setTimeout(() => setGone(true), reduce ? 1000 : 3600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [skipRoute]);

  if (gone || skipRoute) return null;
  return (
    <div
      className={`mela-splash fixed inset-0 z-[200] grid place-items-center overflow-hidden ${leaving ? "splash-leave" : ""}`}
      onClick={() => setLeaving(true)}
      onTransitionEnd={() => leaving && setGone(true)}
      role="presentation"
      style={{ background: "radial-gradient(120% 70% at 50% 42%, #4a0812 0%, #24040a 38%, #120205 72%, #080102 100%)" }}
    >
      <svg viewBox="0 0 390 844" className="h-full max-h-[900px] w-auto max-w-none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="sp-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff5a4e" stopOpacity="0.6" />
            <stop offset="45%" stopColor="#d4182c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#d4182c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sp-node" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ffe3e3" />
            <stop offset="60%" stopColor="#c9707a" />
            <stop offset="100%" stopColor="#5a1420" />
          </radialGradient>
          <linearGradient id="sp-thread" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffb08a" />
            <stop offset="100%" stopColor="#ff2e43" />
          </linearGradient>
          <pattern id="sp-lattice" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0 L0 22 M0 0 L22 0" stroke="#ffd0c4" strokeWidth="1.1" strokeOpacity="0.8" fill="none" />
          </pattern>
          <clipPath id="sp-heartclip">
            <path d={HEART} />
          </clipPath>
        </defs>

        {[0, 1, 2].map((i) => (
          <circle key={i} className="splash-ring" style={{ animationDelay: `${1.1 + i * 0.25}s` }} cx={C.x} cy={C.y} r="150" fill="none" stroke="#ff4d5a" strokeWidth="1.3" />
        ))}
        <circle cx={C.x} cy={C.y} r="215" fill="none" stroke="#ff4d5a" strokeOpacity="0.12" />
        <circle cx={C.x} cy={C.y} r="290" fill="none" stroke="#ff4d5a" strokeOpacity="0.08" />

        <g fill="none" stroke="url(#sp-thread)" strokeWidth="1.1" strokeLinecap="round">
          {NODES.map((n, i) => (
            <path key={i} className="splash-thread" pathLength={1} style={{ animationDelay: `${1.2 + i * 0.04}s` }} d={thread(n, i)} />
          ))}
        </g>
        {NODES.map(([x, y, r, liked], i) => (
          <g key={i} className="splash-node" style={{ animationDelay: `${1.45 + i * 0.04}s` }}>
            <circle cx={x} cy={y} r={r} fill="url(#sp-node)" stroke="#ff6b74" strokeWidth="1.6" />
            {liked && <path transform={`translate(${x + 4} ${y - 8}) scale(.05)`} d={HEART} fill="#ff3b4c" stroke="#fff3ee" strokeWidth="10" />}
          </g>
        ))}

        <circle className="splash-glow" cx={C.x} cy={C.y} r="170" fill="url(#sp-glow)" />
        <g className="splash-heart">
          <g transform="translate(75 248)">
            <path d={HEART} fill="#e5383b" fillOpacity="0.55" />
            <rect width="240" height="216" fill="url(#sp-lattice)" clipPath="url(#sp-heartclip)" />
            <g fill="none" stroke="#ffe0d6" strokeWidth="1.2" strokeOpacity="0.9" clipPath="url(#sp-heartclip)">
              <path d="M120 38 C100 90 100 150 120 212" />
              <path d="M120 38 C140 90 140 150 120 212" />
              <path d="M4 66 C60 80 180 80 236 66" />
              <path d="M14 118 C70 132 170 132 226 118" />
            </g>
            <path className="splash-outline" pathLength={1} d={HEART} fill="none" stroke="#ffd9cf" strokeWidth="2.6" />
          </g>
        </g>
      </svg>

      <div className="absolute inset-x-0 bottom-[11vh] flex flex-col items-center gap-2">
        <div dir="ltr" className="splash-rise font-brand gold-text text-[3.6rem] leading-none font-bold tracking-[0.12em]" style={{ animationDelay: "1.7s" }}>
          MELA
        </div>
        <div className="splash-rise flex items-center gap-2.5" style={{ animationDelay: "1.85s" }} aria-hidden="true">
          <span className="h-px w-16 bg-gradient-to-l from-gilt to-transparent" />
          <svg width="26" height="16" viewBox="0 0 26 16">
            <path d="M2 14C8 12 14 8 24 2M8 11c-1-3 0-6 3-7 0 3-1 5-3 7zM13 8c0-3 2-5 5-5-1 3-2 4-5 5zM8 11c3-1 6 0 7 2-3 1-5 0-7-2z" fill="#f5c46a" stroke="#f5c46a" strokeWidth=".8" strokeLinecap="round" />
          </svg>
          <span className="h-px w-16 bg-gradient-to-r from-gilt to-transparent" />
        </div>
        <div className="splash-rise text-[1.05rem] tracking-[0.2em] text-gold-3" style={{ animationDelay: "2s" }}>
          אהבה עם שורשים
        </div>
      </div>
    </div>
  );
}
