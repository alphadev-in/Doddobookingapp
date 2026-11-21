// Gate dashboard, onboarding and account pages behind a valid Firebase session cookie.
// Also: private pages and APIs are never cached, so bookings show up on refresh.
import { defineMiddleware } from 'astro:middleware';
import { getCookie } from './lib/http';
import { SESSION_COOKIE, verifySessionCookie } from './lib/session';

const PROTECTED = ['/dashboard', '/onboarding', '/account', '/notifications', '/admin'];
const isProtected = (path: string) => PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const private_ = isProtected(path) || path.startsWith('/api/');
  if (isProtected(path)) {
    const uid = await verifySessionCookie(getCookie(context.request, SESSION_COOKIE));
    if (!uid) return context.redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  const res = await next();
  if (private_) res.headers.set('Cache-Control', 'private, no-store');
  return res;
});
