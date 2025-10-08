import Image from "next/image"
import Link from "next/link"

import { assetUrl } from "@/core-services/assets/cdn"

import styles from "./home-page.module.css"

const testimonials = [
  {
    name: "Millon Zahino",
    title: "Behavioral Science Lead",
    quote:
      "As an industrial operator, securing capacity and optimizing budgets are critical. Targon stands out as the partner that actually ships on time.",
  },
  {
    name: "Sarah Mitchell",
    title: "VP, Operations",
    quote:
      "The team pairs real-world manufacturing knowledge with modern tech. We cut our launch runway in half and scaled confidently.",
  },
  {
    name: "David Chen",
    title: "Director of Logistics",
    quote:
      "Every engagement is grounded, clear, and measurable. Targon’s tooling makes it easy for our teams to course-correct in hours, not weeks.",
  },
  {
    name: "Emma Rodriguez",
    title: "Head of Merchandising",
    quote:
      "We rely on Targon to deliver sustainable products without compromising pace. They sweat the details so our buyers don’t have to.",
  },
  {
    name: "James Thompson",
    title: "Chief Revenue Officer",
    quote:
      "From forecasting to fulfillment, Targon keeps the flywheel spinning. We’ve unlocked new categories with full margin visibility.",
  },
  {
    name: "Lisa Anderson",
    title: "Plant Manager",
    quote:
      "Implementation was the smoothest I’ve seen. Their crews show up, document everything, then leave us with systems the team actually loves using.",
  },
]

const marqueeItems = [...testimonials, ...testimonials]

const differentiators = [
  {
    heading: "Circular-first manufacturing",
    copy: "GRS-certified inputs and climate-friendly production lines that scale with real demand.",
  },
  {
    heading: "Operational telemetry",
    copy: "Unified control tower for inventory, margin, and workforce readiness—built on the EcomOS platform.",
  },
  {
    heading: "Partnership DNA",
    copy: "We embed with teams, run the playbooks alongside them, and hand off durable systems—not slide decks.",
  },
]

export default function HomePage() {
  return (
    <main className="flex flex-col gap-24 bg-[#021b2b] pb-24 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={assetUrl("/home/hero-bg.png")}
            alt=""
            fill
            priority
            className="object-cover object-center opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#021b2b]/20 via-[#021b2b]/80 to-[#021b2b]" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 py-24 lg:flex-row lg:items-center lg:py-32">
          <div className="max-w-xl">
            <p className="text-sm uppercase tracking-[0.32em] text-[#00C2B9]">Innovation to Impact</p>
            <h1 className={`mt-6 text-4xl font-extrabold leading-tight lg:text-6xl ${styles.heroCopy}`}>
              Everyday operations, re-engineered for sustainable growth.
            </h1>
            <p className="mt-6 text-base leading-relaxed text-white/80 lg:text-lg">
              Targon Global builds circular-first supply chains and the software that keeps them sharp. From concept to
              floor launch, we’re the quiet partner powering your next release.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-full bg-[#00C2B9] px-8 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-[#002433] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#00C2B9]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2B9]"
              >
                Explore Targon
              </Link>
              <span className="text-sm text-white/60">GRS Certified • Climate Pledge Friendly</span>
            </div>
          </div>

          <div className="relative hidden flex-1 justify-end lg:flex">
            <div className="relative h-[320px] w-[320px] overflow-hidden rounded-[160px] bg-[#00C2B9]/10 backdrop-blur">
              <Image
                src={assetUrl("/home/hero-floating.png")}
                alt=""
                fill
                priority
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>

        <div className="relative mx-auto mt-10 flex max-w-5xl flex-wrap justify-center gap-6 px-6 pb-8 sm:mt-12">
          <div className="relative h-44 w-44 overflow-hidden rounded-full border border-white/10 bg-white/5 sm:h-56 sm:w-56 lg:h-64 lg:w-64">
            <Image
              src={assetUrl("/home/circle-left.png")}
              alt=""
              fill
              className="object-cover object-center"
            />
            <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
          </div>
          <div className="relative h-52 w-52 overflow-hidden rounded-full border border-[#00C2B9]/30 bg-[#00C2B9]/20 sm:h-64 sm:w-64 lg:h-72 lg:w-72">
            <Image
              src={assetUrl("/home/circle-center.png")}
              alt=""
              fill
              className="object-cover object-center"
            />
            <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
          </div>
          <div className="relative h-40 w-40 overflow-hidden rounded-full border border-white/10 bg-white/5 sm:h-52 sm:w-52 lg:h-60 lg:w-60">
            <Image
              src={assetUrl("/home/circle-right.png")}
              alt=""
              fill
              className="object-cover object-center"
            />
            <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#021b2b] via-[#021b2b]/90 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-3">
            {differentiators.map((item) => (
              <div
                key={item.heading}
                className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20"
              >
                <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">Why Targon</p>
                <h3 className="mt-4 text-xl font-semibold text-white">{item.heading}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/75">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#021b2b] via-[#010b14] to-[#00070f]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col items-center gap-6 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">What our partners say</p>
            <h2 className="text-3xl font-semibold sm:text-4xl">The world needs what we’re building—now.</h2>
            <p className="max-w-2xl text-balance text-sm text-white/70">
              All feedback comes directly from transformation programs we’ve shipped in the last twelve months.
            </p>
          </div>

          <div className={`mt-16 overflow-hidden ${styles.marquee}`}>
            <div className={styles.track}>
              {marqueeItems.map((testimonial, index) => (
                <article
                  key={`${testimonial.name}-${index}`}
                  className={`w-80 flex-shrink-0 rounded-2xl p-6 text-left text-sm text-white/85 ${styles.testimonialCard}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00C2B9]/20 text-sm font-semibold text-[#00C2B9]">
                      {testimonial.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/50">{testimonial.title}</p>
                    </div>
                  </div>
                  <p className="mt-5 leading-relaxed text-white/80">{testimonial.quote}</p>
                  <div className="mt-6 flex gap-1 text-base text-[#00C2B9]">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <span key={idx}>★</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
