// Modal popup shown across the dashboard when an existing business is not subscribed.
import { useState } from 'react';
import { api } from './api';

interface Props {
  open: boolean;
  businessName: string;
}

export default function SubscriptionModal({ open, businessName }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>('/api/billing/checkout', { body: {} });
      if (url) window.location.href = url;
    } catch (e: any) {
      setError(e.message ?? 'Failed to open checkout');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sub-modal-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M3 6h18v12H3zM3 10h18M7 15h4" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <h2 id="sub-modal-title" className="text-xl font-bold text-slate-900">Activate Your Subscription</h2>
          <p className="mt-2 text-sm text-slate-600">
            Welcome to <span className="font-semibold">{businessName}</span> on Doddo. To use your booking calendar, take client appointments, and access dashboard tools, please complete your £5/month subscription.
          </p>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Doddo Standard — £5 / month</p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Unlimited appointments & calendar</li>
              <li className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Online client booking link</li>
              <li className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> No lock-in, cancel any time</li>
            </ul>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 text-center text-sm text-rose-600">{error}</p>}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={subscribe}
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-5 text-base font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Opening Stripe Checkout…' : 'Subscribe Now with Stripe'}
          </button>
          <a
            href="/dashboard/billing"
            className="flex min-h-10 items-center justify-center text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            View billing details
          </a>
        </div>
      </div>
    </div>
  );
}
