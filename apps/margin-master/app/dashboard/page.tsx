import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, DollarSign, Package, TrendingUp, ArrowRight, BarChart3, FileText, Layers } from 'lucide-react'

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MarginMaster</h1>
          <p className="text-muted-foreground">
            Automated Product Optimization for Amazon FBA
          </p>
        </div>

        {/* Featured Tool */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Combination Generator</CardTitle>
                <CardDescription className="mt-2">
                  Automatically analyze thousands of product variations to find optimal configurations
                </CardDescription>
              </div>
              <Zap className="h-12 w-12 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Smart Optimization</p>
                  <p className="text-sm text-muted-foreground">Find size tier sweet spots</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Maximize Margins</p>
                  <p className="text-sm text-muted-foreground">Identify top opportunities</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Bulk Analysis</p>
                  <p className="text-sm text-muted-foreground">Process 1000s at once</p>
                </div>
              </div>
            </div>
            <Link href="/combination-generator">
              <Button size="lg" className="w-full md:w-auto">
                Start Generating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Fee Tables
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">6</div>
              <p className="text-xs text-muted-foreground">
                Types of fees loaded
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Marketplaces
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">11</div>
              <p className="text-xs text-muted-foreground">
                European countries
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Programs
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">
                FBA, Low-Price, SIPP
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Fee Entries
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">908</div>
              <p className="text-xs text-muted-foreground">
                Total fee records
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Get started with your analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/combination-generator" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Zap className="mr-2 h-4 w-4" />
                  Generate Combinations
                </Button>
              </Link>
              <Link href="/materials" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Layers className="mr-2 h-4 w-4" />
                  Configure Materials
                </Button>
              </Link>
              <Link href="/sourcing" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="mr-2 h-4 w-4" />
                  Configure Sourcing
                </Button>
              </Link>
              <Link href="/amazon-fees" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  View Fee Tables
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fee Categories</CardTitle>
              <CardDescription>
                Types of Amazon fees in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Fulfillment Fees</span>
                  <span className="text-sm font-medium">461 entries</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Referral Fees</span>
                  <span className="text-sm font-medium">267 entries</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Storage Fees</span>
                  <span className="text-sm font-medium">8 entries</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Surcharges & Discounts</span>
                  <span className="text-sm font-medium">172 entries</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}