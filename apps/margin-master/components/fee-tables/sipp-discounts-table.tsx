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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCountryName, formatCurrencyWithSymbol } from '@/lib/utils/format-helpers';
import { exportSippDiscounts } from '@/lib/utils/export-helpers';
import { filterByMarketplace } from '@/lib/utils/marketplace-filters';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { TableHeaderCell } from '@/components/ui/table-header-cell';
import { useTableState } from '@/hooks/use-table-state';
import { compareMarketplaces } from '@/lib/constants/marketplace-order';
import { compareSizeTiers } from '@/lib/constants/size-tier-order';

interface SippDiscountRaw {
  programName: string;
  sizeTierName: string;
  rateWeightLowerBoundKg: string | number | { toString(): string };
  rateWeightUpperBoundKg: string | number | { toString(): string };
  marketplace: string;
  discount: string | number | { toString(): string };
  currency: string;
}

interface SippDiscount {
  programName: string;
  sizeTierName: string;
  rateWeightLowerBoundKg: number;
  rateWeightUpperBoundKg: number;
  marketplace: string;
  discount: number;
  currency: string;
}

interface SippDiscountsTableProps {
  countryFilter?: string;
}

export function SippDiscountsTable({ countryFilter }: SippDiscountsTableProps) {
  const [data, setData] = useState<{ sippDiscounts?: SippDiscount[] } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Table state management for filtering only - sorting is disabled
  const tableState = useTableState({}) as any;

  useEffect(() => {
    fetch('/api/amazon-fees/sipp-discounts')
      .then(res => res.json())
      .then(data => {
        // Convert decimal values to numbers
        const processedData = {
          ...data,
          sippDiscounts: data.sippDiscounts?.map((item: SippDiscountRaw) => ({
            ...item,
            rateWeightLowerBoundKg: Number(item.rateWeightLowerBoundKg),
            rateWeightUpperBoundKg: Number(item.rateWeightUpperBoundKg),
            discount: Number(item.discount)
          }))
        };
        setData(processedData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // Generate filter options
  const filterOptions = useMemo(() => {
    if (!data?.sippDiscounts) return {
      sizeTiers: []
    };
    
    const sizeTiers = Array.from(new Set(data.sippDiscounts.map(d => d.sizeTierName)));
    
    return {
      sizeTiers: sizeTiers.sort().map(tier => ({ value: tier, label: tier }))
    };
  }, [data]);

  // Get min/max values for filters
  const filterRanges = useMemo(() => {
    if (!data?.sippDiscounts) return {
      discount: { min: 0, max: 100 },
      weight: { min: 0, max: 50 }
    };

    const discounts = data.sippDiscounts.map(d => d.discount);
    const weights = data.sippDiscounts.map(d => d.rateWeightUpperBoundKg);

    return {
      discount: { 
        min: Math.min(...discounts), 
        max: Math.max(...discounts) 
      },
      weight: { 
        min: 0, 
        max: Math.max(...weights) 
      }
    };
  }, [data]);


  // Custom filters for complex filtering logic
  const customFilters = useMemo(() => ({
    weightRange: (item: SippDiscount, filterValue: [number, number]) => {
      const [min, max] = filterValue;
      return item.rateWeightLowerBoundKg <= max && item.rateWeightUpperBoundKg >= min;
    },
    marketplace: (item: SippDiscount, filterValue: string) => {
      // Convert marketplace code to country name for comparison
      const countryName = getCountryName(item.marketplace);
      return countryName.toLowerCase().includes(filterValue.toLowerCase());
    },
  }), []);

  // Process the data
  const processedData = useMemo(() => {
    if (!data?.sippDiscounts) return null;

    const processSippData = (discounts: SippDiscount[]) => {
      // Apply country filter first
      let filtered = countryFilter 
        ? filterByMarketplace(discounts, countryFilter, 'marketplace')
        : discounts;

      // Apply table filters
      const result = tableState.processData?.(filtered, {
        customFilters,
        skipPagination: true, // We don't paginate in this table
      }) || { data: filtered, totalCount: filtered.length, pageCount: 1 };

      // Sort by marketplace and size tier (predefined order)
      return result.data.sort((a: any, b: any) => {
        // First sort by marketplace
        const marketplaceCompare = compareMarketplaces(a.marketplace, b.marketplace);
        if (marketplaceCompare !== 0) return marketplaceCompare;
        
        // Then by size tier
        const sizeTierCompare = compareSizeTiers(a.sizeTierName, b.sizeTierName);
        if (sizeTierCompare !== 0) return sizeTierCompare;
        
        // Finally by weight range
        return a.rateWeightLowerBoundKg - b.rateWeightLowerBoundKg;
      });
    };

    // Separate by program
    const standardSippDiscounts = data.sippDiscounts.filter(d => d.programName === "Standard Fulfilment by Amazon");
    const lowPriceSippDiscounts = data.sippDiscounts.filter(d => d.programName === "Low-Price FBA");

    return {
      standardSippDiscounts: processSippData(standardSippDiscounts),
      lowPriceSippDiscounts: processSippData(lowPriceSippDiscounts),
    };
  }, [data, countryFilter, tableState, customFilters]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SIPP Discounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !processedData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SIPP Discounts</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const totalDisplayed = processedData.standardSippDiscounts.length + processedData.lowPriceSippDiscounts.length;
  const totalSippDiscounts = data.sippDiscounts?.length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>SIPP Discounts</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportSippDiscounts(processedData.standardSippDiscounts, 'standard')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Standard
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportSippDiscounts(processedData.lowPriceSippDiscounts, 'lowprice')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Low-Price
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {totalDisplayed} of {totalSippDiscounts} SIPP discounts
              {countryFilter && ` for ${getCountryName(countryFilter)}`}
            </p>
          </div>

          <Tabs defaultValue="standard" className="w-full">
            <TabsList>
              <TabsTrigger value="standard">
                Standard FBA SIPP ({processedData.standardSippDiscounts.length})
              </TabsTrigger>
              <TabsTrigger value="lowprice">
                Low-Price FBA SIPP ({processedData.lowPriceSippDiscounts.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="standard">
              {processedData.standardSippDiscounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No SIPP discounts available for this program
                </p>
              ) : (
                <div className="table-wrapper">
                  <Table className="fee-table">
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell
                          column="sizeTierName"
                          filterState={tableState.getFilterState('sizeTierName')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="select"
                          filterOptions={filterOptions.sizeTiers}
                          filterMultiple={true}
                          filterPlaceholder="Filter size tiers..."
                        >
                          Size Tier
                        </TableHeaderCell>
                        <TableHeaderCell
                          column="weightRange"
                          filterState={tableState.getFilterState('weightRange')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="range"
                          filterMin={filterRanges.weight.min}
                          filterMax={filterRanges.weight.max}
                          filterStep={0.1}
                          filterFormatLabel={(value) => `${value} kg`}
                        >
                          Weight Range (kg)
                        </TableHeaderCell>
                        <TableHeaderCell
                          column="marketplace"
                          filterState={tableState.getFilterState('marketplace')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="text"
                          filterPlaceholder="Filter marketplace..."
                        >
                          Marketplace
                        </TableHeaderCell>
                        <TableHeaderCell
                          column="discount"
                          filterState={tableState.getFilterState('discount')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="range"
                          filterMin={filterRanges.discount.min}
                          filterMax={filterRanges.discount.max}
                          filterStep={0.01}
                          filterFormatLabel={(value) => formatCurrencyWithSymbol(value, 'EUR')}
                        >
                          Discount
                        </TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedData.standardSippDiscounts.map((discount: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{discount.sizeTierName}</TableCell>
                          <TableCell>
                            {discount.rateWeightLowerBoundKg} - {discount.rateWeightUpperBoundKg}
                          </TableCell>
                          <TableCell>{getCountryName(discount.marketplace)}</TableCell>
                          <TableCell>
                            {formatCurrencyWithSymbol(discount.discount, discount.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="lowprice">
              {processedData.lowPriceSippDiscounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No SIPP discounts available for this program
                </p>
              ) : (
                <div className="table-wrapper">
                  <Table className="fee-table">
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell
                          column="sizeTierName"
                          filterState={tableState.getFilterState('sizeTierName')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="select"
                          filterOptions={filterOptions.sizeTiers}
                          filterMultiple={true}
                          filterPlaceholder="Filter size tiers..."
                        >
                          Size Tier
                        </TableHeaderCell>
                        <TableHeaderCell
                          column="weightRange"
                          filterState={tableState.getFilterState('weightRange')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="range"
                          filterMin={filterRanges.weight.min}
                          filterMax={filterRanges.weight.max}
                          filterStep={0.1}
                          filterFormatLabel={(value) => `${value} kg`}
                        >
                          Weight Range (kg)
                        </TableHeaderCell>
                        <TableHeaderCell
                          column="marketplace"
                          filterState={tableState.getFilterState('marketplace')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="text"
                          filterPlaceholder="Filter marketplace..."
                        >
                          Marketplace
                        </TableHeaderCell>
                        <TableHeaderCell
                          column="discount"
                          filterState={tableState.getFilterState('discount')}
                          onFilter={tableState.handleFilter}
                          onClearFilter={tableState.handleClearFilter}
                          sortable={false}
                          filterType="range"
                          filterMin={filterRanges.discount.min}
                          filterMax={filterRanges.discount.max}
                          filterStep={0.01}
                          filterFormatLabel={(value) => formatCurrencyWithSymbol(value, 'EUR')}
                        >
                          Discount
                        </TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedData.lowPriceSippDiscounts.map((discount: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{discount.sizeTierName}</TableCell>
                          <TableCell>
                            {discount.rateWeightLowerBoundKg} - {discount.rateWeightUpperBoundKg}
                          </TableCell>
                          <TableCell>{getCountryName(discount.marketplace)}</TableCell>
                          <TableCell>
                            {formatCurrencyWithSymbol(discount.discount, discount.currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}