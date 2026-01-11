'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-4 w-4 rounded border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800" />;
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-4 w-4 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
    >
      {isDark ? <Sun className="h-2.5 w-2.5" aria-hidden /> : <Moon className="h-2.5 w-2.5" aria-hidden />}
    </button>
  );
}
