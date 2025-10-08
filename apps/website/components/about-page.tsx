"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"

import { assetUrl } from "@/core-services/assets/cdn"

const pillars = [
  {
    id: "mission",
    title: "Mission",
    summary: "Designing better everyday operations for builders, brands, and the teams that support them.",
    copy: [
      "We assemble cross-functional crews that ship durable systems while transferring knowledge to your internal team.",
      "Our frameworks keep the focus on momentum: smart automation, measurable guardrails, and tools that free your experts to do their best work.",
    ],
  },
  {
    id: "vision",
    title: "Vision",
    summary: "Circular supply chains as the default, with accessible tech orchestrating every handoff.",
    copy: [
      "We envision a platform era where sustainable manufacturing isn’t a premium tier—it’s baseline.",
      "To get there, we invest in materials science, multi-channel telemetry, and distributed fulfillment playbooks.",
    ],
  },
  {
    id: "values",
    title: "Values",
    summary: "Humility in partnership, clarity in execution, and boldness in iteration.",
    copy: [
      "We operate transparently, share the numbers, and document every decision so you’re never guessing.",
      "We chase compounding gains: better tooling, tighter loops, and clear accountability from day zero.",
    ],
  },
]

const commitments = [
  {
    title: "Circular-first materials",
    detail: "GRS-certified inputs and continuous audits to keep every release compliant and future-proof.",
  },
  {
    title: "Operational telemetry",
    detail: "Unified insight into inventory, margin, workforce, and customer signals—triggered by action, not reports.",
  },
  {
    title: "Embedded partnership",
    detail: "We stand up autonomous teams, leave behind documentation, and build the muscle memory that keeps momentum.",
  },
]

export default function AboutPage() {
  const [activeId, setActiveId] = useState(pillars[0].id)
  const activePillar = pillars.find((pillar) => pillar.id === activeId) ?? pillars[0]

  return (
    <main className="flex flex-col gap-24 bg-[#021b2b] pb-24 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={assetUrl("/about/about-bg.png")}
            alt=""
            fill
            priority
            className="object-cover object-center opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#021b2b]/60 via-[#021b2b] to-[#000c17]" />
        </div>

        <div className="relative mx-auto flex max-w-6xl flex-col gap-14 px-6 py-24 lg:flex-row lg:items-start lg:py-32">
          <div className="max-w-xl space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">About Targon</p>
            <h1 className="text-4xl font-extrabold leading-tight lg:text-5xl">
              Purpose-built teams taking ideas from whiteboard to warehouse.
            </h1>
            <p className="text-base leading-relaxed text-white/75">
              We’re the builders behind the scenes—engineers, operators, and program leads who stand up resilient
              supply chains, guide software transformations, and leave the playbooks so you can scale on your terms.
            </p>

            <div className="flex flex-wrap gap-3">
              {pillars.map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => setActiveId(pillar.id)}
                  className={`rounded-full border px-6 py-2 text-sm font-semibold uppercase tracking-[0.25em] transition ${
                    pillar.id === activeId
                      ? "border-[#00C2B9] bg-[#00C2B9] text-[#002433] shadow-lg shadow-[#00C2B9]/30"
                      : "border-white/20 bg-white/5 text-white/70 hover:border-white/40 hover:text-white"
                  }`}
                >
                  {pillar.title}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex flex-1 flex-col items-center gap-8 lg:items-end">
            <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_22px_55px_rgba(0,0,0,0.45)]">
              <Image
                src={assetUrl("/about/about-portrait.png")}
                alt=""
                width={2366}
                height={2371}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="flex w-full max-w-sm gap-4">
              <div className="flex-1 rounded-2xl border border-[#00C2B9]/30 bg-[#00C2B9]/15 px-5 py-4 text-sm text-[#00C2B9]">
                Mission
              </div>
              <div className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-5 py-4 text-sm text-white/80">
                Values
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#021b2b] via-[#021b2b]/70 to-[#010b16]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:flex-row lg:items-start lg:gap-16">
          <div className="max-w-xl space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">{activePillar.title}</p>
            <h2 className="text-3xl font-semibold">{activePillar.summary}</h2>
            <div className="space-y-4 text-sm leading-relaxed text-white/75">
              {activePillar.copy.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid flex-1 gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm lg:grid-cols-3">
            {commitments.map((commitment) => (
              <div key={commitment.title} className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-[#00C2B9]">Commitment</p>
                <h3 className="text-lg font-semibold text-white">{commitment.title}</h3>
                <p className="text-sm leading-relaxed text-white/70">{commitment.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#010b16] to-[#00070f]" />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-col items-center gap-5 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-[#00C2B9]">Ready to collaborate?</p>
            <h2 className="text-3xl font-semibold sm:text-4xl">Let&apos;s shape the next release together.</h2>
            <p className="max-w-2xl text-sm text-white/70">
              Drop us a note with your roadmap and we’ll assemble a team to explore the fastest, cleanest path to
              production.
            </p>
            <Link
              href="mailto:founders@targonglobal.com"
              className="inline-flex items-center justify-center rounded-full bg-[#00C2B9] px-8 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-[#002433] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#00C2B9]/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2B9]"
            >
              Start the conversation
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
