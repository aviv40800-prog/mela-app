/** The MELA wordmark — gold Cinzel capitals, as in the key visual. */
export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "text-[1.35rem]", md: "text-[1.75rem]", lg: "text-6xl" }[size];
  return (
    <span dir="ltr" className={`font-brand font-bold tracking-[0.18em] gold-text animate-shimmer ${cls}`}>
      MELA
    </span>
  );
}
