'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { QboConnectionStatus } from '@/lib/qbo/types';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/plutus';

async function fetchQboStatus(): Promise<QboConnectionStatus> {
  const res = await fetch(`${basePath}/api/qbo/status`);
  return res.json();
}

async function disconnectQbo(): Promise<{ success: boolean }> {
  const res = await fetch(`${basePath}/api/qbo/disconnect`, { method: 'POST' });
  return res.json();
}

export function QboConnectionCard() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const { data: status, isLoading } = useQuery({
    queryKey: ['qbo-status'],
    queryFn: fetchQboStatus,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectQbo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qbo-status'] });
      toast.success('Disconnected from QuickBooks');
    },
    onError: () => {
      toast.error('Failed to disconnect');
    },
  });

  // Handle URL params from OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected === 'true') {
      queryClient.invalidateQueries({ queryKey: ['qbo-status'] });
      toast.success('Successfully connected to QuickBooks!');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      const errorMessages: Record<string, string> = {
        invalid_params: 'Invalid OAuth parameters',
        invalid_state: 'Security check failed. Please try again.',
        token_exchange_failed: 'Failed to connect. Please try again.',
        connect_failed: 'Failed to initiate connection.',
      };
      toast.error(errorMessages[error] ?? 'Connection failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, queryClient]);

  const handleConnect = () => {
    window.location.href = `${basePath}/api/qbo/connect`;
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card className="card-hover">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-500/10 dark:bg-brand-cyan/15">
              <Link className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" />
            </div>
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-4 h-10 w-full" />
          <Skeleton className="h-9 w-28" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal-500/10 dark:bg-brand-cyan/15">
            <Link className="h-5 w-5 text-brand-teal-600 dark:text-brand-cyan" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">QuickBooks Online</CardTitle>
              {status?.connected ? (
                <Badge variant="default" className="bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 h-3 w-3" />
                  Not Connected
                </Badge>
              )}
            </div>
            <CardDescription>
              {status?.connected && status.companyName
                ? status.companyName
                : 'Link your QBO account'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {status?.connected ? (
          <>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Your QuickBooks account is connected. You can now sync your financial data.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnectMutation.isPending}>
                {disconnectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Securely connect to QuickBooks Online to sync your financial data automatically.
            </p>
            <Button onClick={handleConnect}>Connect QBO</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
