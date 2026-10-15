"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The landing hero visual — MELA's matchmaking at work: a glowing red geometric heart beats at the centre,
 * sending a ripple of light with every beat; threads of light run from it to the community's profile cards,
 * particles flow along them, and every few seconds a bright spark travels out to one member whose card lights
 * up — a new connection being made, all the time. On phones the cards orbit the heart in two slow rings.
 *
 * Pure SVG + CSS animation (no canvas, no animation loop in JS). The stage is measured on resize so the
 * threads land exactly on the cards at every width. Reduced-motion users get a still image.
 */

type Card = { id: string; x: number; y: number; w: number; aspect: number };

const PEOPLE = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27"];

// Desktop — positions follow the approved concept (1379 × 752): two clusters, a clear centre column for the text.
const WIDE: Omit<Card, "aspect">[] = [
  { id: "01", x: 19.0, y: 15, w: 49 },
  { id: "02", x: 29.2, y: 12, w: 52 },
  { id: "03", x: 34.0, y: 22, w: 58 },
  { id: "04", x: 14.4, y: 25, w: 55 },
  { id: "05", x: 25.9, y: 30, w: 48 },
  { id: "06", x: 11.2, y: 37, w: 47 },
  { id: "07", x: 7.5, y: 48, w: 53 },
  { id: "08", x: 21.4, y: 44, w: 71 },
  { id: "09", x: 15.7, y: 56, w: 76 },
  { id: "11", x: 14.4, y: 70, w: 74 },
  { id: "12", x: 6.8, y: 80, w: 62 },
  { id: "13", x: 21.5, y: 84, w: 60 },
  { id: "14", x: 28.6, y: 70, w: 73 },
  { id: "15", x: 66.6, y: 21, w: 60 },
  { id: "16", x: 74.4, y: 11, w: 53 },
  { id: "17", x: 83.0, y: 15, w: 48 },
  { id: "18", x: 74.0, y: 30, w: 54 },
  { id: "19", x: 83.1, y: 33, w: 67 },
  { id: "20", x: 92.2, y: 24, w: 52 },
  { id: "21", x: 75.5, y: 48, w: 60 },
  { id: "22", x: 92.7, y: 47, w: 63 },
  { id: "23", x: 85.9, y: 57, w: 54 },
  { id: "24", x: 79.1, y: 66, w: 66 },
  { id: "25", x: 89.0, y: 73, w: 75 },
  { id: "26", x: 72.7, y: 82, w: 60 },
  { id: "27", x: 82.0, y: 88, w: 63 },
];

const ASPECT: Record<string, number> = {
  "01": 1.56, "02": 1.43, "03": 1.42, "04": 1.53, "05": 1.48, "06": 1.62, "07": 2.07, "08": 1.21, "09": 1.32, "11": 1.3, "12": 1.65, "13": 1.48, "14": 1.28, "15": 1.48, "16": 1.47, "17": 1.6, "18": 1.54, "19": 1.36, "20": 1.52, "21": 1.35, "22": 1.78, "23": 1.46, "24": 1.53, "25": 1.36, "26": 1.35, "27": 1.64,
};

const HEART = "M120 212 C48 160 4 116 4 66 C4 30 32 4 66 4 C92 4 110 18 120 38 C130 18 148 4 174 4 C208 4 236 30 236 66 C236 116 192 160 120 212 Z";

