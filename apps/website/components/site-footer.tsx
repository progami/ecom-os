import Image from "next/image"
import Link from "next/link"

import { Facebook, Instagram, Twitter } from "lucide-react"

const footerSections = [
  {
    title: "Quick Links",
    links: [
      { href: "/policy", label: "Policy" },
      { href: "/ecomos", label: "EcomOS" },
      { href: "/coelum-star", label: "Coelum Star" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/resources", label: "Resources" },
      { href: "/blog", label: "Blog" },
      { href: "/documents", label: "Documents" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/partners", label: "Partners" },
      { href: "/customers", label: "Customers" },
      { href: "/contact", label: "Contact us" },
    ],
  },
]

const socialLinks = [
  { href: "https://www.facebook.com", icon: Facebook, label: "Facebook" },
  { href: "https://www.twitter.com", icon: Twitter, label: "Twitter" },
  { href: "https://www.instagram.com", icon: Instagram, label: "Instagram" },
]

export default function SiteFooter() {
  return (
    <footer className="bg-[#00C2B9] text-[#021b2b]" style={{ height: '475px', width: '1920px', margin: '0 auto' }}>
      <div className="mx-auto w-full max-w-[1920px] px-6 py-14 sm:px-10 lg:px-16 h-full flex flex-col justify-between">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" aria-label="Targon">
              <Image
                src="/assets/images/logo-footer.png"
                alt="Targon logo"
                width={168}
                height={36}
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6">
              Hello, we are Targon, trying to make an effort to put the right people for you to get the best results.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <p className="text-sm font-bold uppercase tracking-[0.3em]">
                {section.title}
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-[#021b2b]/30 pt-6">
          <div className="flex items-center justify-end gap-4">
            {socialLinks.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#021b2b]/60 transition hover:border-[#021b2b]"
              >
                <Icon className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
