#!/usr/bin/env node

// Script to check what sections are being returned from Xero P&L report

const fs = require('fs');
const path = require('path');

// Read the development log
const logPath = path.join(__dirname, '..', 'development.log');
const logContent = fs.readFileSync(logPath, 'utf8');

// Find the most recent P&L report structure
const reportStructureMatch = logContent.match(/=== DETAILED P&L REPORT STRUCTURE.*?===/gs);

if (reportStructureMatch) {
  console.log('Found P&L Report Structure entries:', reportStructureMatch.length);
  
  // Get the most recent one
  const latestReport = reportStructureMatch[reportStructureMatch.length - 1];
  console.log('\nMost recent P&L Report Structure:');
  console.log(latestReport);
}

// Find all P&L ROW entries
const rowMatches = logContent.match(/P&L ROW \d+\.\d+: Section=".*?" Label=".*?" Value=.*? Cells=\[.*?\]/g);

if (rowMatches) {
  console.log('\n\nP&L Row Analysis:');
  console.log('Total rows found:', rowMatches.length);
  
  // Group by section
  const sections = {};
  rowMatches.forEach(row => {
    const sectionMatch = row.match(/Section="(.*?)"/);
    if (sectionMatch) {
      const section = sectionMatch[1] || '(empty)';
      if (!sections[section]) {
        sections[section] = [];
      }
      sections[section].push(row);
    }
  });
  
  console.log('\nSections found:');
  Object.keys(sections).forEach(section => {
    console.log(`\n${section}: ${sections[section].length} rows`);
    // Show first 3 rows from each section
    sections[section].slice(0, 3).forEach(row => {
      const labelMatch = row.match(/Label="(.*?)"/);
      const valueMatch = row.match(/Value=(.*?) Cells/);
      if (labelMatch && valueMatch) {
        console.log(`  - ${labelMatch[1]}: ${valueMatch[1]}`);
      }
    });
  });
}

// Look for any mention of Amazon or revenue accounts
console.log('\n\nSearching for Amazon or revenue-related entries...');
const amazonMatches = logContent.match(/.*[Aa]mazon.*|.*[Rr]evenue.*|.*[Ss]ales.*|.*[Ii]ncome.*/g);
if (amazonMatches) {
  const uniqueMatches = [...new Set(amazonMatches)];
  console.log('Found', uniqueMatches.length, 'unique matches');
  uniqueMatches.slice(-10).forEach(match => {
    if (!match.includes('heartbeat') && !match.includes('Worker process')) {
      console.log(match.trim());
    }
  });
}