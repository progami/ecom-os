'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Clock,
  Info,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

type ModelStatus = 'available' | 'beta' | 'coming-soon';
type ModelType = 'statistical' | 'neural' | 'foundation';
type ModelSpeed = 'fast' | 'medium' | 'slow';

interface ForecastingModel {
  id: string;
  name: string;
  description: string;
  type: ModelType;
  status: ModelStatus;
  speed: ModelSpeed;
  bestFor: string;
  supportsRegressors: boolean;
  features: string[];
  icon: React.ReactNode;
}

// ============================================================================
// Model Data
// ============================================================================

const MODELS: ForecastingModel[] = [
  {
    id: 'prophet',
    name: 'Prophet',
    description: 'Facebook/Meta\'s decomposable model with trend, seasonality, and holiday effects.',
    type: 'statistical',
    status: 'available',
    speed: 'medium',
    bestFor: 'Business forecasting with multiple seasonality',
    supportsRegressors: true,
    features: [
      'Automatic seasonality detection',
      'Handles missing data gracefully',
      'Configurable holidays and events',
      'Uncertainty intervals',
    ],
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'ets',
    name: 'ETS (Auto)',
    description: 'Exponential smoothing state-space model with automatic parameter selection.',
    type: 'statistical',
    status: 'available',
    speed: 'fast',
    bestFor: 'Short-term forecasts, univariate series',
    supportsRegressors: false,
    features: [
      'Automatic model selection (error, trend, seasonality)',
      'Fast computation',
      'Prediction intervals',
      'Well-suited for inventory planning',
    ],
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: 'arima',
    name: 'Auto-ARIMA',
    description: 'Classic autoregressive integrated moving average with automatic order selection.',
    type: 'statistical',
    status: 'available',
    speed: 'medium',
    bestFor: 'Stationary series, financial forecasting',
    supportsRegressors: true,
    features: [
      'Automatic (p,d,q) selection',
      'Handles non-stationarity via differencing',
      'Strong theoretical foundation',
      'Supports external regressors (ARIMAX)',
    ],
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: 'theta',
    name: 'Theta',
    description: 'Simple yet effective model that won the M3 competition. Decomposes series into two theta lines.',
    type: 'statistical',
    status: 'available',
    speed: 'fast',
    bestFor: 'Quick baseline forecasts, monthly data',
    supportsRegressors: false,
    features: [
      'Extremely fast',
      'Simple to understand',
      'Surprisingly accurate for many use cases',
      'No tuning required',
    ],
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: 'neuralprophet',
    name: 'NeuralProphet',
    description: 'Neural network-based successor to Prophet with PyTorch backend. 55-92% more accurate.',
    type: 'neural',
    status: 'available',
    speed: 'medium',
    bestFor: 'Complex patterns, high-frequency data',
    supportsRegressors: true,
    features: [
      'Auto-regression for short-term patterns',
      'Lagged regressors support',
      'Global models across multiple series',
      'GPU acceleration available',
    ],
    icon: <BrainCircuit className="h-4 w-4" />,
  },
  {
    id: 'nbeats',
    name: 'N-BEATS',
    description: 'Neural Basis Expansion Analysis. Pure deep learning architecture for time series.',
    type: 'neural',
    status: 'coming-soon',
    speed: 'slow',
    bestFor: 'Point forecasts, univariate series',
    supportsRegressors: false,
    features: [
      'Interpretable decomposition',
      'State-of-the-art accuracy on M4',
      'Stack-based architecture',
      'No feature engineering needed',
    ],
    icon: <BrainCircuit className="h-4 w-4" />,
  },
  {
    id: 'nhits',
    name: 'N-HiTS',
    description: 'Hierarchical interpolation for time series. More efficient than N-BEATS with multi-rate sampling.',
    type: 'neural',
    status: 'coming-soon',
    speed: 'medium',
    bestFor: 'Long-horizon forecasts, multi-scale patterns',
    supportsRegressors: false,
    features: [
      'Better long-horizon accuracy',
      '50x faster than N-BEATS',
      'Multi-scale temporal patterns',
      'Memory efficient',
    ],
    icon: <BrainCircuit className="h-4 w-4" />,
  },
  {
    id: 'chronos',
    name: 'Chronos',
    description: 'Amazon\'s foundation model for time series. Pre-trained on diverse datasets, zero-shot capable.',
    type: 'foundation',
    status: 'coming-soon',
    speed: 'slow',
    bestFor: 'Zero-shot forecasting, limited historical data',
    supportsRegressors: false,
    features: [
      'Pre-trained on 27B observations',
      'Zero-shot forecasting',
      'No training required',
      'Multiple model sizes (Mini to Large)',
    ],
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'timegpt',
    name: 'TimeGPT',
    description: 'Nixtla\'s foundation model. First generative pre-trained transformer for time series.',
    type: 'foundation',
    status: 'coming-soon',
    speed: 'medium',
    bestFor: 'Zero-shot forecasting, anomaly detection',
    supportsRegressors: true,
    features: [
      'Zero-shot forecasting',
      'Fine-tuning optional',
      'Supports exogenous variables',
      'API-based (no local compute)',
    ],
    icon: <Sparkles className="h-4 w-4" />,
  },
];

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ status }: { status: ModelStatus }) {
  switch (status) {
    case 'available':
      return <Badge variant="success">Available</Badge>;
    case 'beta':
      return <Badge className="bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">Beta</Badge>;
    case 'coming-soon':
      return <Badge variant="outline">Coming Soon</Badge>;
  }
}

