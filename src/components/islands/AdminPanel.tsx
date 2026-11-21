// Admin: users (enable/disable sign-in), businesses and subscription plans.
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

interface AdminUser {
  uid: string; email: string; created?: string; lastSignIn?: string; disabled: boolean; role: string;
  business: { id: string; name: string; slug: string; subscription: { plan: string; status: string } } | null;
}

const PLANS = ['trial', 'standard'] as const;
const STATUSES = ['trialing', 'active', 'paused', 'cancelled'] as const;

function CouponSection() {
  const [codes, setCodes] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', kind: 'percent', value: '20', duration: 'once', months: '3', maxRedemptions: '', expiresAt: '' });
  const load = () => api<any>('/api/admin/coupons').then((d) => setCodes(d.codes)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api('/api/admin/coupons', { body: { code: form.code, percentOff: form.kind === 'percent' ? form.value : undefined, amountOffPounds: form.kind === 'amount' ? form.value : undefined, duration: form.duration, months: form.months, maxRedemptions: form.maxRedemptions || undefined, expiresAt: form.expiresAt || undefined } });
      setForm({ ...form, code: '' });
      await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function toggle(id: string, active: boolean) {
    await api(`/api/admin/coupons/${id}`, { method: 'PATCH', body: { active: !active } }).catch((e) => setErr(e.message));
    await load();
  }
  const input = 'min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base';
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 p-4"><h2 className="font-semibold">Coupons</h2><p className="text-sm text-slate-500">Create a code and give it to a customer. They enter it on the Stripe checkout page.</p></div>
      <form onSubmit={create} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Code<input className={input} placeholder="WELCOME20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></label>
        <label className="text-sm font-medium">Discount<select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="percent">% off</option><option value="amount">£ off</option></select></label>
        <label className="text-sm font-medium">Amount<input type="number" min="1" className={input} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></label>
        <label className="text-sm font-medium">Applies to<select className={input} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}><option value="once">First payment</option><option value="repeating">Several months</option><option value="forever">Every payment</option></select></label>
        {form.duration === 'repeating' && <label className="text-sm font-medium">Months<input type="number" min="1" max="36" className={input} value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} /></label>}
        <label className="text-sm font-medium">Max uses (optional)<input type="number" min="1" className={input} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} /></label>
        <label className="text-sm font-medium">Expires (optional)<input type="date" className={input} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
        <div className="flex items-end"><button className="min-h-11 w-full rounded-lg bg-brand-600 font-semibold text-white">Create coupon</button></div>
      </form>
      {err && <p role="alert" className="px-4 pb-3 text-sm text-rose-700">{err}</p>}
      <ul className="divide-y divide-slate-200 border-t border-slate-200">
        {(codes ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div><p className="font-mono font-semibold">{c.code}</p><p className="text-slate-500">{c.off}{c.duration ? ` · ${c.duration}` : ''} · used {c.timesRedeemed}{c.maxRedemptions ? ` of ${c.maxRedemptions}` : ''}</p></div>
            <button type="button" onClick={() => toggle(c.id, c.active)} className={`min-h-11 rounded-lg px-4 font-semibold ${c.active ? 'border border-rose-300 text-rose-700' : 'bg-emerald-600 text-white'}`}>{c.active ? 'Turn off' : 'Turn on'}</button>
          </li>
        ))}
        {codes && codes.length === 0 && <li className="p-4 text-sm text-slate-500">No coupons yet.</li>}
      </ul>
    </section>
  );
}

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

      <CouponSection />

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
