// Gate dashboard and onboarding pages behind a valid Firebase session cookie.
import { defineMiddleware } from 'astro:middleware';
import { getCookie } from './lib/http';
import { SESSION_COOKIE, verifySessionCookie } from './lib/session';

const PROTECTED = ['/dashboard', '/onboarding', '/account', '/notifications', '/admin'];

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (!PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) return next();
  const uid = await verifySessionCookie(getCookie(context.request, SESSION_COOKIE));
  if (!uid) return context.redirect(`/login?next=${encodeURIComponent(path)}`);
  return next();
});
