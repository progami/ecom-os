'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { assetUrl } from '@/core-services/assets/cdn'

const pillars = [
  {
    id: 'mission',
    label: 'Mission',
    headline: 'Designing better everyday operations for builders and brands.',
    body: [
      'We assemble cross-functional crews that ship durable systems while transferring knowledge to your internal team.',
      'Momentum matters. Our frameworks keep the focus on measurable guardrails, smart automation, and tools your experts actually love using.',
    ],
  },
  {
    id: 'vision',
    label: 'Vision',
    headline: 'Circular supply chains as the default, orchestrated by accessible tech.',
    body: [
      'Sustainability should never be a premium tier. We invest in materials science, telemetry, and distributed fulfillment so you can scale responsibly.',
      'The result: faster releases, cleaner execution, and a platform era where doing the right thing is the standard.',
    ],
  },
  {
    id: 'values',
    label: 'Values',
    headline: 'Humility in partnership. Clarity in execution. Boldness in iteration.',
    body: [
      'We operate transparently, share the metrics, and document every decision so your teams are never guessing.',
      'Every engagement is built on compounding gains—better tooling, tighter loops, and clear accountability from day zero.',
    ],
  },
]

const commitments = [
  {
    title: 'Circular-first materials',
    description: 'GRS-certified inputs and continuous audits keep every release compliant and future-proof.',
  },
  {
    title: 'Operational telemetry',
    description: 'Unified insight into inventory, margin, workforce, and customer signals—triggered by action, not reports.',
  },
  {
    title: 'Embedded partnership',
    description: 'We stand up autonomous teams, leave behind documentation, and build the muscle memory that keeps momentum.',
  },
]

export default function AboutPage() {
  const [activePillar, setActivePillar] = useState(pillars[0].id)
  const active = useMemo(() => pillars.find((pillar) => pillar.id === activePillar) ?? pillars[0], [activePillar])

  return (
    <main className="flex flex-col gap-24 bg-[#021b2b] pb-24 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={assetUrl('/about/about-bg.png')}
            alt=""
            fill
            priority
            className="object-cover object-center opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#021b2b]/20 via-[#021b2b]/80 to-[#021b2b]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-24 lg:flex-row lg:items-center lg:py-32">
          <div className="flex-1 space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">About Targon</p>
            <h1 className="text-4xl font-extrabold uppercase leading-tight md:text-5xl">
              Purpose-built teams taking ideas from whiteboard to warehouse.
            </h1>
            <p className="text-base leading-relaxed text-white/75 md:text-lg">
              Engineers, operators, and program leads who stand up resilient supply chains, guide software transformations,
              and leave the playbooks so you can scale on your terms.
            </p>

            <div className="flex flex-wrap gap-3">
              {pillars.map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setActivePillar(pillar.id)}
                  className={`w-32 rounded-full border px-6 py-2 text-sm font-semibold uppercase tracking-[0.25em] transition md:w-36 ${
                    pillar.id === activePillar
                      ? 'border-[#00C2B9] bg-[#00C2B9] text-[#002433] shadow-lg shadow-[#00C2B9]/30'
                      : 'border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white'
                  }`}
                >
                  {pillar.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex flex-1 justify-center lg:justify-end">
            <div className="relative h-[360px] w-[360px] overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_25px_60px_rgba(0,0,0,0.4)] lg:h-[420px] lg:w-[420px]">
              <Image
                src={assetUrl('/about/about-portrait.png')}
                alt="Targon team"
                fill
                priority
                className="object-cover object-center"
              />
            </div>
            <Image
              src={assetUrl('/about/about-circle.png')}
              alt="Decorative circle"
              width={480}
              height={480}
              className="pointer-events-none absolute -bottom-16 -left-12 hidden opacity-60 lg:block"
            />
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#021b2b] via-[#010e1d] to-[#00070f]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-20 lg:flex-row lg:items-start">
          <div className="flex-1 space-y-5">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">{active.label}</p>
            <h2 className="text-3xl font-semibold md:text-4xl">{active.headline}</h2>
            <div className="space-y-4 text-sm leading-relaxed text-white/80 md:text-base">
              {active.body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid flex-1 gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {commitments.map((commitment) => (
              <div key={commitment.title} className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-[#00C2B9]">Commitment</p>
                <h3 className="text-lg font-semibold text-white">{commitment.title}</h3>
                <p className="text-sm leading-relaxed text-white/70">{commitment.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00070f] to-[#00030a]" />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">Ready to collaborate?</p>
          <h2 className="text-3xl font-semibold md:text-4xl">Let’s shape the next release together.</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            Share your roadmap and we’ll assemble the crew to explore the fastest, cleanest path to production. We operate as an embedded partner from the first workshop to the handoff playbooks.
          </p>
          <Link
            href="mailto:founders@targonglobal.com"
            className="inline-flex items-center justify-center rounded-full border border-[#00C2B9] px-8 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-[#00C2B9] transition hover:-translate-y-0.5 hover:bg-[#00C2B9]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2B9]"
          >
            Start the conversation
          </Link>
        </div>
      </section>
    </main>
  )
}
