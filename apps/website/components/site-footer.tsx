import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function SiteFooter() {
  return (
    <footer className="bg-[#e9ecef] text-gray-900 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-wide uppercase text-[#002C51]">Targon</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C2B9] align-super" />
            </div>
            <p className="mt-4 text-sm text-gray-600 max-w-xs">
              Hello, we are Targon, trying to make an effort to put the right people for you to get the best results. Just insight.
            </p>
            <div className="mt-4">
              <div className="relative">
                <input placeholder="Search" className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm" />
                <ArrowRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-[#002C51]">Policy</Link></li>
              <li><Link href="/ecomos" className="hover:text-[#002C51]">EcomOS</Link></li>
              <li><Link href="#" className="hover:text-[#002C51]">Caelum Star</Link></li>
            </ul>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-semibold mb-3">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-[#002C51]">Resources</Link></li>
              <li><Link href="/blog" className="hover:text-[#002C51]">Blog</Link></li>
              <li><Link href="#" className="hover:text-[#002C51]">Documents</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-[#002C51]">About us</Link></li>
              <li><Link href="#" className="hover:text-[#002C51]">Partners</Link></li>
              <li><Link href="#" className="hover:text-[#002C51]">Customers</Link></li>
              <li><Link href="#" className="hover:text-[#002C51]">Contact us</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
