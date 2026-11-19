import type { APIRoute } from 'astro';
import { listClients } from '../../../lib/repo';
import { json, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';

export const prerender = false;

export const GET: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  const clients = await listClients(business.id);
  return json({ clients: clients.sort((a, b) => a.name.localeCompare(b.name)) });
});
