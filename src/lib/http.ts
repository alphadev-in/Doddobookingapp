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