function TypeBadge({ type }: { type: ModelType }) {
  switch (type) {
    case 'statistical':
      return (
        <Badge variant="secondary" className="text-[10px]">
          Statistical
        </Badge>
      );
    case 'neural':
      return (
        <Badge className="bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 text-[10px]">
          Neural
        </Badge>
      );
    case 'foundation':
      return (
        <Badge className="bg-gradient-to-r from-brand-teal-500/15 to-brand-cyan/15 text-brand-teal-600 dark:from-brand-teal-500/20 dark:to-brand-cyan/20 dark:text-brand-cyan text-[10px]">
          Foundation
        </Badge>
      );
  }
}

function SpeedIndicator({ speed }: { speed: ModelSpeed }) {
  const colors = {
    fast: 'text-emerald-500',
    medium: 'text-amber-500',
    slow: 'text-orange-500',
  };
  const labels = {
    fast: 'Fast',
    medium: 'Medium',
    slow: 'Slow',
  };
  return (
    <div className="flex items-center gap-1.5">
      <Clock className={`h-3.5 w-3.5 ${colors[speed]}`} />
      <span className="text-xs text-muted-foreground">{labels[speed]}</span>
    </div>
  );
}

function FeatureTooltip({ features }: { features: string[] }) {
  const content = (
    <ul className="space-y-1 text-xs">
      {features.map((feature, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span className="text-brand-cyan">•</span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <TooltipProvider>
      <Tooltip content={content} position="left" delay={0}>
        <button className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-white">
          <Info className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ModelsPage() {
  const availableModels = MODELS.filter((m) => m.status === 'available');
  const comingSoonModels = MODELS.filter((m) => m.status !== 'available');

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-h1">Models</h1>
        <p className="text-body-muted">
          Forecasting models available in Kairos — from classical statistics to foundation models
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {MODELS.filter((m) => m.type === 'statistical').length}
              </div>
              <div className="text-xs text-muted-foreground">Statistical Models</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-slate-900">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 dark:bg-purple-500/20">
              <BrainCircuit className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
                {MODELS.filter((m) => m.type === 'neural').length}
              </div>
              <div className="text-xs text-muted-foreground">Neural Networks</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-slate-900">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-cyan/10 dark:bg-brand-cyan/20">
              <Sparkles className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-brand-teal-600 dark:text-brand-cyan">
                {MODELS.filter((m) => m.type === 'foundation').length}
              </div>
              <div className="text-xs text-muted-foreground">Foundation Models</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Models Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            Available Models
          </CardTitle>
          <CardDescription>
            Ready to use for forecasting — select when creating a new forecast
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Model</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead className="min-w-[180px]">Best For</TableHead>
                  <TableHead className="text-center">Regressors</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal-500/10 dark:bg-brand-cyan/10">
                          <span className="text-brand-teal-600 dark:text-brand-cyan">{model.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {model.name}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {model.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={model.type} />
                    </TableCell>
                    <TableCell>
                      <SpeedIndicator speed={model.speed} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{model.bestFor}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {model.supportsRegressors ? (
                        <Badge variant="secondary" className="text-[10px]">Yes</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <FeatureTooltip features={model.features} />
                        <Button asChild size="sm" className="gap-1.5">
                          <Link href="/forecasts">
                            Use
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Models Table */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-slate-400" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            Advanced models in development — neural networks and foundation models for enhanced accuracy
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Model</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead className="min-w-[180px]">Best For</TableHead>
                  <TableHead className="text-center">Regressors</TableHead>
                  <TableHead className="text-right">Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comingSoonModels.map((model) => (
                  <TableRow key={model.id} className="opacity-60">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5">
                          <span className="text-slate-400 dark:text-slate-500">{model.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-500 dark:text-slate-400">
                            {model.name}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {model.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={model.type} />
                    </TableCell>
                    <TableCell>
                      <SpeedIndicator speed={model.speed} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{model.bestFor}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {model.supportsRegressors ? (
                        <Badge variant="secondary" className="text-[10px]">Yes</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <FeatureTooltip features={model.features} />
                        <StatusBadge status={model.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legend / Guide */}
      <Card className="bg-slate-50/50 dark:bg-white/[0.02]">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-600 dark:text-slate-300">Types:</span>
              <div className="flex items-center gap-1">
                <TypeBadge type="statistical" />
                <span>Classical methods</span>
              </div>
              <div className="flex items-center gap-1">
                <TypeBadge type="neural" />
                <span>Deep learning</span>
              </div>
              <div className="flex items-center gap-1">
                <TypeBadge type="foundation" />
                <span>Pre-trained LLMs</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-600 dark:text-slate-300">Regressors:</span>
              <span>External features (e.g., Google Trends) that can improve forecast accuracy</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
