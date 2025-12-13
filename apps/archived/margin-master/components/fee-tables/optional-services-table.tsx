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
import { Loader2 } from 'lucide-react'
import type { OptionalService } from '@/lib/types'

export function OptionalServicesTable() {
  const [services, setServices] = useState<OptionalService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/amazon-fees/optional')
        if (!response.ok) {
          throw new Error('Failed to fetch optional services')
        }
        const data = await response.json()
        setServices(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchServices()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const groupedServices = services.reduce((acc, service) => {
    if (!acc[service.serviceName]) {
      acc[service.serviceName] = []
    }
    acc[service.serviceName].push(service)
    return acc
  }, {} as Record<string, OptionalService[]>)

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
        <CardTitle>Optional Services</CardTitle>
        <CardDescription>
          Additional FBA services and their associated fees
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption>
            Optional services are charged when requested or required for specific products.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Service Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedServices).map(([serviceName, serviceList]) => (
              <>
                <TableRow key={serviceName} className="bg-muted/50">
                  <TableCell colSpan={4} className="font-semibold">
                    {serviceName}
                  </TableCell>
                </TableRow>
                {serviceList.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell></TableCell>
                    <TableCell>{service.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(service.fee)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{service.unit}</TableCell>
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}