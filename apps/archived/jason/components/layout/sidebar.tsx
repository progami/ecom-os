'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Mail, Home, Settings, LogOut, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Calendar', href: '/calendar-aggregator', icon: Calendar },
  { name: 'Email', href: '/email-summarizer', icon: Mail },
];

const bottomNavigation = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Logout', href: '/logout', icon: LogOut },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn(
      "relative h-screen bg-card/50 border-r border-border/50 backdrop-blur-xl transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <Link href="/" className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-dark shadow-md">
              <span className="text-lg font-bold text-white">J</span>
            </div>
            {!collapsed && (
              <span className="text-lg font-semibold text-foreground">
                Jason
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <div className={cn(
                  "transition-all duration-200",
                  isActive && "scale-110"
                )}>
                  <item.icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
                </div>
                {!collapsed && (
                  <>
                    <span className="font-medium">{item.name}</span>
                    {isActive && (
                      <div className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sync Status */}
        {!collapsed && (
          <div className="p-3">
            <div className="glass rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Sync Status</span>
                <Activity className="h-3 w-3 text-green-500 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground">All calendars synced</p>
              <p className="text-xs text-muted-foreground mt-1">Last sync: 2 mins ago</p>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="p-3 border-t border-border/50 space-y-1">
          {bottomNavigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-lg transition-all duration-200",
                "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
              {!collapsed && <span className="font-medium">{item.name}</span>}
            </Link>
          ))}
        </div>
      </div>
      
      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute top-4 -right-3 p-1.5 bg-card border border-border rounded-md hover:bg-muted/50 transition-all duration-200 shadow-sm"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}