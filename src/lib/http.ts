// Shared API helpers: JSON responses, error mapping, cookie parsing.
import { BookingError } from './booking';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new BookingError('VALIDATION', 'Invalid JSON body');
  }
}

/** Wrap a handler so BookingError maps to its status and anything else becomes a 500 (logged, not leaked). */
export function withErrors(fn: (ctx: any) => Promise<Response>) {
  return async (ctx: any) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof BookingError) return json({ error: e.message, code: e.code }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

export function getCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * Resolve the public base origin for redirects, webhooks and Stripe sessions.
 * In production behind proxies / Cloud Run (where Node sees localhost:8080),
 * this inspects Referer and proxy headers, falling back to PUBLIC_SITE_URL or request URL.
 */
export function getBaseOrigin(request: Request, fallbackUrl?: URL): string {
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const u = new URL(referer);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return u.origin;
      }
    } catch {}
  }

  const xfHost = request.headers.get('x-forwarded-host');
  const xfProto = request.headers.get('x-forwarded-proto') || 'https';
  if (xfHost) {
    const h = xfHost.split(',')[0].trim();
    if (h && !h.startsWith('localhost') && !h.startsWith('127.0.0.1')) {
      return `${xfProto}://${h}`;
    }
  }

  const host = request.headers.get('host');
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1') && !host.startsWith('0.0.0.0')) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`;
  }

  if (process.env.PUBLIC_SITE_URL) {
    return process.env.PUBLIC_SITE_URL.replace(/\/+$/, '');
  }

  return fallbackUrl ? fallbackUrl.origin : 'https://doddo.co.uk';
}
