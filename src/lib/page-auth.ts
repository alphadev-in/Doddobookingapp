// Page-level owner resolution for .astro dashboard pages (server-only).
import type { AstroGlobal } from 'astro';
import { getBusinessByOwner } from './repo';
import { SESSION_COOKIE, verifySessionCookie } from './session';
import type { Business } from './types';

export async function loadOwnerBusiness(Astro: AstroGlobal): Promise<{ business: Business } | { redirect: string }> {
  const uid = await verifySessionCookie(Astro.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!uid) return { redirect: '/login' };
  const business = await getBusinessByOwner(uid);
  if (!business) return { redirect: '/onboarding' };
  return { business };
}
