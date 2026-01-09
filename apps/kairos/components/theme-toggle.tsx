'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-9 w-9 rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5" />;
  }

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-9 w-9 rounded-lg"
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px] text-amber-400" aria-hidden />
      ) : (
        <Moon className="h-[18px] w-[18px] text-slate-500" aria-hidden />
      )}
    </Button>
  );
}

