'use client';

import { useEffect, useMemo, useState } from 'react';

const REPORT_TIME_ZONE = 'UTC';

function formatTimestamp(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone,
  })
    .format(value)
    .replace(',', '');
}

export function TimeZoneClocks() {
  const [now, setNow] = useState(() => new Date());

  const userTimeZone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const reportNow = formatTimestamp(now, REPORT_TIME_ZONE);
  const userNow = formatTimestamp(now, userTimeZone);

  return (
    <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur dark:border-[#0b3a52] dark:bg-[#06182b]/70 dark:text-slate-300 sm:flex">
      <div className="flex flex-col leading-tight">
        <span className="uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Report TZ
        </span>
        <span className="tabular-nums text-slate-800 dark:text-slate-100">
          {REPORT_TIME_ZONE} {reportNow}
        </span>
      </div>
      <span className="text-slate-300 dark:text-slate-600">|</span>
      <div className="flex flex-col leading-tight">
        <span className="uppercase tracking-wide text-slate-500 dark:text-slate-400">
          User TZ
        </span>
        <span className="tabular-nums text-slate-800 dark:text-slate-100">
          {userTimeZone} {userNow}
        </span>
      </div>
    </div>
  );
}
