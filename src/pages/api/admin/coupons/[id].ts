import type { APIRoute } from 'astro';
import { json, readJson, withErrors } from '../../../../lib/http';
import { requireAdmin } from '../../../../lib/session';
import { stripe } from '../../../../lib/stripe';

export const prerender = false;

/** Admin: switch a customer code on or off. */
export const PATCH: APIRoute = withErrors(async ({ request, params }) => {
  await requireAdmin(request);
  const b = await readJson<{ active: boolean }>(request);
  await stripe('POST', `promotion_codes/${encodeURIComponent(params.id!)}`, { active: b.active ? 'true' : 'false' });
  return json({ ok: true });
});
