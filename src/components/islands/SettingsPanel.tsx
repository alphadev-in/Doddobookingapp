// Settings tabs: profile & booking link, hours & policy, payments status, notification toggles and templates.
import { useState } from 'react';
import { api } from './api';
import { defaultHours } from '../../lib/defaults';
import type { Business, WeekHours } from '../../lib/types';

const TABS = ['Profile', 'Hours & policy', 'Booking', 'Payments', 'Notifications'] as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props { business: Business; paymentsMode: 'live' | 'sandbox'; origin: string; }

export default function SettingsPanel({ business, paymentsMode, origin }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Profile');
  const [b, setB] = useState<Business>(business);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(patch: Partial<Business>) {
    setBusy(true);
    setStatus(null);
    try {
      const saved = await api<Business>('/api/business', { method: 'PATCH', body: patch });
      setB(saved);
      setStatus({ kind: 'ok', msg: 'Saved' });
    } catch (e: any) {
      setStatus({ kind: 'err', msg: e.message });
    } finally {
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-brand-500/30';
  const bookingUrl = `${origin}/book/${b.slug}`;

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <div role="tablist" aria-label="Settings sections" className="flex gap-2 overflow-x-auto md:flex-col">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setStatus(null); }}
            className={`min-h-11 shrink-0 rounded-lg px-4 text-left text-sm font-medium ${tab === t ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>{t}</button>
        ))}
      </div>

      <div className="min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        {tab === 'Profile' && (
          <ProfileTab b={b} input={input} busy={busy} onSave={save} bookingUrl={bookingUrl} />
        )}
        {tab === 'Hours & policy' && (
          <HoursTab b={b} input={input} busy={busy} onSave={save} />
        )}
        {tab === 'Booking' && (
          <BookingTab b={b} busy={busy} onSave={save} />
        )}
        {tab === 'Payments' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Payments</h2>
            <div className={`rounded-xl p-4 text-sm ${paymentsMode === 'live' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
              {paymentsMode === 'live'
                ? <>Stripe is <strong>live</strong>. Deposits are charged to your account.</>
                : <>Sandbox mode. No <code>STRIPE_SECRET_KEY</code> is set, so deposits are simulated and no money moves.</>}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Stripe Connect account</dt><dd className="font-medium">{b.stripeAccountId ?? 'Not connected'}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3"><dt className="text-slate-500">Currency</dt><dd className="font-medium">{b.currency}</dd></div>
            </dl>
            <p className="text-sm text-slate-600">To take real deposits, add the keys listed in the README, then connect a Stripe Connect account and save its id (<code>acct_…</code>) below.</p>
            <label className="block text-sm font-medium">Stripe Connect account id
              <input className={input} placeholder="acct_…" defaultValue={b.stripeAccountId ?? ''} onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (b.stripeAccountId ?? '')) save({ stripeAccountId: v || null } as any);
              }} />
            </label>
          </section>
        )}
        {tab === 'Notifications' && (
          <NotificationsTab b={b} input={input} busy={busy} onSave={save} />
        )}
        {status && <p role="status" className={`mt-4 text-sm ${status.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{status.msg}</p>}
      </div>
    </div>
  );
}

function ProfileTab({ b, input, busy, onSave, bookingUrl }: { b: Business; input: string; busy: boolean; onSave: (p: Partial<Business>) => void; bookingUrl: string }) {
  const [f, setF] = useState({
    name: b.name, about: b.about ?? '', email: b.email, phone: b.phone, website: b.website ?? '',
    addressLine1: b.addressLine1 ?? '', addressLine2: b.addressLine2 ?? '', city: b.city ?? '', postcode: b.postcode ?? '',
    timezone: b.timezone, currency: b.currency, logoUrl: b.logoUrl ?? '', coverUrl: b.coverUrl ?? '',
  });
  const [picErr, setPicErr] = useState<string | null>(null);
  const pick = (key: 'logoUrl' | 'coverUrl', max: number) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPicErr(null);
    try {
      const { resizeToDataUrl } = await import('./imageUpload');
      setF((prev) => ({ ...prev, [key]: '' }));
      const url = await resizeToDataUrl(file, max);
      setF((prev) => ({ ...prev, [key]: url }));
    } catch (err: any) {
      setPicErr(err.message);
    }
  };
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div>
        <h2 className="text-lg font-semibold">Business profile</h2>
        <p className="text-sm text-slate-600">This is what clients see on your booking page.</p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Pictures</legend>
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div>
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {f.logoUrl ? <img src={f.logoUrl} alt="Business logo preview" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">No logo</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50">Upload logo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick('logoUrl', 600)} />
              </label>
              {f.logoUrl && <button type="button" onClick={() => setF({ ...f, logoUrl: '' })} className="min-h-11 px-2 text-sm text-rose-600">Remove</button>}
            </div>
          </div>
          <div>
            <div className="flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {f.coverUrl ? <img src={f.coverUrl} alt="Cover photo preview" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">No cover photo (recommended: wide shop or team photo)</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50">Upload cover photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick('coverUrl', 1400)} />
              </label>
              {f.coverUrl && <button type="button" onClick={() => setF({ ...f, coverUrl: '' })} className="min-h-11 px-2 text-sm text-rose-600">Remove</button>}
            </div>
          </div>
        </div>
        {picErr && <p role="alert" className="text-sm text-rose-700">{picErr}</p>}
        <p className="text-xs text-slate-500">JPEG, PNG or WebP. Pictures are resized automatically.</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">Business name<input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="block text-sm font-medium sm:col-span-2">About your business<textarea rows={3} maxLength={600} className={input} value={f.about} onChange={(e) => setF({ ...f, about: e.target.value })} placeholder="Tell clients what makes you special" /></label>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Address</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium sm:col-span-2">Address line 1<input className={input} value={f.addressLine1} onChange={(e) => setF({ ...f, addressLine1: e.target.value })} autoComplete="address-line1" /></label>
          <label className="block text-sm font-medium sm:col-span-2">Address line 2 (optional)<input className={input} value={f.addressLine2} onChange={(e) => setF({ ...f, addressLine2: e.target.value })} autoComplete="address-line2" /></label>
          <label className="block text-sm font-medium">Town or city<input className={input} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} autoComplete="address-level2" /></label>
          <label className="block text-sm font-medium">Postcode<input className={input} value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value })} autoComplete="postal-code" /></label>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Email<input type="email" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
          <label className="block text-sm font-medium">Phone<input type="tel" className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
          <label className="block text-sm font-medium sm:col-span-2">Website (optional)<input type="url" className={input} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></label>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Timezone<input className={input} value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></label>
        <label className="block text-sm font-medium">Currency<input className={input} maxLength={3} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></label>
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-medium">Your booking link</p>
        <a href={`/book/${b.slug}`} className="break-all text-sm text-brand-700 hover:underline">{bookingUrl}</a>
        <p className="mt-1 text-xs text-slate-500">The link stays the same, so existing bookings keep working.</p>
      </div>

      <button disabled={busy} className="min-h-11 rounded-lg bg-brand-600 px-5 font-semibold text-white disabled:opacity-60">Save profile</button>
    </form>
  );
}

function HoursTab({ b, input, busy, onSave }: { b: Business; input: string; busy: boolean; onSave: (p: Partial<Business>) => void }) {
  const [hours, setHours] = useState<WeekHours>(b.hours ?? defaultHours());
  const [policy, setPolicy] = useState({ depositPolicy: b.depositPolicy, cancellationWindowHours: b.cancellationWindowHours, lateCancelDepositForfeit: b.lateCancelDepositForfeit });
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSave({ hours, ...policy }); }}>
      <h2 className="text-lg font-semibold">Opening hours</h2>
      <div className="space-y-2">
        {DAYS.map((d, i) => {
          const h = hours[String(i)];
          return (
            <div key={d} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 sm:grid-cols-[3.5rem_auto_1fr_1fr]">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-5 w-5" checked={h.open} onChange={(e) => setHours({ ...hours, [i]: { ...h, open: e.target.checked } })} />{d}</label>
              {h.open ? (<>
                <input type="time" aria-label={`${d} opens`} className="min-h-11 rounded-lg border border-slate-300 px-2" value={h.start} onChange={(e) => setHours({ ...hours, [i]: { ...h, start: e.target.value } })} />
                <input type="time" aria-label={`${d} closes`} className="min-h-11 rounded-lg border border-slate-300 px-2" value={h.end} onChange={(e) => setHours({ ...hours, [i]: { ...h, end: e.target.value } })} />
              </>) : <span className="col-span-2 text-sm text-slate-400">Closed</span>}
            </div>
          );
        })}
      </div>
      <h2 className="pt-2 text-lg font-semibold">Deposit & cancellation policy</h2>
      <label className="block text-sm font-medium">Policy shown at checkout<textarea rows={3} className={input} value={policy.depositPolicy} onChange={(e) => setPolicy({ ...policy, depositPolicy: e.target.value })} /></label>
      <label className="block text-sm font-medium">Cancellation window (hours)<input type="number" min={0} max={720} className={input} value={policy.cancellationWindowHours} onChange={(e) => setPolicy({ ...policy, cancellationWindowHours: Number(e.target.value) })} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={policy.lateCancelDepositForfeit} onChange={(e) => setPolicy({ ...policy, lateCancelDepositForfeit: e.target.checked })} />Keep deposit on late cancellations and no-shows</label>
      <button disabled={busy} className="min-h-11 rounded-lg bg-brand-600 px-5 font-semibold text-white disabled:opacity-60">Save hours & policy</button>
    </form>
  );
}

function NotificationsTab({ b, input, busy, onSave }: { b: Business; input: string; busy: boolean; onSave: (p: Partial<Business>) => void }) {
  const [n, setN] = useState(b.notifications);
  const [t, setT] = useState(b.templates);
  const rows = [
    { key: 'confirmation', label: 'Booking confirmation', hint: 'Sent immediately after a booking.' },
    { key: 'reminder24h', label: '24-hour reminder', hint: 'Needs a scheduled job calling sendReminders().' },
    { key: 'cancellation', label: 'Cancellation notice', hint: 'Sent when a booking is cancelled.' },
  ] as const;
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); onSave({ notifications: n, templates: t }); }}>
      <h2 className="text-lg font-semibold">Automated messages</h2>
      {rows.map((r) => (
        <fieldset key={r.key} className="space-y-2 rounded-xl border border-slate-200 p-4">
          <legend className="sr-only">{r.label}</legend>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            {r.label}
            <input type="checkbox" role="switch" className="h-6 w-11" checked={n[r.key]} onChange={(e) => setN({ ...n, [r.key]: e.target.checked })} aria-label={`Enable ${r.label}`} />
          </label>
          <p className="text-xs text-slate-500">{r.hint}</p>
          <label className="block text-sm">Template
            <textarea rows={2} className={input} value={t[r.key]} onChange={(e) => setT({ ...t, [r.key]: e.target.value })} />
          </label>
        </fieldset>
      ))}
      <p className="text-xs text-slate-500">Placeholders: {'{{name}}'}, {'{{service}}'}, {'{{business}}'}, {'{{time}}'}</p>
      <button disabled={busy} className="min-h-11 rounded-lg bg-brand-600 px-5 font-semibold text-white disabled:opacity-60">Save notifications</button>
    </form>
  );
}

function BookingTab({ b, busy, onSave }: { b: Business; busy: boolean; onSave: (p: Partial<Business>) => void }) {
  const [paymentsEnabled, setPaymentsEnabled] = useState(b.paymentsEnabled ?? true);
  const [slotIntervalMin, setSlotIntervalMin] = useState<number>(b.slotIntervalMin ?? 15);
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSave({ paymentsEnabled, slotIntervalMin } as any); }}>
      <h2 className="text-lg font-semibold">Online booking</h2>

      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Start times</legend>
        <p className="text-sm text-slate-600">How often clients can pick a start time. Shorter steps give clients more choice.</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Time slot length">
          {[5, 10, 15, 20, 30, 60].map((m) => (
            <button key={m} type="button" role="radio" aria-checked={slotIntervalMin === m} onClick={() => setSlotIntervalMin(m)}
              className={`min-h-11 rounded-lg border text-sm font-semibold ${slotIntervalMin === m ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20' : 'border-slate-300 hover:bg-slate-50'}`}>
              {m} min
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Deposits & payment page</legend>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Take payment at booking</span>
            <span className="block text-sm text-slate-600">{paymentsEnabled ? 'Clients see the payment step when a service needs a deposit.' : 'No payment step. Clients book without paying, and you collect payment in person.'}</span>
          </span>
          <input type="checkbox" role="switch" className="h-6 w-11 shrink-0" checked={paymentsEnabled} onChange={(e) => setPaymentsEnabled(e.target.checked)} aria-label="Take payment at booking" />
        </label>
      </fieldset>

      <button disabled={busy} className="min-h-11 rounded-lg bg-brand-600 px-5 font-semibold text-white disabled:opacity-60">Save booking settings</button>
    </form>
  );
}
