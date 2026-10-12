import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="flex h-dvh flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <Skeleton className="h-10 w-10 !rounded-full" />
        <Skeleton className="h-11 w-11 !rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24 !rounded-full" />
          <Skeleton className="h-3 w-36 !rounded-full" />
        </div>
      </div>
      <div className="flex-1 space-y-3 px-4 pt-6">
        <Skeleton className="h-11 w-2/3 !rounded-[22px]" />
        <Skeleton className="mr-auto h-11 w-1/2 !rounded-[22px]" />
        <Skeleton className="h-16 w-3/4 !rounded-[22px]" />
      </div>
    </main>
  );
}
