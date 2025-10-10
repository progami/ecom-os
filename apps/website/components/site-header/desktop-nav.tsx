'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { NavItem } from "./nav-data"

type DesktopNavProps = {
  navItems: NavItem[]
}

export default function DesktopNav({ navItems }: DesktopNavProps) {
  const pathname = usePathname()

  return (
    <nav className="hidden items-center gap-9 text-sm font-semibold uppercase tracking-[0.28em] md:flex">
      {navItems.map((item) => {
        const active = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`transition-colors ${active ? 'text-brand-accent' : 'text-brand-supportInk hover:text-brand-accent'}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
