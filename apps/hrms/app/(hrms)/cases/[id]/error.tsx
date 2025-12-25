'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function CaseDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[cases/[id]] render error', error);
  }, [error]);

  return (
    <Card padding="lg">
      <h1 className="text-lg font-semibold text-gray-900">Unable to load case</h1>
      <p className="text-sm text-gray-600 mt-2">
        Something went wrong while rendering this case. Try again, or go back to the cases list.
      </p>
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
