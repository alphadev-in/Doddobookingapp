// Subscribe (Stripe Checkout) or manage (Stripe customer portal). Redirects to Stripe.
import { useEffect, useState } from 'react';
import { api } from './api';

export default function BillingActions({ canManage, isActive }: { canManage: boolean; isActive: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: 'checkout' | 'portal') {
    setBusy(kind);
    setError(null);
    try {
      const { url } = await api<{ url: string }>(`/api/billing/${kind}`, { body: {} });
      window.location.href = url;
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  }

  // Auto-launch Stripe Checkout if redirected with ?subscribe=1 or ?welcome=1
  useEffect(() => {
    if (typeof window === 'undefined' || isActive) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('subscribe') === '1' || params.get('welcome') === '1') {
      go('checkout');
    }
  }, [isActive]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {!isActive && (
          <button type="button" disabled={!!busy} onClick={() => go('checkout')} className="min-h-12 rounded-xl bg-brand-600 px-6 font-semibold text-white shadow-lg shadow-brand-600/25 disabled:opacity-60">
            {busy === 'checkout' ? 'Opening secure checkout…' : 'Subscribe — £5 / month'}
          </button>
        )}
        {canManage && (
          <button type="button" disabled={!!busy} onClick={() => go('portal')} className="min-h-12 rounded-xl border border-slate-300 bg-white px-6 font-semibold disabled:opacity-60">
            {busy === 'portal' ? 'Opening…' : 'Manage payment, invoices & cancel'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <p className="text-xs text-slate-500">Payments are handled by Stripe. You can enter a promotion code on the Stripe checkout page.</p>
    </div>
  );
}
