'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { assetUrl } from '@/core-services/assets/cdn'

const pillars = [
  {
    id: 'mission',
    label: 'Mission',
    headline: 'Simplify complexities by innovatively and efficiently using intelligent business processes',
  },
  {
    id: 'vision',
    label: 'Vision',
    headline: 'Create a world where smart, sustainable commerce is simple, scalable, and universally accessible',
  },
  {
    id: 'values',
    label: 'Values',
    headline: 'Operate with integrity, build for durability, and invest in partnerships that elevate every release',
  },
]

const commitmentCopy = [
  'Circular-first materials backed by continuous audits and certification.',
  'Operational telemetry that surfaces actions, not just reports.',
  'Embedded partnership that leaves teams autonomous and confident.',
]

export default function AboutPage() {
  const [activePillar, setActivePillar] = useState(pillars[1].id)
  const active = useMemo(() => pillars.find((pillar) => pillar.id === activePillar) ?? pillars[1], [activePillar])

  const figureAsset = useMemo(() => assetUrl(`/about/${activePillar}.png`), [activePillar])

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

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-24 lg:py-32">
          <div className="space-y-6 text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-[#00C2B9]">Targon’s Purpose</p>
            <h1 className="text-4xl font-extrabold uppercase leading-tight md:text-5xl">
              The simplest choices and the most efficient products.
            </h1>
            <div className="flex flex-wrap justify-center gap-4">
              {pillars.map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setActivePillar(pillar.id)}
                  className={`w-36 rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-[0.25em] transition ${
                    pillar.id === activePillar
                      ? 'border-[#00C2B9] bg-[#00C2B9] text-[#002433] shadow-lg shadow-[#00C2B9]/30'
                      : 'border-white/30 bg-transparent text-white/80 hover:border-white/60'
                  }`}
                >
                  {pillar.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#010f1d] via-[#010b16] to-[#00060d]" />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 py-24 text-center">
          <span className="text-sm uppercase tracking-[0.35em] text-[#00C2B9]">{active.label}</span>
          <Image src={figureAsset} alt={`${active.label} illustration`} width={640} height={360} className="w-full max-w-3xl" />
          <h2 className="text-3xl font-semibold uppercase leading-snug md:text-4xl">{active.headline}</h2>
          <div className="mt-6 grid w-full gap-6 text-sm uppercase tracking-[0.3em] text-white/60 md:grid-cols-3">
            {commitmentCopy.map((copy, index) => (
              <p key={index} className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 leading-loose">
                {copy}
              </p>
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
