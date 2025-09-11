"use client"

import React from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Package,
  Calendar,
  Activity,
  AlertCircle,
  Shield,
  Zap,
  Info
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface MetricData {
  netMargin: number
  roi: number
  breakEvenUnits: number
  monthlyProfitPotential: number
  profitPerUnit: number
  totalInvestment: number
  marketCompetitiveness: number
  riskAssessment: 'low' | 'medium' | 'high'
  trends?: {
    netMargin: 'up' | 'down' | 'stable'
    roi: 'up' | 'down' | 'stable'
    breakEvenUnits: 'up' | 'down' | 'stable'
    monthlyProfitPotential: 'up' | 'down' | 'stable'
  }
}

interface MetricsDashboardProps {
  data?: MetricData
  loading?: boolean
}

const getMetricColor = (value: number, type: 'margin' | 'roi') => {
  if (type === 'margin') {
    if (value >= 25) return 'text-green-600 dark:text-green-400'
    if (value >= 15) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }
  if (type === 'roi') {
    if (value >= 30) return 'text-green-600 dark:text-green-400'
    if (value >= 20) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }
  return 'text-foreground'
}

const getProgressColor = (value: number, type: 'margin' | 'roi') => {
  if (type === 'margin') {
    if (value >= 25) return 'bg-green-600 dark:bg-green-400'
    if (value >= 15) return 'bg-yellow-600 dark:bg-yellow-400'
    return 'bg-red-600 dark:bg-red-400'
  }
  if (type === 'roi') {
    if (value >= 30) return 'bg-green-600 dark:bg-green-400'
    if (value >= 20) return 'bg-yellow-600 dark:bg-yellow-400'
    return 'bg-red-600 dark:bg-red-400'
  }
  return 'bg-primary'
}

const getRiskBadgeVariant = (risk: 'low' | 'medium' | 'high') => {
  switch (risk) {
    case 'low':
      return 'success'
    case 'medium':
      return 'secondary'
    case 'high':
      return 'destructive'
    default:
      return 'default'
  }
}

const MetricCard = ({
  title,
  value,
  icon: Icon,
  trend,
  tooltip,
  color,
  format = 'number',
  suffix = '',
  prefix = '',
  progress,
  progressColor,
  loading = false
}: {
  title: string
  value: number | string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'stable'
  tooltip: string
  color?: string
  format?: 'number' | 'currency' | 'percent'
  suffix?: string
  prefix?: string
  progress?: number
  progressColor?: string
  loading?: boolean
}) => {
  const formatValue = () => {
    if (typeof value === 'string') return value
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)
      case 'percent':
        return `${value.toFixed(1)}%`
      default:
        return new Intl.NumberFormat('en-US').format(value)
    }
  }

  if (loading) {
    return (
      <Card className="overflow-hidden transition-all hover:shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-10 w-32 mb-2" />
          <Skeleton className="h-2 w-full mb-2" />
          <Skeleton className="h-4 w-16" />
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card className="overflow-hidden transition-all hover:shadow-lg group">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
              <div className="p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-bold tracking-tight", color)}>
              {prefix}{formatValue()}{suffix}
            </span>
            {trend && (
              <div className="flex items-center">
                {trend === 'up' && (
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
                {trend === 'down' && (
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
                {trend === 'stable' && (
                  <Activity className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
          {progress !== undefined && (
            <div className="mt-3">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-500", progressColor)}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {progress.toFixed(0)}% of target
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

const InsightCard = ({
  title,
  value,
  icon: Icon,
  description,
  badge,
  loading = false
}: {
  title: string
  value: string | number
  icon: React.ElementType
  description: string
  badge?: React.ReactNode
  loading?: boolean
}) => {
  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-20 mb-1" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {badge}
            </div>
            <p className="text-xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function MetricsDashboard({ data, loading = false }: MetricsDashboardProps) {
  const mockData: MetricData = {
    netMargin: 22.5,
    roi: 28.3,
    breakEvenUnits: 125,
    monthlyProfitPotential: 4500,
    profitPerUnit: 12.50,
    totalInvestment: 15000,
    marketCompetitiveness: 82,
    riskAssessment: 'medium',
    trends: {
      netMargin: 'up',
      roi: 'up',
      breakEvenUnits: 'down',
      monthlyProfitPotential: 'up'
    }
  }

  const metrics = data || mockData

  return (
    <div className="space-y-6">
      {/* Primary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Net Margin"
          value={metrics.netMargin}
          icon={DollarSign}
          trend={metrics.trends?.netMargin}
          tooltip="The percentage of revenue that remains as profit after all expenses"
          color={getMetricColor(metrics.netMargin, 'margin')}
          format="percent"
          progress={metrics.netMargin}
          progressColor={getProgressColor(metrics.netMargin, 'margin')}
          loading={loading}
        />
        <MetricCard
          title="ROI"
          value={metrics.roi}
          icon={Target}
          trend={metrics.trends?.roi}
          tooltip="Return on Investment - the percentage gain on your initial investment"
          color={getMetricColor(metrics.roi, 'roi')}
          format="percent"
          progress={metrics.roi}
          progressColor={getProgressColor(metrics.roi, 'roi')}
          loading={loading}
        />
        <MetricCard
          title="Break-even Units"
          value={metrics.breakEvenUnits}
          icon={Package}
          trend={metrics.trends?.breakEvenUnits}
          tooltip="Number of units you need to sell to cover all costs"
          loading={loading}
        />
        <MetricCard
          title="Monthly Profit Potential"
          value={metrics.monthlyProfitPotential}
          icon={Calendar}
          trend={metrics.trends?.monthlyProfitPotential}
          tooltip="Estimated profit based on projected monthly sales volume"
          format="currency"
          loading={loading}
        />
      </div>

      {/* Additional Insights */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Additional Insights</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <InsightCard
            title="Profit per Unit"
            value={`$${metrics.profitPerUnit.toFixed(2)}`}
            icon={Zap}
            description="Average profit margin on each unit sold"
            loading={loading}
          />
          <InsightCard
            title="Total Investment"
            value={new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
            }).format(metrics.totalInvestment)}
            icon={DollarSign}
            description="Initial capital required to start"
            loading={loading}
          />
          <InsightCard
            title="Market Competitiveness"
            value={`${metrics.marketCompetitiveness}%`}
            icon={Activity}
            description="How well positioned you are versus competitors"
            badge={
              <Badge variant={metrics.marketCompetitiveness >= 75 ? 'success' : 'secondary'}>
                {metrics.marketCompetitiveness >= 75 ? 'Strong' : 'Moderate'}
              </Badge>
            }
            loading={loading}
          />
          <InsightCard
            title="Risk Assessment"
            value={metrics.riskAssessment.charAt(0).toUpperCase() + metrics.riskAssessment.slice(1)}
            icon={Shield}
            description="Overall risk level based on market factors"
            badge={
              <Badge variant={getRiskBadgeVariant(metrics.riskAssessment)}>
                {metrics.riskAssessment === 'low' && <AlertCircle className="h-3 w-3 mr-1" />}
                {metrics.riskAssessment}
              </Badge>
            }
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}