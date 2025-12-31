'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/usePortalSession'
import { toast } from 'react-hot-toast'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { PageContainer, PageHeaderSection, PageContent } from '@/components/layout/page-container'
import { TabbedContainer, TabPanel } from '@/components/ui/tabbed-container'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, Package2, Download, Truck } from '@/lib/lucide-icons'
import { redirectToPortal } from '@/lib/portal'
import { fetchWithCSRF } from '@/lib/fetch-with-csrf'
import {
  OrderDetailsTab,
  LineItemsTab,
  AmazonImportTab,
  FreightLogisticsTab,
  type FormData,
  type AmazonShipmentState,
  type AmazonFreightState,
  type LineItem,
  type WarehouseOption,
  type SkuOption,
} from './components'

export default function NewFulfillmentOrderPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [skus, setSkus] = useState<SkuOption[]>([])

  const [formData, setFormData] = useState<FormData>({
    warehouseCode: '',
    destinationType: 'CUSTOMER',
    destinationName: '',
    destinationAddress: '',
    destinationCountry: '',
    shippingCarrier: '',
    shippingMethod: '',
    trackingNumber: '',
    externalReference: '',
    notes: '',
  })

  const [amazonShipment, setAmazonShipment] = useState<AmazonShipmentState>({
    shipmentId: '',
    shipmentName: '',
    shipmentStatus: '',
    destinationFulfillmentCenterId: '',
    labelPrepType: '',
    boxContentsSource: '',
    shipFromAddress: null,
    shipToAddress: null,
    referenceId: '',
    inboundPlanId: '',
    inboundOrderId: '',
  })

  const [amazonFreight, setAmazonFreight] = useState<AmazonFreightState>({
    shipmentReference: '',
    shipperId: '',
    pickupNumber: '',
    pickupAppointmentId: '',
    deliveryAppointmentId: '',
    loadId: '',
    freightBillNumber: '',
    billOfLadingNumber: '',
    pickupWindowStart: '',
    pickupWindowEnd: '',
    deliveryWindowStart: '',
    deliveryWindowEnd: '',
    pickupAddress: '',
    pickupContactName: '',
    pickupContactPhone: '',
    deliveryAddress: '',
    shipmentMode: '',
    boxCount: '',
    palletCount: '',
    commodityDescription: '',
    distanceMiles: '',
    basePrice: '',
    fuelSurcharge: '',
    totalPrice: '',
    currency: '',
  })

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      skuCode: '',
      skuDescription: '',
      batchLot: '',
      quantity: 1,
      notes: '',
    },
  ])

  const isAmazonFBA = formData.destinationType === 'AMAZON_FBA'

  // Tab configuration - dynamic based on destination type
  const tabs = useMemo(() => {
    const hasDetailsError = !formData.warehouseCode
    const hasAmazonError = isAmazonFBA && !amazonShipment.shipmentId
    const hasLineError = lineItems.some(item => !item.skuCode || !item.batchLot || item.quantity <= 0)

    const baseTabs = [
      {
        id: 'details',
        label: 'Order Details',
        icon: <FileText className="h-4 w-4" />,
        hasError: hasDetailsError,
      },
    ]

    if (isAmazonFBA) {
      baseTabs.push(
        {
          id: 'amazon-import',
          label: 'Amazon Import',
          icon: <Download className="h-4 w-4" />,
          hasError: hasAmazonError,
        },
        {
          id: 'freight',
          label: 'Freight & Logistics',
          icon: <Truck className="h-4 w-4" />,
          hasError: false,
        }
      )
    }

    baseTabs.push({
      id: 'line-items',
      label: 'Line Items',
      icon: <Package2 className="h-4 w-4" />,
      hasError: hasLineError,
    })

    return baseTabs
  }, [formData.warehouseCode, isAmazonFBA, amazonShipment.shipmentId, lineItems])

  const warehouseLabel = useMemo(() => {
    const selected = warehouses.find(w => w.code === formData.warehouseCode)
    return selected ? `${selected.code} — ${selected.name}` : ''
  }, [formData.warehouseCode, warehouses])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirectToPortal('/login', `${window.location.origin}/operations/fulfillment-orders/new`)
      return
    }
  }, [session, status])

  useEffect(() => {
    if (status !== 'authenticated') return

    const load = async () => {
      try {
        setLoading(true)
        const [warehousesRes, skusRes] = await Promise.all([
          fetch('/api/warehouses?includeAmazon=true'),
          fetch('/api/skus'),
        ])

        if (!warehousesRes.ok) {
          const payload = await warehousesRes.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load warehouses')
        }
        if (!skusRes.ok) {
          const payload = await skusRes.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load SKUs')
        }

        const warehousesPayload = await warehousesRes.json().catch(() => null)
        const skusPayload = await skusRes.json().catch(() => null)

        const warehousesData = Array.isArray(warehousesPayload?.data)
          ? (warehousesPayload.data as WarehouseOption[])
          : Array.isArray(warehousesPayload)
            ? (warehousesPayload as WarehouseOption[])
            : []
        const skusData = Array.isArray(skusPayload?.data)
          ? (skusPayload.data as SkuOption[])
          : Array.isArray(skusPayload)
            ? (skusPayload as SkuOption[])
            : []

        setWarehouses(warehousesData)
        setSkus(skusData)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [status])

  const handleSubmit = async () => {
    try {
      if (!formData.warehouseCode) {
        toast.error('Select a warehouse')
        return
      }

      const invalidLine = lineItems.find(item => !item.skuCode || !item.batchLot || item.quantity <= 0)
      if (invalidLine) {
        toast.error('Each line requires SKU, batch/lot, and quantity')
        return
      }

      setSubmitting(true)

      const payload = {
        warehouseCode: formData.warehouseCode,
        warehouseName: warehouseLabel || undefined,
        destinationType: formData.destinationType,
        destinationName: formData.destinationName || undefined,
        destinationAddress: formData.destinationAddress || undefined,
        destinationCountry: formData.destinationCountry || undefined,
        shippingCarrier: formData.shippingCarrier || undefined,
        shippingMethod: formData.shippingMethod || undefined,
        trackingNumber: formData.trackingNumber || undefined,
        externalReference: formData.externalReference || undefined,
        amazonShipmentId: amazonShipment.shipmentId || undefined,
        amazonShipmentName: amazonShipment.shipmentName || undefined,
        amazonShipmentStatus: amazonShipment.shipmentStatus || undefined,
        amazonDestinationFulfillmentCenterId:
          amazonShipment.destinationFulfillmentCenterId || undefined,
        amazonLabelPrepType: amazonShipment.labelPrepType || undefined,
        amazonBoxContentsSource: amazonShipment.boxContentsSource || undefined,
        amazonShipFromAddress: amazonShipment.shipFromAddress ?? undefined,
        amazonReferenceId: amazonShipment.referenceId || undefined,
        amazonShipmentReference: amazonFreight.shipmentReference || undefined,
        amazonShipperId: amazonFreight.shipperId || undefined,
        amazonPickupNumber: amazonFreight.pickupNumber || undefined,
        amazonPickupAppointmentId: amazonFreight.pickupAppointmentId || undefined,
        amazonDeliveryAppointmentId: amazonFreight.deliveryAppointmentId || undefined,
        amazonLoadId: amazonFreight.loadId || undefined,
        amazonFreightBillNumber: amazonFreight.freightBillNumber || undefined,
        amazonBillOfLadingNumber: amazonFreight.billOfLadingNumber || undefined,
        amazonPickupWindowStart: amazonFreight.pickupWindowStart || undefined,
        amazonPickupWindowEnd: amazonFreight.pickupWindowEnd || undefined,
        amazonDeliveryWindowStart: amazonFreight.deliveryWindowStart || undefined,
        amazonDeliveryWindowEnd: amazonFreight.deliveryWindowEnd || undefined,
        amazonPickupAddress: amazonFreight.pickupAddress || undefined,
        amazonPickupContactName: amazonFreight.pickupContactName || undefined,
        amazonPickupContactPhone: amazonFreight.pickupContactPhone || undefined,
        amazonDeliveryAddress: amazonFreight.deliveryAddress || undefined,
        amazonShipmentMode: amazonFreight.shipmentMode || undefined,
        amazonBoxCount: amazonFreight.boxCount || undefined,
        amazonPalletCount: amazonFreight.palletCount || undefined,
        amazonCommodityDescription: amazonFreight.commodityDescription || undefined,
        amazonDistanceMiles: amazonFreight.distanceMiles || undefined,
        amazonBasePrice: amazonFreight.basePrice || undefined,
        amazonFuelSurcharge: amazonFreight.fuelSurcharge || undefined,
        amazonTotalPrice: amazonFreight.totalPrice || undefined,
        amazonCurrency: amazonFreight.currency || undefined,
        notes: formData.notes || undefined,
        lines: lineItems.map(item => ({
          skuCode: item.skuCode,
          skuDescription: item.skuDescription || undefined,
          batchLot: item.batchLot,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
      }

      const response = await fetchWithCSRF('/api/fulfillment-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error ?? 'Failed to create fulfillment order')
        return
      }

      const orderId = data?.data?.id
      if (!orderId) {
        toast.error('Fulfillment order created but missing ID in response')
        return
      }

      toast.success('Fulfillment order created')
      router.push(`/operations/fulfillment-orders/${orderId}`)
    } catch (_error) {
      toast.error('Failed to create fulfillment order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeaderSection
          title="New Fulfillment Order"
          description="Operations"
          icon={FileText}
          actions={
            <Button asChild variant="outline" className="gap-2">
              <Link href="/operations/fulfillment-orders">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
          }
        />
        <PageContent>
          <div className="flex flex-col gap-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                  Draft
                </Badge>
                {isAmazonFBA && amazonShipment.shipmentId && (
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                    Amazon FBA
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Tabbed Content */}
            <TabbedContainer tabs={tabs} defaultTab="details">
              {/* Tab 1: Order Details */}
              <TabPanel>
                <OrderDetailsTab
                  formData={formData}
                  setFormData={setFormData}
                  warehouses={warehouses}
                  loading={loading}
                />
              </TabPanel>

              {/* Tab 2: Amazon Import (only for Amazon FBA) */}
              {isAmazonFBA && (
                <TabPanel>
                  <AmazonImportTab
                    amazonShipment={amazonShipment}
                    setAmazonShipment={setAmazonShipment}
                    setAmazonFreight={setAmazonFreight}
                    setFormData={setFormData}
                    setLineItems={setLineItems}
                    skus={skus}
                  />
                </TabPanel>
              )}

              {/* Tab 3: Freight & Logistics (only for Amazon FBA) */}
              {isAmazonFBA && (
                <TabPanel>
                  <FreightLogisticsTab
                    amazonFreight={amazonFreight}
                    setAmazonFreight={setAmazonFreight}
                  />
                </TabPanel>
              )}

              {/* Tab 4: Line Items */}
              <TabPanel>
                <LineItemsTab
                  lineItems={lineItems}
                  setLineItems={setLineItems}
                  skus={skus}
                />
              </TabPanel>
            </TabbedContainer>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => router.push('/operations/fulfillment-orders')}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Fulfillment Order'}
              </Button>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    </DashboardLayout>
  )
}
