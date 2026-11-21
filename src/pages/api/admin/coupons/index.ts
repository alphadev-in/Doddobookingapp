import type { APIRoute } from 'astro';
import { BookingError } from '../../../../lib/booking';
import { json, readJson, withErrors } from '../../../../lib/http';
import { requireAdmin } from '../../../../lib/session';
import { stripe } from '../../../../lib/stripe';

export const prerender = false;

/** Admin: list promotion codes (coupons customers can type at checkout). */
export const GET: APIRoute = withErrors(async ({ request }) => {
  await requireAdmin(request);
  const list = await stripe<{ data: any[] }>('GET', 'promotion_codes?limit=100&expand[]=data.promotion.coupon');
  return json({
    codes: list.data.map((p) => ({
      id: p.id, code: p.code, active: p.active, timesRedeemed: p.times_redeemed, maxRedemptions: p.max_redemptions,
      expiresAt: p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
      off: p.coupon?.percent_off ? `${p.coupon.percent_off}% off` : p.coupon?.amount_off ? `£${(p.coupon.amount_off / 100).toFixed(2)} off` : '',
      duration: p.coupon?.duration === 'repeating' ? `${p.coupon.duration_in_months} months` : p.coupon?.duration ?? '',
    })),
  });
});

/**
 * Admin: create a coupon and a customer-facing code for it.
 * body: { code, percentOff? | amountOffPence?, duration: 'once'|'forever'|'repeating', months?, maxRedemptions?, expiresAt? }
 */
export const POST: APIRoute = withErrors(async ({ request }) => {
  await requireAdmin(request);
  const b = await readJson<any>(request);
  const code = String(b.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new BookingError('VALIDATION', 'Code: 3–30 letters, numbers, - or _');
  const form: Record<string, string> = { name: `${code} offer`, duration: ['once', 'forever', 'repeating'].includes(b.duration) ? b.duration : 'once' };
  if (form.duration === 'repeating') {
    const months = Number(b.months);
    if (!Number.isInteger(months) || months < 1 || months > 36) throw new BookingError('VALIDATION', 'Months must be 1–36');
    form.duration_in_months = String(months);
  }
  if (b.percentOff !== undefined && b.percentOff !== '') {
    const p = Number(b.percentOff);
    if (!(p > 0 && p <= 100)) throw new BookingError('VALIDATION', 'Percent must be between 1 and 100');
    form.percent_off = String(p);
  } else {
    const pence = Math.round(Number(b.amountOffPounds ?? 0) * 100);
    if (!(pence > 0)) throw new BookingError('VALIDATION', 'Enter a percent or a £ amount');
    form.amount_off = String(pence);
    form.currency = 'gbp';
  }
  const coupon = await stripe<{ id: string }>('POST', 'coupons', form);
  const pc: Record<string, string> = { coupon: coupon.id, code, 'restrictions[first_time_transaction]': 'false' };
  if (b.maxRedemptions) pc.max_redemptions = String(Math.max(1, Math.floor(Number(b.maxRedemptions))));
  if (b.expiresAt) pc.expires_at = String(Math.floor(new Date(String(b.expiresAt)).getTime() / 1000));
  const promo = await stripe<{ id: string; code: string }>('POST', 'promotion_codes', pc);
  return json({ id: promo.id, code: promo.code }, 201);
});
