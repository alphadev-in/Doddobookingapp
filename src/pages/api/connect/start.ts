import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { BookingError } from '../../../lib/booking';
import { getBaseOrigin, withErrors } from '../../../lib/http';
import { requireBusiness } from '../../../lib/session';

export const prerender = false;

/** Signed state ties the OAuth round-trip to this business so it cannot be replayed for another one. */
export const signState = (businessId: string) => {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  const sig = crypto.createHmac('sha256', key).update(businessId).digest('hex');
  return `${businessId}.${sig}`;
};

/** Send the owner to Stripe to connect their own account (Stripe Connect, OAuth). */
export const GET: APIRoute = withErrors(async ({ request, url }) => {
  const business = await requireBusiness(request);
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new BookingError('VALIDATION', 'Stripe Connect is not set up yet');
  const origin = getBaseOrigin(request, url);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    state: signState(business.id),
    redirect_uri: `${origin}/api/connect/callback`,
    'stripe_user[business_name]': business.name,
    'stripe_user[email]': business.email,
  });
  return new Response(null, { status: 302, headers: { Location: `https://connect.stripe.com/oauth/authorize?${params}` } });
});
