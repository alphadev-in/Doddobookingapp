import type { APIRoute } from 'astro';
import { sendReminders } from '../../../lib/reminders';
import { json, withErrors } from '../../../lib/http';

export const prerender = false;

/** Scheduled job endpoint. Requires CRON_SECRET; refuses to run if the secret is not configured. */
export const GET: APIRoute = withErrors(async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) return json({ error: 'Forbidden' }, 403);
  return json(await sendReminders());
});
