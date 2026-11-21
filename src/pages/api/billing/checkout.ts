import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { getBaseOrigin, json, withErrors } from '../../../lib/http';
import { requireBusiness, sessionUser } from '../../../lib/session';
import { stripe, SUBSCRIPTION_PRICE_ID } from '../../../lib/stripe';

export const prerender = false;

/** Start a £5/month subscription in Stripe Checkout. Customers can enter a coupon code on the Stripe page. */
export const POST: APIRoute = withErrors(async ({ request, url }) => {
  const business = await requireBusiness(request, { allowUnpaid: true });
  const u = await sessionUser(request);
  const price = SUBSCRIPTION_PRICE_ID();
  if (!price) throw new BookingError('VALIDATION', 'Subscriptions are not set up yet');
  if (business.subscription.stripeSubscriptionId && (business.subscription.status === 'active' || business.subscription.status === 'trialing')) {
    throw new BookingError('VALIDATION', 'Your subscription is already active');
  }
  const origin = getBaseOrigin(request, url);
  const session = await stripe<{ url: string }>('POST', 'checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    allow_promotion_codes: 'true',
    client_reference_id: business.id,
    customer_email: u?.email ?? '',
    success_url: `${origin}/dashboard?status=success`,
    cancel_url: `${origin}/dashboard/billing?status=cancelled`,
    'subscription_data[metadata][businessId]': business.id,
    'metadata[businessId]': business.id,
  });
  return json({ url: session.url });
});
