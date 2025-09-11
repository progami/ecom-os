'use client';

import { Package } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePrograms } from '@/lib/hooks/use-amazon-fees';
import { getProgramInfo, isFulfillmentProgram } from '@/lib/constants/amazon-programs';

interface ProgramSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  country?: string;
  className?: string;
  showOnlyFulfillmentPrograms?: boolean;
}

export function ProgramSelector({
  value = 'STANDARD',
  onChange,
  country,
  className,
  showOnlyFulfillmentPrograms = true,
}: ProgramSelectorProps) {
  const { data, isLoading } = usePrograms({ country, includeCountries: true });

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Loading programs..." />
        </SelectTrigger>
      </Select>
    );
  }

  // Filter programs based on whether we only want fulfillment programs
  const filteredPrograms = data?.programs.filter(program => 
    !showOnlyFulfillmentPrograms || isFulfillmentProgram(program.code)
  ) || [];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <SelectValue placeholder="Select a program">
            {value && getProgramInfo(value).displayName}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Available Programs</SelectLabel>
          {filteredPrograms.map((program) => {
            const programInfo = getProgramInfo(program.code);
            return (
              <SelectItem key={program.code} value={program.code}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{programInfo.icon}</span>
                    <div>
                      <div className="font-medium">{programInfo.displayName}</div>
                      {programInfo.description && (
                        <div className="text-xs text-muted-foreground">
                          {programInfo.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {program.code}
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}