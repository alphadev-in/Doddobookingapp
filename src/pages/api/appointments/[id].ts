import type { APIRoute } from 'astro';
import { BookingError, reschedule, setStatus } from '../../../lib/booking';
import { deleteAppointment, getAppointment, recomputeClientStats, updateAppointment } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';

export const prerender = false;

async function ownedAppointment(request: Request, id: string) {
  const business = await requireBusiness(request);
  const appt = await getAppointment(id);
  if (!appt || appt.businessId !== business.id) throw new BookingError('NOT_FOUND', 'Appointment not found', 404);
  return appt;
}

export const GET: APIRoute = withErrors(async ({ request, params }) => json(await ownedAppointment(request, params.id!)));

/** Owner PATCH: status | startAt (reschedule) | notes | title (blocks). */
export const PATCH: APIRoute = withErrors(async ({ request, params }) => {
  let appt = await ownedAppointment(request, params.id!);
  const body = await readJson<any>(request);
  if (body.startAt && body.startAt !== appt.startAt) appt = await reschedule(appt, String(body.startAt), false);
  if (body.status && body.status !== appt.status) {
    const status = String(body.status);
    if (!['confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) throw new BookingError('VALIDATION', 'Invalid status');
    appt = await setStatus(appt, status as any, 'dashboard');
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.notes === 'string') patch.notes = body.notes.slice(0, 1000);
  if (appt.kind === 'block' && typeof body.title === 'string') patch.title = body.title.trim() || 'Blocked';
  if (Object.keys(patch).length) appt = (await updateAppointment(appt.id, patch))!;
  return json(appt);
});

export const DELETE: APIRoute = withErrors(async ({ request, params }) => {
  const appt = await ownedAppointment(request, params.id!);
  await deleteAppointment(appt.id);
  if (appt.clientId) await recomputeClientStats(appt.clientId);
  return json({ ok: true });
});
