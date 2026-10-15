"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The landing hero visual — MELA's matchmaking at work.
 *
 * - A sculpted, glowing wine-red heart beats at the centre: layered gradients, inner shadows and a specular
 *   highlight give it volume, and on desktop it tilts gently toward the pointer.
 * - The community floats around it in three depths: large sharp cards up front, medium cards, and tiny blurred
 *   ones far behind. Each depth drifts at its own speed (parallax), so the scene reads as real 3D space.
 * - Threads of light run from the heart to everyone; sparks travel out to one member after another.
 * - Every few seconds a live match happens: two members (one from each side) lean in and grow, a bright thread
 *   draws from each of them into the heart, they meet in a small burst of light — then they settle back and a
 *   new pair is chosen.
 *
 * SVG + CSS animations; one light requestAnimationFrame loop drives the parallax (desktop only, paused when the
 * hero is off-screen). On phones the cards orbit the heart instead. Reduced-motion users get a still image.
 */

type Depth = 0 | 1 | 2; // 0 = far background · 1 = middle · 2 = up front
type Card = { id: string; x: number; y: number; w: number; aspect: number; z: Depth; ring?: number; k?: number };
type Placed = Card & { i: number; h: number; d: string };
type Pair = { a: number; b: number; n: number };

const photo = (id: string) => `/landing/people/${id}.webp`;

const PEOPLE = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27"];

/** How each depth looks and moves. `parallax` is the drift in px at full pointer travel. */
const DEPTH = {
  0: { scale: 0.62, blur: 1.5, opacity: 0.5, parallax: 7, thread: 0.14, float: 9 },
  1: { scale: 1, blur: 0, opacity: 0.94, parallax: 16, thread: 0.32, float: 6 },
  2: { scale: 1.22, blur: 0, opacity: 1, parallax: 30, thread: 0.46, float: 5 },
} as const;

