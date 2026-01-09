import 'server-only';

import type { Session } from 'next-auth';

type KairosActor = {
  id: string | null;
  email: string | null;
  isSuperAdmin: boolean;
};

function parseEmailSet(raw: string | undefined) {
  return new Set(
    (raw ?? '')
      .split(/[,\s]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

const DEFAULT_SUPER_ADMINS = new Set(['jarrar@targonglobal.com']);

function superAdminEmailSet() {
  const configured = parseEmailSet(process.env.KAIROS_SUPER_ADMIN_EMAILS);
  return configured.size > 0 ? configured : DEFAULT_SUPER_ADMINS;
}

export function isKairosSuperAdmin(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return superAdminEmailSet().has(normalized);
}

export function getKairosActor(session: Session | null): KairosActor {
  const user = session?.user as (Session['user'] & { id?: unknown }) | undefined;
  const id = typeof user?.id === 'string' ? user.id : null;
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : null;

  return {
    id,
    email,
    isSuperAdmin: isKairosSuperAdmin(email),
  };
}

export function buildKairosOwnershipWhere(actor: KairosActor) {
  if (actor.isSuperAdmin) return {};

  const or: Array<Record<string, unknown>> = [];
  if (actor.id) {
    or.push({ createdById: actor.id });
  }
  if (actor.email) {
    or.push({ createdByEmail: actor.email });
  }

  if (or.length === 0) {
    return { id: '__forbidden__' };
  }

  return { OR: or };
}
