#!/bin/bash

# Storage Ledger Weekly Update Cron Setup Script
# This script sets up a cron job to run the storage ledger update every Tuesday at 2 AM

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📅 Setting up Storage Ledger weekly cron job..."

# Create the cron command
CRON_COMMAND="cd $PROJECT_ROOT && /usr/local/bin/npx tsx scripts/update-storage-ledger-weekly.ts >> $PROJECT_ROOT/logs/storage-ledger-cron.log 2>&1"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Add to crontab (runs every Tuesday at 2 AM)
# The storage ledger captures Monday end-of-day snapshots, so we run on Tuesday
CRON_SCHEDULE="0 2 * * 2"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "update-storage-ledger-weekly.ts"; then
    echo "⚠️  Cron job already exists. Updating..."
    # Remove existing job
    crontab -l 2>/dev/null | grep -v "update-storage-ledger-weekly.ts" | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $CRON_COMMAND") | crontab -

echo "✅ Cron job added successfully!"
echo "📍 Schedule: Every Tuesday at 2:00 AM"
echo "📁 Log file: $PROJECT_ROOT/logs/storage-ledger-cron.log"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To remove this cron job: crontab -l | grep -v 'update-storage-ledger-weekly.ts' | crontab -"
echo ""
echo "To run the update manually:"
echo "cd $PROJECT_ROOT && npx tsx scripts/update-storage-ledger-weekly.ts"