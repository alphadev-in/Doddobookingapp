import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { listServices, saveService } from '../../../lib/repo';
import { json, readJson, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';

export const prerender = false;

/** Rename a category across all its services (or merge into an existing one). */
export const PATCH: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  const { from, to } = await readJson<{ from: string; to: string }>(request);
  const next = String(to ?? '').trim().slice(0, 60);
  if (!next) throw new BookingError('VALIDATION', 'Category name is required');
  const affected = (await listServices(business.id)).filter((s) => s.category === from);
  for (const s of affected) await saveService({ ...s, category: next });
  return json({ updated: affected.length });
});
