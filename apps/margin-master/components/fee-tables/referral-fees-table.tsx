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
import { getCountryName, formatCurrencyWithSymbol, getCurrencySymbol } from '@/lib/utils/format-helpers';
import { exportReferralFees } from '@/lib/utils/export-helpers';
import { filterByMarketplace } from '@/lib/utils/marketplace-filters';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { TableHeaderCell } from '@/components/ui/table-header-cell';
import { useTableState } from '@/hooks/use-table-state';
import { createHierarchicalComparator } from '@/lib/constants/marketplace-order';

interface ReferralFee {
  marketplaceGroup: string;
  productCategory: string;
  productSubcategory?: string;
  priceLowerBound: number;
  priceUpperBound: number;
  feePercentage: number;
  minReferralFee?: number;
  currency: string;
}

interface ReferralFeesTableProps {
  countryFilter?: string;
}

export function ReferralFeesTable({ countryFilter }: ReferralFeesTableProps) {
  const [data, setData] = useState<{ referralFees?: ReferralFee[] } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Table state management
  // Note: All sorting is hierarchical - marketplaces are grouped and pre-sorted by size (US, UK, DE, FR, etc.)
  // Then the selected sort is applied within each marketplace group
  const tableState = useTableState({
    defaultSort: { column: 'productCategory', direction: 'asc' },
  }) as any;

  useEffect(() => {
    fetch('/api/amazon-fees/referral-fees')
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
    if (!data?.referralFees) return {
      categories: [],
      subcategories: []
    };
    
    const categories = Array.from(new Set(data.referralFees.map(f => f.productCategory)));
    const subcategories = Array.from(new Set(data.referralFees.filter(f => f.productSubcategory).map(f => f.productSubcategory)));
    
    return {
      categories: categories.sort().map(cat => ({ value: cat, label: cat })),
      subcategories: subcategories.sort().map(sub => ({ value: sub || '', label: sub || '' }))
    };
  }, [data]);

  // Get min/max values for filters
  const filterRanges = useMemo(() => {
    if (!data?.referralFees) return {
      percentage: { min: 0, max: 100 },
      price: { min: 0, max: 10000 },
      minFee: { min: 0, max: 100 }
    };

    const percentages = data.referralFees.map(f => f.feePercentage);
    const prices = data.referralFees.flatMap(f => [f.priceLowerBound, f.priceUpperBound]);
    const minFees = data.referralFees.filter(f => f.minReferralFee).map(f => f.minReferralFee);

    return {
      percentage: { 
        min: Math.min(...percentages), 
        max: Math.max(...percentages) 
      },
      price: { 
        min: Math.min(...prices), 
        max: Math.max(...prices) 
      },
      minFee: { 
        min: minFees.length > 0 ? Math.min(...minFees.filter(f => f !== undefined) as number[]) : 0, 
        max: minFees.length > 0 ? Math.max(...minFees.filter(f => f !== undefined) as number[]) : 100 
      }
    };
  }, [data]);

  // Custom comparators for sorting (with marketplace hierarchy)
  const customComparators = useMemo(() => ({
    productCategory: createHierarchicalComparator<ReferralFee>((a, b) => {
      return a.productCategory.localeCompare(b.productCategory);
    }),
    feePercentage: createHierarchicalComparator<ReferralFee>((a, b) => {
      return a.feePercentage - b.feePercentage;
    }),
    minReferralFee: createHierarchicalComparator<ReferralFee>((a, b) => {
      // Handle null/undefined values
      if (!a.minReferralFee && !b.minReferralFee) return 0;
      if (!a.minReferralFee) return 1;
      if (!b.minReferralFee) return -1;
      return a.minReferralFee - b.minReferralFee;
    }),
    priceRange: createHierarchicalComparator<ReferralFee>((a, b) => {
      return a.priceLowerBound - b.priceLowerBound;
    }),
  }), []);

  // Custom filters for complex filtering logic
  const customFilters = useMemo(() => ({
    priceRange: (item: ReferralFee, filterValue: [number, number]) => {
      const [min, max] = filterValue;
      return item.priceUpperBound >= min && item.priceLowerBound <= max;
    },
    minReferralFee: (item: ReferralFee, filterValue: [number, number]) => {
      if (!item.minReferralFee) return true;
      const [min, max] = filterValue;
      return item.minReferralFee >= min && item.minReferralFee <= max;
    },
    marketplaceGroup: (item: ReferralFee, filterValue: string) => {
      // Convert marketplace code to country name for comparison
      const countryName = getCountryName(item.marketplaceGroup);
      return countryName.toLowerCase().includes(filterValue.toLowerCase());
    },
  }), []);

  // Process the data
  const processedData = useMemo(() => {
    if (!data?.referralFees) return [];

    // Apply country filter first
    let filtered = countryFilter 
      ? filterByMarketplace(data.referralFees, countryFilter, 'marketplaceGroup')
      : data.referralFees;

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
          <CardTitle>Referral Fees</CardTitle>
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
          <CardTitle>Referral Fees</CardTitle>
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
        <CardTitle>Referral Fees</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportReferralFees(processedData)}
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {processedData.length} referral fees
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
                    column="productCategory"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('productCategory')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={true}
                    filterType="select"
                    filterOptions={filterOptions.categories}
                    filterMultiple={true}
                    filterPlaceholder="Filter categories..."
                  >
                    Category
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="productSubcategory"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('productSubcategory')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    filterType="select"
                    filterOptions={filterOptions.subcategories}
                    filterMultiple={true}
                    filterPlaceholder="Filter subcategories..."
                  >
                    Subcategory
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="priceRange"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('priceRange')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    filterType="range"
                    filterMin={filterRanges.price.min}
                    filterMax={filterRanges.price.max}
                    filterStep={1}
                    filterFormatLabel={(value) => formatCurrencyWithSymbol(value, 'EUR')}
                  >
                    Price Range
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="feePercentage"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('feePercentage')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={true}
                    filterType="range"
                    filterMin={filterRanges.percentage.min}
                    filterMax={filterRanges.percentage.max}
                    filterStep={0.1}
                    filterFormatLabel={(value) => `${value}%`}
                  >
                    Percentage
                  </TableHeaderCell>
                  <TableHeaderCell
                    column="minReferralFee"
                    sortState={tableState.sort}
                    filterState={tableState.getFilterState('minReferralFee')}
                    onSort={tableState.handleSort}
                    onFilter={tableState.handleFilter}
                    onClearFilter={tableState.handleClearFilter}
                    sortable={true}
                    filterType="range"
                    filterMin={filterRanges.minFee.min}
                    filterMax={filterRanges.minFee.max}
                    filterStep={0.01}
                    filterFormatLabel={(value) => formatCurrencyWithSymbol(value, 'EUR')}
                  >
                    Minimum Fee
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedData.map((fee: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{getCountryName(fee.marketplaceGroup)}</TableCell>
                    <TableCell className="font-medium">{fee.productCategory}</TableCell>
                    <TableCell>{fee.productSubcategory || '-'}</TableCell>
                    <TableCell>
                      {getCurrencySymbol(fee.currency)}{fee.priceLowerBound} - {getCurrencySymbol(fee.currency)}{fee.priceUpperBound}
                    </TableCell>
                    <TableCell>{fee.feePercentage}%</TableCell>
                    <TableCell>
                      {fee.minReferralFee ? formatCurrencyWithSymbol(fee.minReferralFee, fee.currency) : '-'}
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