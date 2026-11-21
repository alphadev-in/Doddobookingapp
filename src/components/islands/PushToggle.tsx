// Turn on phone notifications for this device. Works for the installed app (iPhone: add to Home Screen first).
import { useEffect, useState } from 'react';
import { api } from './api';

type State = 'checking' | 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied' | 'error';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushToggle() {
  const [state, setState] = useState<State>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isIos && !standalone) return setState('needs-install');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'off');
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const { publicKey } = await api<{ publicKey: string }>('/api/push/public-key');
      if (!publicKey) throw new Error('Notifications are not set up yet.');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as any });
      await api('/api/push/subscribe', { body: sub.toJSON() });
      setState('on');
    } catch (e: any) {
      setError(e.message ?? 'Could not turn on notifications.');
      setState('error');
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('/api/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setState('off');
  }

  if (state === 'checking') return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">Phone notifications</p>
        <p className="text-sm text-slate-600">
          {state === 'on' && 'On for this device. You’ll get an alert when a booking comes in or changes.'}
          {state === 'off' && 'Get an alert on your phone when a booking comes in or changes. Tap the alert to open it.'}
          {state === 'needs-install' && 'On iPhone, first tap Share → Add to Home Screen, open Doddo from your Home Screen, then turn this on.'}
          {state === 'denied' && 'Notifications are blocked for this site. Allow them in your browser or phone settings.'}
          {state === 'unsupported' && 'This browser does not support notifications. Add Doddo to your Home Screen and try again.'}
          {state === 'error' && (error ?? 'Something went wrong.')}
        </p>
      </div>
      {state === 'off' || state === 'error' ? (
        <button type="button" onClick={enable} className="min-h-11 shrink-0 rounded-lg bg-brand-600 px-4 font-semibold text-white">Turn on alerts</button>
      ) : state === 'on' ? (
        <button type="button" onClick={disable} className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-4 font-medium text-slate-700">Turn off</button>
      ) : null}
    </div>
  );
}
