import type { APIRoute } from 'astro';
import { listServices, saveService } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';
import { validateService } from '../../../lib/validate';

export const prerender = false;

export const GET: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  return json({ services: await listServices(business.id) });
});

export const POST: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request, { allowUnpaid: true });
  const data = validateService(await readJson(request));
  return json(await saveService({ ...data, businessId: business.id }), 201);
});
