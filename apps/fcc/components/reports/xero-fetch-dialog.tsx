'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Cloud, Calendar, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';

interface XeroFetchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: FetchParams) => Promise<void>;
  reportType: string;
  reportTitle: string;
  existingDataCheck?: (date: string) => Promise<boolean>;
}

interface FetchParams {
  date?: string;
  periods?: number;
  timeframe?: 'MONTH' | 'QUARTER' | 'YEAR';
}

export function XeroFetchDialog({
  isOpen,
  onClose,
  onConfirm,
  reportType,
  reportTitle,
  existingDataCheck
}: XeroFetchDialogProps) {
  const [loading, setLoading] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to end of last month
    const lastMonth = endOfMonth(subMonths(new Date(), 1));
    return format(lastMonth, 'yyyy-MM-dd');
  });

  // For P&L and Cash Flow, additional options
  const [periods, setPeriods] = useState(1);
  const [timeframe, setTimeframe] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');

  const isBalanceSheet = reportType === 'BALANCE_SHEET';
  const showPeriodOptions = ['PROFIT_LOSS', 'CASH_FLOW'].includes(reportType);

  // Check for existing data when date changes
  React.useEffect(() => {
    if (!existingDataCheck || !selectedDate) return;

    const checkData = async () => {
      setCheckingExisting(true);
      try {
        const exists = await existingDataCheck(selectedDate);
        setHasExistingData(exists);
      } catch (error) {
        console.error('Failed to check existing data:', error);
      } finally {
        setCheckingExisting(false);
      }
    };

    checkData();
  }, [selectedDate, existingDataCheck]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const params: FetchParams = {
        date: selectedDate
      };

      if (showPeriodOptions) {
        params.periods = periods;
        params.timeframe = timeframe;
      }

      await onConfirm(params);
      onClose();
    } catch (error) {
      console.error('Failed to fetch from Xero:', error);
      toast.error('Failed to fetch data from Xero');
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = () => {
    if (isBalanceSheet) {
      return 'Balance Sheet Date';
    }
    return 'Period End Date';
  };

  const getDateHelp = () => {
    if (isBalanceSheet) {
      return 'Balance sheet will show financial position as of this date';
    }
    return 'The last date of the period to fetch data for';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-secondary border-default">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            <Cloud className="h-5 w-5 text-emerald-400" />
            Fetch {reportTitle} from Xero
          </DialogTitle>
          <DialogDescription className="text-gray-400 mt-2">
            Configure the parameters for fetching data from your Xero account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium text-gray-300">
              {getDateLabel()}
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{getDateHelp()}</p>
          </div>

          {/* Period Options for P&L and Cash Flow */}
          {showPeriodOptions && (
            <>
              <div className="space-y-2">
                <Label htmlFor="periods" className="text-sm font-medium text-gray-300">
                  Number of Periods
                </Label>
                <input
                  id="periods"
                  type="number"
                  min="1"
                  max="12"
                  value={periods}
                  onChange={(e) => setPeriods(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500">Number of periods to include in the report</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeframe" className="text-sm font-medium text-gray-300">
                  Period Type
                </Label>
                <select
                  id="timeframe"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as 'MONTH' | 'QUARTER' | 'YEAR')}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent appearance-none"
                  style={{ 
                    backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', 
                    backgroundPosition: 'right 0.5rem center', 
                    backgroundRepeat: 'no-repeat', 
                    backgroundSize: '1.5em 1.5em' 
                  }}
                >
                  <option value="MONTH">Monthly</option>
                  <option value="QUARTER">Quarterly</option>
                  <option value="YEAR">Yearly</option>
                </select>
              </div>
            </>
          )}

          {/* Warning about overwriting */}
          <div className={cn(
            "border rounded-lg p-4",
            hasExistingData ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"
          )}>
            <div className="flex gap-3">
              <AlertCircle className={cn(
                "h-5 w-5 flex-shrink-0 mt-0.5",
                hasExistingData ? "text-red-400" : "text-amber-400"
              )} />
              <div className="space-y-1">
                <p className={cn(
                  "text-sm font-medium",
                  hasExistingData ? "text-red-400" : "text-amber-400"
                )}>
                  {hasExistingData ? "Warning: Existing Data Will Be Overwritten" : "Important"}
                </p>
                <p className="text-xs text-gray-400">
                  {hasExistingData ? (
                    <>
                      Data already exists for this period. Fetching new data will <strong className="text-red-400">replace the existing data</strong>.
                      The previous version will be archived for audit purposes.
                    </>
                  ) : (
                    <>
                      Fetching data will replace any existing data for the same period. 
                      Previous versions will be archived for audit purposes.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Info about what will be fetched */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">What will be fetched:</p>
                <p className="text-xs text-gray-400">
                  {isBalanceSheet ? (
                    <>Balance Sheet as of {format(new Date(selectedDate), 'MMMM d, yyyy')}</>
                  ) : (
                    <>
                      {reportTitle} for {periods} {timeframe.toLowerCase()}{periods > 1 ? 's' : ''} 
                      ending {format(new Date(selectedDate), 'MMMM d, yyyy')}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "bg-emerald-600 hover:bg-emerald-700 text-white",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? (
              <>
                <Cloud className="h-4 w-4 mr-2 animate-pulse" />
                Fetching...
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4 mr-2" />
                Fetch from Xero
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}