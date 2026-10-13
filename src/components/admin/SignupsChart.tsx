"use client";

import { useState } from "react";

/**
 * Daily real signups — one series, so no legend (the card title names it). Thin gold columns with a
 * 4px rounded data-end, hairline grid, hover tooltip per day, and a visually-hidden table for screen readers.
 * Time runs left→right (oldest first) even in the RTL page, matching how Hebrew readers read charts.
 */
export function SignupsChart({ data }: { data: { day: string; n: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { top: 16, right: 8, bottom: 26, left: 30 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(4, ...data.map((d) => d.n));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const band = innerW / data.length;
  const barW = Math.min(24, band - 6);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const label = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
  const total = data.reduce((a, d) => a + d.n, 0);
  const lastIdx = data.length - 1;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: "ltr" }} role="img" aria-label={`הרשמות ב־${data.length} הימים האחרונים: ${total}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="rgba(70,42,24,0.07)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t) + 3.5} textAnchor="end" className="fill-mute-2 text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          const h = Math.max(0, y(0) - y(d.n));
          const r = Math.min(4, h);
          const x = cx - barW / 2;
          const yy = y(d.n);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hit target: the whole band, taller than the mark */}
              <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="transparent" />
              {hover === i && <rect x={pad.left + band * i + 2} y={pad.top} width={band - 4} height={innerH} rx={6} fill="rgba(70,42,24,0.035)" />}
              {d.n > 0 && (
                <path
                  d={`M${x},${y(0)} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + barW - r} Q${x + barW},${yy} ${x + barW},${yy + r} V${y(0)} Z`}
                  fill="#c9a24a"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i === 0 || i === lastIdx || i % 3 === lastIdx % 3) && (
                <text x={cx} y={H - 8} textAnchor="middle" className="fill-mute-2 text-[10px]">
                  {label(d.day)}
                </text>
              )}
              {i === lastIdx && d.n > 0 && (
                <text x={cx} y={yy - 6} textAnchor="middle" className="fill-cream text-[11px] font-semibold">
                  {d.n}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke="rgba(70,42,24,0.14)" strokeWidth={1} />
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line-2 bg-ink-2/95 px-2.5 py-1.5 text-[11.5px] whitespace-nowrap shadow-xl backdrop-blur"
          style={{ left: `${((pad.left + (innerW / data.length) * (hover + 0.5)) / W) * 100}%` }}
        >
          <div className="text-mute">{label(data[hover].day)}</div>
          <div className="tabular font-semibold text-cream">{data[hover].n} הרשמות</div>
        </div>
      )}

      <table className="sr-only">
        <caption>הרשמות לפי יום</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th>{d.day}</th>
              <td>{d.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
}
