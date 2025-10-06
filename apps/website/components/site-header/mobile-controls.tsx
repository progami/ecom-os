'use client'

import { useState } from "react"

import Link from "next/link"
import { Menu, X } from "lucide-react"
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
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="md:hidden rounded-full border border-[#02253b]/20 p-2 text-[#02253b] transition hover:bg-[#02253b]/10"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="md:hidden" style={{ zIndex: 9999 }}>
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 flex h-full w-72 flex-col bg-white p-6 shadow-xl" style={{ zIndex: 10000 }}>
            <div className="mb-6 flex items-center justify-between">
              <span className="text-base font-extrabold uppercase text-[#02253b] tracking-[0.3em]">Menu</span>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[#02253b]/20 p-2 text-[#02253b] transition hover:bg-[#02253b] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const active = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`rounded px-3 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition-colors ${
                      active ? "bg-[#02253b] text-white" : "text-[#02253b] hover:bg-[#02253b]/10"
                    }`}
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
