import type { APIRoute } from 'astro';
import { listStaff, saveStaff } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';
import { validateStaff } from '../../../lib/validate';

export const prerender = false;

export const GET: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  return json({ staff: await listStaff(business.id) });
});

export const POST: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  const data = validateStaff(await readJson(request));
  return json(await saveStaff({ ...data, businessId: business.id }), 201);
});
