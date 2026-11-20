import type { APIRoute } from 'astro';
import { adminAuth } from '../../../../lib/firebase-admin';
import { BookingError } from '../../../../lib/booking';
import { json, readJson, withErrors } from '../../../../lib/http';
import { requireAdmin, ADMIN_EMAIL } from '../../../../lib/session';

export const prerender = false;

/** Admin: enable or disable a user's sign-in. The admin account itself cannot be disabled. */
export const PATCH: APIRoute = withErrors(async ({ request, params }) => {
  await requireAdmin(request);
  const target = await adminAuth().getUser(params.uid!).catch(() => null);
  if (!target) throw new BookingError('NOT_FOUND', 'User not found', 404);
  if ((target.email ?? '').toLowerCase() === ADMIN_EMAIL) throw new BookingError('VALIDATION', 'The admin account cannot be disabled');
  const body = await readJson<{ disabled: boolean }>(request);
  await adminAuth().updateUser(target.uid, { disabled: !!body.disabled });
  return json({ ok: true, disabled: !!body.disabled });
});
