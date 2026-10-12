/** Compact compatibility gauge — a thin gold arc around the number, instead of a generic icon. */
export function CompatRing({ value, size = 14 }: { value: number; size?: number }) {
  const r = size / 2 - 1.5;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
    </svg>
  );
}
