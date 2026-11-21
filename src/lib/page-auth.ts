// Page-level owner resolution for .astro dashboard pages (server-only).
import type { AstroGlobal } from 'astro';
import { countUnread, getBusinessByOwner, getUser } from './repo';
import { SESSION_COOKIE, isAdminEmail, verifySessionCookie } from './session';
import { adminAuth } from './firebase-admin';
import { isSubscribed, type Business } from './types';

type Loaded = { business: Business; unread: number; isAdmin: boolean; email: string };

export async function loadOwnerBusiness(Astro: AstroGlobal, opts: { allowUnpaid?: boolean } = {}): Promise<Loaded | { redirect: string }> {
  const uid = await verifySessionCookie(Astro.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!uid) return { redirect: '/login' };
  const user = await getUser(uid);
  if (user?.role === 'customer') return { redirect: '/account' };
  const business = await getBusinessByOwner(uid);
  if (!business) return { redirect: '/onboarding' };
  if (!opts.allowUnpaid && !isSubscribed(business)) return { redirect: '/dashboard/billing?subscribe=1' };
  const email = (user?.email || (await adminAuth().getUser(uid)).email || '').toLowerCase();
  const unread = await countUnread({ businessId: business.id });
  return { business, unread, isAdmin: isAdminEmail(email), email };
}
