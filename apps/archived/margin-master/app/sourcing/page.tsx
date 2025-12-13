'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Globe, Edit, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const sourcingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  countryOfOrigin: z.string().optional(),
  tariffRatePercent: z.number().min(0).max(100, 'Tariff must be between 0 and 100'),
  freightAssumptionCost: z.number().min(0).optional(),
  freightUnit: z.string().optional(),
  costBufferPercent: z.number().min(0).max(100, 'Buffer must be between 0 and 100'),
})

type SourcingFormData = z.infer<typeof sourcingSchema>

export default function SourcingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  
  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<SourcingFormData>({
    resolver: zodResolver(sourcingSchema),
    defaultValues: {
      tariffRatePercent: 0,
      costBufferPercent: 5,
      freightUnit: 'USD/kg',
    }
  })

  const freightUnit = watch('freightUnit')

  const onSubmit = (data: SourcingFormData) => {
    // TODO: Implement sourcing profile creation
    reset()
    setIsCreateOpen(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sourcing Profiles</h1>
            <p className="text-muted-foreground">
              Configure tariffs, freight costs, and cost buffers
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Sourcing Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Create Sourcing Profile</DialogTitle>
                  <DialogDescription>
                    Define sourcing parameters for margin calculations
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Profile Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., China Standard Shipping"
                      {...register('name')}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country of Origin</Label>
                    <Input
                      id="country"
                      placeholder="e.g., China"
                      {...register('countryOfOrigin')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tariff">Tariff Rate (%)</Label>
                    <Input
                      id="tariff"
                      type="number"
                      step="0.1"
                      placeholder="0"
                      {...register('tariffRatePercent', { valueAsNumber: true })}
                    />
                    {errors.tariffRatePercent && (
                      <p className="text-sm text-destructive">{errors.tariffRatePercent.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="freight">Freight Cost</Label>
                      <Input
                        id="freight"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...register('freightAssumptionCost', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Freight Unit</Label>
                      <Select 
                        value={freightUnit}
                        onValueChange={(value) => register('freightUnit').onChange({ target: { value } })}
                      >
                        <SelectTrigger id="unit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD/kg">USD/kg</SelectItem>
                          <SelectItem value="USD/lb">USD/lb</SelectItem>
                          <SelectItem value="USD/unit">USD/unit</SelectItem>
                          <SelectItem value="USD/cbm">USD/cbm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buffer">Cost Buffer (%)</Label>
                    <Input
                      id="buffer"
                      type="number"
                      step="0.1"
                      placeholder="5"
                      {...register('costBufferPercent', { valueAsNumber: true })}
                    />
                    {errors.costBufferPercent && (
                      <p className="text-sm text-destructive">{errors.costBufferPercent.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Additional margin to account for unexpected costs
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create Profile</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profiles</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Active sourcing profiles
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Tariff Rate</CardTitle>
              <Badge variant="secondary">%</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">
                Across all profiles
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Countries</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Unique origins
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sourcing Profiles</CardTitle>
            <CardDescription>
              Manage your sourcing configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search profiles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Tariff Rate</TableHead>
                    <TableHead>Freight Cost</TableHead>
                    <TableHead>Cost Buffer</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      <Globe className="mx-auto h-8 w-8 mb-2 text-muted-foreground/50" />
                      <p>No sourcing profiles found</p>
                      <p className="text-sm">Create your first sourcing profile to get started</p>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}