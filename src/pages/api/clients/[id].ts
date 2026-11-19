import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { getClient, listAppointments, saveClient } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';

export const prerender = false;

async function owned(request: Request, id: string) {
  const business = await requireBusiness(request);
  const client = await getClient(id);
  if (!client || client.businessId !== business.id) throw new BookingError('NOT_FOUND', 'Client not found', 404);
  return { business, client };
}

/** Client detail with full appointment history. */
export const GET: APIRoute = withErrors(async ({ request, params }) => {
  const { business, client } = await owned(request, params.id!);
  const history = (await listAppointments(business.id)).filter((a) => a.clientId === client.id).sort((a, b) => b.startAt.localeCompare(a.startAt));
  return json({ client, history });
});

/** Only private notes and contact details are editable; stats are derived. */
export const PATCH: APIRoute = withErrors(async ({ request, params }) => {
  const { client } = await owned(request, params.id!);
  const body = await readJson<any>(request);
  const next = {
    ...client,
    notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : client.notes,
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : client.name,
    email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : client.email,
    phone: typeof body.phone === 'string' ? body.phone.trim() : client.phone,
  };
  return json(await saveClient(next));
});
