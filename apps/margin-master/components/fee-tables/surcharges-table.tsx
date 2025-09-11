'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle } from 'lucide-react'
import type { Surcharge } from '@/lib/types'

export function SurchargesTable() {
  const [surcharges, setSurcharges] = useState<Surcharge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSurcharges = async () => {
      try {
        const response = await fetch('/api/amazon-fees/surcharges')
        if (!response.ok) {
          throw new Error('Failed to fetch surcharges')
        }
        const data = await response.json()
        setSurcharges(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchSurcharges()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatFee = (surcharge: Surcharge) => {
    if (surcharge.percentage) {
      return `${surcharge.percentage}%`
    }
    if (surcharge.fee) {
      return formatCurrency(surcharge.fee)
    }
    return 'Variable'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Surcharges & Additional Fees</CardTitle>
        <CardDescription>
          Variable and seasonal fees that may apply to FBA sellers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>
            Surcharges are subject to change based on market conditions and seasonal factors.
          </p>
        </div>
        <Table>
          <TableCaption>
            These additional fees may apply based on specific conditions or time periods.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Surcharge Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Fee/Rate</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surcharges.map((surcharge) => (
              <TableRow key={surcharge.id}>
                <TableCell className="font-medium">{surcharge.name}</TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {surcharge.description}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatFee(surcharge)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {surcharge.unit || (surcharge.percentage ? 'of sale price' : 'per unit')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}