'use client';

import { Check, ChevronsUpDown, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useCountries } from '@/lib/hooks/use-amazon-fees';
import { useState } from 'react';

interface CountrySelectorProps {
  value?: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  className?: string;
}

export function CountrySelector({
  value = [],
  onChange,
  multiple = true,
  placeholder = 'Select countries...',
  className,
}: CountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useCountries({ includePrograms: true });

  const selectedCountries = data?.countries.filter((country) =>
    value.includes(country.code)
  ) || [];

  const handleSelect = (countryCode: string) => {
    if (multiple) {
      if (value.includes(countryCode)) {
        onChange(value.filter((code) => code !== countryCode));
      } else {
        onChange([...value, countryCode]);
      }
    } else {
      onChange([countryCode]);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between', className)}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {selectedCountries.length > 0 ? (
              <div className="flex items-center gap-2">
                {multiple && selectedCountries.length > 2 ? (
                  <span>{selectedCountries.length} countries selected</span>
                ) : (
                  selectedCountries.map((country) => (
                    <Badge key={country.code} variant="secondary" className="text-xs">
                      {country.code}
                    </Badge>
                  ))
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search countries..." />
          <CommandEmpty>
            {isLoading ? 'Loading countries...' : 'No country found.'}
          </CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-auto">
            {data?.countries.map((country) => (
              <CommandItem
                key={country.code}
                value={country.name}
                onSelect={() => handleSelect(country.code)}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value.includes(country.code) ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{country.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {country.code}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{country.currency}</span>
                    {country.region && (
                      <>
                        <span>•</span>
                        <span>{country.region}</span>
                      </>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}