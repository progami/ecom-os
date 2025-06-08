#!/bin/bash

# Setup automated daily backups

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"

# Add to crontab (runs daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * cd $(dirname $SCRIPT_DIR) && $BACKUP_SCRIPT") | crontab -

echo "✅ Automated daily backup scheduled for 2 AM"
echo "📝 View scheduled backups with: crontab -l"
echo "❌ Remove scheduled backup with: crontab -r"