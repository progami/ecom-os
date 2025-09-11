export const metadata = {
  title: "About – Targon Global",
  description: "Learn about Targon Global: our mission, values, and commitment to sustainable protection products.",
}

import MarketingBg from '@/components/marketing-bg'

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <MarketingBg>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center">ABOUT TARGON</h1>
          <p className="mt-6 text-center max-w-3xl mx-auto text-white/80">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus semper vitae orci sit amet finibus. Aliquam placerat, erat vitae egestas placerat.
          </p>

          <div className="mt-10 rounded-2xl bg-white/10 p-2">
            <div className="h-56 md:h-72 rounded-xl bg-white/40" />
          </div>

          {/* Vision */}
          <div className="mt-16 grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1">
              <div className="h-48 rounded-2xl bg-white/40" />
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl font-extrabold text-[#00C2B9]">VISION</h2>
              <p className="mt-4 text-white/80">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam placerat, erat vitae egestas placerat, orci purus dapibus augue.</p>
            </div>
          </div>

          {/* Mission */}
          <div className="mt-16 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-extrabold text-[#00C2B9]">MISSION</h2>
              <p className="mt-4 text-white/80">Everyday, done better. We obsess over durable, recyclable, cost-effective materials that help pros move faster.</p>
            </div>
            <div>
              <div className="h-40 rounded-2xl bg-white/40" />
            </div>
          </div>

          {/* Story */}
          <div className="mt-16 grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1">
              <div className="h-40 rounded-2xl bg-white/40" />
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl font-extrabold text-[#00C2B9]">STORY</h2>
              <p className="mt-4 text-white/80">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque habitant morbi tristique senectus et netus.</p>
            </div>
          </div>

          {/* Values */}
          <div className="mt-16 grid md:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl font-extrabold text-[#00C2B9]">VALUES</h2>
              <ul className="mt-4 space-y-2 text-white/90 list-disc list-inside">
                <li>Efficiency – Solving everyday problems, better.</li>
                <li>Simplicity – Reducing complexity, giving you what you need.</li>
                <li>Innovation – Maximizing creativity.</li>
              </ul>
            </div>
            <div>
              <div className="h-40 rounded-2xl bg-white/40" />
            </div>
          </div>
        </div>
      </MarketingBg>
    </main>
  )
}
