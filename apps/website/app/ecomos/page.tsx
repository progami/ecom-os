import { ArrowRight } from 'lucide-react'
import MarketingBg from '@/components/marketing-bg'

export const metadata = {
  title: 'Ecom OS – Targon Global',
  description: 'EcomOS: Unified platform for modern e‑commerce operations.',
}

export default function Home() {
  return (
    <div className="relative min-h-screen text-white">
      <MarketingBg>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center">ECOM OS</h1>

        {/* ECOMOS Intro */}
        <div className="mt-10">
          <h2 className="text-3xl font-extrabold text-[#00C2B9]">ECOMOS</h2>
          <p className="mt-3 max-w-3xl text-white/80">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus semper vitae orci sit amet finibus. Aliquam placerat, erat vitae egestas placerat, orci purus dapibus augue.
          </p>

          {/* Overlapping placeholders */}
          <div className="mt-8 relative h-72">
            <div className="absolute top-6 left-6 w-64 md:w-80 h-40 md:h-48 bg-white/40 rounded-2xl" />
            <div className="absolute top-10 left-40 w-64 md:w-80 h-40 md:h-48 bg-white/30 rounded-2xl" />
            <div className="absolute top-16 left-64 w-56 md:w-72 h-36 md:h-44 bg-white/25 rounded-2xl" />
            <div className="absolute top-24 left-96 w-80 h-40 bg-white/20 rounded-2xl" />
          </div>
        </div>

        {/* How it helps */}
        <div className="mt-20 text-center">
          <h3 className="text-3xl font-extrabold tracking-wide">HOW IT HELPS THE BUSINESS</h3>
          <p className="mt-4 max-w-3xl mx-auto text-white/80">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus semper vitae orci sit amet finibus. Aliquam placerat, erat vitae egestas placerat.
          </p>
        </div>

        <div className="mt-10 rounded-2xl bg-white/10 p-2">
          <div className="h-64 md:h-72 rounded-xl bg-white/40" />
        </div>

        <div className="mt-10 text-center">
          <button className="px-6 py-3 rounded-full bg-[#00C2B9] text-white font-semibold inline-flex items-center gap-2 hover:brightness-110">
            Inquire More <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        </div>
      </MarketingBg>
    </div>
  )
}
