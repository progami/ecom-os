export default function MarketingBg({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Base gradient behind content (no negative z-index to avoid disappearing) */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(60rem 30rem at 85% 10%, rgba(0,194,185,0.35) 0%, rgba(0,194,185,0.12) 40%, transparent 70%), linear-gradient(180deg, #002C51 0%, #002C51 50%, #6F7B8B 100%)",
        }}
      />
      <div className="relative z-10 text-white">
        {children}
      </div>
    </div>
  )
}
