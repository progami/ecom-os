import * as React from 'react';

import { cn } from '@/lib/utils';
import { TableCell, TableRow } from './table';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200 dark:bg-white/10',
        className,
      )}
      {...props}
    />
  );
}

function SkeletonText({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-full rounded', className)} {...props} />;
}

function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      {Array.from({ length: columns }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </TableCell>
      ))}
    </TableRow>
  );
}

function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </>
  );
}

function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-white/10 dark:bg-[#06182b]/85',
        className,
      )}
      {...props}
    >
      <div className="space-y-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonTableRow, SkeletonTable, SkeletonCard };
