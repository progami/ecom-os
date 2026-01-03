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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

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

  // Filter navigation based on permissions
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
    <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-md">
            <span className="text-sm font-bold text-white">HR</span>
          </div>
          <span className="text-lg font-semibold text-gray-900">HRMS</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <NotificationBell />
          </div>
          {onClose && (
            <button onClick={onClose} className="md:hidden p-2 hover:bg-gray-100 rounded-lg">
              <XIcon className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-6">
          {filteredNavigation.map((section, sectionIdx) => (
            <li key={sectionIdx}>
              {section.title && (
                <div className="px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              <ul role="list" className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        matchesPath(item.href)
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600 -ml-px'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                        'group flex gap-x-3 rounded-lg py-3 px-3 text-sm font-medium transition-colors',
                      )}
                    >
                      <item.icon
                        className={cn(
                          matchesPath(item.href)
                            ? 'text-blue-600'
                            : 'text-gray-400 group-hover:text-gray-600',
                          'h-5 w-5 shrink-0 transition-colors',
                        )}
                      />
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
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
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 flex">
        <div className="relative mr-16 flex w-full max-w-xs flex-1">
          <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
            <button type="button" className="-m-2.5 p-2.5" onClick={onClose}>
              <XIcon className="h-6 w-6 text-white" />
            </button>
          </div>
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
    <div className="sticky top-0 z-40 flex items-center gap-x-4 bg-white px-4 py-4 border-b border-gray-200 sm:px-6 md:hidden">
      <button
        type="button"
        className="-m-2 p-2 text-gray-600 hover:text-gray-900"
        onClick={onMenuClick}
      >
        <MenuIcon className="h-6 w-6" />
      </button>
      <div className="flex-1 text-base font-semibold text-gray-900">{getCurrentPageName()}</div>
      <NotificationBell />
    </div>
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

  // Fetch current user permissions for navigation; refresh when roles change.
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
      <div className="md:pl-64 min-h-screen flex flex-col bg-gray-50">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1">
          <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">{children}</div>
        </main>

        <footer className="border-t border-gray-200 bg-white mt-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-xs text-gray-500 text-center">
              HRMS{' '}
              <a
                href={versionHref}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-700 transition-colors"
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
