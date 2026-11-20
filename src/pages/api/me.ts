import type { APIRoute } from 'astro';
import { getBusinessByOwner, getUser, saveUser } from '../../lib/repo';
import { json, readJson, withErrors } from '../../lib/http';
import { BookingError } from '../../lib/booking';
import { isAdminEmail, sessionUser } from '../../lib/session';

export const prerender = false;

/** Who am I? Role decides where the user lands after sign-in. */
export const GET: APIRoute = withErrors(async ({ request }) => {
  const u = await sessionUser(request);
  if (!u) throw new BookingError('FORBIDDEN', 'Please sign in', 401);
  const user = await getUser(u.uid);
  const business = user?.role === 'customer' ? null : await getBusinessByOwner(u.uid);
  const role = user?.role ?? (business ? 'business' : null);
  return json({ uid: u.uid, email: u.email, role, isAdmin: isAdminEmail(u.email), hasBusiness: !!business });
});

/** Choose a role once (at sign-up). Existing business owners keep their role. */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const u = await sessionUser(request);
  if (!u) throw new BookingError('FORBIDDEN', 'Please sign in', 401);
  const existing = await getUser(u.uid);
  if (existing) return json(existing);
  const body = await readJson<any>(request);
  const role = body.role === 'customer' ? 'customer' : 'business';
  const row = await saveUser({ uid: u.uid, email: u.email, name: String(body.name ?? '').trim().slice(0, 120), role, createdAt: new Date().toISOString() });
  return json(row, 201);
});
