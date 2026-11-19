import type { APIRoute } from 'astro';
import { BookingError, quoteFor } from '../../../lib/booking';
import { getBusinessBySlug } from '../../../lib/repo';
import { createDepositIntent, paymentsMode } from '../../../lib/payments';
import { json, readJson, withErrors } from '../../../lib/http';

export const prerender = false;

/** Public: create the deposit PaymentIntent. The amount is computed here from the services, never from the client. */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const body = await readJson<any>(request);
  const business = await getBusinessBySlug(String(body.businessSlug ?? ''));
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [];
  const { quote } = await quoteFor(business, serviceIds);
  if (quote.depositCents <= 0) throw new BookingError('VALIDATION', 'No deposit is required for this booking');
  const intent = await createDepositIntent({
    amountCents: quote.depositCents, currency: business.currency, stripeAccountId: business.stripeAccountId,
    metadata: { businessId: business.id, serviceIds: serviceIds.join(',') },
  });
  return json({ ...intent, mode: paymentsMode() });
});
