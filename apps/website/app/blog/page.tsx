export const metadata = {
  title: "Blog – Targon Global",
  description: "Company updates, product notes, and sustainability progress.",
}

const posts = [
  { title: "Welcome to Targon Global", date: "2025-01-05", summary: "Why we exist and what we’re building." },
  { title: "Materials and Sustainability Roadmap", date: "2025-02-12", summary: "How we’re sourcing and certifying responsibly." },
]

import MarketingBg from '@/components/marketing-bg'

export default function BlogPage() {
  return (
    <main className="min-h-screen">
      <MarketingBg>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center">BLOGS</h1>
          <h2 className="mt-6 text-center text-2xl font-extrabold text-brand-accent tracking-wide">LATEST UPDATES</h2>

          <div className="mt-10 space-y-6">
            {[0,1,2,3,4].map((i) => (
              <div key={i} className="h-28 md:h-32 rounded-2xl bg-white/40" />
            ))}
          </div>
        </div>
      </MarketingBg>
    </main>
  )
}
