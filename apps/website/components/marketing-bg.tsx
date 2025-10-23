import { brandColors } from "@ecom-os/theme"

export default function MarketingBg({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Base gradient behind content (no negative z-index to avoid disappearing) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            `radial-gradient(60rem 30rem at 85% 10%, ${brandColors.accentShadow} 0%, rgba(0,194,185,0.12) 40%, transparent 70%), linear-gradient(180deg, ${brandColors.primary} 0%, ${brandColors.primaryMuted} 50%, ${brandColors.slate} 100%)`,
        }}
      />
      <div className="relative z-10 text-white">
        {children}
      </div>
    </div>
  )
}
