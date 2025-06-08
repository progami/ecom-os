#!/bin/bash

# Complete WMS Migration Script
# This script completes the migration of warehouse_management to the main app structure

set -e

echo "Starting complete WMS migration..."

# 1. Ensure all destination directories exist
echo "Creating destination directories..."
mkdir -p app/wms/{admin,analytics,auth,config,dashboard,finance,integrations,operations,reports}
mkdir -p app/api/v1/wms/{admin,amazon,config,dashboard,export,finance,integrations,inventory,invoices,operations,rates,reconciliation,reports,settings,skus,transactions,warehouse-configs,warehouses}
mkdir -p components/wms/{admin,common,config,finance,integrations,layout,operations,reports,ui,warehouse}
mkdir -p lib/wms/{amazon,calculations,config,modules,services,types,utils}

# 2. Check for any unmigrated pages
echo "Checking for unmigrated pages..."
for file in warehouse_management/src/app/**/*.tsx warehouse_management/src/app/**/*.ts; do
  if [[ -f "$file" ]]; then
    rel_path=${file#warehouse_management/src/app/}
    dest_path="app/wms/$rel_path"
    
    # Skip if already migrated
    if [[ -f "$dest_path" ]]; then
      echo "Already migrated: $rel_path"
    else
      echo "Need to migrate: $rel_path"
    fi
  fi
done

# 3. Check for any unmigrated API routes
echo "Checking for unmigrated API routes..."
for file in warehouse_management/src/app/api/**/*.ts; do
  if [[ -f "$file" ]]; then
    rel_path=${file#warehouse_management/src/app/api/}
    dest_path="app/api/v1/wms/$rel_path"
    
    # Skip if already migrated
    if [[ -f "$dest_path" ]]; then
      echo "Already migrated API: $rel_path"
    else
      echo "Need to migrate API: $rel_path"
    fi
  fi
done

# 4. List what needs to be cleaned up
echo ""
echo "Files still in warehouse_management that need removal:"
echo "Pages: $(find warehouse_management/src/app -name "*.tsx" -o -name "*.ts" | grep -v "/api/" | wc -l)"
echo "API routes: $(find warehouse_management/src/app/api -name "*.ts" | wc -l)"
echo "Components: $(find warehouse_management/src/components -name "*.tsx" -o -name "*.ts" | wc -l)"
echo "Lib files: $(find warehouse_management/src/lib -name "*.ts" | wc -l)"

echo ""
echo "Migration status check complete."