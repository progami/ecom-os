import { redirect } from 'next/navigation';

import { KairosShell } from '@/components/kairos-shell';
import { auth } from '@/lib/auth';
import { getAppEntitlement } from '@ecom-os/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const entitlement = session ? getAppEntitlement((session as any).roles, 'kairos') : null;
  if (!session || !entitlement) {
    redirect('/no-access');
  }

  return <KairosShell>{children}</KairosShell>;
}
