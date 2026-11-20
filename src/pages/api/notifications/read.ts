import type { APIRoute } from 'astro';
import { markNotificationRead, getBusinessByOwner, getUser } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { BookingError } from '../../../lib/booking';
import { sessionUser } from '../../../lib/session';
import { col } from '../../../lib/repo';
import type { Notification } from '../../../lib/types';

export const prerender = false;

/** Mark one notification read, only if it belongs to the signed-in user. */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const u = await sessionUser(request);
  if (!u) throw new BookingError('FORBIDDEN', 'Please sign in', 401);
  const { id } = await readJson<{ id: string }>(request);
  const doc = await col<Notification>('notifications').doc(String(id)).get();
  if (!doc.exists) throw new BookingError('NOT_FOUND', 'Notification not found', 404);
  const n = doc.data()!;
  const user = await getUser(u.uid);
  const business = await getBusinessByOwner(u.uid);
  const mine = (n.customerEmail && n.customerEmail === u.email) || (n.businessId && business?.id === n.businessId && user?.role !== 'customer');
  if (!mine) throw new BookingError('NOT_FOUND', 'Notification not found', 404);
  await markNotificationRead(n.id);
  return json({ ok: true });
});
