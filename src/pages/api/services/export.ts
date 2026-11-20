import type { APIRoute } from 'astro';
import { listServices } from '../../../lib/repo';
import { toCsv } from '../../../lib/csv';
import { withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';

export const prerender = false;

const HEADER = ['name', 'category', 'duration_min', 'buffer_min', 'price', 'deposit_type', 'deposit_value', 'active'];

/** Export services as CSV. Prices are in major units (e.g. 35.00); deposit_value is % for percent, major units for fixed. */
export const GET: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  const rows = (await listServices(business.id))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((s) => [
      s.name, s.category, String(s.durationMin), String(s.bufferMin), (s.priceCents / 100).toFixed(2), s.depositType,
      s.depositType === 'fixed' ? (s.depositValue / 100).toFixed(2) : String(s.depositValue), s.active ? 'yes' : 'no',
    ]);
  return new Response(toCsv([HEADER, ...rows]), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="services.csv"' },
  });
});
