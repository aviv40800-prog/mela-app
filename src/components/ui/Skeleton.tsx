export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-2xl ${className}`} />;
}

/** Placeholder with the exact silhouette of a discovery card. */
export function CardSkeleton() {
  return (
    <div className="surface relative h-[calc(100dvh-196px)] overflow-hidden rounded-[32px]" aria-busy aria-label="טוען פרופילים">
      <div className="skeleton absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 space-y-3 p-6">
        <div className="skeleton h-8 w-40 rounded-full" />
        <div className="skeleton h-4 w-56 rounded-full" />
        <div className="flex gap-2 pt-1">
          <div className="skeleton h-7 w-20 rounded-full" />
          <div className="skeleton h-7 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3.5">
          <div className="skeleton h-14 w-14 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-28 rounded-full" />
            <div className="skeleton h-3 w-48 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
