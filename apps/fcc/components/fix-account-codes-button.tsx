'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export function FixAccountCodesButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);

  const checkStatus = async () => {
    try {
      const response = await fetch('/api/fix-account-codes');
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  };

  const fixAccountCodes = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/fix-account-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 50 })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix account codes');
      }

      setResults(data);
      await checkStatus(); // Refresh status
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Check status on mount
  useState(() => {
    checkStatus();
  });

  return (
    <div className="space-y-4">
      {status && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p>Total transactions: {status.totalTransactions}</p>
              <p>With account codes: {status.transactionsWithAccountCode} ({status.percentageFixed})</p>
              <p>Missing account codes: {status.totalTransactions - status.transactionsWithAccountCode}</p>
              <p>LineItem records: {status.lineItemRecords}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p>Processed: {results.processed} transactions</p>
              <p>Fixed: {results.fixed}</p>
              <p>Failed: {results.failed}</p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Button
        onClick={fixAccountCodes}
        disabled={isLoading || (status && status.totalTransactions === status.transactionsWithAccountCode)}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Fixing Account Codes...
          </>
        ) : (
          'Fix Missing Account Codes'
        )}
      </Button>

      {status && status.totalTransactions === status.transactionsWithAccountCode && (
        <p className="text-sm text-muted-foreground">
          All transactions have account codes!
        </p>
      )}
    </div>
  );
}