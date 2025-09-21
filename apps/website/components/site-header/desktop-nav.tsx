'use client'

import Link from "next/link"
import { Search } from "lucide-react"
import { usePathname } from "next/navigation"

import type { NavItem } from "./nav-data"

type DesktopNavProps = {
  navItems: NavItem[]
}

export default function DesktopNav({ navItems }: DesktopNavProps) {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex items-center gap-2">
      {navItems.map((item) => {
        const active = pathname === item.href
        const isEcom = item.href === "/ecomos"
        const baseClasses = "px-3 py-2 rounded font-semibold text-sm uppercase tracking-wide transition-colors"
        const variant = isEcom
          ? active
            ? "bg-[#002C51] text-white"
            : "text-[#002C51] border border-[#002C51]/20 hover:bg-[#002C51] hover:text-white"
          : active
          ? "text-[#002C51]"
          : "text-gray-700 hover:text-[#002C51]"

        return (
          <Link key={item.href} href={item.href} className={`${baseClasses} ${variant}`}>
            {item.label}
          </Link>
        )
      })}
      <button aria-label="Search" className="ml-2 p-2 rounded hover:bg-gray-100 text-[#6F7B8B]">
        <Search className="w-4 h-4" />
      </button>
    </nav>
  )
}
