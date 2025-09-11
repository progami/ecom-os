"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CountryFilterProps {
  data: any[]
  onCountryChange: (country: string | null) => void
  marketplaceField: string
}

export function CountryFilter({ 
  data, 
  onCountryChange, 
  marketplaceField 
}: CountryFilterProps) {
  const [selectedCountry, setSelectedCountry] = React.useState<string>("all")

  // Extract unique countries from the data
  const uniqueCountries = React.useMemo(() => {
    const countries = new Set<string>()
    
    data.forEach(item => {
      const marketplace = item[marketplaceField]
      if (marketplace && typeof marketplace === 'string') {
        countries.add(marketplace)
      }
    })
    
    return Array.from(countries).sort()
  }, [data, marketplaceField])

  const handleValueChange = (value: string) => {
    setSelectedCountry(value)
    onCountryChange(value === "all" ? null : value)
  }

  return (
    <div className="ml-auto">
      <Select value={selectedCountry} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Countries</SelectItem>
          {uniqueCountries.map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}