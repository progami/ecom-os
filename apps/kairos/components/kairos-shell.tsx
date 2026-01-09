'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Database, Menu, Sparkles } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/forecasts', label: 'Forecasts', icon: BarChart3 },
  { href: '/sources', label: 'Data Sources', icon: Database },
  { href: '/models', label: 'Models', icon: Sparkles },
] as const;

export function KairosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 space-y-4">
            <Link href="/forecasts" className="block focus:outline-none">
              <Card className="bg-white/70 shadow-sm backdrop-blur dark:bg-slate-950/50">
                <CardContent className="p-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Kairos
                  </div>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Forecasting workspace
                  </div>
                </CardContent>
              </Card>
            </Link>

            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={active ? 'secondary' : 'ghost'}
                    className={cn('w-full justify-start gap-2', active && 'shadow-sm')}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" aria-hidden />
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">Theme</div>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open navigation menu">
                    <Menu className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Navigate</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {NAV_ITEMS.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" aria-hidden />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Kairos</div>
            </div>
            <ThemeToggle />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
