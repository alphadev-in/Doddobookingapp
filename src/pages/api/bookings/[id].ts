import type { APIRoute } from 'astro';
import { BookingError, cancellationPolicy, createBooking, reschedule, setStatus } from '../../../lib/booking';
import { getAppointment, getBusinessById, getServices, listStaff } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';

export const prerender = false;

/** Load an appointment, requiring the per-booking manage token. Client-facing data only. */
async function authorised(id: string, token: string | null) {
  const appt = await getAppointment(id);
  if (!appt || appt.kind !== 'booking' || !token || token !== appt.manageToken) {
    throw new BookingError('NOT_FOUND', 'Booking not found', 404);
  }
  const business = await getBusinessById(appt.businessId);
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  return { appt, business };
}

function publicView(appt: any, business: any, services: any[], staffName: string) {
  return {
    id: appt.id, status: appt.status, startAt: appt.startAt, endAt: appt.endAt, paymentStatus: appt.paymentStatus,
    depositCents: appt.depositCents, priceCents: appt.priceCents, currency: business.currency,
    business: { name: business.name, slug: business.slug, timezone: business.timezone, email: business.email, phone: business.phone },
    services: services.map((s) => s.name), staffName, clientName: appt.clientName,
    policy: { ...cancellationPolicy(business, appt), text: business.depositPolicy },
  };
}

export const GET: APIRoute = withErrors(async ({ params, url }) => {
  const { appt, business } = await authorised(params.id!, url.searchParams.get('token'));
  const services = await getServices(appt.serviceIds);
  const staff = (await listStaff(business.id)).find((s) => s.id === appt.staffId);
  return json(publicView(appt, business, services, staff?.name ?? 'Any available'));
});

/** PATCH { token, action: 'cancel' | 'reschedule', startAt? } */
export const PATCH: APIRoute = withErrors(async ({ params, request }) => {
  const body = await readJson<any>(request);
  const { appt, business } = await authorised(params.id!, String(body.token ?? ''));
  if (Date.parse(appt.startAt) < Date.now()) throw new BookingError('VALIDATION', 'Past bookings cannot be changed');
  if (body.action === 'cancel') {
    if (appt.status !== 'confirmed') throw new BookingError('VALIDATION', 'This booking cannot be cancelled');
    const updated = await setStatus(appt, 'cancelled', 'client');
    return json({ ok: true, status: updated.status, paymentStatus: updated.paymentStatus });
  }
  if (body.action === 'reschedule') {
    if (appt.status !== 'confirmed') throw new BookingError('VALIDATION', 'This booking cannot be rescheduled');
    const updated = await reschedule(appt, String(body.startAt ?? ''), true);
    return json({ ok: true, startAt: updated.startAt, endAt: updated.endAt, business: business.slug });
  }
  throw new BookingError('VALIDATION', 'Unknown action');
});
