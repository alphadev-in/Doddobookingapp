import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { deleteService, listServices, saveService } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';
import { validateService } from '../../../lib/validate';

export const prerender = false;

async function owned(request: Request, id: string) {
  const business = await requireBusiness(request);
  const svc = (await listServices(business.id)).find((s) => s.id === id);
  if (!svc) throw new BookingError('NOT_FOUND', 'Service not found', 404);
  return { business, svc };
}

export const PATCH: APIRoute = withErrors(async ({ request, params }) => {
  const { business, svc } = await owned(request, params.id!);
  const data = validateService({ ...svc, ...(await readJson(request)) });
  return json(await saveService({ ...data, id: svc.id, businessId: business.id }));
});

export const DELETE: APIRoute = withErrors(async ({ request, params }) => {
  const { svc } = await owned(request, params.id!);
  await deleteService(svc.id);
  return json({ ok: true });
});
