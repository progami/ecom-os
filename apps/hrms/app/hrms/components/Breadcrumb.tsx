'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Breadcrumb() {
  const pathname = usePathname()
  const parts = (pathname || '/').split('/').filter(Boolean)
  const acc: { href: string; label: string }[] = []
  let href = ''
  for (const part of parts) {
    href += '/' + part
    acc.push({ href, label: part.replace(/[-_]/g, ' ') })
  }
  if (acc.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex items-center gap-2">
        <li>
          <Link href="/hrms" className="hover:text-primary">hrms</Link>
        </li>
        {acc
          .filter(x => x.href !== '/hrms')
          .map((item, idx) => (
            <li key={item.href} className="flex items-center gap-2">
              <span className="text-gray-300 dark:text-gray-600">/</span>
              {idx === acc.length - 2 || idx === acc.length - 1 ? (
                <span className="capitalize">{item.label}</span>
              ) : (
                <Link className="hover:text-primary capitalize" href={item.href}>{item.label}</Link>
              )}
            </li>
          ))}
      </ol>
    </nav>
  )
}

