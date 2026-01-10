import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-[var(--shadow)]">
    <div className="overflow-x-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("border-b border-border/60 bg-muted/30 [&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    hoverable?: boolean
  }
>(({ className, hoverable = true, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors data-[state=selected]:bg-muted",
      hoverable && "hover:bg-muted/50 cursor-pointer",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    align?: "left" | "center" | "right"
  }
>(({ className, align = "left", ...props }, ref) => {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align]

  return (
    <th
      ref={ref}
      className={cn(
        "h-12 px-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider [&:has([role=checkbox])]:pr-0",
        alignClass,
        className
      )}
      {...props}
    />
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    align?: "left" | "center" | "right"
  }
>(({ className, align = "left", ...props }, ref) => {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align]

  return (
    <td
      ref={ref}
      className={cn(
        "p-4 align-middle [&:has([role=checkbox])]:pr-0",
        alignClass,
        className
      )}
      {...props}
    />
  )
})
TableCell.displayName = "TableCell"

interface TableSkeletonProps {
  rows?: number
  columns: number
}

function TableSkeleton({ rows = 5, columns }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-4">
              <div className="h-4 bg-muted rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

interface ResultsCountProps {
  count: number
  singular: string
  plural: string
  loading?: boolean
}

function ResultsCount({ count, singular, plural, loading = false }: ResultsCountProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <p className="text-sm text-muted-foreground">
      {count} {count === 1 ? singular : plural}
    </p>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableSkeleton,
  ResultsCount,
}
