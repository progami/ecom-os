import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy – Targon Global',
  description: 'How Targon Global collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <main className="flex flex-col bg-brand-primary text-white">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary via-brand-primaryDeep to-brand-primaryOverlay" />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center lg:px-16">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">Legal</p>
          <h1 className="text-4xl font-extrabold uppercase leading-tight md:text-5xl">
            Privacy Policy
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/70">
            Your privacy is important to us. This policy explains how we handle your data.
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
                Targon Global Ltd (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting
                your privacy. This Privacy Policy explains how we collect, use, disclose, and
                safeguard your information when you use our software applications, platforms, and
                services (collectively, the &quot;Services&quot;).
              </p>
              <p>
                Please read this Privacy Policy carefully. By using our Services, you consent to
                the practices described in this policy.
              </p>
            </LegalSection>

            {/* Information We Collect */}
            <LegalSection title="2. Information We Collect">
              <h3 className="font-semibold text-white">2.1 Information You Provide</h3>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Account Information:</strong> Name, email address, company name, and
                  contact details when you create an account
                </li>
                <li>
                  <strong>Business Data:</strong> Financial data, inventory information, and other
                  business data you submit through our Services
                </li>
                <li>
                  <strong>Communications:</strong> Information you provide when you contact us for
                  support or feedback
                </li>
              </ul>

              <h3 className="mt-6 font-semibold text-white">2.2 Information Collected Automatically</h3>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Usage Data:</strong> Information about how you use our Services,
                  including features accessed and actions taken
                </li>
                <li>
                  <strong>Device Information:</strong> Browser type, operating system, and device
                  identifiers
                </li>
                <li>
                  <strong>Log Data:</strong> IP addresses, access times, and referring URLs
                </li>
              </ul>

              <h3 className="mt-6 font-semibold text-white">2.3 Third-Party Data</h3>
              <p>
                When you connect third-party services (such as QuickBooks Online or Amazon Seller
                Central), we may collect data from those services as authorized by you to provide
                our Services.
              </p>
            </LegalSection>

            {/* How We Use Information */}
            <LegalSection title="3. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Provide, maintain, and improve our Services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
                <li>Detect, investigate, and prevent fraudulent transactions and abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </LegalSection>

            {/* Data Sharing */}
            <LegalSection title="4. How We Share Your Information">
              <p>We may share your information in the following circumstances:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Service Providers:</strong> With vendors and service providers who need
                  access to perform services on our behalf
                </li>
                <li>
                  <strong>Business Transfers:</strong> In connection with any merger, sale of
                  company assets, or acquisition
                </li>
                <li>
                  <strong>Legal Requirements:</strong> When required by law or to protect our
                  rights, privacy, safety, or property
                </li>
                <li>
                  <strong>With Your Consent:</strong> When you have given us explicit consent to
                  share your information
                </li>
              </ul>
              <p className="mt-4 rounded-lg border border-brand-accent/30 bg-brand-accent/10 p-4">
                <strong className="text-brand-accent">We do not sell your personal information.</strong>
              </p>
            </LegalSection>

            {/* Data Security */}
            <LegalSection title="5. Data Security">
              <p>
                We implement appropriate technical and organizational security measures to protect
                your information against unauthorized access, alteration, disclosure, or
                destruction. These measures include:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and audits</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Employee training on data protection practices</li>
              </ul>
              <p>
                However, no method of transmission over the Internet or electronic storage is
                completely secure, and we cannot guarantee absolute security.
              </p>
            </LegalSection>

            {/* Data Retention */}
            <LegalSection title="6. Data Retention">
              <p>
                We retain your information for as long as your account is active or as needed to
                provide you Services. We may also retain and use your information to comply with
                legal obligations, resolve disputes, and enforce our agreements.
              </p>
              <p>
                You may request deletion of your data by contacting us. We will delete or
                anonymize your information within 30 days, unless we are required to retain it for
                legal purposes.
              </p>
            </LegalSection>

            {/* Your Rights */}
            <LegalSection title="7. Your Rights">
              <p>Depending on your location, you may have the following rights:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Access:</strong> Request a copy of the personal information we hold
                  about you
                </li>
                <li>
                  <strong>Correction:</strong> Request correction of inaccurate or incomplete
                  information
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your personal information
                </li>
                <li>
                  <strong>Portability:</strong> Request a copy of your data in a portable format
                </li>
                <li>
                  <strong>Objection:</strong> Object to processing of your personal information
                </li>
                <li>
                  <strong>Restriction:</strong> Request restriction of processing in certain
                  circumstances
                </li>
              </ul>
              <p>
                To exercise these rights, please contact us at{' '}
                <a href="mailto:privacy@targonglobal.com" className="text-brand-accent hover:underline">
                  privacy@targonglobal.com
                </a>
                .
              </p>
            </LegalSection>

            {/* Cookies */}
            <LegalSection title="8. Cookies and Tracking">
              <p>
                We use cookies and similar tracking technologies to collect and track information
                about your use of our Services. You can control cookies through your browser
                settings, but disabling cookies may limit your use of certain features.
              </p>
              <p>Types of cookies we use:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong>Essential Cookies:</strong> Required for the Services to function
                  properly
                </li>
                <li>
                  <strong>Analytics Cookies:</strong> Help us understand how you use our Services
                </li>
                <li>
                  <strong>Preference Cookies:</strong> Remember your settings and preferences
                </li>
              </ul>
            </LegalSection>

            {/* International Transfers */}
            <LegalSection title="9. International Data Transfers">
              <p>
                Your information may be transferred to and processed in countries other than your
                country of residence. These countries may have different data protection laws. We
                ensure appropriate safeguards are in place to protect your information in
                accordance with this Privacy Policy.
              </p>
            </LegalSection>

            {/* Children */}
            <LegalSection title="10. Children&apos;s Privacy">
              <p>
                Our Services are not intended for children under 16 years of age. We do not
                knowingly collect personal information from children. If we become aware that we
                have collected information from a child, we will take steps to delete it.
              </p>
            </LegalSection>

            {/* Changes */}
            <LegalSection title="11. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by posting the new Privacy Policy on this page and updating the
                &quot;Last updated&quot; date.
              </p>
              <p>
                We encourage you to review this Privacy Policy periodically for any changes.
              </p>
            </LegalSection>

            {/* Contact */}
            <LegalSection title="12. Contact Us">
              <p>
                If you have any questions about this Privacy Policy or our data practices, please
                contact us:
              </p>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-6">
                <p className="font-semibold text-white">Targon Global Ltd</p>
                <p className="mt-2 text-white/70">
                  Email:{' '}
                  <a
                    href="mailto:privacy@targonglobal.com"
                    className="text-brand-accent hover:underline"
                  >
                    privacy@targonglobal.com
                  </a>
                </p>
                <p className="mt-1 text-white/70">
                  For general inquiries:{' '}
                  <a
                    href="mailto:hello@targonglobal.com"
                    className="text-brand-accent hover:underline"
                  >
                    hello@targonglobal.com
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
