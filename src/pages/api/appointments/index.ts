import type { APIRoute } from 'astro';
import { createBlock, createBooking } from '../../../lib/booking';
import { listAppointments } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';

export const prerender = false;

/** Owner: list appointments/blocks. Optional ?from=ISO&to=ISO window. */
export const GET: APIRoute = withErrors(async ({ request, url }) => {
  const business = await requireBusiness(request);
  const from = Date.parse(url.searchParams.get('from') ?? '') || -Infinity;
  const to = Date.parse(url.searchParams.get('to') ?? '') || Infinity;
  const rows = (await listAppointments(business.id)).filter((a) => Date.parse(a.endAt) > from && Date.parse(a.startAt) < to);
  return json({ appointments: rows.sort((a, b) => a.startAt.localeCompare(b.startAt)) });
});

/** Owner: create a walk-in/phone booking (kind 'walkin'|'booking') or a time block (kind 'block'). */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  const body = await readJson<any>(request);
  if (body.kind === 'block') {
    const appt = await createBlock({
      businessId: business.id, staffId: body.staffId ? String(body.staffId) : null,
      startAt: String(body.startAt ?? ''), endAt: String(body.endAt ?? ''), title: String(body.title ?? ''),
    });
    return json(appt, 201);
  }
  const appt = await createBooking({
    businessId: business.id,
    serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [],
    staffId: String(body.staffId ?? 'any'),
    startAt: String(body.startAt ?? ''),
    client: { name: String(body.client?.name ?? ''), email: String(body.client?.email ?? ''), phone: String(body.client?.phone ?? '') },
    notes: String(body.notes ?? ''),
    source: 'dashboard',
    kind: body.kind === 'walkin' ? 'walkin' : 'booking',
  });
  return json(appt, 201);
});
