import type { APIRoute } from 'astro';
import { BookingError } from '../../lib/booking';
import { isSlugTaken, saveBusiness } from '../../lib/repo';
import { json, readJson, withErrors } from '../../lib/http';
import { ownerContext } from '../../lib/session';
import { validateBusinessSettings, validateSlug } from '../../lib/validate';
import { uid } from '../../lib/ids';
import { defaultHours } from '../../lib/defaults';

export const prerender = false;

/** Onboarding step 1: create the signed-in owner's business. One business per owner in Phase 1. */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const { uid: ownerUid, business: existing } = await ownerContext(request);
  if (existing) throw new BookingError('VALIDATION', 'You already have a business', 409);
  const body = await readJson<any>(request);
  const slug = validateSlug(String(body.slug ?? ''));
  if (await isSlugTaken(slug)) throw new BookingError('VALIDATION', 'That booking link is taken', 409);
  const base = validateBusinessSettings({
    name: body.name, email: body.email, phone: body.phone, timezone: body.timezone, currency: body.currency,
    hours: body.hours ?? defaultHours(),
  });
  const business = await saveBusiness({
    ...defaultBusinessFields(), ...base, id: `biz_${uid()}`, slug, ownerUid, stripeAccountId: null, createdAt: new Date().toISOString(),
  } as any);
  return json(business, 201);
});

function defaultBusinessFields() {
  return {
    depositPolicy: 'A deposit secures your booking. Deposits are non-refundable inside the cancellation window.',
    cancellationWindowHours: 24, lateCancelDepositForfeit: true,
    notifications: { confirmation: true, reminder24h: true, cancellation: true },
    templates: {
      confirmation: 'Hi {{name}}, your {{service}} at {{business}} is confirmed for {{time}}.',
      reminder24h: 'Reminder: {{service}} at {{business}} tomorrow at {{time}}.',
      cancellation: 'Hi {{name}}, your {{service}} on {{time}} has been cancelled.',
    },
  };
}
