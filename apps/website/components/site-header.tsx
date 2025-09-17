import Link from "next/link"

import DesktopNav from "./site-header/desktop-nav"
import MobileControls from "./site-header/mobile-controls"
import { navItems } from "./site-header/nav-data"

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1 group">
          <div className="leading-tight">
            <span className="text-lg font-extrabold tracking-wide uppercase text-[#002C51]">Targon</span>
            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[#00C2B9] align-super" />
          </div>
        </Link>

        <DesktopNav navItems={navItems} />

        <MobileControls navItems={navItems} />
      </div>
    </header>
  )
}