// Desktop — positions follow the approved concept (1379 × 752): two clusters, a clear centre column for the text.
const WIDE: Omit<Card, "aspect">[] = [
  { id: "01", x: 19.0, y: 15, w: 49, z: 1 },
  { id: "02", x: 29.2, y: 12, w: 52, z: 1 },
  { id: "03", x: 34.0, y: 22, w: 58, z: 1 },
  { id: "04", x: 14.4, y: 25, w: 55, z: 1 },
  { id: "05", x: 25.9, y: 30, w: 48, z: 1 },
  { id: "06", x: 11.2, y: 37, w: 47, z: 1 },
  { id: "07", x: 6.5, y: 48, w: 53, z: 1 },
  { id: "08", x: 21.4, y: 44, w: 71, z: 2 },
  { id: "09", x: 14.7, y: 58, w: 76, z: 2 },
  { id: "11", x: 13.4, y: 74, w: 66, z: 1 },
  { id: "12", x: 5.8, y: 84, w: 58, z: 1 },
  { id: "13", x: 21.5, y: 86, w: 56, z: 1 },
  { id: "14", x: 27.6, y: 69, w: 73, z: 2 },
  { id: "15", x: 66.6, y: 21, w: 60, z: 1 },
  { id: "16", x: 74.4, y: 11, w: 53, z: 1 },
  { id: "17", x: 83.0, y: 15, w: 48, z: 1 },
  { id: "18", x: 74.0, y: 30, w: 54, z: 1 },
  { id: "19", x: 83.6, y: 35, w: 67, z: 2 },
  { id: "20", x: 93.2, y: 23, w: 52, z: 1 },
  { id: "21", x: 74.5, y: 48, w: 60, z: 1 },
  { id: "22", x: 93.7, y: 48, w: 63, z: 1 },
  { id: "23", x: 86.4, y: 58, w: 54, z: 1 },
  { id: "24", x: 78.1, y: 68, w: 66, z: 2 },
  { id: "25", x: 90.0, y: 76, w: 66, z: 1 },
  { id: "26", x: 72.7, y: 84, w: 58, z: 1 },
  { id: "27", x: 82.0, y: 90, w: 60, z: 1 },
  // the far background — tiny, soft, filling the gaps
  { id: "16", x: 3.6, y: 24, w: 46, z: 0 },
  { id: "21", x: 9.0, y: 7, w: 44, z: 0 },
  { id: "05", x: 24.6, y: 3, w: 42, z: 0 },
  { id: "27", x: 33.5, y: 38, w: 44, z: 0 },
  { id: "02", x: 3.4, y: 64, w: 46, z: 0 },
  { id: "15", x: 29.0, y: 52, w: 42, z: 0 },
  { id: "24", x: 8.6, y: 95, w: 44, z: 0 },
  { id: "04", x: 96.6, y: 9, w: 46, z: 0 },
  { id: "12", x: 66.2, y: 6, w: 44, z: 0 },
  { id: "06", x: 67.5, y: 38, w: 44, z: 0 },
  { id: "13", x: 97.2, y: 35, w: 42, z: 0 },
  { id: "03", x: 71.0, y: 58, w: 44, z: 0 },
  { id: "09", x: 97.0, y: 63, w: 46, z: 0 },
  { id: "01", x: 93.0, y: 94, w: 44, z: 0 },
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

/** A "connection" spark goes out every SPARK_GAP seconds, to a different member each time. */
const SPARK_GAP = 1.3;
/** A live match: how long one lasts, and how often a new pair is chosen (ms). Keep PAIR_MS in sync with hn-m* in globals.css. */
const PAIR_MS = 3200;
const PAIR_EVERY = 4600;
/** How much a matched pair grows. */
const PAIR_SCALE = 1.16;

const f = (n: number) => n.toFixed(1);

export function HeroNetwork({ variant, heartTop }: { variant: "wide" | "compact"; heartTop?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pair, setPair] = useState<Pair | null>(null);
  const wide = variant === "wide";

  // refs the parallax loop writes to directly (no re-renders)
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const tilt = useRef<HTMLDivElement>(null);
  const spec = useRef<SVGGElement>(null);
  const halfA = useRef<SVGGElement>(null);
  const halfB = useRef<SVGGElement>(null);
  const flash = useRef<SVGGElement>(null);
  const geom = useRef<{ a: [number, number, Depth]; b: [number, number, Depth]; c: [number, number] } | null>(null);
  const pool = useRef<{ left: number[]; right: number[]; outer: Placed[] }>({ left: [], right: [], outer: [] });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = size !== null;
  const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- live matches: pick a pair, hold it, release it, repeat (only while the hero is on screen) ----
  useEffect(() => {
    const el = ref.current;
    if (!ready || !el || calm()) return;
    let visible = true;
    let n = 0;
    let last = "";
    let release: ReturnType<typeof setTimeout> | undefined;
    const pick = () => {
      if (!visible || document.hidden) return;
      const { left, right, outer } = pool.current;
      let a: number | undefined, b: number | undefined;
      for (let tries = 0; tries < 6; tries++) {
        if (wide) {
          a = left[Math.floor(Math.random() * left.length)];
          b = right[Math.floor(Math.random() * right.length)];
        } else if (outer.length) {
          const p = outer[Math.floor(Math.random() * outer.length)];
          const opp = outer.find((o) => o.k === ((p.k ?? 0) + Math.floor(outer.length / 2)) % outer.length);
          a = p.i;
          b = opp?.i;
        }
        if (a !== undefined && b !== undefined && `${a}-${b}` !== last) break;
      }
      if (a === undefined || b === undefined) return;
      last = `${a}-${b}`;
      setPair({ a, b, n: ++n });
      release = setTimeout(() => setPair(null), PAIR_MS);
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const first = setTimeout(pick, 1400);
    const every = setInterval(pick, PAIR_EVERY);
    return () => {
      io.disconnect();
      clearTimeout(first);
      clearTimeout(release);
      clearInterval(every);
    };
  }, [ready, wide]);

  // ---- desktop parallax: the depths drift with the pointer (and a slow idle sway); the heart tilts toward it ----
  useEffect(() => {
    const el = ref.current;
    if (!ready || !wide || !el || calm()) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, visible = true;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const gx = tx + Math.sin(t / 4200) * 0.35;
      const gy = ty * 0.7 + Math.cos(t / 5300) * 0.3;
      x += (gx - x) * 0.05;
      y += (gy - y) * 0.05;
      const off = (z: Depth): [number, number] => [-x * DEPTH[z].parallax, -y * DEPTH[z].parallax * 0.6];
      ([0, 1, 2] as Depth[]).forEach((z) => {
        const [ox, oy] = off(z);
        const l = layers.current[z];
        if (l) l.style.transform = `translate3d(${f(ox)}px,${f(oy)}px,0)`;
      });
      const [hx, hy] = off(1).map((v) => v * 0.5);
      if (tilt.current) tilt.current.style.transform = `translate3d(${f(hx)}px,${f(hy)}px,0) rotateY(${f(x * 9)}deg) rotateX(${f(-y * 7)}deg)`;
      if (spec.current) spec.current.setAttribute("transform", `translate(${f(x * 7)} ${f(y * 6)})`);
      const g = geom.current;
      if (g) {
        const c: [number, number] = [g.c[0] + hx, g.c[1] + hy];
        const half = (p: [number, number, Depth]) => {
          const [ox, oy] = off(p[2]);
          return widePath(p[0] + ox, p[1] + oy, c[0], c[1]);
        };
        halfA.current?.querySelectorAll("path").forEach((p) => p.setAttribute("d", half(g.a)));
        halfB.current?.querySelectorAll("path").forEach((p) => p.setAttribute("d", half(g.b)));
        flash.current?.setAttribute("transform", `translate(${f(c[0])} ${f(c[1])})`);
      }
    };
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [ready, wide]);

  const W = size?.w ?? 0;
  const H = size?.h ?? 0;
  const hs = wide ? Math.min(330, Math.max(240, W * 0.22)) : Math.min(150, W * 0.38);
  const cx = W / 2;
  const cy = wide ? (heartTop ?? 0) + hs * 0.45 : H / 2;

  // ---- card layout ----
  let cards: Card[];
  if (wide) {
    const scale = Math.min(1.25, Math.max(0.8, W / 1379)) * 1.05;
    cards = WIDE.map((c) => ({ ...c, w: c.w * scale * DEPTH[c.z].scale, aspect: ASPECT[c.id] ?? 1.45, x: (c.x / 100) * W, y: (c.y / 100) * H }));
    // the front row claims its space first, the far background fills what is left
    cards.sort((a, b) => b.z - a.z);
  } else {
    // Phones: rings of small cards around the heart, at three depths — a community, too small to single anyone out.
    const R = Math.min(W / 2 - 20, H / 2 - 22);
    const rings: { r: number; n: number; off: number; z: (k: number) => Depth; w: Record<Depth, number> }[] = [
      { r: R * 0.56, n: 10, off: 0, z: (k) => (k % 2 ? 0 : 1), w: { 0: 21, 1: 28, 2: 28 } },
      { r: R * 0.76, n: 12, off: Math.PI / 12, z: () => 0, w: { 0: 17, 1: 17, 2: 17 } },
      { r: R, n: 14, off: Math.PI / 14, z: (k) => (k % 2 ? 1 : 2), w: { 0: 30, 1: 31, 2: 40 } },
    ];
    let p = 0;
    cards = rings.flatMap((ring, ri) =>
      Array.from({ length: ring.n }, (_, k) => {
        const a = ring.off + (k / ring.n) * Math.PI * 2;
        const z = ring.z(k);
        const id = PEOPLE[(p++ * 7) % PEOPLE.length];
        return { id, z, ring: ri, k, w: ring.w[z], aspect: 1.32, x: cx + Math.cos(a) * ring.r, y: cy + Math.sin(a) * ring.r };
      }),
    );
  }

  // Desktop: cards that would cover the text column move outward, or drop out on narrow screens; no card overlaps another.
  const textHalf = 300;
  const textTop = (heartTop ?? 0) + hs * 0.95;
  const taken: { l: number; t: number; r: number; b: number; z: Depth }[] = [];
  const placed: Placed[] = cards.flatMap((c, i) => {
    const h = c.w * c.aspect;
    let x = c.x;
    const y = c.y;
    if (wide && y + h / 2 > textTop) {
      const left = x < cx;
      const edge = left ? cx - textHalf : cx + textHalf;
      if (left ? x + c.w / 2 > edge : x - c.w / 2 < edge) x = left ? edge - c.w / 2 - 10 : edge + c.w / 2 + 10;
      if (x - c.w / 2 < 6 || x + c.w / 2 > W - 6) return [];
    }
    if (wide) {
      const box = { l: x - c.w / 2 - 3, t: y - h / 2 - 3, r: x + c.w / 2 + 3, b: y + h / 2 + 3, z: c.z };
      const hit = (o: (typeof taken)[number]) =>
        // the far background may tuck behind others, as long as most of it stays visible
        c.z === 0 && o.z !== 0 ? x > o.l && x < o.r && y > o.t && y < o.b : box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t;
      if (taken.some(hit)) return [];
      // keep the heart itself clear
      if (Math.abs(x - cx) < hs * 0.6 + c.w / 2 && y - h / 2 < cy + hs * 0.5) return [];
      taken.push(box);
    }

    // thread: heart → the card's side facing the heart (desktop: soft S-curves; phones: gently bent spokes)
    let d: string;
    if (wide) {
      const toLeft = x < cx;
      const ex = toLeft ? x + c.w / 2 : x - c.w / 2;
      const sx = cx + (toLeft ? -1 : 1) * hs * 0.36;
      const sy = cy + Math.max(-hs * 0.25, Math.min(hs * 0.25, (y - cy) * 0.18));
      d = `M${f(sx)} ${f(sy)} C${f(sx + (ex - sx) * 0.42)} ${f(sy)} ${f(sx + (ex - sx) * 0.58)} ${f(y)} ${f(ex)} ${f(y)}`;
    } else {
      const dist = Math.hypot(x - cx, y - cy) || 1;
      const ux = (x - cx) / dist;
      const uy = (y - cy) / dist;
      const sx = cx + ux * hs * 0.34;
      const sy = cy + uy * hs * 0.3;
      const ex = x - ux * (c.w * 0.5);
      const ey = y - uy * (h * 0.5);
      const bend = (i % 2 ? 1 : -1) * 14; // alternating bends: woven light, not a wheel
      d = `M${f(sx)} ${f(sy)} Q${f((sx + ex) / 2 - uy * bend)} ${f((sy + ey) / 2 + ux * bend)} ${f(ex)} ${f(ey)}`;
    }
    return [{ ...c, i, h, x, y, d }];
  });

  // live-match candidates: never the blurred background, and on desktop only members beside the heart, so the
  // threads of light never cross the headline
  const matchable = placed.filter((p) => p.z > 0 && (!wide || p.y < textTop + 40));
  pool.current = {
    left: matchable.filter((p) => p.x < cx).map((p) => p.i),
    right: matchable.filter((p) => p.x > cx).map((p) => p.i),
    outer: placed.filter((p) => p.ring === 2),
  };

  // where a matched card moves to: a little closer to its partner, through the heart
  const pairMove = (p: Placed): [number, number] => {
    if (wide) return [(p.x < cx ? 1 : -1) * Math.min(34, Math.abs(p.x - cx) * 0.08), (cy - p.y) * 0.06];
    const dist = Math.hypot(p.x - cx, p.y - cy) || 1;
    return [((cx - p.x) / dist) * 16, ((cy - p.y) / dist) * 16];
  };
  const byIndex = (i: number) => placed.find((p) => p.i === i);
  const pa = pair ? byIndex(pair.a) : undefined;
  const pb = pair ? byIndex(pair.b) : undefined;
  const meet: [number, number] = [cx, wide ? cy + hs * 0.06 : cy];
  // the point on each matched card where its thread of light starts (the side facing the heart, after it moves)
  const anchor = (p: Placed): [number, number, Depth] => {
    const [mx, my] = pairMove(p);
    const x = p.x + mx;
    const y = p.y + my;
    if (wide) return [x + (p.x < cx ? 1 : -1) * (p.w * PAIR_SCALE) / 2, y, p.z];
    const dist = Math.hypot(x - cx, y - cy) || 1;
    return [x - ((x - cx) / dist) * (p.w * PAIR_SCALE) / 2, y - ((y - cy) / dist) * (p.h * PAIR_SCALE) / 2, p.z];
  };
  geom.current = pa && pb ? { a: anchor(pa), b: anchor(pb), c: meet } : null;

  const sparkable = placed.filter((p) => p.z > 0);
  const cycle = sparkable.length * SPARK_GAP; // every member gets a spark once per cycle
  const sparkStyle = (p: Placed) => {
    const j = sparkable.indexOf(p);
    return { animationDuration: `${cycle}s`, animationDelay: `${((j * 7) % sparkable.length) * SPARK_GAP - cycle}s` };
  };

  const threads = (list: Placed[], key: string) => (
    <svg className="hn-threads" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={`hn-thread-${variant}-${key}`} gradientUnits="userSpaceOnUse" x1={0} y1="0" x2={W} y2="0">
          <stop offset="0%" stopColor="#8a1630" />
          <stop offset="50%" stopColor="#ff7d8c" />
          <stop offset="100%" stopColor="#8a1630" />
        </linearGradient>
      </defs>
      {list.map((p) => (
        <g key={p.i} opacity={DEPTH[p.z].thread / DEPTH[1].thread}>
          <path d={p.d} fill="none" stroke={`url(#hn-thread-${variant}-${key})`} strokeWidth={(wide ? 1.1 : 0.9) * (p.z === 2 ? 1.3 : 1)} strokeOpacity={DEPTH[1].thread * 1.3} />
          {p.z > 0 && (
            <>
              <path
                className="hn-flow"
                d={p.d}
                fill="none"
                stroke="#ffb3bd"
                strokeWidth={wide ? 2 : 1.5}
                strokeLinecap="round"
                strokeDasharray={wide ? "1.5 24" : "1.2 16"}
                style={{ animationDuration: `${3 + (p.i % 5) * 0.5}s`, animationDelay: `${-((p.i * 0.37) % 3)}s` }}
              />
              <path className="hn-spark" d={p.d} pathLength={1} fill="none" stroke="#fff3f4" strokeWidth={wide ? 3 : 2.4} strokeLinecap="round" style={sparkStyle(p)} />
            </>
          )}
        </g>
      ))}
    </svg>
  );

  const cardEl = (p: Placed) => {
    const dz = DEPTH[p.z];
    const paired = pair && (pair.a === p.i || pair.b === p.i);
    const [mx, my] = paired ? pairMove(p) : [0, 0];
    const radius = (wide ? [6, 10, 12] : [4, 6, 7])[p.z];
    return (
      <div
        key={p.i}
        className={paired ? "hn-slot is-paired" : "hn-slot"}
        style={{
          position: "absolute",
          left: p.x - p.w / 2,
          top: p.y - p.h / 2,
          width: p.w,
          height: p.h,
          zIndex: paired ? 3 : p.z,
          transform: paired ? `translate(${f(mx)}px, ${f(my)}px) scale(${PAIR_SCALE})` : undefined,
        }}
      >
        <div className={wide ? undefined : "hn-counter"} style={{ width: "100%", height: "100%" }}>
          <div className="hn-card" style={{ width: "100%", height: "100%", animationDuration: `${dz.float + (p.i % 4) * 0.9}s`, animationDelay: `${-((p.i * 0.8) % 5)}s` }}>
            <div
              className={`hn-face hn-z${p.z}${p.z > 0 ? " hn-match" : ""}`}
              style={{ borderRadius: radius, opacity: dz.opacity, filter: dz.blur ? `blur(${dz.blur}px)` : undefined, ...(p.z > 0 ? sparkStyle(p) : {}) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo(p.id)} alt="" loading={p.z > 0 && p.i < 12 ? "eager" : "lazy"} draggable={false} />
            </div>
            <span className="hn-pairglow" style={{ borderRadius: radius + 2 }} />
          </div>
        </div>
      </div>
    );
  };

  const layer = (z: Depth) => {
    const list = placed.filter((p) => p.z === z);
    return (
      <div
        ref={(el) => {
          layers.current[z] = el;
        }}
        className={z === 0 ? "hn-layer hn-far" : "hn-layer"}
        style={{ position: "absolute", inset: 0, zIndex: z === 2 ? 3 : undefined }}
      >
        {threads(list, String(z))}
        {list.map(cardEl)}
      </div>
    );
  };

  // the live match: a bright thread from each member into the heart, meeting in a burst of light
  const halfPath = (p: [number, number, Depth]) => (wide ? widePath(p[0], p[1], meet[0], meet[1]) : spokePath(p[0], p[1], meet[0], meet[1]));
  const match = (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 4 }} viewBox={`0 0 ${W} ${H}`}>
      {pair && geom.current && (
        <g key={pair.n}>
          {[geom.current.a, geom.current.b].map((p, k) => (
            <g key={k} ref={k ? halfB : halfA}>
              <path className="hn-mline hn-mglow" d={halfPath(p)} pathLength={1} fill="none" stroke="#ff2d55" strokeWidth={wide ? 7 : 5} strokeLinecap="round" />
              <path className="hn-mline" d={halfPath(p)} pathLength={1} fill="none" stroke="#ffe3e8" strokeWidth={wide ? 1.8 : 1.4} strokeLinecap="round" />
              <path className="hn-mhead" d={halfPath(p)} pathLength={1} fill="none" stroke="#fff" strokeWidth={wide ? 4.5 : 3.4} strokeLinecap="round" />
            </g>
          ))}
          <g ref={flash} transform={`translate(${f(meet[0])} ${f(meet[1])})`}>
            <circle className="hn-mring" r={hs * 0.16} fill="none" stroke="#ffd1d9" strokeWidth={2} />
            <g className="hn-mheart">
              <path d={HEART} transform={`scale(${(hs * 0.15) / 240}) translate(-120 -108)`} fill="#fff1f3" />
            </g>
          </g>
        </g>
      )}
    </svg>
  );

  const heart = (
    <div
      ref={tilt}
      style={{ position: "absolute", left: cx - hs / 2, top: cy - hs * 0.45, width: hs, height: hs * 0.9, zIndex: 2, transformStyle: "preserve-3d" }}
    >
      <svg className="hn-heart" style={{ width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 240 216">
        <defs>
          <clipPath id={`hn-clip-${variant}`}>
            <path d={HEART} />
          </clipPath>
          {/* body: lit from the upper left, falling into deep wine at the far edge */}
          <radialGradient id={`hn-body-${variant}`} cx="36%" cy="28%" r="88%" fx="32%" fy="22%">
            <stop offset="0%" stopColor="#ff7b88" />
            <stop offset="18%" stopColor="#f0344f" />
            <stop offset="46%" stopColor="#bb1238" />
            <stop offset="76%" stopColor="#760a23" />
            <stop offset="100%" stopColor="#3f0312" />
          </radialGradient>
          {/* inner shadows: a deep one along the lower right, a warm rim light along the upper left */}
          <filter id={`hn-depth-${variant}`} x="-25%" y="-25%" width="150%" height="150%">
            <feFlood floodColor="#24010b" floodOpacity="0.95" />
            <feComposite in2="SourceAlpha" operator="out" />
            <feGaussianBlur stdDeviation="13" />
            <feOffset dx="-11" dy="-15" />
            <feComposite in2="SourceAlpha" operator="in" result="dark" />
            <feFlood floodColor="#ffc2ca" floodOpacity="0.9" />
            <feComposite in2="SourceAlpha" operator="out" />
            <feGaussianBlur stdDeviation="3.5" />
            <feOffset dx="3" dy="4" />
            <feComposite in2="SourceAlpha" operator="in" result="rim" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="dark" />
              <feMergeNode in="rim" />
            </feMerge>
          </filter>
          {/* the network shows on the lit side and sinks into the shadow */}
          <radialGradient id={`hn-meshfade-${variant}`} cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.08" />
          </radialGradient>
          <mask id={`hn-meshmask-${variant}`}>
            <rect width="240" height="216" fill={`url(#hn-meshfade-${variant})`} />
          </mask>
          <radialGradient id={`hn-spec-${variant}`}>
            <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#ffd6dc" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffd6dc" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`hn-rim-${variant}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffc9d0" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#ff8b9a" stopOpacity="0.1" />
            <stop offset="80%" stopColor="#ff5c74" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ff8b9a" stopOpacity="0.9" />
          </linearGradient>
          <filter id={`hn-soft-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        <path d={HEART} fill={`url(#hn-body-${variant})`} filter={`url(#hn-depth-${variant})`} />
        <g clipPath={`url(#hn-clip-${variant})`}>
          <g mask={`url(#hn-meshmask-${variant})`}>
            <path d={MESH} stroke="#ffd0d7" strokeWidth="0.75" strokeOpacity="0.6" fill="none" />
            <g fill="#fff0f2">
              {NODES.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i % 4 ? 1.6 : 2.6} className={i % 3 ? undefined : "hn-dot"} style={i % 3 ? undefined : { animationDelay: `${(i % 7) * 0.3}s` }} />
              ))}
            </g>
          </g>
          {/* specular highlights — they slide a little as the heart tilts */}
          <g ref={spec} className="hn-spec">
            <ellipse cx="74" cy="52" rx="46" ry="26" transform="rotate(-30 74 52)" fill={`url(#hn-spec-${variant})`} />
            <ellipse cx="64" cy="42" rx="13" ry="6" transform="rotate(-32 64 42)" fill="#fff" opacity="0.8" filter={`url(#hn-soft-${variant})`} />
            <ellipse cx="180" cy="40" rx="26" ry="12" transform="rotate(24 180 40)" fill={`url(#hn-spec-${variant})`} opacity="0.5" />
          </g>
        </g>
        <path d={HEART} fill="none" stroke={`url(#hn-rim-${variant})`} strokeWidth="2.4" />
      </svg>
    </div>
  );

  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, pointerEvents: "none", userSelect: "none", perspective: 900 }} aria-hidden="true">
      {size && (
        <>
          {/* a wine-red bloom behind the heart, and a ripple of light on every beat */}
          <div
            className="hn-bloom"
            style={{
              position: "absolute",
              borderRadius: "50%",
              left: cx - hs * 1.15,
              top: cy - hs * 1.05,
              width: hs * 2.3,
              height: hs * 2.1,
              background: "radial-gradient(closest-side, rgb(214 30 64 / 0.42), rgb(130 12 36 / 0.18) 55%, transparent 78%)",
            }}
          />
          {[0, 1].map((k) => (
            <div
              key={k}
              className="hn-ripple"
              style={{ position: "absolute", borderRadius: "50%", left: cx - hs * 0.55, top: cy - hs * 0.55, width: hs * 1.1, height: hs * 1.1, animationDelay: `${k * 0.32}s` }}
            />
          ))}

          {wide ? (
            <>
              {layer(0)}
              {layer(1)}
              {heart}
              {layer(2)}
              {match}
            </>
          ) : (
            // phones: the whole constellation turns slowly around the heart; cards counter-rotate to stay upright
            <>
              <div className="hn-orbit" style={{ position: "absolute", inset: 0, transformOrigin: `${cx}px ${cy}px` }}>
                {threads(placed, "all")}
                {[...placed].sort((a, b) => a.z - b.z).map(cardEl)}
              </div>
              {heart}
              <div className="hn-orbit" style={{ position: "absolute", inset: 0, zIndex: 4, transformOrigin: `${cx}px ${cy}px` }}>
                {match}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Desktop thread from a card's edge into the heart: leaves the card level, then curves in. */
function widePath(ex: number, ey: number, cx: number, cy: number) {
  return `M${f(ex)} ${f(ey)} C${f(ex + (cx - ex) * 0.55)} ${f(ey)} ${f(cx - (cx - ex) * 0.18)} ${f(cy)} ${f(cx)} ${f(cy)}`;
}

/** Phone thread from a card into the heart: a gently bent spoke. */
function spokePath(ex: number, ey: number, cx: number, cy: number) {
  const dx = cx - ex;
  const dy = cy - ey;
  const len = Math.hypot(dx, dy) || 1;
  return `M${f(ex)} ${f(ey)} Q${f(ex + dx / 2 + (dy / len) * 12)} ${f(ey + dy / 2 - (dx / len) * 12)} ${f(cx)} ${f(cy)}`;
}
