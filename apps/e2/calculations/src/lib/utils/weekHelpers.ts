// Helper functions for week-based calculations

// ADD THIS NEW FUNCTION
export function getWeekStartingSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 for Sunday, 1 for Monday, etc.
  const diff = d.getDate() - day; // This calculates the preceding Sunday
  const sunday = new Date(d.getFullYear(), d.getMonth(), diff);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

export function getWeekNumber(date: Date): number {
  // Align with getWeekDateRange logic
  const d = new Date(date);
  const year = d.getUTCFullYear();
  
  // Find the first Sunday of the year (same as getWeekDateRange)
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfWeek = jan1.getUTCDay();
  const daysToFirstSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const firstSunday = new Date(Date.UTC(year, 0, 1 + daysToFirstSunday));
  
  // Calculate the number of days from first Sunday
  const diffMs = d.getTime() - firstSunday.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  // Calculate week number (week 1 starts from first Sunday)
  const weekNum = Math.floor(diffDays / 7) + 1;
  
  // Handle dates before first Sunday (they belong to week 1)
  if (d < firstSunday) {
    return 1;
  }
  
  return weekNum;
}

export function getWeekStartDate(year: number, week: number): Date {
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7;
  const weekStart = new Date(firstDayOfYear);
  weekStart.setDate(firstDayOfYear.getDate() + daysOffset);
  return weekStart;
}

export function formatWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function parseWeekKey(weekKey: string): { year: number; week: number } {
  const match = weekKey.match(/(\d{4})-W(\d{2})/);
  if (!match) throw new Error(`Invalid week key: ${weekKey}`);
  return {
    year: parseInt(match[1]),
    week: parseInt(match[2])
  };
}

export function getWeeksInYear(year: number): number {
  // ISO 8601 week date system - a year has 53 weeks if:
  // 1. January 1 is a Thursday (year starts on Thursday)
  // 2. January 1 is a Wednesday and it's a leap year
  
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  
  // Check if it's a leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  
  // Thursday = 4, Wednesday = 3
  if (dayOfWeek === 4 || (dayOfWeek === 3 && isLeapYear)) {
    return 53;
  }
  
  // Also check if December 31 falls in week 53
  const dec31 = new Date(year, 11, 31);
  const lastWeek = getWeekNumber(dec31);
  
  return lastWeek > 52 ? 53 : 52;
}

export function generateWeekArray(year: number): string[] {
  const weeks: string[] = [];
  const numWeeks = getWeeksInYear(year);
  for (let week = 1; week <= numWeeks; week++) {
    weeks.push(formatWeekKey(year, week));
  }
  return weeks;
}

export function getWeekLabel(week: number): string {
  return `W${week.toString().padStart(2, '0')}`;
}

export function formatWeekWithStatus(week: number, isReconciled: boolean, isFuture: boolean, isCurrentWeek: boolean): string {
  const baseLabel = getWeekLabel(week);
  if (isReconciled) return `✓ ${baseLabel}`;
  if (isFuture && !isCurrentWeek) return `📊 ${baseLabel}`;
  return baseLabel;
}

export function getMonthFromWeek(week: number, year?: number): string {
  // Get the month based on the week's start date
  // If year is not provided, use current year
  const targetYear = year || new Date().getFullYear();
  
  // Use the same logic as getWeekDateRange to ensure consistency
  const dateRange = getWeekDateRange(targetYear, week);
  
  // Get the month of the start date
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[dateRange.start.getMonth()];
}

export function getQuarterFromWeek(week: number): string {
  if (week <= 13) return 'Q1';
  if (week <= 27) return 'Q2';  // Changed from 26 to 27
  if (week <= 39) return 'Q3';
  return 'Q4';
}

// Get the date range for a specific week (Sunday-based)
export function getWeekDateRange(year: number, weekNumber: number): { start: Date; end: Date; formatted: string } {
  // Calculate week start using UTC to avoid DST issues
  // Week 1 starts on the first Sunday of the year
  
  // Find the first Sunday of the year
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfWeek = jan1.getUTCDay();
  const daysToFirstSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  
  // Calculate the start of the target week (Sunday)
  const firstSunday = new Date(Date.UTC(year, 0, 1 + daysToFirstSunday));
  const weekStart = new Date(firstSunday);
  weekStart.setUTCDate(firstSunday.getUTCDate() + (weekNumber - 1) * 7);
  
  // Calculate week end (Saturday)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  
  // Format the date range
  const formatDate = (date: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
  };
  
  const formatted = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  
  return { start: weekStart, end: weekEnd, formatted };
}

// Convert monthly data to weekly (distribute evenly)
export function monthlyToWeekly(monthlyData: Record<string, number>, year: number): Record<string, number> {
  const weeklyData: Record<string, number> = {};
  
  Object.entries(monthlyData).forEach(([monthKey, value]) => {
    const [monthYear, month] = monthKey.split('-');
    const monthNum = parseInt(month);
    const yearNum = parseInt(monthYear);
    
    // Find all weeks that start in this month
    const weeksInMonth: number[] = [];
    for (let week = 1; week <= 52; week++) {
      const weekRange = getWeekDateRange(yearNum, week);
      if (weekRange.start.getMonth() + 1 === monthNum) {
        weeksInMonth.push(week);
      }
    }
    
    // If no weeks found (edge case), skip this month
    if (weeksInMonth.length === 0) return;
    
    // Distribute value evenly across the weeks that actually belong to this month
    const weeklyValue = value / weeksInMonth.length;
    
    weeksInMonth.forEach(week => {
      const weekKey = formatWeekKey(yearNum, week);
      weeklyData[weekKey] = Math.round(weeklyValue);
    });
  });
  
  return weeklyData;
}