"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Menu, X } from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/ecomos", label: "EcomOS" },
  { href: "/blog", label: "Blog" },
]

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 group">
          <div className="leading-tight">
            <span className="text-lg font-extrabold tracking-wide uppercase text-[#002C51]">Targon</span>
            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[#00C2B9] align-super" />
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href
            const isEcom = item.href === "/ecomos"
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "px-3 py-2 rounded font-semibold text-sm uppercase tracking-wide transition-colors",
                  isEcom
                    ? active
                      ? "bg-[#002C51] text-white"
                      : "text-[#002C51] border border-[#002C51]/20 hover:bg-[#002C51] hover:text-white"
                    : active
                    ? "text-[#002C51]"
                    : "text-gray-700 hover:text-[#002C51]",
                ].join(" ")}
              >
                {item.label}
              </Link>
            )
          })}
          <button aria-label="Search" className="ml-2 p-2 rounded hover:bg-gray-100 text-[#6F7B8B]">
            <Search className="w-4 h-4" />
          </button>
        </nav>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          <button aria-label="Search" className="p-2 rounded hover:bg-gray-100 text-[#6F7B8B]">
            <Search className="w-5 h-5" />
          </button>
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="p-2 rounded hover:bg-gray-100 text-[#002C51]">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {open && (
        <div className="md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-extrabold uppercase text-[#002C51]">Menu</span>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const active = pathname === item.href
                const isEcom = item.href === "/ecomos"
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "px-3 py-3 rounded font-semibold text-sm uppercase tracking-wide",
                      isEcom
                        ? active
                          ? "bg-[#002C51] text-white"
                          : "text-[#002C51] border border-[#002C51]/20 hover:bg-[#002C51] hover:text-white"
                        : active
                        ? "text-[#002C51]"
                        : "text-gray-700 hover:text-[#002C51]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
