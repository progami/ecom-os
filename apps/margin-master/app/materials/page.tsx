'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Search, Package, Edit, Trash2, Info, HelpCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { materialTemplates, MaterialTemplateCard } from '@/components/material-templates'

const materialSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  countryOfOrigin: z.string().optional(),
  costPerUnit: z.number().min(0, 'Cost must be positive'),
  costUnit: z.enum(['area', 'weight', 'volume', 'piece']),
  densityGCm3: z.number().min(0, 'Density must be positive'),
  thicknessOptions: z.array(z.number()).optional(),
  maxSheetLength: z.number().optional(),
  maxSheetWidth: z.number().optional(),
  minOrderQuantity: z.number().optional(),
  setupCost: z.number().optional(),
  wasteFactor: z.number().min(0).max(1).default(0.1),
  maxBendRadius: z.number().optional(),
  isRigid: z.boolean().default(false),
  requiresLiner: z.boolean().default(false),
  notes: z.string().optional(),
})

type MaterialFormData = z.infer<typeof materialSchema>

interface Material {
  id: string
  name: string
  countryOfOrigin: string | null
  costPerUnit: number
  costUnit: string
  densityGCm3: number
  thicknessOptions: number[] | null
  maxSheetLength: number | null
  maxSheetWidth: number | null
  minOrderQuantity: number | null
  setupCost: number | null
  wasteFactor: number
  maxBendRadius: number | null
  isRigid: boolean
  requiresLiner: boolean
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export default function MaterialsPage() {
  return (
    <TooltipProvider>
      <MaterialsPageContent />
    </TooltipProvider>
  )
}

function MaterialsPageContent() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      costPerUnit: 0,
      costUnit: 'area',
      densityGCm3: 0,
      wasteFactor: 0.1,
      isRigid: false,
      requiresLiner: false,
      thicknessOptions: [1.0],
    }
  })
  
  const costUnit = watch('costUnit')

  useEffect(() => {
    fetchMaterials()
  }, [])

  const fetchMaterials = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      
      const response = await fetch(`/api/materials?${params}`)
      if (!response.ok) throw new Error('Failed to fetch materials')
      
      const data = await response.json()
      setMaterials(data)
    } catch (error) {
      console.error('Error fetching materials:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMaterials()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const onSubmit = async (data: MaterialFormData) => {
    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) throw new Error('Failed to create material')
      
      await fetchMaterials()
      reset()
      setIsCreateOpen(false)
    } catch (error) {
      console.error('Error creating material:', error)
    }
  }

  const formatCostUnit = (unit: string) => {
    switch (unit) {
      case 'area': return 'per m²'
      case 'weight': return 'per kg'
      case 'volume': return 'per m³'
      case 'piece': return 'per unit'
      default: return ''
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Material Profiles</h1>
            <p className="text-muted-foreground">
              Manage material properties for margin calculations
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Material
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <form onSubmit={handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Create Material Profile</DialogTitle>
                  <DialogDescription>
                    Add a new material with physical properties and cost information
                  </DialogDescription>
                </DialogHeader>
                
                <Tabs defaultValue="templates" className="mt-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="physical">Physical Properties</TabsTrigger>
                    <TabsTrigger value="cost">Cost & Constraints</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="templates" className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Start with a template to quickly set up common materials
                    </div>
                    <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                      {materialTemplates.map((template) => (
                        <MaterialTemplateCard
                          key={template.name}
                          template={template}
                          onSelect={(template) => {
                            // Populate form with template data
                            setValue('name', template.data.name)
                            setValue('densityGCm3', template.data.densityGCm3)
                            setValue('costUnit', template.data.costUnit)
                            setValue('wasteFactor', template.data.wasteFactor)
                            setValue('isRigid', template.data.isRigid)
                            setValue('requiresLiner', template.data.requiresLiner)
                            setValue('notes', template.data.notes)
                            if (template.data.thicknessOptions) {
                              setValue('thicknessOptions', template.data.thicknessOptions)
                            }
                            if (template.data.suggestedCost) {
                              setValue('costPerUnit', template.data.suggestedCost)
                            }
                            // Switch to basic tab after selection
                            const basicTab = document.querySelector('[value="basic"]') as HTMLElement
                            basicTab?.click()
                          }}
                        />
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="name">Material Name</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Give your material a descriptive name. Examples:</p>
                              <ul className="list-disc list-inside mt-1">
                                <li>Corrugated Cardboard - Single Wall</li>
                                <li>Kraft Paper - 80gsm Brown</li>
                                <li>Bubble Wrap - Large Bubbles</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        id="name"
                        placeholder="e.g., Corrugated Cardboard"
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
                      <div className="flex items-center gap-2">
                        <Label htmlFor="density">Density (g/cm³)</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Material density affects packaging weight. Common values:</p>
                              <ul className="list-disc list-inside mt-1">
                                <li>Corrugated cardboard: 0.15-0.25</li>
                                <li>Solid cardboard: 0.6-0.9</li>
                                <li>Plastic sheet: 0.9-1.4</li>
                                <li>Foam: 0.02-0.1</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        id="density"
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        {...register('densityGCm3', { valueAsNumber: true })}
                      />
                      {errors.densityGCm3 && (
                        <p className="text-sm text-destructive">{errors.densityGCm3.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        placeholder="Additional information about this material..."
                        className="min-h-[80px]"
                        {...register('notes')}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="physical" className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="thickness">Available Thicknesses (mm)</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>List all thickness options your supplier offers. This affects:</p>
                              <ul className="list-disc list-inside mt-1">
                                <li>Material strength and protection</li>
                                <li>Total packaging weight</li>
                                <li>Material cost per unit</li>
                              </ul>
                              <p className="mt-1">Example: 1.5, 2, 3, 4 (for cardboard)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        id="thickness"
                        placeholder="e.g., 1, 1.5, 2, 3"
                        onChange={(e) => {
                          const values = e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
                          setValue('thicknessOptions', values)
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Comma-separated values</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="maxLength">Max Sheet Length (cm)</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Maximum material sheet/roll length available from supplier</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          id="maxLength"
                          type="number"
                          placeholder="Optional"
                          {...register('maxSheetLength', { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxWidth">Max Sheet Width (cm)</Label>
                        <Input
                          id="maxWidth"
                          type="number"
                          placeholder="Optional"
                          {...register('maxSheetWidth', { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bendRadius">Max Bend Radius (cm)</Label>
                      <Input
                        id="bendRadius"
                        type="number"
                        step="0.1"
                        placeholder="Optional - for rigid materials"
                        {...register('maxBendRadius', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="rigid" className="flex flex-col space-y-1">
                        <span>Rigid Material</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Cannot be easily bent or folded
                        </span>
                      </Label>
                      <Switch
                        id="rigid"
                        {...register('isRigid')}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="liner" className="flex flex-col space-y-1">
                        <span>Requires Liner</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Needs inner protective layer
                        </span>
                      </Label>
                      <Switch
                        id="liner"
                        {...register('requiresLiner')}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="cost" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="costUnit">Cost Unit Type</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>How your supplier charges for this material:</p>
                                <ul className="list-disc list-inside mt-1">
                                  <li><strong>Area:</strong> Sheet materials (cardboard, paper)</li>
                                  <li><strong>Weight:</strong> Bulk materials (pellets, granules)</li>
                                  <li><strong>Volume:</strong> Foam, loose fill</li>
                                  <li><strong>Piece:</strong> Pre-cut or standard sizes</li>
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Select
                          value={costUnit}
                          onValueChange={(value) => setValue('costUnit', value as any)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="area">Per Area (m²)</SelectItem>
                            <SelectItem value="weight">Per Weight (kg)</SelectItem>
                            <SelectItem value="volume">Per Volume (m³)</SelectItem>
                            <SelectItem value="piece">Per Piece</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cost">
                          Cost per {costUnit === 'area' ? 'Square Meter' : 
                                  costUnit === 'weight' ? 'Kilogram' : 
                                  costUnit === 'volume' ? 'Cubic Meter' : 'Unit'}
                        </Label>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...register('costPerUnit', { valueAsNumber: true })}
                        />
                        {errors.costPerUnit && (
                          <p className="text-sm text-destructive">{errors.costPerUnit.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="moq">Minimum Order Quantity</Label>
                      <Input
                        id="moq"
                        type="number"
                        step="0.01"
                        placeholder="Optional - in cost units"
                        {...register('minOrderQuantity', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setup">Setup Cost ($)</Label>
                      <Input
                        id="setup"
                        type="number"
                        step="0.01"
                        placeholder="Optional - one-time cost"
                        {...register('setupCost', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="waste">Waste Factor (%)</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Material lost during cutting and production. Typical values:</p>
                              <ul className="list-disc list-inside mt-1">
                                <li>Simple rectangular cuts: 5-10%</li>
                                <li>Complex die-cuts: 15-25%</li>
                                <li>Irregular shapes: 20-30%</li>
                              </ul>
                              <p className="mt-1">This increases your effective material cost.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        id="waste"
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        placeholder="10"
                        defaultValue="10"
                        onChange={(e) => setValue('wasteFactor', parseFloat(e.target.value) / 100)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Percentage of material wasted during cutting/production
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button type="submit">Create Material</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Materials</CardTitle>
            <CardDescription>
              View and manage your material profiles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search materials..."
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
                    <TableHead>Material Name</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Physical Properties</TableHead>
                    <TableHead>Constraints</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        <p>Loading materials...</p>
                      </TableCell>
                    </TableRow>
                  ) : materials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        <Package className="mx-auto h-8 w-8 mb-2 text-muted-foreground/50" />
                        <p>No materials found</p>
                        <p className="text-sm">Create your first material profile to get started</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    materials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-medium">{material.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {material.countryOfOrigin || 'Unknown origin'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>${Number(material.costPerUnit).toFixed(2)} {formatCostUnit(material.costUnit)}</div>
                            <div className="text-sm text-muted-foreground">
                              Waste: {(Number(material.wasteFactor) * 100).toFixed(0)}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div>Density: {Number(material.densityGCm3)} g/cm³</div>
                            {material.thicknessOptions && (
                              <div className="text-muted-foreground">
                                Thickness: {(material.thicknessOptions as number[]).join(', ')}mm
                              </div>
                            )}
                            <div className="flex gap-2">
                              {material.isRigid && <Badge variant="outline" className="text-xs">Rigid</Badge>}
                              {material.requiresLiner && <Badge variant="outline" className="text-xs">Liner</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            {material.minOrderQuantity && (
                              <div>MOQ: {Number(material.minOrderQuantity)} {material.costUnit}</div>
                            )}
                            {material.maxSheetLength && material.maxSheetWidth && (
                              <div className="text-muted-foreground">
                                Max: {material.maxSheetLength}×{material.maxSheetWidth}cm
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={material.isActive ? 'default' : 'secondary'}>
                            {material.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}