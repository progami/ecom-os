'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryName, formatCurrencyWithSymbol } from '@/lib/utils/format-helpers';
import { exportStorageFees } from '@/lib/utils/export-helpers';
import { filterByMarketplace } from '@/lib/utils/marketplace-filters';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { TableHeaderCell } from '@/components/ui/table-header-cell';
import { useTableState } from '@/hooks/use-table-state';
import { compareMarketplaces } from '@/lib/constants/marketplace-order';
import { getStorageSizePriority } from '@/lib/constants/size-tier-order';

interface StorageFee {
  marketplaceGroup: string;
  productSize: string;
  productCategory: string;
  period: string;
  fee: number;
  currency: string;
  unitOfMeasure: string;
}

interface StorageFeesTableProps {
  countryFilter?: string;
}

export function StorageFeesTable({ countryFilter }: StorageFeesTableProps) {
  const [data, setData] = useState<{ storageFees?: StorageFee[] } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Table state management for filtering only - sorting is disabled
  const tableState = useTableState({}) as any;

  useEffect(() => {
    fetch('/api/amazon-fees/storage-fees')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Generate filter options
  const filterOptions = useMemo(() => {
    if (!data?.storageFees) return {
      productSizes: [],
      categories: [],
      periods: []
    };
    
    const productSizes = Array.from(new Set(data.storageFees.map(f => f.productSize)));
    const categories = Array.from(new Set(data.storageFees.map(f => f.productCategory)));
    const periods = Array.from(new Set(data.storageFees.map(f => f.period)));
    
    return {
      productSizes: productSizes.sort().map(size => ({ value: size, label: size })),
      categories: categories.sort().map(cat => ({ value: cat, label: cat })),
      periods: periods.sort().map(period => ({ value: period, label: period }))
    };
  }, [data]);

  // Get min/max values for filters
  const filterRanges = useMemo(() => {
    if (!data?.storageFees) return {
      fee: { min: 0, max: 100 }
    };

    return {
      fee: { 
        min: Math.min(...data.storageFees.map(f => f.fee)), 
        max: Math.max(...data.storageFees.map(f => f.fee)) 
      }
    };
  }, [data]);


  // Custom filters for complex filtering logic
  const customFilters = useMemo(() => ({
    marketplaceGroup: (item: StorageFee, filterValue: string) => {
      // Convert marketplace code to country name for comparison
      const countryName = getCountryName(item.marketplaceGroup);
      return countryName.toLowerCase().includes(filterValue.toLowerCase());
    },
  }), []);

  // Process the data
  const processedData = useMemo(() => {
    if (!data?.storageFees) return [];

    // Apply country filter first
    let filtered = countryFilter 
      ? filterByMarketplace(data.storageFees, countryFilter, 'marketplaceGroup')
      : data.storageFees;

    // Apply table filters
    const result = tableState.processData?.(filtered, {
      customFilters,
      skipPagination: true, // We don't paginate in this table
    }) || { data: filtered, totalCount: filtered.length, pageCount: 1 };

    // Sort by marketplace, product size, category, and period (predefined order)
    return result.data.sort((a: any, b: any) => {
      // First sort by marketplace
      const marketplaceCompare = compareMarketplaces(a.marketplaceGroup, b.marketplaceGroup);
      if (marketplaceCompare !== 0) return marketplaceCompare;
      
      // Then by product size (standard size first)
      const aSizePriority = getStorageSizePriority(a.productSize);
      const bSizePriority = getStorageSizePriority(b.productSize);
      if (aSizePriority !== bSizePriority) return aSizePriority - bSizePriority;
      
      // Then by product category
      const categoryCompare = a.productCategory.localeCompare(b.productCategory);
      if (categoryCompare !== 0) return categoryCompare;
      
      // Finally by period
      return a.period.localeCompare(b.period);
    });
  }, [data, countryFilter, tableState, customFilters]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Storage Fees</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportStorageFees(processedData)}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {processedData.length} storage fees
              {countryFilter && ` for ${getCountryName(countryFilter)}`}
            </p>
          </div>

          <div className="table-wrapper">
            <Table className="fee-table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell
                    column="marketplaceGroup"
                    filterState={tableState.getFilterState('marketplaceGroup')}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={false}
                    filterType="text"
                    filterPlaceholder="Filter marketplace..."
                  >
                    Marketplace
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="productSize"
                    filterState={tableState.getFilterState('productSize')}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={false}
                    filterType="select"
                    filterOptions={filterOptions.productSizes}
                    filterMultiple={true}
                    filterPlaceholder="Filter product sizes..."
                  >
                    Product Size
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="productCategory"
                    filterState={tableState.getFilterState('productCategory')}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={false}
                    filterType="select"
                    filterOptions={filterOptions.categories}
                    filterMultiple={true}
                    filterPlaceholder="Filter categories..."
                  >
                    Product Category
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="period"
                    filterState={tableState.getFilterState('period')}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={false}
                    filterType="select"
                    filterOptions={filterOptions.periods}
                    filterMultiple={true}
                    filterPlaceholder="Filter periods..."
                  >
                    Period
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="fee"
                    filterState={tableState.getFilterState('fee')}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={false}
                    filterType="range"
                    filterMin={filterRanges.fee.min}
                    filterMax={filterRanges.fee.max}
                    filterStep={0.01}
                    filterFormatLabel={(value) => formatCurrencyWithSymbol(value, 'EUR')}
                  >
                    Fee
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.map((fee: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{getCountryName(fee.marketplaceGroup)}</TableCell>
                    <TableCell className="font-medium">{fee.productSize}</TableCell>
                    <TableCell>{fee.productCategory}</TableCell>
                    <TableCell>{fee.period}</TableCell>
                    <TableCell>
                      {formatCurrencyWithSymbol(fee.fee, fee.currency)} / {fee.unitOfMeasure}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}