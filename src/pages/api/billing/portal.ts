import type { APIRoute } from 'astro';
import { BookingError } from '../../../lib/booking';
import { json, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';
import { stripe } from '../../../lib/stripe';

export const prerender = false;

/** Open Stripe's customer portal: update card, view invoices, or cancel. */
export const POST: APIRoute = withErrors(async ({ request, url }) => {
  const business = await requireBusiness(request);
  const customer = business.subscription.stripeCustomerId;
  if (!customer) throw new BookingError('VALIDATION', 'No subscription yet. Start one first.');
  const session = await stripe<{ url: string }>('POST', 'billing_portal/sessions', { customer, return_url: `${url.origin}/dashboard/billing` });
  return json({ url: session.url });
});
