// Stripe REST client for subscriptions and coupons (server-only). Reads STRIPE_SECRET_KEY at call time.
import 'dotenv/config';

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

export async function stripe<T = any>(method: 'GET' | 'POST' | 'DELETE', path: string, form?: Record<string, string>): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Payments are not configured yet (STRIPE_SECRET_KEY is missing).');
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  let body: string | undefined;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers, body });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
  return json as T;
}

export const SUBSCRIPTION_PRICE_ID = () => process.env.STRIPE_PRICE_ID_MONTHLY ?? '';

/** Map a Stripe subscription status onto the app's status. */
export function mapSubscriptionStatus(s: string): 'trialing' | 'active' | 'paused' | 'cancelled' {
  if (s === 'trialing') return 'trialing';
  if (s === 'active') return 'active';
  if (s === 'canceled' || s === 'incomplete_expired') return 'cancelled';
  return 'paused'; // past_due, unpaid, incomplete
}
