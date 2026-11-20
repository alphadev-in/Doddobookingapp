// Admin: users (enable/disable sign-in), businesses and subscription plans.
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

interface AdminUser {
  uid: string; email: string; created?: string; lastSignIn?: string; disabled: boolean; role: string;
  business: { id: string; name: string; slug: string; subscription: { plan: string; status: string } } | null;
}

const PLANS = ['trial', 'standard'] as const;
const STATUSES = ['trialing', 'active', 'paused', 'cancelled'] as const;

export default function AdminPanel() {
  const [data, setData] = useState<{ users: AdminUser[]; totals: Record<string, number> } | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api<any>('/api/admin/users').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => (data?.users ?? []).filter((u) => (u.email + ' ' + (u.business?.name ?? '')).toLowerCase().includes(q.toLowerCase())), [data, q]);

  async function toggleDisabled(u: AdminUser) {
    setBusy(u.uid);
    try { await api(`/api/admin/users/${u.uid}`, { method: 'PATCH', body: { disabled: !u.disabled } }); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }
  async function setSub(u: AdminUser, patch: { plan?: string; status?: string }) {
    if (!u.business) return;
    setBusy(u.uid);
    try {
      await api(`/api/admin/businesses/${u.business.id}`, { method: 'PATCH', body: { plan: patch.plan ?? u.business.subscription.plan, status: patch.status ?? u.business.subscription.status } });
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }

  if (error && !data) return <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>;
  if (!data) return <div className="skeleton h-48" aria-busy="true" />;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3">
        {[['Accounts', data.totals.users], ['Businesses', data.totals.businesses], ['Customers', data.totals.customers]].map(([l, v]) => (
          <div key={String(l)} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</p>
            <p className="mt-1 text-2xl font-bold">{v}</p>
          </div>
        ))}
      </section>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="font-semibold">Users & subscriptions</h2>
          <input type="search" placeholder="Search email or business" value={q} onChange={(e) => setQ(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base sm:w-72" />
        </div>
        <ul className="divide-y divide-slate-200">
          {rows.map((u) => (
            <li key={u.uid} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.email || u.uid}</p>
                <p className="text-sm text-slate-500">
                  {u.role === 'customer' ? 'Customer' : u.business ? `Business · ${u.business.name}` : 'Business (no setup yet)'}
                  {u.lastSignIn && ` · last sign-in ${new Date(u.lastSignIn).toLocaleDateString('en-GB')}`}
                </p>
                {u.disabled && <span className="mt-1 inline-block rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Sign-in disabled</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {u.business && (
                  <>
                    <select aria-label="Plan" disabled={busy === u.uid} value={u.business.subscription.plan} onChange={(e) => setSub(u, { plan: e.target.value })}
                      className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm">
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select aria-label="Status" disabled={busy === u.uid} value={u.business.subscription.status} onChange={(e) => setSub(u, { status: e.target.value })}
                      className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </>
                )}
                <button type="button" disabled={busy === u.uid} onClick={() => toggleDisabled(u)}
                  className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${u.disabled ? 'bg-emerald-600 text-white' : 'border border-rose-300 text-rose-700'} disabled:opacity-50`}>
                  {u.disabled ? 'Enable' : 'Disable'}
                </button>
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No matching accounts.</li>}
        </ul>
      </section>
    </div>
  );
}
