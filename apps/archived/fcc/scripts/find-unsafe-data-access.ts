#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { glob } from 'glob';

// Find all TypeScript/JavaScript files in the reports directory
const reportFiles = glob.sync('app/reports/**/*.{ts,tsx,js,jsx}', {
  cwd: '/Users/jarraramjad/Documents/ecom_os/FCC'
});

console.log(`Found ${reportFiles.length} report files to analyze\n`);

const unsafePatterns = [
  // Direct property access on potentially undefined data
  /data\.contacts(?!.*\?)/g,
  /data\.reports(?!.*\?)/g,
  /reportStatuses\.reports(?!.*\?)/g,
  /response\.data(?!.*\?)/g,
  /result\.data(?!.*\?)/g,
  
  // Map operations without safety checks
  /\.map\(/g,
  
  // Array operations without null checks
  /\.forEach\(/g,
  /\.filter\(/g,
  /\.reduce\(/g,
];

interface UnsafeAccess {
  file: string;
  line: number;
  code: string;
  pattern: string;
}

const findings: UnsafeAccess[] = [];

reportFiles.forEach(file => {
  const fullPath = `/Users/jarraramjad/Documents/ecom_os/FCC/${file}`;
  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    unsafePatterns.forEach(pattern => {
      if (pattern.test(line)) {
        // Check if it's inside a conditional that checks for data
        const lineNumber = index + 1;
        let isSafe = false;
        
        // Look backwards for safety checks
        for (let i = Math.max(0, index - 5); i < index; i++) {
          if (lines[i].includes('if (data') || 
              lines[i].includes('data ?') || 
              lines[i].includes('data &&') ||
              lines[i].includes('?.')) {
            isSafe = true;
            break;
          }
        }
        
        // Check if the line itself has optional chaining
        if (line.includes('?.')) {
          isSafe = true;
        }
        
        if (!isSafe && !line.trim().startsWith('//')) {
          findings.push({
            file: file,
            line: lineNumber,
            code: line.trim(),
            pattern: pattern.source
          });
        }
      }
    });
  });
});

// Group findings by file
const findingsByFile = findings.reduce((acc, finding) => {
  if (!acc[finding.file]) {
    acc[finding.file] = [];
  }
  acc[finding.file].push(finding);
  return acc;
}, {} as Record<string, UnsafeAccess[]>);

console.log('POTENTIALLY UNSAFE DATA ACCESS PATTERNS');
console.log('=======================================\n');

Object.entries(findingsByFile).forEach(([file, fileFindings]) => {
  console.log(`\n${file}:`);
  fileFindings.forEach(finding => {
    console.log(`  Line ${finding.line}: ${finding.code}`);
    console.log(`    Pattern: ${finding.pattern}`);
  });
});

console.log(`\n\nTotal findings: ${findings.length} potential issues in ${Object.keys(findingsByFile).length} files`);

// Specific recommendations
console.log('\n\nRECOMMENDATIONS:');
console.log('================');
console.log('1. Add null/undefined checks before accessing nested properties');
console.log('2. Use optional chaining (?.) for safe property access');
console.log('3. Provide default values for arrays: data?.contacts || []');
console.log('4. Add loading and error states to handle API failures gracefully');