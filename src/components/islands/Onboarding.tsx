// Four-step onboarding wizard. Creates the business, its policies, first services and team members.
import { useMemo, useState } from 'react';
import { api } from './api';
import { defaultHours } from '../../lib/defaults';
import type { WeekHours } from '../../lib/types';

interface Props { defaultTimezone: string; defaultCurrency: string; }
type Svc = { name: string; durationMin: number; bufferMin: number; priceCents: number; category: string };
type Member = { name: string; role: string; color: string };

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEPS = ['Business', 'Hours & policy', 'Services', 'Team'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899'];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export default function Onboarding({ defaultTimezone, defaultCurrency }: Props) {
  const [step, setStep] = useState(0);
  const [biz, setBiz] = useState({ name: '', slug: '', email: '', phone: '', timezone: defaultTimezone, currency: defaultCurrency });
  const [slugTouched, setSlugTouched] = useState(false);
  const [hours, setHours] = useState<WeekHours>(defaultHours());
  const [policy, setPolicy] = useState({ depositPolicy: 'A deposit secures your booking. Deposits are non-refundable inside the cancellation window.', cancellationWindowHours: 24, lateCancelDepositForfeit: true });
  const [services, setServices] = useState<Svc[]>([{ name: 'Haircut', category: 'General', durationMin: 45, bufferMin: 10, priceCents: 3500 }]);
  const [team, setTeam] = useState<Member[]>([{ name: '', role: 'Stylist', color: COLORS[0] }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stepErrors = useMemo(() => {
    const e: string[] = [];
    if (step === 0) {
      if (biz.name.trim().length < 2) e.push('Enter your business name.');
      if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(biz.slug)) e.push('Booking link: use 3–40 lowercase letters, numbers or hyphens.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(biz.email)) e.push('Enter a valid contact email.');
    }
    if (step === 2) services.forEach((s, i) => { if (s.name.trim().length < 2) e.push(`Service ${i + 1} needs a name.`); if (!(s.durationMin >= 5)) e.push(`Service ${i + 1} needs a duration of at least 5 minutes.`); });
    if (step === 3) team.forEach((m, i) => { if (m.name.trim().length < 2) e.push(`Team member ${i + 1} needs a name.`); });
    return e;
  }, [step, biz, services, team]);

  async function launch() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/businesses', { body: biz });
      await api('/api/business', { method: 'PATCH', body: { hours, ...policy } });
      const created: { id: string }[] = [];
      for (const s of services) created.push(await api<{ id: string }>('/api/services', { body: { ...s, depositType: 'none', depositValue: 0 } }));
      for (const m of team) {
        await api('/api/staff', { body: { name: m.name, role: m.role, color: m.color, active: true, serviceIds: created.map((c) => c.id), hours } });
      }
      // Direct newly onboarded users straight into Stripe Checkout for subscription
      try {
        const { url } = await api<{ url: string }>('/api/billing/checkout', { body: {} });
        if (url) {
          window.location.href = url;
          return;
        }
      } catch (_) {
        // Fall back to billing page if checkout creation fails or keys are not ready
      }
      window.location.href = '/dashboard/billing?welcome=1';
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

  return (
    <div className="mx-auto max-w-xl">
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="text-center">
            <div className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${i <= step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'}`} aria-current={i === step ? 'step' : undefined}>{i + 1}</div>
            <span className="hidden text-xs text-slate-600 sm:block">{label}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        {step === 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Business details</h2>
            <label className="block text-sm font-medium">Business name<input className={input} value={biz.name} onChange={(e) => { const name = e.target.value; setBiz({ ...biz, name, slug: slugTouched ? biz.slug : slugify(name) }); }} /></label>
            <label className="block text-sm font-medium">Booking link
              <div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-brand-500/30">
                <span className="pl-3 text-sm text-slate-500">…/book/</span>
                <input className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2.5 text-base outline-none" value={biz.slug} onChange={(e) => { setSlugTouched(true); setBiz({ ...biz, slug: slugify(e.target.value) }); }} aria-describedby="slug-hint" />
              </div>
              <span id="slug-hint" className="mt-1 block text-xs text-slate-500">Share this with clients. Lowercase letters, numbers and hyphens.</span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Contact email<input type="email" className={input} value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} /></label>
              <label className="block text-sm font-medium">Phone<input type="tel" className={input} value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></label>
              <label className="block text-sm font-medium">Timezone<input className={input} value={biz.timezone} onChange={(e) => setBiz({ ...biz, timezone: e.target.value })} /></label>
              <label className="block text-sm font-medium">Currency<input className={input} maxLength={3} value={biz.currency} onChange={(e) => setBiz({ ...biz, currency: e.target.value.toUpperCase() })} /></label>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold">Operating hours</h2>
            <div className="space-y-2">
              {DAYS.map((d, i) => {
                const h = hours[String(i)];
                return (
                  <div key={d} className="grid grid-cols-[3.5rem_1fr] items-center gap-2 sm:grid-cols-[3.5rem_auto_1fr_1fr]">
                    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="h-5 w-5" checked={h.open} onChange={(e) => setHours({ ...hours, [i]: { ...h, open: e.target.checked } })} />{d}</label>
                    {h.open ? (
                      <>
                        <input type="time" aria-label={`${d} opens`} className="min-h-11 rounded-lg border border-slate-300 px-2" value={h.start} onChange={(e) => setHours({ ...hours, [i]: { ...h, start: e.target.value } })} />
                        <input type="time" aria-label={`${d} closes`} className="min-h-11 rounded-lg border border-slate-300 px-2" value={h.end} onChange={(e) => setHours({ ...hours, [i]: { ...h, end: e.target.value } })} />
                      </>
                    ) : <span className="col-span-2 text-sm text-slate-400">Closed</span>}
                  </div>
                );
              })}
            </div>
            <label className="block text-sm font-medium">Deposit & cancellation policy<textarea rows={3} className={input} value={policy.depositPolicy} onChange={(e) => setPolicy({ ...policy, depositPolicy: e.target.value })} /></label>
            <label className="block text-sm font-medium">Cancellation window (hours before appointment)
              <input type="number" min={0} max={720} className={input} value={policy.cancellationWindowHours} onChange={(e) => setPolicy({ ...policy, cancellationWindowHours: Number(e.target.value) })} />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={policy.lateCancelDepositForfeit} onChange={(e) => setPolicy({ ...policy, lateCancelDepositForfeit: e.target.checked })} />Keep the deposit for late cancellations and no-shows</label>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Add your first services</h2>
            {services.map((s, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between"><span className="text-sm font-semibold">Service {i + 1}</span>
                  {services.length > 1 && <button type="button" className="min-h-11 px-2 text-sm text-rose-600" onClick={() => setServices(services.filter((_, j) => j !== i))}>Remove</button>}</div>
                <input aria-label="Service name" placeholder="Name" className={input} value={s.name} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs font-medium text-slate-600">Minutes<input type="number" min={5} className={input} value={s.durationMin} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, durationMin: Number(e.target.value) } : x))} /></label>
                  <label className="text-xs font-medium text-slate-600">Buffer<input type="number" min={0} className={input} value={s.bufferMin} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, bufferMin: Number(e.target.value) } : x))} /></label>
                  <label className="text-xs font-medium text-slate-600">Price (pence)<input type="number" min={0} className={input} value={s.priceCents} onChange={(e) => setServices(services.map((x, j) => j === i ? { ...x, priceCents: Number(e.target.value) } : x))} /></label>
                </div>
              </div>
            ))}
            <button type="button" className="min-h-11 w-full rounded-lg border border-dashed border-slate-400 text-sm font-medium" onClick={() => setServices([...services, { name: '', category: 'General', durationMin: 30, bufferMin: 0, priceCents: 0 }])}>+ Add another service</button>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Add your team</h2>
            <p className="text-sm text-slate-500">Every team member starts with all services and your opening hours. Adjust later in Team.</p>
            {team.map((m, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <input aria-label="Team member name" placeholder="Name" className={input} value={m.name} onChange={(e) => setTeam(team.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Role" placeholder="Role" className={input} value={m.role} onChange={(e) => setTeam(team.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
                  <div className="flex items-center gap-2" role="radiogroup" aria-label="Calendar colour">
                    {COLORS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={m.color === c} aria-label={`Colour ${c}`} onClick={() => setTeam(team.map((x, j) => j === i ? { ...x, color: c } : x))}
                        className={`h-8 w-8 rounded-full ring-offset-2 ${m.color === c ? 'ring-2 ring-slate-800' : ''}`} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="min-h-11 w-full rounded-lg border border-dashed border-slate-400 text-sm font-medium" onClick={() => setTeam([...team, { name: '', role: 'Stylist', color: COLORS[team.length % COLORS.length] }])}>+ Add team member</button>
          </section>
        )}

        {stepErrors.length > 0 && <ul className="mt-4 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-800" role="status">{stepErrors.map((e) => <li key={e}>• {e}</li>)}</ul>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" disabled={step === 0 || busy} onClick={() => setStep(step - 1)} className="min-h-11 rounded-lg px-4 text-sm font-medium text-slate-600 disabled:opacity-0">Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={stepErrors.length > 0} onClick={() => setStep(step + 1)} className="min-h-11 rounded-lg bg-brand-600 px-6 font-semibold text-white disabled:opacity-40">Continue</button>
          ) : (
            <button type="button" disabled={stepErrors.length > 0 || busy} onClick={launch} className="min-h-11 rounded-lg bg-emerald-600 px-6 font-semibold text-white disabled:opacity-40">{busy ? 'Launching…' : 'Launch dashboard'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
