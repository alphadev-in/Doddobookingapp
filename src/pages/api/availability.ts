import type { APIRoute } from 'astro';
import { getBusinessBySlug } from '../../lib/repo';
import { getDaySlots, BookingError } from '../../lib/booking';
import { json, withErrors } from '../../lib/http';

export const prerender = false;

/** GET /api/availability?slug=&serviceIds=a,b&staffId=any|id&date=YYYY-MM-DD */
export const GET: APIRoute = withErrors(async ({ url }) => {
  const slug = url.searchParams.get('slug') ?? '';
  const serviceIds = (url.searchParams.get('serviceIds') ?? '').split(',').filter(Boolean);
  const staffId = url.searchParams.get('staffId') ?? 'any';
  const date = url.searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BookingError('VALIDATION', 'date must be YYYY-MM-DD');
  const business = await getBusinessBySlug(slug);
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  const slots = await getDaySlots({ businessId: business.id, serviceIds, staffId, date });
  return json({ date, timezone: business.timezone, slots });
});