// The heart's network: a staggered grid of nodes (clipped to the heart) linked to their nearest neighbours.
const NODES: [number, number][] = [];
for (let row = 0, y = 10; y <= 214; row++, y += 19) {
  for (let x = (row % 2) * 11 + 4; x <= 238; x += 22) {
    NODES.push([x + Math.sin(x * 12.9898 + y * 78.233) * 3, y + Math.cos(x * 4.1414 + y * 9.731) * 3]);
  }
}
const MESH = (() => {
  let d = "";
  NODES.forEach(([x, y], i) =>
    NODES.forEach(([x2, y2], j) => {
      if (j > i && Math.hypot(x2 - x, y2 - y) < 27) d += `M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }),
  );
  return d;
})();

/** A new "connection" spark goes out every SPARK_GAP seconds, to a different member each time. */
const SPARK_GAP = 0.9;

export function HeroNetwork({ variant, heartTop }: { variant: "wide" | "compact"; heartTop?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = size?.w ?? 0;
  const H = size?.h ?? 0;
  const wide = variant === "wide";
  const hs = wide ? Math.min(330, Math.max(240, W * 0.22)) : Math.min(150, W * 0.38);
  const cx = W / 2;
  const cy = wide ? (heartTop ?? 0) + hs * 0.45 : H / 2;

  // ---- card layout ----
  let cards: Card[];
  if (wide) {
    const scale = Math.min(1.25, Math.max(0.8, W / 1379)) * 1.05;
    cards = WIDE.map((c) => ({ ...c, w: c.w * scale, aspect: ASPECT[c.id] ?? 1.45, x: (c.x / 100) * W, y: (c.y / 100) * H }));
  } else {
    // Phones: two rings of small cards around the heart — enough to read as "a community", too small to single anyone out.
    const R = Math.min(W / 2 - 22, H / 2 - 24);
    const rings = [
      { r: R * 0.6, n: 12, w: 30, off: 0 },
      { r: R, n: 16, w: 36, off: Math.PI / 16 },
    ];
    cards = rings.flatMap((ring, ri) =>
      Array.from({ length: ring.n }, (_, k) => {
        const a = ring.off + (k / ring.n) * Math.PI * 2;
        const id = PEOPLE[(ri * 12 + k * 5) % PEOPLE.length];
        return { id, w: ring.w, aspect: 1.32, x: cx + Math.cos(a) * ring.r, y: cy + Math.sin(a) * ring.r };
      }),
    );
  }

  // Desktop: cards that would cover the text column move outward, or drop out on narrow screens; no card overlaps another.
  const textHalf = 300;
  const textTop = (heartTop ?? 0) + hs * 0.95;
  const taken: { l: number; t: number; r: number; b: number }[] = [];
  const placed = cards.flatMap((c, i) => {
    const h = c.w * c.aspect;
    let x = c.x;
    const y = c.y;
    if (wide && y + h / 2 > textTop) {
      const left = x < cx;
      const edge = left ? cx - textHalf : cx + textHalf;
      if (left ? x + c.w / 2 > edge : x - c.w / 2 < edge) x = left ? edge - c.w / 2 - 10 : edge + c.w / 2 + 10;
      if (x - c.w / 2 < 6 || x + c.w / 2 > W - 6) return [];
    }
    const box = { l: x - c.w / 2 - 3, t: y - h / 2 - 3, r: x + c.w / 2 + 3, b: y + h / 2 + 3 };
    if (wide && taken.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) return [];
    taken.push(box);

    // thread: heart edge → the card's side facing the heart (desktop: soft S-curves; phones: gently bent spokes)
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    let ex: number, ey: number, d: string;
    if (wide) {
      const toLeft = x < cx;
      ex = toLeft ? x + c.w / 2 : x - c.w / 2;
      ey = y;
      const sx = cx + (toLeft ? -1 : 1) * hs * 0.36;
      const sy = cy + Math.max(-hs * 0.25, Math.min(hs * 0.25, (ey - cy) * 0.18));
      d = `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + (ex - sx) * 0.42).toFixed(1)} ${sy.toFixed(1)} ${(sx + (ex - sx) * 0.58).toFixed(1)} ${ey.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    } else {
      const ux = dx / dist;
      const uy = dy / dist;
      const sx = cx + ux * hs * 0.34;
      const sy = cy + uy * hs * 0.3;
      ex = x - ux * (c.w * 0.5);
      ey = y - uy * (h * 0.5);
      // a gentle bend, alternating sides, so the spokes read as woven light rather than a wheel
      const bend = (i % 2 ? 1 : -1) * 14;
      const mx = (sx + ex) / 2 - uy * bend;
      const my = (sy + ey) / 2 + ux * bend;
      d = `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
    return [{ ...c, i, h, x, y, d, ex, ey }];
  });

  const cycle = placed.length * SPARK_GAP; // every member gets a spark once per cycle
  const sparkStyle = (i: number) => ({ animationDuration: `${cycle}s`, animationDelay: `${((i * 7) % placed.length) * SPARK_GAP - cycle}s` });

  const threads = (
    <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={`hn-thread-${variant}`} gradientUnits="userSpaceOnUse" x1={0} y1="0" x2={W} y2="0">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="50%" stopColor="#ffb08a" />
          <stop offset="100%" stopColor="#ff6b6b" />
        </linearGradient>
      </defs>
      <g className="hn-threads">
        {placed.map((p) => (
          <g key={`${p.id}-${p.i}`}>
            <path d={p.d} fill="none" stroke={`url(#hn-thread-${variant})`} strokeWidth={wide ? 1.1 : 0.9} strokeOpacity="0.42" />
            <path
              className="hn-flow"
              d={p.d}
              fill="none"
              stroke="#ffd6cc"
              strokeWidth={wide ? 2 : 1.6}
              strokeLinecap="round"
              strokeDasharray={wide ? "1.5 24" : "1.2 16"}
              style={{ animationDuration: `${3 + (p.i % 5) * 0.5}s`, animationDelay: `${-((p.i * 0.37) % 3)}s` }}
            />
            {/* the "connection" spark: a bright comet from the heart to this member */}
            <path className="hn-spark" d={p.d} pathLength={1} fill="none" stroke="#fff" strokeWidth={wide ? 3 : 2.4} strokeLinecap="round" style={sparkStyle(p.i)} />
            <circle cx={p.ex} cy={p.ey} r={wide ? 2.4 : 1.8} fill="#ffc2b8" />
          </g>
        ))}
      </g>
    </svg>
  );

  const cardEls = placed.map((p) => (
    <div key={`${p.id}-${p.i}`} className={wide ? "absolute" : "hn-counter absolute"} style={{ left: p.x - p.w / 2, top: p.y - p.h / 2, width: p.w, height: p.h }}>
      <div className="hn-card h-full w-full" style={{ animationDuration: `${5 + (p.i % 4) * 0.9}s`, animationDelay: `${-((p.i * 0.8) % 5)}s` }}>
        <div className={`hn-match h-full w-full overflow-hidden border border-[#ff8a8a]/60 bg-[#2a0a10] ${wide ? "rounded-[10px]" : "rounded-[7px]"}`} style={sparkStyle(p.i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/landing/people/${p.id}.webp`} alt="" className="h-full w-full object-cover" loading={p.i < 8 ? "eager" : "lazy"} draggable={false} />
        </div>
      </div>
    </div>
  ));

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
      {size && (
        <>
          {/* warm glow + a ripple of light on every beat */}
          <div
            className="absolute rounded-full"
            style={{
              left: cx - hs * 1.15,
              top: cy - hs * 1.05,
              width: hs * 2.3,
              height: hs * 2.1,
              background: "radial-gradient(closest-side, rgb(255 70 80 / 0.38), rgb(200 20 45 / 0.14) 55%, transparent 78%)",
            }}
          />
          {[0, 1].map((k) => (
            <div
              key={k}
              className="hn-ripple absolute rounded-full border border-[#ff6b74]"
              style={{ left: cx - hs * 0.55, top: cy - hs * 0.55, width: hs * 1.1, height: hs * 1.1, animationDelay: `${k * 0.32}s` }}
            />
          ))}

          {wide ? (
            <>
              {threads}
              {cardEls}
            </>
          ) : (
            // phones: the whole constellation turns slowly around the heart; cards counter-rotate to stay upright
            <div className="hn-orbit absolute inset-0" style={{ transformOrigin: `${cx}px ${cy}px` }}>
              {threads}
              {cardEls}
            </div>
          )}

          {/* the heart */}
          <svg className="hn-heart absolute" style={{ left: cx - hs / 2, top: cy - hs * 0.45, width: hs, height: hs * 0.9 }} viewBox="0 0 240 216" overflow="visible">
            <defs>
              <clipPath id={`hn-clip-${variant}`}>
                <path d={HEART} />
              </clipPath>
              <radialGradient id={`hn-fill-${variant}`} cx="50%" cy="42%" r="62%">
                <stop offset="0%" stopColor="#ff6a5c" stopOpacity="0.95" />
                <stop offset="60%" stopColor="#e5283b" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#8f0d22" stopOpacity="0.7" />
              </radialGradient>
            </defs>
            <path d={HEART} fill={`url(#hn-fill-${variant})`} />
            <g clipPath={`url(#hn-clip-${variant})`}>
              <path d={MESH} stroke="#ffd6cc" strokeWidth="0.8" strokeOpacity="0.7" fill="none" />
              <g fill="#fff1ec">
                {NODES.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i % 4 ? 1.8 : 2.9} className={i % 3 ? undefined : "hn-dot"} style={i % 3 ? undefined : { animationDelay: `${(i % 7) * 0.3}s` }} />
                ))}
              </g>
            </g>
            <path d={HEART} fill="none" stroke="#ffd9cf" strokeWidth="2.6" />
          </svg>
        </>
      )}
    </div>
  );
}
