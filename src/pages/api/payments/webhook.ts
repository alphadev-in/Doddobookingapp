import type { APIRoute } from 'astro';
import { verifyWebhookSignature } from '../../../lib/payments';
import { findAppointmentByIntent, updateAppointment } from '../../../lib/repo';
import { json } from '../../../lib/http';

export const prerender = false;

/** Stripe webhook. Keeps appointment payment status in sync (e.g. async payment methods). */
export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const ok = verifyWebhookSignature(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET ?? '');
  if (!ok) return json({ error: 'Invalid signature' }, 400);
  const event = JSON.parse(raw) as { type: string; data: { object: { id: string; status: string } } };
  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const appt = await findAppointmentByIntent(event.data.object.id);
    if (appt && event.type === 'payment_intent.succeeded' && appt.paymentStatus === 'unpaid') {
      await updateAppointment(appt.id, { paymentStatus: 'deposit_paid' });
    }
  }
  return json({ received: true });
};
