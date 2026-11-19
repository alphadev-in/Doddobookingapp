import 'dotenv/config'; // Astro dev exposes .env to import.meta.env only; load it into process.env for server code
// Stripe layer (server-only). Uses Stripe's REST API directly via fetch, so there is no SDK
// dependency to install. With no STRIPE_SECRET_KEY set, everything runs in SANDBOX mode:
// deposits are simulated, nothing leaves the machine, and the flow is otherwise identical.
import crypto from 'node:crypto';

const SECRET = process.env.STRIPE_SECRET_KEY || '';
const PUBLISHABLE = process.env.STRIPE_PUBLISHABLE_KEY || '';

export const paymentsMode = (): 'live' | 'sandbox' => (SECRET ? 'live' : 'sandbox');
export const SANDBOX_PREFIX = 'sandbox_pi_';

export interface DepositIntent {
  id: string;
  mode: 'live' | 'sandbox';
  clientSecret: string | null; // null in sandbox
  publishableKey: string | null;
  stripeAccount: string | null; // Stripe Connect connected account, if any
  amountCents: number;
  currency: string;
}

async function stripeRequest(method: 'GET' | 'POST', path: string, form: Record<string, string> | null, account: string | null) {
  const headers: Record<string, string> = { Authorization: `Bearer ${SECRET}` };
  if (account) headers['Stripe-Account'] = account;
  let body: string | undefined;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers, body });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
  return json;
}

/** Create a PaymentIntent for a deposit. Amount is always computed server-side. */
export async function createDepositIntent(opts: {
  amountCents: number; currency: string; stripeAccountId: string | null; metadata: Record<string, string>;
}): Promise<DepositIntent> {
  const base = { amountCents: opts.amountCents, currency: opts.currency, stripeAccount: opts.stripeAccountId };
  if (paymentsMode() === 'sandbox') {
    return { id: `${SANDBOX_PREFIX}${crypto.randomUUID().replace(/-/g, '')}`, mode: 'sandbox', clientSecret: null, publishableKey: null, ...base, stripeAccount: null };
  }
  const form: Record<string, string> = {
    amount: String(opts.amountCents),
    currency: opts.currency.toLowerCase(),
    'automatic_payment_methods[enabled]': 'true',
    description: 'Booking deposit',
  };
  for (const [k, v] of Object.entries(opts.metadata)) form[`metadata[${k}]`] = v;
  const pi = await stripeRequest('POST', 'payment_intents', form, opts.stripeAccountId);
  return { id: pi.id, mode: 'live', clientSecret: pi.client_secret, publishableKey: PUBLISHABLE || null, ...base };
}

/** Confirm a deposit actually succeeded before a booking is written. */
export async function verifyDeposit(id: string, expectedCents: number, stripeAccountId: string | null): Promise<{ ok: boolean; reason?: string }> {
  if (id.startsWith(SANDBOX_PREFIX)) {
    return paymentsMode() === 'sandbox' ? { ok: true } : { ok: false, reason: 'Sandbox payment ids are not accepted in live mode' };
  }
  if (paymentsMode() === 'sandbox') return { ok: false, reason: 'Live payment ids are not accepted in sandbox mode' };
  const pi = await stripeRequest('GET', `payment_intents/${encodeURIComponent(id)}`, null, stripeAccountId);
  if (pi.status !== 'succeeded') return { ok: false, reason: `Payment status is ${pi.status}` };
  if (pi.amount_received !== expectedCents) return { ok: false, reason: 'Paid amount does not match the deposit' };
  return { ok: true };
}

/** Refund a deposit (business-initiated cancellations). No-op in sandbox. */
export async function refundDeposit(id: string | null, stripeAccountId: string | null) {
  if (!id || id.startsWith(SANDBOX_PREFIX) || paymentsMode() === 'sandbox') return;
  await stripeRequest('POST', 'refunds', { payment_intent: id }, stripeAccountId);
}

/** Verify a Stripe-Signature header (v1 HMAC-SHA256, 5 minute tolerance). */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
