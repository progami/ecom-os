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
import { exportFulfilmentFees } from '@/lib/utils/export-helpers';
import { filterByMarketplace } from '@/lib/utils/marketplace-filters';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { TableHeaderCell } from '@/components/ui/table-header-cell';
import { useTableState } from '@/hooks/use-table-state';
import { createHierarchicalComparator, compareMarketplaces } from '@/lib/constants/marketplace-order';
import { compareSizeTiers } from '@/lib/constants/size-tier-order';

interface FulfilmentFee {
  id: number;
  sizeTierName: string;
  lengthLimitCm: number;
  widthLimitCm: number;
  heightLimitCm: number;
  tierUnitWeightLimitKg?: number;
  tierDimWeightLimitKg?: number;
  rateWeightLowerBoundKg: number;
  rateWeightUpperBoundKg: number;
  marketplace: string;
  currency: string;
  fee: number;
  createdAt: string;
}

interface FulfilmentFeesData {
  standardFees: FulfilmentFee[];
  lowPriceFees: FulfilmentFee[];
  total: number;
}

interface FulfilmentFeesTableProps {
  countryFilter?: string;
}


export function FulfillmentFeesTable({ countryFilter }: FulfilmentFeesTableProps) {
  const [data, setData] = useState<FulfilmentFeesData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Table state management for filtering only - sorting is disabled
  const tableState = useTableState({}) as any;

  useEffect(() => {
    fetch('/api/amazon-fees/fulfilment-fees')
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

  // Generate size tier options
  const sizeTierOptions = useMemo(() => {
    if (!data) return [];
    
    const allFees = [...data.standardFees, ...data.lowPriceFees];
    const uniqueSizeTiers = Array.from(new Set(allFees.map(f => f.sizeTierName)));
    
    return uniqueSizeTiers
      .sort(compareSizeTiers)
      .map(tier => ({
        value: tier,
        label: tier,
      }));
  }, [data]);

  // Get min/max values for filters
  const filterRanges = useMemo(() => {
    if (!data) return {
      fee: { min: 0, max: 100 },
      weight: { min: 0, max: 50 },
      length: { min: 0, max: 1000 },
      width: { min: 0, max: 1000 },
      height: { min: 0, max: 1000 },
    };

    const allFees = [...data.standardFees, ...data.lowPriceFees];
    return {
      fee: { 
        min: Math.min(...allFees.map(f => f.fee)), 
        max: Math.max(...allFees.map(f => f.fee)) 
      },
      weight: { 
        min: 0, 
        max: Math.max(...allFees.map(f => f.rateWeightUpperBoundKg)) 
      },
      length: { 
        min: 0, 
        max: Math.max(...allFees.map(f => f.lengthLimitCm)) 
      },
      width: { 
        min: 0, 
        max: Math.max(...allFees.map(f => f.widthLimitCm)) 
      },
      height: { 
        min: 0, 
        max: Math.max(...allFees.map(f => f.heightLimitCm)) 
      },
    };
  }, [data]);


  // Custom filters for complex filtering logic
  const customFilters = useMemo(() => ({
    weightRange: (item: FulfilmentFee, filterValue: [number, number]) => {
      const [min, max] = filterValue;
      return item.rateWeightLowerBoundKg <= max && item.rateWeightUpperBoundKg >= min;
    },
    lengthLimitCm: (item: FulfilmentFee, filterValue: [number, number]) => {
      const [min, max] = filterValue;
      return item.lengthLimitCm >= min && item.lengthLimitCm <= max;
    },
    widthLimitCm: (item: FulfilmentFee, filterValue: [number, number]) => {
      const [min, max] = filterValue;
      return item.widthLimitCm >= min && item.widthLimitCm <= max;
    },
    heightLimitCm: (item: FulfilmentFee, filterValue: [number, number]) => {
      const [min, max] = filterValue;
      return item.heightLimitCm >= min && item.heightLimitCm <= max;
    },
    marketplace: (item: FulfilmentFee, filterValue: string) => {
      // Convert marketplace code to country name for comparison
      const countryName = getCountryName(item.marketplace);
      return countryName.toLowerCase().includes(filterValue.toLowerCase());
    },
  }), []);

  // Process the data
  const processedData = useMemo(() => {
    if (!data) return null;

    const processFeesData = (fees: FulfilmentFee[]) => {
      // Apply country filter first
      let filtered = countryFilter 
        ? filterByMarketplace(fees, countryFilter, 'marketplace')
        : fees;

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

    return {
      standardFees: processFeesData(data.standardFees),
      lowPriceFees: processFeesData(data.lowPriceFees),
    };
  }, [data, countryFilter, tableState, customFilters]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fulfilment Fees</CardTitle>
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
          <CardTitle>Fulfilment Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Failed to load data</p>
        </CardContent>
      </Card>
    );
  }

  const totalDisplayed = processedData.standardFees.length + processedData.lowPriceFees.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Fulfilment Fees</CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportFulfilmentFees(processedData.standardFees, 'standard')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Standard
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportFulfilmentFees(processedData.lowPriceFees, 'lowprice')}
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
              Showing {totalDisplayed} of {data.total} fees
              {countryFilter && ` for ${getCountryName(countryFilter)}`}
            </p>
          </div>

          <Tabs defaultValue="standard" className="w-full">
            <TabsList>
              <TabsTrigger value="standard">
                Standard FBA ({processedData.standardFees.length})
              </TabsTrigger>
              <TabsTrigger value="lowprice">
                Low-Price FBA ({processedData.lowPriceFees.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="standard">
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
                        filterOptions={sizeTierOptions}
                        filterMultiple={true}
                        filterPlaceholder="Filter size tiers..."
                      >
                        Size Tier
                      </TableHeaderCell>
                      <TableHeaderCell
                        column="dimensions"
                        sortable={false}
                        filterable={false}
                      >
                        Max Dimensions (cm)
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
                    {processedData.standardFees.map((fee: any) => (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">{fee.sizeTierName}</TableCell>
                        <TableCell>
                          {fee.lengthLimitCm} × {fee.widthLimitCm} × {fee.heightLimitCm}
                        </TableCell>
                        <TableCell>
                          {fee.rateWeightLowerBoundKg} - {fee.rateWeightUpperBoundKg}
                        </TableCell>
                        <TableCell>{getCountryName(fee.marketplace)}</TableCell>
                        <TableCell>
                          {formatCurrencyWithSymbol(fee.fee, fee.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="lowprice">
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
                        filterOptions={sizeTierOptions}
                        filterMultiple={true}
                        filterPlaceholder="Filter size tiers..."
                      >
                        Size Tier
                      </TableHeaderCell>
                      <TableHeaderCell
                        column="dimensions"
                        sortable={false}
                        filterable={false}
                      >
                        Max Dimensions (cm)
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
                    {processedData.lowPriceFees.map((fee: any) => (
                      <TableRow key={fee.id}>
                        <TableCell className="font-medium">{fee.sizeTierName}</TableCell>
                        <TableCell>
                          {fee.lengthLimitCm} × {fee.widthLimitCm} × {fee.heightLimitCm}
                        </TableCell>
                        <TableCell>
                          {fee.rateWeightLowerBoundKg} - {fee.rateWeightUpperBoundKg}
                        </TableCell>
                        <TableCell>{getCountryName(fee.marketplace)}</TableCell>
                        <TableCell>
                          {formatCurrencyWithSymbol(fee.fee, fee.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}