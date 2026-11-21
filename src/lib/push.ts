// Web Push for the installed PWA (Android/Chrome, desktop, and iOS 16.4+ when added to the Home Screen).
// Server-only. Keys: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
import webpush from 'web-push';
import { col } from './repo';
import type { PushSubscriptionRow } from './types';

let configured = false;
function setup(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:hello@doddo.co.uk', pub, priv);
  configured = true;
  return true;
}

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? '';

export async function saveSubscription(row: Omit<PushSubscriptionRow, 'id' | 'createdAt'>) {
  const id = `psub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const doc = { ...row, id, createdAt: new Date().toISOString() };
  await col<PushSubscriptionRow>('pushSubscriptions').doc(id).set(doc);
  return doc;
}

export async function removeSubscription(endpoint: string) {
  const q = await col<PushSubscriptionRow>('pushSubscriptions').where('endpoint', '==', endpoint).get();
  await Promise.all(q.docs.map((d) => d.ref.delete()));
}

/** Send a notification to every device subscribed for a business owner or a customer. Never throws. */
export async function sendPush(target: { businessId?: string; customerEmail?: string }, payload: { title: string; body: string; url: string }) {
  if (!setup()) return;
  const field = target.businessId ? 'businessId' : 'customerEmail';
  const value = target.businessId ?? target.customerEmail;
  if (!value) return;
  const q = await col<PushSubscriptionRow>('pushSubscriptions').where(field, '==', value).get();
  await Promise.all(q.docs.map(async (d) => {
    const row = d.data();
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, JSON.stringify(payload), { TTL: 3600 });
    } catch (e: any) {
      // 404/410 = the device unsubscribed or the app was removed. Clean it up.
      if (e?.statusCode === 404 || e?.statusCode === 410) await d.ref.delete();
      else console.error('push failed', e?.statusCode ?? e);
    }
  }));
}
