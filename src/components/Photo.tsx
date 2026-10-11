"use client";

import { useState } from "react";

const PALETTES = [
  ["#3a2a12", "#16120b"],
  ["#2b2117", "#0f0d0b"],
  ["#33240f", "#141110"],
  ["#2a1d1a", "#100c0b"],
];

/** Profile photo with a luxurious monogram fallback when no photo is available or it fails to load. */
export function Photo({
  src,
  name,
  className = "",
  rounded = "rounded-3xl",
  priority,
}: {
  src?: string | null;
  name: string;
  className?: string;
  rounded?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0) || "M";
  const [c1, c2] = PALETTES[(name.charCodeAt(0) || 0) % PALETTES.length];

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        onError={() => setFailed(true)}
        className={`select-none object-cover ${rounded} ${className}`}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={`relative grid place-items-center overflow-hidden ${rounded} ${className}`}
      style={{ background: `radial-gradient(120% 90% at 30% 15%, ${c1}, ${c2} 70%)`, containerType: "size" }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-[0.10]" aria-hidden>
        <defs>
          <pattern id="mela-weave" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 14h28M14 0v28" stroke="#d4af37" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mela-weave)" />
      </svg>
      <span className="font-display gold-text relative leading-none font-bold" style={{ fontSize: "42cqmin" }}>
        {initial}
      </span>
    </div>
  );
}
