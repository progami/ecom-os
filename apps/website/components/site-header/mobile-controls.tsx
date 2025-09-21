'use client'

import { useState } from "react"

import Link from "next/link"
import { Menu, Search, X } from "lucide-react"
import { usePathname } from "next/navigation"

import type { NavItem } from "./nav-data"

type MobileControlsProps = {
  navItems: NavItem[]
}

export default function MobileControls({ navItems }: MobileControlsProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <div className="md:hidden flex items-center gap-2">
        <button aria-label="Search" className="p-2 rounded hover:bg-gray-100 text-[#6F7B8B]">
          <Search className="w-5 h-5" />
        </button>
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="p-2 rounded hover:bg-gray-100 text-[#002C51]"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-extrabold uppercase text-[#002C51]">Menu</span>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="p-2 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const active = pathname === item.href
                const isEcom = item.href === "/ecomos"
                const baseClasses = "px-3 py-3 rounded font-semibold text-sm uppercase tracking-wide"
                const variant = isEcom
                  ? active
                    ? "bg-[#002C51] text-white"
                    : "text-[#002C51] border border-[#002C51]/20 hover:bg-[#002C51] hover:text-white"
                  : active
                  ? "text-[#002C51]"
                  : "text-gray-700 hover:text-[#002C51]"

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`${baseClasses} ${variant}`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
