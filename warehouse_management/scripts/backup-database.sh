#!/bin/bash

# Database Backup Script
# Run this regularly to create backups

BACKUP_DIR="./backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_URL=$(grep DATABASE_URL .env | cut -d '=' -f2)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."

# For PostgreSQL
if [[ $DB_URL == *"postgresql"* ]]; then
    DB_NAME=$(echo $DB_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    pg_dump $DB_URL > "$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"
    echo "✅ PostgreSQL backup completed: backup_${DB_NAME}_${TIMESTAMP}.sql"
fi

# For SQLite
if [[ $DB_URL == *"file:"* ]]; then
    DB_PATH=$(echo $DB_URL | sed 's/file://')
    cp "$DB_PATH" "$BACKUP_DIR/backup_${TIMESTAMP}.db"
    echo "✅ SQLite backup completed: backup_${TIMESTAMP}.db"
fi

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*" -mtime +7 -delete

echo "🧹 Cleaned up old backups (kept last 7 days)"
echo "📁 Backup location: $BACKUP_DIR"