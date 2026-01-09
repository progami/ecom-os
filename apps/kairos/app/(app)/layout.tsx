import { redirect } from 'next/navigation';

import { KairosShell } from '@/components/kairos-shell';
import { auth } from '@/lib/auth';
import { getAppEntitlement } from '@ecom-os/auth';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const roles = (session as any)?.roles;
  const entitlement = session ? (getAppEntitlement(roles, 'kairos') ?? getAppEntitlement(roles, 'chronos')) : null;
  if (!session || !entitlement) {
    redirect('/no-access');
  }

  return <KairosShell>{children}</KairosShell>;
}
