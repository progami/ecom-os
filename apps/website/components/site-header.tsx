import Image from "next/image"
import Link from "next/link"

import DesktopNav from "./site-header/desktop-nav"
import MobileControls from "./site-header/mobile-controls"
import { navItems } from "./site-header/nav-data"

export default function SiteHeader() {
  return (
    <header className="border-b-4 border-[#00C2B9] bg-[#F5F5F5] text-[#02253b]">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-6 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center" aria-label="Targon">
          <Image
            src="/assets/images/logo-header.png"
            alt="Targon logo"
            width={160}
            height={36}
            priority
          />
        </Link>

        <DesktopNav navItems={navItems} />

        <MobileControls navItems={navItems} />
      </div>
    </header>
  )
}
