export const metadata = {
  title: "Products – Targon Global",
  description: "Explore Targon Global products: professional-grade drop cloths and protection materials.",
}

import MarketingBg from '@/components/marketing-bg'

export default function ProductsPage() {
  return (
    <main className="min-h-screen">
      <MarketingBg>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center">PRODUCTS</h1>

          {/* Brand wordmark */}
          <div className="mt-8 flex items-center justify-center">
            <div className="text-4xl font-extrabold tracking-wide">
              <span className="text-white">CS</span>
              <span className="text-brand-accent">|</span>
              <span className="ml-2">CAELUM</span>
              <span className="ml-2">STAR</span>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-10 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide">WHAT THE WORLD NEEDS NEXT, WE ARE MAKING NOW.</h2>
          </div>

          {/* Category pills */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <button className="px-5 py-2 rounded-full bg-brand-accent text-white font-semibold">RECYCLED PLASTIC</button>
            <button className="px-5 py-2 rounded-full border border-white/40 text-white font-semibold">COTTON</button>
          </div>

          {/* Tiers */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'CORE' },
              { label: 'BASIC' },
              { label: 'ESSENTIAL' },
              { label: 'DELUXE' },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl overflow-hidden bg-white/10 backdrop-blur">
                <div className="h-40 md:h-48 bg-white/40" />
                <div className="px-4 py-3 bg-brand-accent text-center font-semibold">{t.label}</div>
          </div>
          ))}
         </div>

          {/* Pipeline */}
          <div className="mt-16 text-center">
            <h3 className="text-3xl font-extrabold text-brand-accent">OUR PIPELINE</h3>
            <p className="mt-4 max-w-3xl mx-auto text-white/80">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus semper vitae orci sit amet finibus. Aliquam placerat.
            </p>
          </div>

          <div className="mt-10 rounded-2xl bg-white/10 p-2">
            <div className="h-64 rounded-xl bg-white/40" />
          </div>
        </div>
      </MarketingBg>
    </main>
  )
}
