'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function CaseDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[cases/[id]] render error', error);
  }, [error]);

  const errorDetails = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Message: ${error.message || 'Unknown error'}`);
    if (error.digest) parts.push(`Digest: ${error.digest}`);
    if (error.stack) {
      parts.push('');
      parts.push(error.stack);
    }
    return parts.join('\n');
  }, [error]);

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card padding="lg">
      <h1 className="text-lg font-semibold text-gray-900">Unable to load case</h1>
      <p className="text-sm text-gray-600 mt-2">
        Something went wrong while rendering this case. Try again, or go back to the cases list.
      </p>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-700">Technical details</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 whitespace-pre-wrap">
          {errorDetails}
        </pre>
        <div className="mt-2 flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copyDetails()}
            disabled={copied}
          >
            {copied ? 'Copied' : 'Copy details'}
          </Button>
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/cases"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          Back to cases
        </Link>
      </div>
    </Card>
  );
}
