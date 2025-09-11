- Commit regularly after each feature is shipped to avoid data loss
- DO NOT CREATE UNREQUIRED FILES, IF YOU HAVE TO CLEAN THEM UP LATER
- Sync data from Xero only when the user presses the sync buttons - only point you will talk to xero api
- Add logging wherever possible be explicit for future debugging purposes, for dev env write to development.log file
- capture full error logs, do not skip logs
- DO NOT MODIFY INTERNAL LIBRARIES, OR SDK's THEMSELVES
- USE MCP tools where possible
- All test files should be placed inside a dedicated test directory, not in the root or mixed with source code
- Make sure you are using BullMQ
- Do NOT MONKEY PATCH THINGS
- DO NOT REMOVE CRITICAL FEATURES WITHOUT EXPLICIT PERMISSIONS
- NO TEST DATA

## Xero API Data Storage
- All Xero API calls that fetch report data (P&L, Balance Sheet, etc.) are automatically logged in the ImportedReport table
- This provides a complete audit trail of all data fetches with timestamps, status, and record counts
- Report data is also stored in the ReportData table for quick access without hitting Xero API
- The system tracks: fetch date/time, imported by (user/system), period covered, record count, and full data