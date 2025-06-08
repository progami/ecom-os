#!/bin/bash
set -e

echo "🚀 Starting complete WMS migration..."

# Function to update imports in a file
update_imports() {
    local file=$1
    echo "Updating imports in: $file"
    
    # Update component imports
    sed -i.bak 's|@/components/layout/dashboard-layout|@/components/wms/layout/dashboard-layout|g' "$file"
    sed -i.bak 's|@/components/ui/|@/components/wms/shared/|g' "$file"
    sed -i.bak 's|@/components/|@/components/wms/|g' "$file"
    
    # Update lib imports
    sed -i.bak 's|@/lib/utils|@/lib/wms/utils|g' "$file"
    sed -i.bak 's|@/lib/auth|@/lib/wms/utils/auth-utils|g' "$file"
    sed -i.bak 's|@/lib/financial-utils|@/lib/wms/utils/financial-utils|g' "$file"
    sed -i.bak 's|@/lib/calculations/|@/lib/wms/services/calculations/|g' "$file"
    sed -i.bak 's|@/lib/|@/lib/wms/|g' "$file"
    
    # Update API routes
    sed -i.bak 's|/api/|/api/v1/wms/|g' "$file"
    
    # Update navigation routes
    sed -i.bak 's|href="/admin/|href="/wms/admin/|g' "$file"
    sed -i.bak 's|href="/finance/|href="/wms/finance/|g' "$file"
    sed -i.bak 's|href="/operations/|href="/wms/operations/|g' "$file"
    sed -i.bak 's|href="/config/|href="/wms/config/|g' "$file"
    sed -i.bak 's|href="/analytics|href="/wms/analytics|g' "$file"
    sed -i.bak 's|href="/dashboard|href="/wms/dashboard|g' "$file"
    sed -i.bak 's|href="/reports|href="/wms/reports|g' "$file"
    sed -i.bak 's|href="/integrations/|href="/wms/integrations/|g' "$file"
    sed -i.bak 's|push("/|push("/wms/|g' "$file"
    sed -i.bak 's|push('"'"'/|push('"'"'/wms/|g' "$file"
    
    # Update type imports
    sed -i.bak 's|@/types|@/lib/wms/types|g' "$file"
    
    # Clean up backup files
    rm -f "${file}.bak"
}

# 1. Migrate remaining components
echo "📦 Migrating remaining components..."
for component in archive/warehouse_management/src/components/**/*.tsx archive/warehouse_management/src/components/**/*.ts; do
    if [[ -f "$component" ]]; then
        rel_path=${component#archive/warehouse_management/src/components/}
        dest_dir="components/wms/$(dirname "$rel_path")"
        dest_file="components/wms/$rel_path"
        
        if [[ ! -f "$dest_file" ]]; then
            mkdir -p "$dest_dir"
            cp "$component" "$dest_file"
            update_imports "$dest_file"
            echo "✅ Migrated component: $rel_path"
        fi
    fi
done

# 2. Migrate remaining lib files
echo "📚 Migrating remaining lib files..."
for lib in archive/warehouse_management/src/lib/**/*.ts; do
    if [[ -f "$lib" ]]; then
        rel_path=${lib#archive/warehouse_management/src/lib/}
        dest_dir="lib/wms/$(dirname "$rel_path")"
        dest_file="lib/wms/$rel_path"
        
        if [[ ! -f "$dest_file" ]]; then
            mkdir -p "$dest_dir"
            cp "$lib" "$dest_file"
            update_imports "$dest_file"
            echo "✅ Migrated lib: $rel_path"
        fi
    fi
done

# 3. Migrate remaining API routes
echo "🔌 Migrating remaining API routes..."
for api in archive/warehouse_management/src/app/api/**/*.ts; do
    if [[ -f "$api" ]]; then
        rel_path=${api#archive/warehouse_management/src/app/api/}
        dest_dir="app/api/v1/wms/$(dirname "$rel_path")"
        dest_file="app/api/v1/wms/$rel_path"
        
        if [[ ! -f "$dest_file" ]]; then
            mkdir -p "$dest_dir"
            cp "$api" "$dest_file"
            update_imports "$dest_file"
            
            # Update Prisma model references
            sed -i.bak 's/prisma\.user/prisma.wmsUser/g' "$dest_file"
            sed -i.bak 's/prisma\.warehouse/prisma.wmsWarehouse/g' "$dest_file"
            sed -i.bak 's/prisma\.sku/prisma.wmsSku/g' "$dest_file"
            sed -i.bak 's/prisma\.inventoryTransaction/prisma.wmsInventoryTransaction/g' "$dest_file"
            sed -i.bak 's/prisma\.inventoryBalance/prisma.wmsInventoryBalance/g' "$dest_file"
            sed -i.bak 's/prisma\.costRate/prisma.wmsCostRate/g' "$dest_file"
            sed -i.bak 's/prisma\.invoice/prisma.wmsInvoice/g' "$dest_file"
            sed -i.bak 's/prisma\.storageLedger/prisma.wmsStorageLedger/g' "$dest_file"
            sed -i.bak 's/prisma\.calculatedCost/prisma.wmsCalculatedCost/g' "$dest_file"
            sed -i.bak 's/prisma\.warehouseConfig/prisma.wmsWarehouseConfig/g' "$dest_file"
            sed -i.bak 's/prisma\.palletVariance/prisma.wmsPalletVariance/g' "$dest_file"
            rm -f "${dest_file}.bak"
            
            echo "✅ Migrated API: $rel_path"
        fi
    fi
done

# 4. Migrate remaining pages
echo "📄 Migrating remaining pages..."
for page in archive/warehouse_management/src/app/**/*.tsx archive/warehouse_management/src/app/**/*.ts; do
    if [[ -f "$page" ]] && [[ ! "$page" =~ "/api/" ]]; then
        rel_path=${page#archive/warehouse_management/src/app/}
        dest_dir="app/wms/$(dirname "$rel_path")"
        dest_file="app/wms/$rel_path"
        
        # Skip layout.tsx and page.tsx at root as they're already handled
        if [[ "$rel_path" == "layout.tsx" ]] || [[ "$rel_path" == "page.tsx" ]]; then
            continue
        fi
        
        if [[ ! -f "$dest_file" ]]; then
            mkdir -p "$dest_dir"
            cp "$page" "$dest_file"
            update_imports "$dest_file"
            echo "✅ Migrated page: $rel_path"
        fi
    fi
done

# 5. Copy middleware
if [[ -f "archive/warehouse_management/src/middleware.ts" ]] && [[ ! -f "middleware.ts" ]]; then
    cp "archive/warehouse_management/src/middleware.ts" "middleware.ts"
    update_imports "middleware.ts"
    echo "✅ Migrated middleware"
fi

# 6. Copy any missing type definitions
if [[ -d "archive/warehouse_management/src/types" ]]; then
    cp -r archive/warehouse_management/src/types/* lib/wms/types/ 2>/dev/null || true
fi

echo ""
echo "✨ Migration complete! Summary:"
echo "- Components migrated to /components/wms/"
echo "- API routes migrated to /app/api/v1/wms/"
echo "- Pages migrated to /app/wms/"
echo "- Lib files migrated to /lib/wms/"
echo "- All imports updated"
echo "- Prisma models prefixed with 'wms'"

echo ""
echo "📋 Next steps:"
echo "1. Run 'npm run type-check' to verify TypeScript"
echo "2. Run 'npm run lint' to check for issues"
echo "3. Test the application"
echo "4. Create separate PRs for schema and integration"