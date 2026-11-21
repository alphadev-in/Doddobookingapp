import type { APIRoute } from 'astro';
import { BookingError } from '../../lib/booking';
import { getBusinessById, saveBusiness } from '../../lib/repo';
import { json, readJson, withErrors } from '../../lib/http';
import { requireBusiness } from '../../lib/session';
import { validateBusinessSettings } from '../../lib/validate';

export const prerender = false;

export const GET: APIRoute = withErrors(async ({ request }) => json(await requireBusiness(request)));

/** Settings: hours, deposit/cancellation policy, notifications, templates, profile. Slug is immutable. */
export const PATCH: APIRoute = withErrors(async ({ request }) => {
  const current = await requireBusiness(request, { allowUnpaid: true });
  const data = validateBusinessSettings({ ...current, ...(await readJson(request)) });
  const fresh = await getBusinessById(current.id);
  if (!fresh) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  return json(await saveBusiness({ ...fresh, ...data, slug: fresh.slug, id: fresh.id, ownerUid: fresh.ownerUid } as any));
});
