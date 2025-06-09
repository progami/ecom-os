import AppShell from '@/components/layout/app-shell'

export default function BookkeepingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}