'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

function QboIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
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
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={status?.connected ? 'border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            status?.connected
              ? 'bg-green-100 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-800'
              : 'bg-slate-100 dark:bg-white/10 ring-1 ring-slate-200 dark:ring-white/10'
          }`}>
            {status?.connected ? (
              <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <QboIcon className="h-6 w-6 text-slate-500 dark:text-slate-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                QuickBooks Online
              </h3>
              {status?.connected && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-0">
                  Connected
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {status?.connected && status.companyName
                ? status.companyName
                : 'Connect to sync your financial data'}
            </p>
          </div>

          {status?.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
              className="shrink-0"
            >
              {disconnectMutation.isPending ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              size="sm"
              className="shrink-0 bg-brand-teal-600 hover:bg-brand-teal-700 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90"
            >
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
