import { redirect } from 'next/navigation';

import { ChronosShell } from '@/components/chronos-shell';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/no-access');
  }

  return <ChronosShell>{children}</ChronosShell>;
}
