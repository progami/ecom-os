import Link from 'next/link'
import { ArrowRight, Leaf, CheckCircle } from 'lucide-react'
import MarketingBg from '@/components/marketing-bg'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Gradient canvas for the whole marketing body */}
      <MarketingBg>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">INNOVATION TO IMPACT</h1>
              <p className="text-base md:text-lg text-white/80 mt-6 max-w-xl">
                Professional-grade protection materials built with recycled inputs. We focus on quality, efficiency, and fair pricing.
              </p>
              <div className="mt-8">
                <Link href="/about" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#00C2B9] text-white font-semibold hover:brightness-110">
                  Learn More <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
            <div className="relative h-72 md:h-96">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-40 md:w-96 md:h-60 rounded-2xl bg-white/30" />
              </div>
            </div>
          </div>
        </div>

        {/* Mid Feature */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide">WHAT THE WORLD NEEDS NEXT, WE ARE MAKING NOW.</h2>
            <p className="text-white/70 mt-2">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
          </div>
          <div className="mt-10 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
              <div className="h-40 md:h-56 rounded-2xl bg-white/30" />
              <div className="h-40 md:h-56 rounded-2xl bg-white/30" />
              <div className="h-40 md:h-56 rounded-2xl bg-white/30" />
            </div>
          </div>
          <div className="mt-10 text-center">
            <a href="#" className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#00C2B9] text-white font-semibold hover:brightness-110">
              Buy on Amazon
            </a>
          </div>
        </div>

        {/* Testimonials */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide">WHAT OUR CUSTOMERS THINK</h2>
            <p className="text-white/70 mt-2">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[0,1,2].map((i) => (
              <div key={i} className="rounded-xl bg-white p-5 shadow-lg">
                <div className="h-24 bg-gray-200 rounded" />
                <div className="mt-4 h-2 w-24 bg-[#00C2B9] rounded" />
                <div className="mt-3 h-4 w-32 bg-gray-300 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-center justify-center gap-6 text-sm text-white/80">
            <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-400"/> Climate Pledge Friendly</div>
            <div className="flex items-center gap-2"><Leaf className="w-4 h-4 text-teal-400"/> GRS Certified</div>
          </div>
        </div>
      </MarketingBg>

      {/* Contact (outside gradient) */}
      <section id="contact" className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-[#002C51] mb-4">Let’s Talk</h2>
            <p className="text-gray-700 mb-6">Quick question or bulk order? We’ll get back within one business day.</p>
            <div className="space-y-2 text-gray-700">
              <p>Email: <a className="text-[#002C51] hover:underline" href="mailto:help@targonglobal.com">help@targonglobal.com</a></p>
              <p>Phone: <a className="text-[#002C51] hover:underline" href="tel:+18000000000">+1 (800) 000-0000</a></p>
            </div>
          </div>
          <form className="space-y-4">
            <input className="w-full px-4 py-3 border border-[#002C51]/20 rounded focus:outline-none focus:border-[#002C51]" placeholder="Name" />
            <input type="email" className="w-full px-4 py-3 border border-[#002C51]/20 rounded focus:outline-none focus:border-[#002C51]" placeholder="Email" />
            <textarea rows={4} className="w-full px-4 py-3 border border-[#002C51]/20 rounded focus:outline-none focus:border-[#002C51]" placeholder="How can we help?" />
            <button className="px-6 py-3 bg-[#002C51] text-white rounded hover:brightness-110 font-medium">Send</button>
          </form>
        </div>
      </section>
    </div>
  )
}
