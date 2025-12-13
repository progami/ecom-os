import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface RateCardRow {
  sizeTier: string;
  dimensions: string;
  weightRange: string;
  fees: Record<string, { amount: number; currency: string }>;
}

interface Country {
  id: string;
  code: string;
  name: string;
  currency: string;
}

interface RateCardTableProps {
  countries: Country[];
  rateCard: RateCardRow[];
  className?: string;
}

export function RateCardTable({ countries, rateCard, className }: RateCardTableProps) {
  const formatCurrency = (amount: number, currency: string) => {
    const formatter = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return formatter.format(amount);
  };

  // Group rows by size tier
  const groupedData = rateCard.reduce((acc, row) => {
    if (!acc[row.sizeTier]) {
      acc[row.sizeTier] = [];
    }
    acc[row.sizeTier].push(row);
    return acc;
  }, {} as Record<string, RateCardRow[]>);

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Size Tier</TableHead>
            <TableHead className="min-w-[150px]">Dimensions</TableHead>
            <TableHead className="min-w-[100px]">Weight</TableHead>
            {countries.map((country) => (
              <TableHead key={country.code} className="text-center min-w-[100px]">
                {country.name}
                <div className="text-xs text-muted-foreground">({country.currency})</div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(groupedData).map(([sizeTier, rows]) => (
            rows.map((row, index) => (
              <TableRow key={`${sizeTier}-${row.weightRange}`}>
                {index === 0 && (
                  <TableCell 
                    rowSpan={rows.length} 
                    className="sticky left-0 bg-background z-10 font-medium border-r"
                  >
                    {sizeTier}
                  </TableCell>
                )}
                <TableCell>{row.dimensions}</TableCell>
                <TableCell>{row.weightRange}</TableCell>
                {countries.map((country) => {
                  const fee = row.fees[country.code];
                  return (
                    <TableCell key={country.code} className="text-center">
                      {fee ? formatCurrency(fee.amount, fee.currency) : '-'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ))}
        </TableBody>
      </Table>
    </div>
  );
}