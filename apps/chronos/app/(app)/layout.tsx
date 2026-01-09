import { redirect } from 'next/navigation';

import { ChronosShell } from '@/components/chronos-shell';
import { auth } from '@/lib/auth';
import { getAppEntitlement } from '@ecom-os/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const entitlement = session ? getAppEntitlement((session as any).roles, 'chronos') : null;
  if (!session || !entitlement) {
    redirect('/no-access');
  }

  return <ChronosShell>{children}</ChronosShell>;
}
