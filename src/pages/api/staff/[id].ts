import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { deleteStaff, listStaff, saveStaff } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';
import { validateStaff } from '../../../lib/validate';

export const prerender = false;

async function owned(request: Request, id: string) {
  const business = await requireBusiness(request);
  const member = (await listStaff(business.id)).find((s) => s.id === id);
  if (!member) throw new BookingError('NOT_FOUND', 'Team member not found', 404);
  return { business, member };
}

export const PATCH: APIRoute = withErrors(async ({ request, params }) => {
  const { business, member } = await owned(request, params.id!);
  const data = validateStaff({ ...member, ...(await readJson(request)) });
  return json(await saveStaff({ ...data, id: member.id, businessId: business.id }));
});

export const DELETE: APIRoute = withErrors(async ({ request, params }) => {
  const { member } = await owned(request, params.id!);
  await deleteStaff(member.id);
  return json({ ok: true });
});
