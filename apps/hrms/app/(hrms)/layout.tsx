'use client';

import Link from 'next/link';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  FolderIcon,
  DocumentIcon,
  CalendarIcon,
  CalendarDaysIcon,
  MenuIcon,
  XIcon,
  ClipboardDocumentCheckIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  OrgChartIcon,
  UsersIcon,
  LockClosedIcon,
  ChartBarIcon,
} from '@/components/ui/Icons';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { NavigationHistoryProvider } from '@/lib/navigation-history';
import { MeApi } from '@/lib/api-client';
import { CommandPalette } from '@/components/search/CommandPalette';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requireSuperAdmin?: boolean;
  requireHR?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
  requireSuperAdmin?: boolean;
  requireHR?: boolean;
}

const navigation: NavSection[] = [
  {
    title: 'Home',
    items: [
      { name: 'Work Queue', href: '/work', icon: BellIcon },
      { name: 'My Hub', href: '/hub', icon: HomeIcon },
      { name: 'Tasks', href: '/tasks', icon: CheckCircleIcon },
    ],
  },
  {
    title: 'People',
    items: [
      { name: 'Employees', href: '/employees', icon: UsersIcon },
      { name: 'Org Chart', href: '/organogram', icon: OrgChartIcon },
      { name: 'Leave', href: '/leave', icon: CalendarDaysIcon },
      { name: 'Reviews', href: '/performance/reviews', icon: ClipboardDocumentCheckIcon },
      { name: 'Cases', href: '/cases', icon: ExclamationTriangleIcon },
      { name: 'Policies', href: '/policies', icon: DocumentIcon },
      { name: 'Resources', href: '/resources', icon: FolderIcon },
      { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
    ],
  },
  {
    title: 'Admin',
    requireHR: true,
    items: [
      {
        name: 'Access Management',
        href: '/admin/access',
        icon: LockClosedIcon,
        requireSuperAdmin: true,
      },
      { name: 'Audit Logs', href: '/audit-logs', icon: LockClosedIcon, requireHR: true },
      { name: 'Ops Dashboards', href: '/admin/dashboards', icon: ChartBarIcon, requireHR: true },
    ],
  },
];

function Sidebar({
  onClose,
  isSuperAdmin,
  isHR,
}: {
  onClose?: () => void;
  isSuperAdmin: boolean;
  isHR: boolean;
}) {
  const pathname = usePathname();

  const matchesPath = (href: string) => {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname.startsWith(href);
  };

  const canSeeHR = isSuperAdmin || isHR;

  const filteredNavigation = navigation
    .filter((section) => !section.requireSuperAdmin || isSuperAdmin)
    .filter((section) => !section.requireHR || canSeeHR)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.requireSuperAdmin && !isSuperAdmin) return false;
        if (item.requireHR && !canSeeHR) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex grow flex-col overflow-y-auto bg-[hsl(var(--sidebar))]">
      {/* Logo Section */}
      <div className="flex h-20 shrink-0 items-center justify-between px-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--sidebar-accent))] to-[hsl(176,100%,28%)] shadow-lg shadow-[hsl(var(--sidebar-accent))]/20 transition-transform group-hover:scale-105">
            <span className="text-sm font-bold text-white tracking-tight">HR</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-white tracking-tight">HRMS</span>
            <span className="text-[10px] text-[hsl(var(--sidebar-foreground))]/50 uppercase tracking-widest">Enterprise</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <NotificationBell variant="dark" />
          </div>
          {onClose && (
            <button onClick={onClose} className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors">
              <XIcon className="h-5 w-5 text-[hsl(var(--sidebar-foreground))]/70" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul role="list" className="flex flex-col gap-y-8">
          {filteredNavigation.map((section, sectionIdx) => (
            <li key={sectionIdx}>
              {section.title && (
                <div className="px-3 pb-3 text-[11px] font-medium text-[hsl(var(--sidebar-foreground))]/40 uppercase tracking-[0.15em]">
                  {section.title}
                </div>
              )}
              <ul role="list" className="space-y-1">
                {section.items.map((item) => {
                  const isActive = matchesPath(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'group relative flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                          isActive
                            ? 'nav-active text-white'
                            : 'text-[hsl(var(--sidebar-foreground))]/70 hover:text-white hover:bg-white/5'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-[18px] w-[18px] shrink-0 transition-colors',
                            isActive
                              ? 'text-[hsl(var(--sidebar-accent))]'
                              : 'text-[hsl(var(--sidebar-foreground))]/50 group-hover:text-[hsl(var(--sidebar-foreground))]/80'
                          )}
                        />
                        <span className="truncate">{item.name}</span>
                        {isActive && (
                          <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-accent))]" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="mt-auto px-4 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[hsl(var(--sidebar-accent))]/30 to-[hsl(var(--sidebar-accent))]/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-[hsl(var(--sidebar-accent))]">
              {isSuperAdmin ? 'SA' : isHR ? 'HR' : 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {isSuperAdmin ? 'Super Admin' : isHR ? 'HR Admin' : 'Employee'}
            </p>
            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))]/40">Active</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileNav({
  isOpen,
  onClose,
  isSuperAdmin,
  isHR,
}: {
  isOpen: boolean;
  onClose: () => void;
  isSuperAdmin: boolean;
  isHR: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="relative z-50 md:hidden">
      <div
        className="fixed inset-0 bg-[hsl(var(--sidebar))]/90 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 left-0 flex w-full max-w-[280px]">
        <div className="relative flex w-full flex-col shadow-2xl">
          <Sidebar onClose={onClose} isSuperAdmin={isSuperAdmin} isHR={isHR} />
        </div>
      </div>
    </div>
  );
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  const getCurrentPageName = () => {
    for (const section of navigation) {
      for (const item of section.items) {
        if (item.href === '/') {
          if (pathname === '/' || pathname === '') return item.name;
        } else if (pathname.startsWith(item.href)) {
          return item.name;
        }
      }
    }
    return 'Work Queue';
  };

  return (
    <header className="sticky top-0 z-40 flex items-center gap-x-4 glass border-b border-border px-4 py-4 sm:px-6 md:hidden">
      <button
        type="button"
        className="-m-2 p-2.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        onClick={onMenuClick}
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <h1 className="text-base font-semibold text-foreground">{getCurrentPageName()}</h1>
      </div>
      <NotificationBell />
    </header>
  );
}

export default function HRMSLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isHR, setIsHR] = useState(false);
  const version = process.env.NEXT_PUBLIC_VERSION ?? '0.0.0';
  const explicitReleaseUrl = process.env.NEXT_PUBLIC_RELEASE_URL || undefined;
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || undefined;
  const commitUrl = commitSha
    ? `https://github.com/progami/ecom-os/commit/${commitSha}`
    : undefined;
  const inferredReleaseUrl = `https://github.com/progami/ecom-os/releases/tag/v${version}`;
  const versionHref = explicitReleaseUrl ?? commitUrl ?? inferredReleaseUrl;

  const pathname = usePathname();
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const fetchUserPermissions = useCallback(async () => {
    try {
      const me = await MeApi.get();
      setIsSuperAdmin(Boolean(me.isSuperAdmin));
      setIsHR(Boolean(me.isHR));
    } catch {
      // Ignore errors, default to non-admin
    }
  }, []);

  useEffect(() => {
    fetchUserPermissions();

    const handleFocus = () => fetchUserPermissions();
    const handleMeUpdated = () => fetchUserPermissions();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('hrms:me-updated', handleMeUpdated);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('hrms:me-updated', handleMeUpdated);
    };
  }, [fetchUserPermissions]);

  return (
    <NavigationHistoryProvider>
      {/* Desktop Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:z-50 md:flex md:w-64 md:flex-col">
        <Sidebar isSuperAdmin={isSuperAdmin} isHR={isHR} />
      </div>

      {/* Mobile Nav */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isSuperAdmin={isSuperAdmin}
        isHR={isHR}
      />

      {/* Main Content */}
      <div className="md:pl-64 min-h-screen flex flex-col bg-gradient-subtle">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1">
          <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>

        <footer className="mt-auto py-6">
          <div className="px-4 sm:px-6 lg:px-8">
            <p className="text-xs text-muted-foreground/60 text-center">
              HRMS{' '}
              <a
                href={versionHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-muted-foreground transition-colors"
              >
                v{version}
              </a>
            </p>
          </div>
        </footer>
      </div>

      <CommandPalette />
    </NavigationHistoryProvider>
  );
}
