import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '../../../lib/payments';
import { getBusinessById, saveBusiness } from '../../../lib/repo';
import { json } from '../../../lib/http';
import { mapSubscriptionStatus } from '../../../lib/stripe';

export const prerender = false;

/**
 * Stripe billing webhook. Set STRIPE_BILLING_WEBHOOK_SECRET to the signing secret of this endpoint.
 * Events: checkout.session.completed, customer.subscription.created | updated | deleted.
 */
export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? '';
  if (!verifyWebhookSignature(raw, request.headers.get('stripe-signature'), secret)) return json({ error: 'Invalid signature' }, 400);

  const event = JSON.parse(raw) as { type: string; data: { object: any } };
  const obj = event.data.object;
  const businessId: string | undefined = obj.metadata?.businessId ?? obj.client_reference_id;
  const business = businessId ? await getBusinessById(businessId) : null;
  if (!business) return json({ received: true, skipped: 'no business' });

  const sub = business.subscription;
  if (event.type === 'checkout.session.completed') {
    await saveBusiness({ ...business, subscription: { ...sub, plan: 'standard', status: 'active', stripeCustomerId: obj.customer, stripeSubscriptionId: obj.subscription } });
  } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const status = event.type === 'customer.subscription.deleted' ? 'cancelled' : mapSubscriptionStatus(obj.status);
    await saveBusiness({
      ...business,
      subscription: {
        ...sub, plan: 'standard', status,
        stripeCustomerId: obj.customer, stripeSubscriptionId: obj.id,
        currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : sub.currentPeriodEnd ?? null,
      },
    });
  }
  return json({ received: true });
};
