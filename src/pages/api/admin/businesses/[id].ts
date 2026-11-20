import type { APIRoute } from 'astro';
import { BookingError } from '../../../../lib/booking';
import { getBusinessById, saveBusiness } from '../../../../lib/repo';
import { json, readJson, withErrors } from '../../../../lib/http';
import { requireAdmin } from '../../../../lib/session';

export const prerender = false;

/** Admin: set a business's subscription plan and status. */
export const PATCH: APIRoute = withErrors(async ({ request, params }) => {
  await requireAdmin(request);
  const business = await getBusinessById(params.id!);
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  const body = await readJson<any>(request);
  const plan = body.plan === 'standard' ? 'standard' : 'trial';
  const allowed = ['trialing', 'active', 'paused', 'cancelled'];
  const status = allowed.includes(body.status) ? body.status : business.subscription.status;
  return json(await saveBusiness({ ...business, subscription: { plan, status, trialEndsAt: business.subscription.trialEndsAt } }));
});
