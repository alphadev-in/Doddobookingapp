import type { APIRoute } from 'astro';
import { json, withErrors } from '../../../lib/http';
import { vapidPublicKey } from '../../../lib/push';

export const prerender = false;

export const GET: APIRoute = withErrors(async () => json({ publicKey: vapidPublicKey() }));
