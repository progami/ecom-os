'use client';

import { ProductSetupGrid } from '@/components/sheets/product-setup-grid';
import {
  ProductSetupParametersPanel,
  type ProductSetupParametersPanelProps,
} from '@/components/sheets/product-setup-panels';

type ParameterList = ProductSetupParametersPanelProps['parameters'];

type ProductSetupWorkspaceProps = {
  strategyId: string;
  products: Array<{ id: string; sku: string; name: string }>;
  operationsParameters: ParameterList;
  salesParameters: ParameterList;
  financeParameters: ParameterList;
};

export function ProductSetupWorkspace({
  strategyId,
  products,
  operationsParameters,
  salesParameters,
  financeParameters,
}: ProductSetupWorkspaceProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* Left column - Products catalog */}
      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
            Products
          </h2>
          <p className="text-sm text-muted-foreground">Manage your product catalog</p>
        </header>
        <ProductSetupGrid strategyId={strategyId} products={products} />
      </section>

      {/* Right column - Configuration panels */}
      <div className="flex flex-col gap-6">
        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
              Operations
            </h2>
            <p className="text-sm text-muted-foreground">Lead times & logistics</p>
          </header>
          <ProductSetupParametersPanel
            strategyId={strategyId}
            parameterType="ops"
            parameters={operationsParameters}
          />
        </section>

        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
              Sales
            </h2>
            <p className="text-sm text-muted-foreground">Inventory thresholds</p>
          </header>
          <ProductSetupParametersPanel
            strategyId={strategyId}
            parameterType="sales"
            parameters={salesParameters}
          />
        </section>

        <section className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300/80">
              Finance
            </h2>
            <p className="text-sm text-muted-foreground">Cash flow settings</p>
          </header>
          <ProductSetupParametersPanel
            strategyId={strategyId}
            parameterType="finance"
            parameters={financeParameters}
          />
        </section>
      </div>
    </div>
  );
}
