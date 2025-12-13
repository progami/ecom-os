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
import { exportLowInventoryFees } from '@/lib/utils/export-helpers';
import { filterByMarketplace } from '@/lib/utils/marketplace-filters';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { TableHeaderCell } from '@/components/ui/table-header-cell';
import { useTableState } from '@/hooks/use-table-state';
import { createHierarchicalComparator } from '@/lib/constants/marketplace-order';

interface LowInventoryFee {
  marketplaceGroup: string;
  tierGroup: string;
  daysOfSupplyLowerBound: number;
  daysOfSupplyUpperBound: number;
  tierWeightLimitKg: number;
  fee: number;
  currency: string;
}

interface LowInventoryFeesTableProps {
  countryFilter?: string;
}

export function LowInventoryFeesTable({ countryFilter }: LowInventoryFeesTableProps) {
  const [data, setData] = useState<{ lowInventoryFees?: LowInventoryFee[] } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Table state management
  // Note: All sorting is hierarchical - marketplaces are grouped and pre-sorted by size (US, UK, DE, FR, etc.)
  // Then the selected sort is applied within each marketplace group
  const tableState = useTableState({
    defaultSort: { column: 'daysOfSupply', direction: 'asc' },
  }) as any;

  useEffect(() => {
    fetch('/api/amazon-fees/low-inventory')
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
  const tierGroupOptions = useMemo(() => {
    if (!data?.lowInventoryFees) return [];
    
    const tierGroups = Array.from(new Set(data.lowInventoryFees.map(f => f.tierGroup)));
    
    return tierGroups.sort().map(group => ({ value: group, label: group }));
  }, [data]);

  // Get min/max values for filters
  const filterRanges = useMemo(() => {
    if (!data?.lowInventoryFees) return {
      fee: { min: 0, max: 100 },
      daysOfSupply: { min: 0, max: 365 },
      weightLimit: { min: 0, max: 100 }
    };

    const fees = data.lowInventoryFees.map(f => f.fee);
    const daysOfSupply = data.lowInventoryFees.flatMap(f => [f.daysOfSupplyLowerBound, f.daysOfSupplyUpperBound]);
    const weights = data.lowInventoryFees.map(f => f.tierWeightLimitKg);

    return {
      fee: { 
        min: Math.min(...fees), 
        max: Math.max(...fees) 
      },
      daysOfSupply: { 
        min: Math.min(...daysOfSupply), 
        max: Math.max(...daysOfSupply) 
      },
      weightLimit: { 
        min: 0, 
        max: Math.max(...weights) 
      }
    };
  }, [data]);

  // Custom comparators for sorting (with marketplace hierarchy)
  const customComparators = useMemo(() => ({
    tierGroup: createHierarchicalComparator<LowInventoryFee>((a, b) => {
      return a.tierGroup.localeCompare(b.tierGroup);
    }),
    daysOfSupply: createHierarchicalComparator<LowInventoryFee>((a, b) => {
      return a.daysOfSupplyLowerBound - b.daysOfSupplyLowerBound;
    }),
    fee: createHierarchicalComparator<LowInventoryFee>((a, b) => {
      return a.fee - b.fee;
    }),
  }), []);

  // Custom filters for complex filtering logic
  const customFilters = useMemo(() => ({
    daysOfSupply: (item: LowInventoryFee, filterValue: [number, number]) => {
      const [min, max] = filterValue;
      return item.daysOfSupplyUpperBound >= min && item.daysOfSupplyLowerBound <= max;
    },
    marketplaceGroup: (item: LowInventoryFee, filterValue: string) => {
      // Convert marketplace code to country name for comparison
      const countryName = getCountryName(item.marketplaceGroup);
      return countryName.toLowerCase().includes(filterValue.toLowerCase());
    },
  }), []);

  // Process the data
  const processedData = useMemo(() => {
    if (!data?.lowInventoryFees) return [];

    // Apply country filter first
    let filtered = countryFilter 
      ? filterByMarketplace(data.lowInventoryFees, countryFilter, 'marketplaceGroup')
      : data.lowInventoryFees;

    // Then apply table filters and sorting
    const result = tableState.processData?.(filtered, {
      customComparators,
      customFilters,
      skipPagination: true, // We don't paginate in this table
    }) || { data: filtered, totalCount: filtered.length, pageCount: 1 };

    return result.data;
  }, [data, countryFilter, tableState, customComparators, customFilters]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Low Inventory Level Fees</CardTitle>
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
          <CardTitle>Low Inventory Level Fees</CardTitle>
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
        <CardTitle>Low Inventory Level Fees</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportLowInventoryFees(processedData)}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {processedData.length} low inventory fees
              {countryFilter && ` for ${getCountryName(countryFilter)}`}
            </p>
          </div>

          <div className="table-wrapper">
            <Table className="fee-table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell
                    column="marketplaceGroup"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('marketplaceGroup')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    filterType="text"
                    filterPlaceholder="Filter marketplace..."
                  >
                    Marketplace
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="tierGroup"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('tierGroup')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={true}
                    filterType="select"
                    filterOptions={tierGroupOptions}
                    filterMultiple={true}
                    filterPlaceholder="Filter tier groups..."
                  >
                    Tier Group
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="daysOfSupply"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('daysOfSupply')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={true}
                    filterType="range"
                    filterMin={filterRanges.daysOfSupply.min}
                    filterMax={filterRanges.daysOfSupply.max}
                    filterStep={1}
                    filterFormatLabel={(value) => `${value} days`}
                  >
                    Days of Supply
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="tierWeightLimitKg"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('tierWeightLimitKg')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    filterType="range"
                    filterMin={filterRanges.weightLimit.min}
                    filterMax={filterRanges.weightLimit.max}
                    filterStep={0.1}
                    filterFormatLabel={(value) => `${value} kg`}
                  >
                    Weight Limit
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="fee"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('fee')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={true}
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
                    <TableCell className="font-medium">{fee.tierGroup}</TableCell>
                    <TableCell>
                      {fee.daysOfSupplyLowerBound} - {fee.daysOfSupplyUpperBound} days
                    </TableCell>
                    <TableCell>{fee.tierWeightLimitKg} kg</TableCell>
                    <TableCell>
                      {formatCurrencyWithSymbol(fee.fee, fee.currency)}
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