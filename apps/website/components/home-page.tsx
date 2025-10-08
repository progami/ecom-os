'use client'

import Image from 'next/image'
import Link from 'next/link'

import { assetUrl } from '@/core-services/assets/cdn'

import styles from './home-page.module.css'

const testimonials = [
  {
    name: 'Millon Zahino',
    title: 'Behavioral Science Lead',
    quote:
      'As an industrial operator, securing capacity and optimizing budgets are critical. Targon is the partner that shows up and ships on time.',
  },
  {
    name: 'Sarah Mitchell',
    title: 'VP, Operations',
    quote:
      'Their crews combine real-world manufacturing knowledge with modern tooling. We halved launch timelines without sacrificing quality.',
  },
  {
    name: 'David Chen',
    title: 'Director of Logistics',
    quote:
      'Targon keeps our teams aligned with data we can act on. Every workflow is documented, measurable, and grounded in execution.',
  },
  {
    name: 'Emma Rodriguez',
    title: 'Head of Merchandising',
    quote:
      'Sustainable products, delivered fast. They sweat the details so our buyers can stay focused on the customer experience.',
  },
  {
    name: 'James Thompson',
    title: 'Chief Revenue Officer',
    quote:
      'From forecasting to fulfillment, Targon keeps the flywheel spinning. We’ve unlocked new categories with full margin visibility.',
  },
  {
    name: 'Lisa Anderson',
    title: 'Plant Manager',
    quote:
      'Implementation was the smoothest I’ve seen. The systems they leave behind are the ones our operators actually love using.',
  },
]

const marqueeItems = [...testimonials, ...testimonials]

const quickLinks = [
  {
    heading: 'Quick Links',
    items: ['Policy', 'EcomOS', 'Caelum Star'],
  },
  {
    heading: 'Explore',
    items: ['Resources', 'Blog', 'Documents'],
  },
  {
    heading: 'Company',
    items: ['About us', 'Partners', 'Customers', 'Contact us'],
  },
]

export default function HomePage() {
  return (
    <main className="flex flex-col bg-[#021b2b] text-white">
      <section className="relative overflow-hidden pb-20 pt-16">
        <div className="absolute inset-0">
          <Image
            src={assetUrl('/home/hero-bg.png')}
            alt=""
            fill
            priority
            className="object-cover object-center opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#021b2b]/30 via-[#021b2b]/85 to-[#021b2b]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-6 text-center">
          <div className="max-w-2xl space-y-6">
            <p className="text-sm uppercase tracking-[0.32em] text-[#00C2B9]">Innovation to Impact</p>
            <h1 className="text-4xl font-extrabold uppercase leading-tight md:text-5xl">
              What the world needs next we are making now.
            </h1>
            <p className="text-base leading-relaxed text-white/75 md:text-lg">
              Targon builds circular-first supply chains and the software that keeps them sharp. From concept to launch,
              we are the quiet partner powering your next release.
            </p>
          </div>

          <Link
            href="/about"
            className="inline-flex items-center justify-center rounded-full bg-[#00C2B9] px-10 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-[#002433] shadow-[0_12px_24px_rgba(0,194,185,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(0,194,185,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00C2B9] focus-visible:ring-offset-[#021b2b]"
          >
            about us
          </Link>

          <div className="relative flex flex-wrap justify-center gap-8">
            <div className="relative h-40 w-40 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[0_18px_45px_rgba(0,0,0,0.35)] md:h-48 md:w-48 lg:h-56 lg:w-56">
              <Image src={assetUrl('/home/circle-left.png')} alt="" fill className="object-cover object-center" />
            </div>
            <div className="relative h-48 w-48 overflow-hidden rounded-full border border-[#00C2B9]/30 bg-[#00C2B9]/15 shadow-[0_18px_45px_rgba(0,0,0,0.35)] md:h-56 md:w-56 lg:h-64 lg:w-64">
              <Image src={assetUrl('/home/circle-center.png')} alt="" fill className="object-cover object-center" />
            </div>
            <div className="relative h-36 w-36 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[0_18px_45px_rgba(0,0,0,0.35)] md:h-44 md:w-44 lg:h-52 lg:w-52">
              <Image src={assetUrl('/home/circle-right.png')} alt="" fill className="object-cover object-center" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-[#021b2b] via-[#011226] to-[#00070f]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">what our customers think</p>
            <h2 className="mt-4 text-3xl font-semibold md:text-4xl">The world needs what we’re building—now.</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70 md:text-base">
              Feedback straight from transformation programs we’ve shipped in the last twelve months.
            </p>
          </div>

          <div className={styles.marquee}>
            <div className={styles.track}>
              {marqueeItems.map((testimonial, index) => (
                <article
                  key={`${testimonial.name}-${index}`}
                  className={`w-80 flex-shrink-0 rounded-3xl p-6 text-left text-sm text-white/80 backdrop-blur-sm ${styles.testimonialCard}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00C2B9]/20 text-sm font-semibold text-[#00C2B9]">
                      {testimonial.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-[#00C2B9]">{testimonial.title}</p>
                    </div>
                  </div>
                  <p className="mt-5 leading-relaxed">{testimonial.quote}</p>
                  <div className="mt-6 flex gap-1 text-base text-[#00C2B9]">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <span key={starIndex} aria-hidden="true">
                        ★
                      </span>
                    ))}
                    <span className="sr-only">5 out of 5 rating</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#00C2B9] text-[#021b2b]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-md space-y-4">
            <h3 className="text-3xl font-semibold uppercase tracking-[0.3em]">Targon</h3>
            <p className="text-sm leading-relaxed">
              Hello, we are Targon, working to put the right people and systems in place so you get the best results
              across every launch. Insight meets execution.
            </p>
          </div>

          <div className="flex flex-1 flex-wrap gap-12">
            {quickLinks.map((group) => (
              <div key={group.heading} className="min-w-[140px] space-y-3 text-sm">
                <p className="font-semibold uppercase tracking-[0.25em]">{group.heading}</p>
                <ul className="space-y-2 text-[#021b2b]/80">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
