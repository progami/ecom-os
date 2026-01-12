'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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

function QboLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12h8M12 8v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12l2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-white/10 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-slate-100 dark:bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-32 bg-slate-100 dark:bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-10 w-28 bg-slate-100 dark:bg-white/10 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50/80 to-green-50/80 backdrop-blur-sm p-6 dark:border-emerald-500/20 dark:from-emerald-950/30 dark:to-green-950/30">
        {/* Success glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
            <CheckCircleIcon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                QuickBooks Online
              </h3>
              <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20">
                Connected
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {status.companyName}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
            className="shrink-0 rounded-xl border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            {disconnectMutation.isPending ? (
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                <span>Disconnecting</span>
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur-sm p-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200/50 dark:bg-white/5 dark:ring-white/10">
          <QboLogo className="h-7 w-7 text-slate-400 dark:text-slate-500" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-0.5">
            QuickBooks Online
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Connect to sync your financial data
          </p>
        </div>

        <Button
          onClick={handleConnect}
          size="sm"
          className="shrink-0 rounded-xl bg-brand-teal-600 hover:bg-brand-teal-700 dark:bg-brand-cyan dark:hover:bg-brand-cyan/90 text-white shadow-lg shadow-brand-teal-500/25 dark:shadow-brand-cyan/20"
        >
          Connect
        </Button>
      </div>
    </div>
  );
}
