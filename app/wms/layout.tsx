import AppShell from '@/components/layout/app-shell'

export default function WMSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}