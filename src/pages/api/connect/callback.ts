import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { getBusinessById, saveBusiness } from '../../../lib/repo';
import { signState } from './start';
import { sessionUser } from '../../../lib/session';

export const prerender = false;

const back = (path: string, origin: string) => new Response(null, { status: 302, headers: { Location: `${origin}${path}` } });

/** Stripe returns here with ?code=…&state=…. Exchange the code and save the connected account id. */
export const GET: APIRoute = async ({ request, url }) => {
  const u = await sessionUser(request);
  if (!u) return back('/login?next=/dashboard/settings', url.origin);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const businessId = state.split('.')[0];
  const expected = signState(businessId);
  const valid = state.length === expected.length && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected));
  if (!valid || !code) return back('/dashboard/settings?connect=invalid', url.origin);

  const business = await getBusinessById(businessId);
  if (!business || business.ownerUid !== u.uid) return back('/dashboard/settings?connect=invalid', url.origin);

  const res = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY ?? ''}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }),
  });
  const json = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !json.stripe_user_id) return back('/dashboard/settings?connect=failed', url.origin);

  await saveBusiness({ ...business, stripeAccountId: json.stripe_user_id });
  return back('/dashboard/settings?connect=ok', url.origin);
};
