import * as React from 'react'

export function Table({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <table className={`w-full text-sm ${className}`}>{children}</table>
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-muted/60">{children}</thead>
}

export function TH({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left font-medium p-2 border-b border-gray-200 dark:border-gray-800 ${className}`}>{children}</th>
}

export function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-2 border-b border-gray-200 dark:border-gray-800 ${className}`}>{children}</td>
}

