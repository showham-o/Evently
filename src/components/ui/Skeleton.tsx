interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Skeleton className="mb-4 h-8 w-2/3" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-5/6" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Skeleton className="mb-3 h-5 w-3/4" />
      <Skeleton className="mb-2 h-4 w-1/2" />
      <Skeleton className="mb-2 h-4 w-1/3" />
      <Skeleton className="mt-4 h-6 w-24" />
    </div>
  );
}
