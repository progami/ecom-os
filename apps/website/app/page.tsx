'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const testimonials = [
  {
    id: 0,
    name: 'Millen Zahino',
    rating: 5,
    content: 'As an industrial, securing capacity and optimizing budgets are key. In that sense, Clive, you are looking for a transport partner committed.'
  },
  {
    id: 1,
    name: 'Sarah Mitchell',
    rating: 5,
    content: 'Outstanding quality and exceptional service. Their innovative approach has transformed our operations and exceeded expectations.'
  },
  {
    id: 2,
    name: 'David Chen',
    rating: 5,
    content: 'Professional team with deep industry expertise. They deliver consistent results and maintain excellent communication throughout.'
  },
  {
    id: 3,
    name: 'Emma Rodriguez',
    rating: 5,
    content: 'Reliable partner for our business growth. Their solutions are practical, efficient, and perfectly aligned with our objectives.'
  },
  {
    id: 4,
    name: 'James Thompson',
    rating: 5,
    content: 'Impressive turnaround times and attention to detail. Working with them has significantly improved our productivity and outcomes.'
  },
  {
    id: 5,
    name: 'Lisa Anderson',
    rating: 5,
    content: 'Their commitment to excellence is evident in every interaction. A truly dependable partner for our critical business needs.'
  },
  {
    id: 6,
    name: 'Michael Roberts',
    rating: 5,
    content: 'Cost-effective solutions without compromising quality. They understand our industry challenges and deliver targeted results.'
  },
  {
    id: 7,
    name: 'Jennifer Park',
    rating: 5,
    content: 'Seamless collaboration and proactive support. Their team goes above and beyond to ensure our success at every stage.'
  },
  {
    id: 8,
    name: 'Robert Wilson',
    rating: 5,
    content: 'Strategic thinking and practical execution. They bring valuable insights that help us stay competitive in our market.'
  },
  {
    id: 9,
    name: 'Amanda Foster',
    rating: 5,
    content: 'Trusted advisor and implementation partner. Their expertise has been instrumental in achieving our ambitious growth targets.'
  }
]

export default function HomePage() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => prev + 0.05)
    }, 30)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="relative bg-[#000]">
      <div className="relative" style={{ width: '1920px', height: '2303px' }}>
        {/* Hero background - 682px height */}
        <div className="absolute" style={{ left: 0, top: 0, width: '1920px', height: '682px' }}>
          <Image
            src="/assets/images/hero.png"
            alt="Robotic arm working on a vehicle"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Blue gradient background for circles section - extends from hero to testimonials */}
        <div
          className="absolute bg-gradient-to-b from-[#032644] via-[#02253c] to-[#021b2b]"
          style={{ left: 0, top: '682px', width: '1920px', height: '1285px' }}
        />

        {/* "INNOVATION TO IMPACT" text at X:970.66, Y:268 from Figma (268 - 95px header = 173px) - 96px Montserrat Bold */}
        <div className="absolute" style={{ left: '970.66px', top: '173px' }}>
          <h1 className="text-right font-bold uppercase leading-tight tracking-[0.28em] text-white" style={{ fontSize: '96px', fontFamily: 'Montserrat' }}>
            <span className="block">INNOVATION</span>
            <span className="block">TO</span>
            <span className="flex items-center justify-end gap-4">
              <span className="h-16 w-20 rounded-l-[999px] rounded-r-none bg-[#00C2B9]" aria-hidden />
              <span>IMPACT</span>
            </span>
          </h1>
        </div>

        {/* "WHAT THE WORLD NEEDS NEXT" heading at X:270.66, Y:860 from Figma (860 - 95px header = 765px) - 48px Montserrat Bold */}
        <div className="absolute" style={{ left: '270.66px', top: '765px' }}>
          <h2 className="text-left font-bold uppercase leading-tight tracking-wide text-white" style={{ fontSize: '48px', fontFamily: 'Montserrat' }}>
            WHAT THE WORLD NEEDS NEXT<br />WE ARE MAKING NOW.
          </h2>
        </div>

        {/* Leftmost circle (industrial - using circle-3.png) - at X:304, Y:1140 from Figma (1140 - 68px header = 1072px) */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{
            left: '304px',
            top: '1072px',
            width: '464px',
            height: '464px',
            zIndex: 1,
          }}
        >
          <Image
            src="/assets/images/circle-3.png"
            alt="Industrial roller"
            fill
            className="object-cover"
          />
        </div>

        {/* Middle circle (binoculars - using circle-1.png) - at X:721.33, Y:1102.66 from Figma (1102.66 - 68px header = 1034.66px) */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{
            left: '721.33px',
            top: '1034.66px',
            width: '509.33px',
            height: '509.33px',
            zIndex: 3,
          }}
        >
          <Image
            src="/assets/images/circle-1.png"
            alt="Observation binoculars"
            fill
            className="object-cover"
          />
        </div>

        {/* Rightmost circle (green valley - using circle-2.png) - at X:1165, Y:1033 from Figma (1033 - 68px header = 965px) */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{
            left: '1165px',
            top: '965px',
            width: '420px',
            height: '420px',
            zIndex: 2,
          }}
        >
          <Image
            src="/assets/images/circle-2.png"
            alt="Green valley landscape"
            fill
            className="object-cover"
          />
        </div>

        {/* ABOUT US Button - 241x60 at Y:1686.66 from Figma (1686.66 - 95px header = 1591.66px) */}
        <div className="absolute" style={{ left: '50%', top: '1591.66px', transform: 'translateX(-50%)' }}>
          <Link
            href="/about"
            className="flex items-center justify-center rounded-sm bg-[#00C2B9] text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:brightness-110"
            style={{ width: '241px', height: '60px' }}
          >
            ABOUT US
          </Link>
        </div>

        {/* WHAT OUR CUSTOMERS THINK heading at X:593.33, Y:1866.66 from Figma (1866.66 - 95px header = 1771.66px) */}
        <div className="absolute" style={{ left: '593.33px', top: '1771.66px' }}>
          <h2 className="font-bold uppercase text-white" style={{ fontSize: '48px', fontFamily: 'Montserrat' }}>
            WHAT OUR CUSTOMERS THINK
          </h2>
        </div>

        {/* Testimonials Section - starts at Y:2062 from Figma (2062 - 95px header = 1967px) */}
        <section className="absolute bg-gradient-to-b from-[#021b2b] via-[#01111f] to-[#00070f] text-white" style={{ top: '1967px', width: '1920px', bottom: 0 }}>
          <div className="mx-auto w-full max-w-[1920px] px-20">

            {/* Carousel */}
            <div className="relative overflow-hidden mt-20">
              <div
                className="flex gap-6 transition-none"
                style={{ transform: `translateX(-${offset % 100}%)` }}
              >
                {[...testimonials, ...testimonials, ...testimonials].map((testimonial, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 flex flex-col justify-between rounded-lg border border-white/10 bg-white/5 px-5 py-6 text-xs leading-relaxed text-white/80"
                    style={{ width: '320px', minWidth: '320px' }}
                  >
                    <div>
                      <h3 className="text-base font-semibold text-white">{testimonial.name}</h3>
                      <div className="mt-2 flex gap-1 text-[#00C2B9]">
                        {Array.from({ length: testimonial.rating }, (_, starIndex) => (
                          <span key={starIndex}>★</span>
                        ))}
                      </div>
                      <p className="mt-4">{testimonial.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
