"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The landing hero visual: a glowing geometric heart that pulses at the centre, with threads of light
 * flowing out to the community's profile cards, which float gently around it — the "smart matchmaking"
 * system at work. Pure SVG + CSS animation (no canvas, no JS animation loop); the container is measured
 * once per resize so the threads land exactly on the cards at every screen size.
 *
 * Two layouts: "wide" (desktop background behind the hero text, cards on both sides, heart at the top)
 * and "compact" (phones: a block below the buttons, heart in the middle, a ring of cards).
 */

type Card = { id: string; x: number; y: number; w: number }; // centre x/y in % of the stage, width in design px

// Positions follow the approved concept (1379 × 752): left and right clusters, clear centre column for the text.
const WIDE: Card[] = [
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

// Phones: a ring of twelve around the heart.
const COMPACT: Card[] = [
  { id: "03", x: 11, y: 12, w: 58 },
  { id: "08", x: 33, y: 8, w: 56 },
  { id: "19", x: 67, y: 8, w: 56 },
  { id: "20", x: 89, y: 12, w: 54 },
  { id: "09", x: 9, y: 40, w: 60 },
  { id: "25", x: 91, y: 40, w: 60 },
  { id: "14", x: 9, y: 66, w: 58 },
  { id: "22", x: 91, y: 66, w: 56 },
  { id: "12", x: 11, y: 91, w: 54 },
  { id: "13", x: 33, y: 93, w: 56 },
  { id: "27", x: 67, y: 93, w: 56 },
  { id: "24", x: 89, y: 91, w: 56 },
];

// Natural aspect (h / w) of each cropped photo, so cards keep their proportions.
const ASPECT: Record<string, number> = {
  "01": 1.56, "02": 1.43, "03": 1.42, "04": 1.53, "05": 1.48, "06": 1.62, "07": 2.07, "08": 1.21, "09": 1.32, "11": 1.3, "12": 1.65, "13": 1.48, "14": 1.28, "15": 1.48, "16": 1.47, "17": 1.6, "18": 1.54, "19": 1.36, "20": 1.52, "21": 1.35, "22": 1.78, "23": 1.46, "24": 1.53, "25": 1.36, "26": 1.35, "27": 1.64,
};

const HEART = "M120 212 C48 160 4 116 4 66 C4 30 32 4 66 4 C92 4 110 18 120 38 C130 18 148 4 174 4 C208 4 236 30 236 66 C236 116 192 160 120 212 Z";

// The heart's network: a staggered grid of nodes (clipped to the heart shape) linked to their nearest
// neighbours — a geometric mesh like the concept. Deterministic, computed once.
const NODES: [number, number][] = [];
for (let row = 0, y = 10; y <= 214; row++, y += 19) {
  for (let x = (row % 2) * 11 + 4; x <= 238; x += 22) {
    const jx = Math.sin(x * 12.9898 + y * 78.233) * 3;
    const jy = Math.cos(x * 4.1414 + y * 9.731) * 3;
    NODES.push([x + jx, y + jy]);
  }
}
const LINKS: [number, number][] = [];
NODES.forEach(([x, y], i) => {
  NODES.forEach(([x2, y2], j) => {
    if (j > i && Math.hypot(x2 - x, y2 - y) < 27) LINKS.push([i, j]);
  });
});

export function HeroNetwork({ variant, heartTop, heartSize }: { variant: "wide" | "compact"; heartTop?: number; heartSize?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cards = variant === "wide" ? WIDE : COMPACT;
  const W = size?.w ?? 0;
  const H = size?.h ?? 0;
  // Card sizes scale with the stage (the concept was drawn at 1379px wide); phones use design px as-is.
  const scale = variant === "wide" ? Math.min(1.25, Math.max(0.8, W / 1379)) * 1.12 : Math.min(1.1, Math.max(0.82, W / 390));
  const hs = heartSize ?? (variant === "wide" ? Math.min(330, Math.max(240, W * 0.22)) : Math.min(210, W * 0.5));
  const cx = W / 2;
  const cy = heartTop !== undefined ? heartTop + hs * 0.45 : H / 2;

  // Wide layout: the hero text sits in a centre column below the heart — cards that would cover it move
  // outward, or are left out when there's no room (narrow desktops).
  const textHalf = 300;
  const textTop = (heartTop ?? 0) + hs * 0.95;
  const taken: { l: number; t: number; r: number; b: number }[] = [];
  const placed = cards.flatMap((c, i) => {
    const w = c.w * scale;
    const h = w * (ASPECT[c.id] ?? 1.45);
    let x = (c.x / 100) * W;
    const y = (c.y / 100) * H;
    if (variant === "wide" && y + h / 2 > textTop) {
      const left = x < cx;
      const edge = left ? cx - textHalf : cx + textHalf;
      if (left ? x + w / 2 > edge : x - w / 2 < edge) x = left ? edge - w / 2 - 10 : edge + w / 2 + 10;
      if (x - w / 2 < 6 || x + w / 2 > W - 6) return [];
    }
    // thread: from the heart's edge to the card's inner side, as a soft S-curve
    const toLeft = x < cx;
    const ex = toLeft ? x + w / 2 : x - w / 2;
    const ey = y;
    const sx = cx + (toLeft ? -1 : 1) * hs * 0.36;
    const sy = cy + Math.max(-hs * 0.25, Math.min(hs * 0.25, (ey - cy) * 0.18));
    const d = `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + (ex - sx) * 0.42).toFixed(1)} ${sy.toFixed(1)} ${(sx + (ex - sx) * 0.58).toFixed(1)} ${ey.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    // skip a card that would sit on top of one already placed (only happens when cards were moved aside)
    const box = { l: x - w / 2 - 4, t: y - h / 2 - 4, r: x + w / 2 + 4, b: y + h / 2 + 4 };
    if (taken.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) return [];
    taken.push(box);
    return [{ ...c, i, w, h, x, y, d, ex, ey }];
  });

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
      {size && (
        <>
          {/* glow behind the heart */}
          <div
            className="absolute rounded-full"
            style={{
              left: cx - hs * 1.1,
              top: cy - hs * 1.0,
              width: hs * 2.2,
              height: hs * 2.0,
              background: "radial-gradient(closest-side, rgb(255 196 110 / 0.30), rgb(229 120 60 / 0.10) 55%, transparent 75%)",
            }}
          />

          {/* threads of light */}
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <linearGradient id={`hn-thread-${variant}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffe3a3" />
                <stop offset="100%" stopColor="#f2b75b" />
              </linearGradient>
            </defs>
            <g className="hn-threads">
              {placed.map((p) => (
                <g key={p.id}>
                  <path d={p.d} fill="none" stroke={`url(#hn-thread-${variant})`} strokeWidth="1.1" strokeOpacity="0.45" />
                  <path
                    className="hn-flow"
                    d={p.d}
                    fill="none"
                    stroke="#fff4cf"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeDasharray="2 26"
                    style={{ animationDuration: `${3.2 + (p.i % 5) * 0.55}s`, animationDelay: `${-(p.i * 0.37) % 3}s` }}
                  />
                  <circle cx={p.ex} cy={p.ey} r="2.6" fill="#ffe3a3" className="hn-node" style={{ animationDelay: `${(p.i % 6) * 0.4}s` }} />
                </g>
              ))}
            </g>
          </svg>

          {/* the heart */}
          <svg
            className="hn-heart absolute"
            style={{ left: cx - hs / 2, top: cy - hs * 0.45, width: hs, height: hs * 0.9 }}
            viewBox="0 0 240 216"
            overflow="visible"
          >
            <defs>
              <clipPath id={`hn-clip-${variant}`}>
                <path d={HEART} />
              </clipPath>
              <radialGradient id={`hn-fill-${variant}`} cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#ffcf7a" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#c97a2a" stopOpacity="0.12" />
              </radialGradient>
            </defs>
            <path d={HEART} fill={`url(#hn-fill-${variant})`} />
            <g clipPath={`url(#hn-clip-${variant})`}>
              <path
                d={LINKS.map(([a, b]) => `M${NODES[a][0].toFixed(1)} ${NODES[a][1].toFixed(1)}L${NODES[b][0].toFixed(1)} ${NODES[b][1].toFixed(1)}`).join("")}
                stroke="#ffe7b0"
                strokeWidth="0.8"
                strokeOpacity="0.75"
                fill="none"
              />
              <g fill="#fff7dc">
                {NODES.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i % 4 ? 1.9 : 3} className={i % 3 ? undefined : "hn-dot"} style={i % 3 ? undefined : { animationDelay: `${(i % 7) * 0.3}s` }} />
                ))}
              </g>
            </g>
            <path d={HEART} fill="none" stroke="#ffe9b8" strokeWidth="2.6" />
          </svg>

          {/* floating profile cards */}
          {placed.map((p) => (
            <div
              key={p.id}
              className="hn-card absolute overflow-hidden rounded-[10px] border border-[#f5c46a]/70 bg-[#2a0a10] shadow-[0_0_14px_rgb(245_196_106/0.35),0_8px_20px_rgb(0_0_0/0.45)]"
              style={{
                left: p.x - p.w / 2,
                top: p.y - p.h / 2,
                width: p.w,
                height: p.h,
                animationDuration: `${5 + (p.i % 4) * 0.9}s`,
                animationDelay: `${-(p.i * 0.8) % 5}s`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/landing/people/${p.id}.webp`} alt="" className="h-full w-full object-cover" loading={p.i < 6 ? "eager" : "lazy"} draggable={false} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
