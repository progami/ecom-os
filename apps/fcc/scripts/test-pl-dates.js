#!/usr/bin/env node

// Simple test script to check P&L date calculations

const testDates = [
  { input: '2025-05-31', periods: 1, timeframe: 'MONTH', expected: { start: '2025-05-01', end: '2025-05-31' } },
  { input: '2025-04-30', periods: 1, timeframe: 'MONTH', expected: { start: '2025-04-01', end: '2025-04-30' } },
  { input: '2025-05-15', periods: 1, timeframe: 'MONTH', expected: { start: '2025-05-01', end: '2025-05-31' } },
  { input: '2025-06-30', periods: 2, timeframe: 'MONTH', expected: { start: '2025-05-01', end: '2025-06-30' } },
];

console.log('Testing P&L Date Calculations:\n');

testDates.forEach(test => {
  let endDate = new Date(test.input + 'T00:00:00');
  let startDate = new Date(endDate);
  
  // Our updated logic
  const year = endDate.getFullYear();
  const month = endDate.getMonth();
  
  // Set startDate to first day of the month
  startDate = new Date(year, month, 1);
  
  // If periods > 1, go back that many months
  if (test.periods > 1) {
    startDate.setMonth(startDate.getMonth() - test.periods + 1);
  }
  
  // Set endDate to last day of the month
  endDate = new Date(year, month + 1, 0);
  
  const result = {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
  
  const isCorrect = result.start === test.expected.start && result.end === test.expected.end;
  
  console.log(`Input: ${test.input}, Periods: ${test.periods}, Timeframe: ${test.timeframe}`);
  console.log(`Expected: ${test.expected.start} to ${test.expected.end}`);
  console.log(`Got:      ${result.start} to ${result.end}`);
  console.log(`Result:   ${isCorrect ? '✅ PASS' : '❌ FAIL'}\n`);
});