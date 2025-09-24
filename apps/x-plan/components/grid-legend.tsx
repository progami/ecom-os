'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Keyboard, PenSquare, Sigma } from 'lucide-react';

export function GridLegend() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.7fr,1fr]">
      <div className="grid gap-3 sm:grid-cols-2">
        <LegendCard
          icon={PenSquare}
          title="Editable drivers"
          description="Sky-tinted cells accept inputs and autosave moments after you pause typing."
          accent="bg-gradient-to-br from-sky-500/25 via-blue-500/15 to-transparent"
          iconAccent="bg-gradient-to-br from-sky-500/20 via-blue-500/20 to-indigo-500/20 text-sky-600 dark:text-sky-200"
        />
        <LegendCard
          icon={Sigma}
          title="Calculated outputs"
          description="Slate cells stay read-only—X-Plan recalculates them from your supply, demand, and finance models."
          accent="bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-transparent"
          iconAccent="bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-slate-700/10 text-slate-600 dark:text-slate-200"
        />
      </div>
      <ShortcutCard />
    </div>
  );
}

interface LegendCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
  iconAccent: string;
}

function LegendCard({ icon: Icon, title, description, accent, iconAccent }: LegendCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-slate-950/40">
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100',
          accent,
        )}
      />
      <div className="relative z-10 flex items-start gap-3">
        <span
          className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 shadow-sm dark:border-white/10',
            iconAccent,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </article>
  );
}

function ShortcutCard() {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-slate-950/40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br from-violet-500/20 via-purple-500/15 to-sky-500/10"
      />
      <div className="relative z-10 space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-gradient-to-br from-violet-500/20 via-purple-500/20 to-indigo-500/20 text-indigo-600 shadow-sm dark:border-white/10 dark:text-indigo-200">
            <Keyboard className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Stay in flow</p>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              A soft indigo glow tracks the active row. Keep hands on the keyboard to power through
              updates.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/15 via-purple-500/10 to-transparent p-3 text-xs text-violet-700 shadow-inner dark:border-violet-400/30 dark:from-violet-500/20 dark:via-purple-500/15 dark:text-violet-200">
          <p className="font-semibold">Row focus preview</p>
          <p className="mt-1 text-[0.7rem] leading-5 text-violet-600/80 dark:text-violet-200/80">
            Click or arrow into a line to spotlight it—no more guessing which purchase order is
            live.
          </p>
        </div>
        <dl className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <ShortcutRow description="Edit or commit cell">
            <Keycap>Enter</Keycap>
          </ShortcutRow>
          <ShortcutRow description="Move sideways">
            <Keycap>Tab</Keycap>
            <span className="text-slate-400">/</span>
            <Keycap>⇧ Tab</Keycap>
          </ShortcutRow>
          <ShortcutRow description="Switch sheets">
            <Keycap>Ctrl / ⌘</Keycap>
            <span className="text-slate-400">+</span>
            <Keycap>PgUp</Keycap>
            <span className="text-slate-400">or</span>
            <Keycap>PgDn</Keycap>
          </ShortcutRow>
        </dl>
      </div>
    </article>
  );
}

interface ShortcutRowProps {
  children: ReactNode;
  description: string;
}

function ShortcutRow({ children, description }: ShortcutRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-300">
        {children}
      </dt>
      <dd className="text-right text-slate-500 dark:text-slate-400 sm:text-left">{description}</dd>
    </div>
  );
}

interface KeycapProps {
  children: ReactNode;
}

function Keycap({ children }: KeycapProps) {
  return (
    <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md border border-slate-300/60 bg-white/90 px-2 py-1 text-[0.65rem] font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
      {children}
    </span>
  );
}
