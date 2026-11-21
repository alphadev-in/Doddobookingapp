import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { json, readJson, withErrors } from '../../../lib/http';
import { removeSubscription, saveSubscription } from '../../../lib/push';
import { getBusinessByOwner, getUser } from '../../../lib/repo';
import { sessionUser } from '../../../lib/session';

export const prerender = false;

/** Save this device's push subscription for the signed-in business owner or customer. */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const u = await sessionUser(request);
  if (!u) throw new BookingError('FORBIDDEN', 'Please sign in', 401);
  const body = await readJson<any>(request);
  const endpoint = String(body.endpoint ?? '');
  const p256dh = String(body.keys?.p256dh ?? '');
  const auth = String(body.keys?.auth ?? '');
  if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) throw new BookingError('VALIDATION', 'Invalid push subscription');
  const user = await getUser(u.uid);
  const business = user?.role === 'customer' ? null : await getBusinessByOwner(u.uid);
  if (business) await saveSubscription({ businessId: business.id, endpoint, keys: { p256dh, auth } });
  else await saveSubscription({ customerEmail: u.email, endpoint, keys: { p256dh, auth } });
  return json({ ok: true, role: business ? 'business' : 'customer' }, 201);
});

export const DELETE: APIRoute = withErrors(async ({ request }) => {
  const u = await sessionUser(request);
  if (!u) throw new BookingError('FORBIDDEN', 'Please sign in', 401);
  const body = await readJson<any>(request);
  await removeSubscription(String(body.endpoint ?? ''));
  return json({ ok: true });
});
