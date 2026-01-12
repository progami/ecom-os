import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'End User License Agreement – Targon Global',
  description: 'Terms and conditions for using Targon Global software and services.',
}

export default function EulaPage() {
  return (
    <main className="flex flex-col bg-brand-primary text-white">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary via-brand-primaryDeep to-brand-primaryOverlay" />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center lg:px-16">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">Legal</p>
          <h1 className="text-4xl font-extrabold uppercase leading-tight md:text-5xl">
            End User License Agreement
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/70">
            Please read this agreement carefully before using our software and services.
          </p>
          <p className="text-sm text-white/50">Last updated: January 2026</p>
        </div>
      </section>

      {/* Content Section */}
      <section className="relative pb-24">
        <div className="relative mx-auto w-full max-w-4xl px-6 lg:px-16">
          <div className="space-y-12">
            {/* Introduction */}
            <LegalSection title="1. Introduction">
              <p>
                This End User License Agreement (&quot;Agreement&quot;) is a legal agreement between you
                (&quot;User&quot; or &quot;you&quot;) and Targon Global Ltd (&quot;Company,&quot; &quot;we,&quot; or &quot;us&quot;) for the use
                of our software applications, platforms, and related services (collectively, the
                &quot;Services&quot;).
              </p>
              <p>
                By accessing or using our Services, you agree to be bound by this Agreement. If you
                do not agree to these terms, do not use our Services.
              </p>
            </LegalSection>

            {/* License Grant */}
            <LegalSection title="2. License Grant">
              <p>
                Subject to the terms of this Agreement, we grant you a limited, non-exclusive,
                non-transferable, revocable license to access and use the Services for your
                internal business purposes.
              </p>
              <p>This license does not include the right to:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Modify, copy, or create derivative works of the Services</li>
                <li>Reverse engineer, decompile, or disassemble the Services</li>
                <li>Rent, lease, lend, sell, or sublicense the Services</li>
                <li>Use the Services for any unlawful purpose</li>
                <li>Remove or alter any proprietary notices or labels</li>
              </ul>
            </LegalSection>

            {/* User Responsibilities */}
            <LegalSection title="3. User Responsibilities">
              <p>You agree to:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Provide accurate and complete information when creating an account</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Use the Services in compliance with all applicable laws and regulations</li>
                <li>Not interfere with or disrupt the Services or servers</li>
              </ul>
            </LegalSection>

            {/* Data and Privacy */}
            <LegalSection title="4. Data and Privacy">
              <p>
                Your use of the Services is also governed by our Privacy Policy, which describes
                how we collect, use, and protect your information. By using the Services, you
                consent to our data practices as described in the Privacy Policy.
              </p>
              <p>
                You retain ownership of any data you submit to the Services. You grant us a
                limited license to use this data solely for the purpose of providing the Services
                to you.
              </p>
            </LegalSection>

            {/* Third-Party Integrations */}
            <LegalSection title="5. Third-Party Integrations">
              <p>
                The Services may integrate with third-party applications and services, including
                but not limited to QuickBooks Online, Amazon Seller Central, and other business
                platforms. Your use of these integrations is subject to the respective third-party
                terms of service.
              </p>
              <p>
                We are not responsible for the availability, accuracy, or functionality of
                third-party services.
              </p>
            </LegalSection>

            {/* Intellectual Property */}
            <LegalSection title="6. Intellectual Property">
              <p>
                The Services and all associated intellectual property rights are and shall remain
                the exclusive property of Targon Global Ltd. This Agreement does not grant you any
                rights to our trademarks, logos, or other brand features.
              </p>
            </LegalSection>

            {/* Disclaimer of Warranties */}
            <LegalSection title="7. Disclaimer of Warranties">
              <p>
                THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
                KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES
                OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p>
                We do not warrant that the Services will be uninterrupted, error-free, or secure.
              </p>
            </LegalSection>

            {/* Limitation of Liability */}
            <LegalSection title="8. Limitation of Liability">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, TARGON GLOBAL LTD SHALL NOT BE LIABLE FOR
                ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
                OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
              </p>
              <p>
                Our total liability for any claims arising from this Agreement shall not exceed
                the amounts paid by you to us in the twelve (12) months preceding the claim.
              </p>
            </LegalSection>

            {/* Termination */}
            <LegalSection title="9. Termination">
              <p>
                We may terminate or suspend your access to the Services immediately, without prior
                notice or liability, for any reason, including breach of this Agreement.
              </p>
              <p>
                Upon termination, your right to use the Services will immediately cease. All
                provisions of this Agreement that should survive termination shall survive.
              </p>
            </LegalSection>

            {/* Governing Law */}
            <LegalSection title="10. Governing Law">
              <p>
                This Agreement shall be governed by and construed in accordance with the laws of
                England and Wales, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising from this Agreement shall be subject to the exclusive
                jurisdiction of the courts of England and Wales.
              </p>
            </LegalSection>

            {/* Changes to Agreement */}
            <LegalSection title="11. Changes to This Agreement">
              <p>
                We reserve the right to modify this Agreement at any time. We will notify you of
                any material changes by posting the updated Agreement on our website. Your
                continued use of the Services after such changes constitutes acceptance of the
                modified Agreement.
              </p>
            </LegalSection>

            {/* Contact */}
            <LegalSection title="12. Contact Us">
              <p>
                If you have any questions about this Agreement, please contact us at:
              </p>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-6">
                <p className="font-semibold text-white">Targon Global Ltd</p>
                <p className="mt-2 text-white/70">
                  Email:{' '}
                  <a
                    href="mailto:legal@targonglobal.com"
                    className="text-brand-accent hover:underline"
                  >
                    legal@targonglobal.com
                  </a>
                </p>
              </div>
            </LegalSection>
          </div>
        </div>
      </section>
    </main>
  )
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white md:text-2xl">{title}</h2>
      <div className="space-y-4 text-base leading-relaxed text-white/80">{children}</div>
    </div>
  )
}
