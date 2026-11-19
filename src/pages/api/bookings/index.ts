import type { APIRoute } from 'astro';
import { createBooking, cancellationPolicy } from '../../../lib/booking';
import { getBusinessBySlug } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { BookingError } from '../../../lib/booking';

export const prerender = false;

/** Public: create a booking for a business slug. Deposit (if any) must be verified via paymentIntentId. */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const body = await readJson<any>(request);
  const business = await getBusinessBySlug(String(body.businessSlug ?? ''));
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  const appt = await createBooking({
    businessId: business.id,
    serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [],
    staffId: String(body.staffId ?? 'any'),
    startAt: String(body.startAt ?? ''),
    client: { name: String(body.client?.name ?? ''), email: String(body.client?.email ?? ''), phone: String(body.client?.phone ?? '') },
    notes: String(body.notes ?? '').slice(0, 1000),
    source: 'online',
    paymentIntentId: body.paymentIntentId ? String(body.paymentIntentId) : null,
  });
  return json({ id: appt.id, manageToken: appt.manageToken, startAt: appt.startAt, endAt: appt.endAt, paymentStatus: appt.paymentStatus }, 201);
});
