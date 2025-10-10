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

export default function HomePage() {
  return (
    <main className="flex flex-col bg-brand-primary text-white">
      <section className="relative isolate overflow-hidden pb-20 pt-16 sm:pt-20 lg:pb-24 xl:min-h-[682.67px] 2xl:min-h-[682.67px] 2xl:pb-0 2xl:pt-0">
        <div className="absolute inset-0">
          <Image
            src={assetUrl('/home/hero-innovation.png')}
            alt=""
            fill
            priority
            className="object-cover object-left-top opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-primaryMuted/45 to-brand-primaryDeep/80" />
        </div>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute hidden 2xl:block 2xl:z-10"
          style={{ top: '377px', left: '1157.34px' }}
        >
          <span className="block h-[66.67px] w-[66.67px] rounded-tl-[18px] bg-brand-accent" />
        </span>

        <div className="relative mx-auto flex w-full max-w-[1440px] flex-col items-center px-6 text-right sm:px-10 lg:px-16 2xl:max-w-[1920px] 2xl:px-0">
          <div className="relative z-20 flex min-h-[360px] w-full flex-col items-end justify-center gap-8 text-right sm:min-h-[440px] sm:items-end sm:text-right lg:min-h-[520px] lg:items-end xl:min-h-[600px] xl:items-end xl:justify-start 2xl:absolute 2xl:left-[970.66px] 2xl:top-[173px] 2xl:min-h-0 2xl:w-auto 2xl:items-end 2xl:justify-start 2xl:gap-0">
            <h1 className="flex flex-col text-4xl font-bold uppercase leading-none text-white sm:text-6xl lg:text-[72px] xl:text-[80px] 2xl:text-[96px]">
              <span className="block leading-none">INNOVATION</span>
              <span className="block leading-none">TO</span>
              <span className="block leading-none">IMPACT</span>
            </h1>
          </div>
        </div>
      </section>

      <section className="relative bg-brand-primary py-16 sm:py-20 2xl:min-h-[1100px] 2xl:py-0">
        <div className="relative mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16 2xl:max-w-[1920px] 2xl:px-0">
          <div className="relative flex w-full flex-col items-center gap-6 text-center sm:items-center sm:text-center">
            <div className={`relative z-20 flex w-full max-w-2xl flex-col gap-6 ${styles.heroCopy}`}>
              <h2 className="flex flex-col text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-[36px] xl:text-[40px] 2xl:text-[48px] 2xl:leading-[100%]">
                <span>What the world needs next</span>
                <span>we are making now.</span>
              </h2>
            </div>

            <Link
              href="/about"
              className={`inline-flex h-[60px] w-[241.33px] items-center justify-center rounded-none rounded-tl-[18px] bg-brand-accent text-[20px] font-bold uppercase text-brand-supportNavy shadow-[0_12px_24px_rgba(0,194,185,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(0,194,185,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary ${styles.heroCta} z-20`}
            >
              ABOUT US
            </Link>
          </div>

          <div className={`relative mt-16 w-full 2xl:mt-0 ${styles.ellipseLayer}`}>
            <div className="flex flex-wrap justify-center gap-8 2xl:hidden">
              <div className="relative h-40 w-40 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[0_18px_45px_rgba(0,0,0,0.35)] md:h-48 md:w-48 lg:h-56 lg:w-56">
                <Image src={assetUrl('/home/circle-left.png')} alt="" fill className="object-cover object-center" />
              </div>
              <div className="relative h-48 w-48 overflow-hidden rounded-full border border-brand-accent/30 bg-brand-accent/15 shadow-[0_18px_45px_rgba(0,0,0,0.35)] md:h-56 md:w-56 lg:h-64 lg:w-64">
                <Image src={assetUrl('/home/circle-center.png')} alt="" fill className="object-cover object-center" />
              </div>
              <div className="relative h-36 w-36 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-[0_18px_45px_rgba(0,0,0,0.35)] md:h-44 md:w-44 lg:h-52 lg:w-52">
                <Image src={assetUrl('/home/circle-right.png')} alt="" fill className="object-cover object-center" />
              </div>
            </div>

            <span className={`${styles.heroEllipse} ${styles.ellipsePlastic} hidden 2xl:block`}>
              <Image src={assetUrl('/home/circle-left.png')} alt="" fill className="object-cover object-center" />
            </span>
            <span className={`${styles.heroEllipse} ${styles.ellipseBinocular} hidden 2xl:block`}>
              <Image src={assetUrl('/home/circle-center.png')} alt="" fill className="object-cover object-center" />
            </span>
            <span className={`${styles.heroEllipse} ${styles.ellipseGreen} hidden 2xl:block`}>
              <Image src={assetUrl('/home/circle-right.png')} alt="" fill className="object-cover object-center" />
            </span>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary via-brand-primaryDeep to-brand-primaryOverlay" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold uppercase leading-tight text-white md:text-4xl">What our customers think</h2>
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/20 text-sm font-semibold text-brand-accent">
                      {testimonial.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.name}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-brand-accent">{testimonial.title}</p>
                    </div>
                  </div>
                  <p className="mt-5 leading-relaxed">{testimonial.quote}</p>
                  <div className="mt-6 flex gap-1 text-base text-brand-accent">
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
    </main>
  )
}
