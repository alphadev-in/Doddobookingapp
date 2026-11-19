import type { APIRoute } from 'astro';
import { adminAuth } from '../../../lib/firebase-admin';
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from '../../../lib/session';
import { json, readJson, withErrors } from '../../../lib/http';
import { BookingError } from '../../../lib/booking';

export const prerender = false;

/** Behind a proxy (Cloud Run, App Hosting) the app sees http; trust x-forwarded-proto. */
const isHttps = (request: Request) =>
  new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';

/** Exchange a Firebase ID token (from email/password sign-in) for an httpOnly session cookie. */
export const POST: APIRoute = withErrors(async ({ request }) => {
  const { idToken } = await readJson<{ idToken?: string }>(request);
  if (!idToken) throw new BookingError('VALIDATION', 'Missing token');
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  const secure = isHttps(request) ? '; Secure' : '';
  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(cookie)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_MS / 1000}${secure}`,
  });
});

export const DELETE: APIRoute = async ({ request }) => {
  const secure = isHttps(request) ? '; Secure' : '';
  return json({ ok: true }, 200, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}` });
};
