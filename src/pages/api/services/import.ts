import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { listServices, saveService } from '../../../lib/repo';
import { json, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';
import { parseCsv } from '../../../lib/csv';
import { validateService } from '../../../lib/validate';

export const prerender = false;

/**
 * Import services from CSV (same columns as export). Rows with a name that matches an existing service
 * in the same category update it; other rows are created. Returns a per-row report.
 */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const business = await requireBusiness(request);
  const text = await request.text();
  if (text.length > 500_000) throw new BookingError('VALIDATION', 'File is too large (max 500 KB)');
  const [header, ...body] = parseCsv(text);
  if (!header) throw new BookingError('VALIDATION', 'The file is empty');
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const idx = { name: col('name'), category: col('category'), duration: col('duration_min'), buffer: col('buffer_min'), price: col('price'), depositType: col('deposit_type'), depositValue: col('deposit_value'), active: col('active') };
  if (idx.name < 0 || idx.duration < 0 || idx.price < 0) throw new BookingError('VALIDATION', 'Columns needed: name, duration_min, price (plus optional category, buffer_min, deposit_type, deposit_value, active)');
  if (body.length > 500) throw new BookingError('VALIDATION', 'Import up to 500 services at a time');

  const existing = await listServices(business.id);
  const report: { row: number; name: string; status: 'created' | 'updated' | 'error'; message?: string }[] = [];
  for (let i = 0; i < body.length; i++) {
    const r = body[i];
    const get = (k: number) => (k >= 0 ? (r[k] ?? '').trim() : '');
    const name = get(idx.name);
    try {
      const category = get(idx.category) || 'General';
      const depositType = (get(idx.depositType) || 'none').toLowerCase();
      const depositRaw = get(idx.depositValue);
      const data = validateService({
        name,
        category,
        durationMin: Number(get(idx.duration)),
        bufferMin: get(idx.buffer) ? Number(get(idx.buffer)) : 0,
        priceCents: Math.round(Number(get(idx.price)) * 100),
        depositType,
        depositValue: depositType === 'fixed' ? Math.round(Number(depositRaw || 0) * 100) : Number(depositRaw || 0),
        active: idx.active >= 0 ? !['no', 'false', '0'].includes(get(idx.active).toLowerCase()) : true,
      });
      const match = existing.find((s) => s.name.toLowerCase() === name.toLowerCase() && s.category.toLowerCase() === category.toLowerCase());
      await saveService({ ...data, id: match?.id, businessId: business.id });
      report.push({ row: i + 2, name, status: match ? 'updated' : 'created' });
    } catch (e: any) {
      report.push({ row: i + 2, name, status: 'error', message: e.message ?? 'Invalid row' });
    }
  }
  return json({ report, created: report.filter((x) => x.status === 'created').length, updated: report.filter((x) => x.status === 'updated').length, errors: report.filter((x) => x.status === 'error').length });
});
