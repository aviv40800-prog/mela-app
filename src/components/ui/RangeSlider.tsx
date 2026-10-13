"use client";

import { haptic } from "@/lib/client";

/**
 * Gold range slider — one thumb (value) or two (range). Native <input type=range> underneath for
 * keyboard + screen-reader support; RTL-aware (minimum on the right, as Hebrew readers expect).
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  labels,
}: {
  min: number;
  max: number;
  step?: number;
  value: [number, number] | number;
  onChange: (v: [number, number] | number) => void;
  labels: [string, string] | string;
}) {
  const dual = Array.isArray(value);
  const [lo, hi] = dual ? value : [min, value];
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const tick = () => haptic(3);

  return (
    <div className="relative h-8" dir="rtl">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-fg/10" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-l from-gold-2 to-gold shadow-[0_0_10px_rgba(180,87,58,0.6)]"
        style={{ right: `${dual ? pct(lo) : 0}%`, left: `${100 - pct(hi)}%` }}
      />
      {dual && (
        <input
          type="range"
          aria-label={(labels as [string, string])[0]}
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => {
            tick();
            onChange([Math.min(Number(e.target.value), hi - step), hi]);
          }}
          className="range-thumb absolute inset-0 w-full"
        />
      )}
      <input
        type="range"
        aria-label={dual ? (labels as [string, string])[1] : (labels as string)}
        min={min}
        max={max}
        step={step}
        value={hi}
        onChange={(e) => {
          tick();
          const v = Number(e.target.value);
          onChange(dual ? [lo, Math.max(v, lo + step)] : v);
        }}
        className="range-thumb absolute inset-0 w-full"
      />
    </div>
  );
}
