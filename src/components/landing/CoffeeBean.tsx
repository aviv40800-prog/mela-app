/** A roasted coffee bean — a small nod to the buna ceremony. */
export function CoffeeBean({ size = 14, className = "", rotate = 0 }: { size?: number; className?: string; rotate?: number }) {
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 20 26" className={className} style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <defs>
        <radialGradient id="bean-roast" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#8a5434" />
          <stop offset="0.55" stopColor="#5a3420" />
          <stop offset="1" stopColor="#2f1a0e" />
        </radialGradient>
      </defs>
      <ellipse cx="10" cy="13" rx="9" ry="12" fill="url(#bean-roast)" />
      <path d="M10 2.5c-3 4-3 7.5 0 10.5s3 6.5 0 10.5" fill="none" stroke="#1d0f07" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      <ellipse cx="6.5" cy="8" rx="2" ry="3.2" fill="#fff" opacity="0.12" />
    </svg>
  );
}

/** Three beans in a row — used as a divider. */
export function BeanDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-l from-gold/50 to-transparent" />
      <CoffeeBean size={11} rotate={-25} />
      <CoffeeBean size={13} rotate={8} />
      <CoffeeBean size={11} rotate={35} />
      <span className="h-px w-16 bg-gradient-to-r from-gold/50 to-transparent" />
    </div>
  );
}
