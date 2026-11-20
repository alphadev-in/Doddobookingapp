// Auth helpers (server-only). The browser signs in with Firebase Auth (email/password), exchanges the
// ID token for an httpOnly session cookie, and every dashboard API verifies that cookie.
import { adminAuth } from './firebase-admin';
import { getBusinessByOwner } from './repo';
import { getCookie } from './http';
import { BookingError } from './booking';
import type { Business } from './types';

export const SESSION_COOKIE = '__session';
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export async function verifySessionCookie(cookie: string | null): Promise<string | null> {
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** Resolve the signed-in owner and their business. `business` is null until onboarding is done. */
export async function ownerContext(request: Request): Promise<{ uid: string; business: Business | null }> {
  const uid = await verifySessionCookie(getCookie(request, SESSION_COOKIE));
  if (!uid) throw new BookingError('FORBIDDEN', 'Please sign in', 401);
  return { uid, business: await getBusinessByOwner(uid) };
}

/** Like ownerContext but requires a finished onboarding (a business). */
export async function requireBusiness(request: Request): Promise<Business> {
  const { business } = await ownerContext(request);
  if (!business) throw new BookingError('NOT_FOUND', 'Finish onboarding first', 404);
  return business;
}

/** Admin is identified by email. Override with ADMIN_EMAIL in the environment if needed. */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'prajapatikaranc@gmail.com').toLowerCase();

export async function sessionUser(request: Request): Promise<{ uid: string; email: string } | null> {
  const cookie = getCookie(request, SESSION_COOKIE);
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: (decoded.email ?? '').toLowerCase() };
  } catch {
    return null;
  }
}

export const isAdminEmail = (email: string) => email.toLowerCase() === ADMIN_EMAIL;

/** Throws 403 unless the signed-in user is the admin. */
export async function requireAdmin(request: Request) {
  const u = await sessionUser(request);
  if (!u) throw new BookingError('FORBIDDEN', 'Please sign in', 401);
  if (!isAdminEmail(u.email)) throw new BookingError('FORBIDDEN', 'Admins only', 403);
  return u;
}
