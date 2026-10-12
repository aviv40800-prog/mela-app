import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col">
      <Skeleton className="h-[3px] w-full !rounded-full" />
      <Skeleton className="mt-10 h-9 w-48 !rounded-full" />
      <Skeleton className="mt-3 h-4 w-64 !rounded-full" />
      <Skeleton className="mt-8 aspect-square w-full !rounded-[28px]" />
    </div>
  );
}
