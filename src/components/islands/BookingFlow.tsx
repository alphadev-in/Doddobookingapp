// Public client booking: services → team → date & time → details & policy → deposit → confirmed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, money } from './api';
import { addDaysToDateKey, formatDateTime, toIcs } from '../../lib/time';

export interface PublicService { id: string; name: string; category: string; durationMin: number; priceCents: number; depositType: string; depositValue: number; }
export interface PublicStaff { id: string; name: string; role: string; color: string; serviceIds: string[]; }
export interface PublicBusiness { slug: string; name: string; timezone: string; currency: string; depositPolicy: string; cancellationWindowHours: number; }

interface Props { business: PublicBusiness; services: PublicService[]; staff: PublicStaff[]; todayKey: string; }
type Slot = { startAt: string; time: string; staffId: string };
type Confirmed = { id: string; manageToken: string; startAt: string; endAt: string; depositCents: number };

const STEP_LABELS = ['Services', 'Team', 'Date & time', 'Details', 'Payment'];

export default function BookingFlow({ business, services, staff, todayKey }: Props) {
  const [step, setStep] = useState(0);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string>('any');
  const [date, setDate] = useState(todayKey);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [client, setClient] = useState({ name: '', email: '', phone: '', notes: '' });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [intent, setIntent] = useState<{ id: string; mode: 'live' | 'sandbox'; clientSecret: string | null; publishableKey: string | null; stripeAccount: string | null } | null>(null);
  const paymentEl = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);

  const chosen = services.filter((s) => serviceIds.includes(s.id));
  const totalCents = chosen.reduce((n, s) => n + s.priceCents, 0);
  const depositCents = chosen.reduce((n, s) => n + (s.depositType === 'percent' ? Math.round((s.priceCents * s.depositValue) / 100) : s.depositType === 'fixed' ? s.depositValue : 0), 0);
  const totalMin = chosen.reduce((n, s) => n + s.durationMin, 0);
  const eligibleStaff = useMemo(() => staff.filter((m) => serviceIds.length && serviceIds.every((id) => m.serviceIds.includes(id))), [staff, serviceIds]);
  const dateChoices = Array.from({ length: 14 }, (_, i) => addDaysToDateKey(todayKey, i));

  // Load slots whenever the selection changes on the date/time step.
  useEffect(() => {
    if (step !== 2 || !serviceIds.length) return;
    setSlots(null);
    setSlot(null);
    const qs = new URLSearchParams({ slug: business.slug, serviceIds: serviceIds.join(','), staffId, date });
    api<{ slots: Slot[] }>(`/api/availability?${qs}`).then((d) => setSlots(d.slots)).catch((e) => { setError(e.message); setSlots([]); });
  }, [step, date, staffId, serviceIds.join(',')]);

  // Mount the Stripe Payment Element once we have a live client secret.
  useEffect(() => {
    if (step !== 4 || !intent || intent.mode !== 'live' || !intent.clientSecret) return;
    let cancelled = false;
    loadStripe().then((Stripe) => {
      if (cancelled || !Stripe || !paymentEl.current) return;
      stripeRef.current = Stripe(intent.publishableKey, intent.stripeAccount ? { stripeAccount: intent.stripeAccount } : undefined);
      elementsRef.current = stripeRef.current.elements({ clientSecret: intent.clientSecret });
      elementsRef.current.create('payment').mount(paymentEl.current);
    }).catch(() => setError('Could not load the payment form. Please try again.'));
    return () => { cancelled = true; };
  }, [step, intent]);

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setStaffId('any');
  }

  function validateDetails(): string | null {
    if (client.name.trim().length < 2) return 'Please enter your name.';
    if (!client.email.trim() && !client.phone.trim()) return 'Enter an email address or phone number so we can confirm.';
    if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) return 'Please check your email address.';
    if (!agreed) return 'Please accept the booking policy to continue.';
    return null;
  }

  async function goToPayment() {
    const v = validateDetails();
    if (v) return setError(v);
    setError(null);
    if (depositCents <= 0) return setStep(4);
    setBusy(true);
    try {
      const data = await api<any>('/api/payments/intent', { body: { businessSlug: business.slug, serviceIds } });
      setIntent(data);
      setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      let paymentIntentId: string | null = null;
      if (depositCents > 0 && intent) {
        if (intent.mode === 'live') {
          const { error: stripeErr, paymentIntent } = await stripeRef.current.confirmPayment({ elements: elementsRef.current, redirect: 'if_required' });
          if (stripeErr) throw new Error(stripeErr.message ?? 'Payment failed');
          paymentIntentId = paymentIntent?.id ?? intent.id;
        } else {
          paymentIntentId = intent.id; // sandbox: deposit is simulated
        }
      }
      const created = await api<Confirmed>('/api/bookings', {
        body: { businessSlug: business.slug, serviceIds, staffId: slot!.staffId, startAt: slot!.startAt, client: { name: client.name, email: client.email, phone: client.phone }, notes: client.notes, paymentIntentId },
      });
      setConfirmed(created);
    } catch (e: any) {
      setError(e.message);
      if (/no longer available/i.test(e.message)) setStep(2);
    } finally {
      setBusy(false);
    }
  }

  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  if (confirmed) return <Confirmation b={business} c={confirmed} chosen={chosen} staff={staff} slot={slot!} />;

  const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

  return (
    <div className="space-y-5">
      <ol className="flex gap-1" aria-label="Booking progress">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-slate-200'}`} />
            <span className={`mt-1 hidden text-xs sm:block ${i === step ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        {step === 0 && (
          <section className="space-y-4" aria-labelledby="s0">
            <h2 id="s0" className="text-lg font-semibold">Choose services</h2>
            <ul className="space-y-2">
              {services.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 ${on ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="checkbox" className="h-5 w-5 shrink-0" checked={on} onChange={() => toggleService(s.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{s.name}</span>
                        <span className="block text-sm text-slate-500">{s.durationMin} min{s.depositType !== 'none' ? ' · deposit required' : ''}</span>
                      </span>
                      <span className="font-semibold">{s.priceCents ? money(s.priceCents, business.currency) : 'Free'}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {services.length === 0 && <p className="text-sm text-slate-500">This business has no services online yet.</p>}
            {serviceIds.length > 0 && <p className="text-sm text-slate-600">{chosen.length} selected · {totalMin} min · {money(totalCents, business.currency)}</p>}
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4" aria-labelledby="s1">
            <h2 id="s1" className="text-lg font-semibold">Choose a team member</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <Choice selected={staffId === 'any'} onClick={() => setStaffId('any')} title="Any available" subtitle="We'll match you with the first free team member" />
              {eligibleStaff.map((m) => (
                <Choice key={m.id} selected={staffId === m.id} onClick={() => setStaffId(m.id)} title={m.name} subtitle={m.role} accent={m.color} />
              ))}
            </div>
            {eligibleStaff.length === 0 && <p className="text-sm text-amber-700">No team member offers every selected service. Go back and adjust your selection.</p>}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4" aria-labelledby="s2">
            <h2 id="s2" className="text-lg font-semibold">Pick a date & time</h2>
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {dateChoices.map((d) => {
                const label = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: business.timezone }).format(new Date(`${d}T12:00:00Z`));
                return (
                  <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)}
                    className={`min-h-14 min-w-[5.5rem] shrink-0 snap-start rounded-xl border px-3 text-sm font-medium ${date === d ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}>{label}</button>
                );
              })}
            </div>
            {slots === null && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-11" />)}</div>}
            {slots && slots.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
                No availability on this day. Try another date.
              </div>
            )}
            {slots && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button key={s.startAt} type="button" aria-pressed={slot?.startAt === s.startAt} onClick={() => setSlot(s)}
                    className={`min-h-11 rounded-lg border text-sm font-medium ${slot?.startAt === s.startAt ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-500'}`}>{s.time}</button>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4" aria-labelledby="s3">
            <h2 id="s3" className="text-lg font-semibold">Your details</h2>
            <label className="block text-sm font-medium">Full name<input required autoComplete="name" className={input} value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Email<input type="email" autoComplete="email" className={input} value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></label>
              <label className="block text-sm font-medium">Phone<input type="tel" autoComplete="tel" className={input} value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /></label>
            </div>
            <label className="block text-sm font-medium">Notes for the team (optional)<textarea rows={2} className={input} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} /></label>
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <p className="font-semibold">Booking policy</p>
              <p className="mt-1 text-slate-600">{business.depositPolicy}</p>
              <p className="mt-2 text-slate-600">Cancel or reschedule at least {business.cancellationWindowHours} hours before your appointment. Later changes may forfeit your deposit.</p>
            </div>
            <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />I have read and accept the booking policy.</label>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4" aria-labelledby="s4">
            <h2 id="s4" className="text-lg font-semibold">{depositCents > 0 ? 'Pay your deposit' : 'Confirm your booking'}</h2>
            {depositCents > 0 && intent?.mode === 'sandbox' && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Sandbox mode: this deposit is simulated. No payment is taken.</div>
            )}
            {depositCents > 0 && intent?.mode === 'live' && <div ref={paymentEl} className="min-h-40" />}
            <Summary chosen={chosen} currency={business.currency} slot={slot} staff={staff} staffId={staffId} depositCents={depositCents} timezone={business.timezone} />
          </section>
        )}

        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={back} disabled={step === 0 || busy} className="min-h-11 rounded-lg px-4 text-sm font-medium text-slate-600 disabled:opacity-0">Back</button>
          {step === 0 && <NextBtn disabled={!serviceIds.length} onClick={() => setStep(1)} />}
          {step === 1 && <NextBtn disabled={!staffId} onClick={() => setStep(2)} />}
          {step === 2 && <NextBtn disabled={!slot} onClick={() => setStep(3)} />}
          {step === 3 && <NextBtn busy={busy} label={depositCents > 0 ? 'Continue to deposit' : 'Review & confirm'} onClick={goToPayment} />}
          {step === 4 && <NextBtn busy={busy} label={depositCents > 0 ? `Pay ${money(depositCents, business.currency)} & book` : 'Confirm booking'} onClick={confirm} />}
        </div>
      </div>
    </div>
  );
}

function NextBtn({ onClick, disabled, busy, label = 'Continue' }: { onClick: () => void; disabled?: boolean; busy?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy}
      className="min-h-11 rounded-lg bg-brand-600 px-6 font-semibold text-white disabled:opacity-40">{busy ? 'Please wait…' : label}</button>
  );
}

function Choice({ selected, onClick, title, subtitle, accent }: { selected: boolean; onClick: () => void; title: string; subtitle: string; accent?: string }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={`flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left ${selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
      <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: accent ?? '#c7d2fe' }} aria-hidden="true" />
      <span><span className="block font-medium">{title}</span><span className="block text-sm text-slate-500">{subtitle}</span></span>
    </button>
  );
}

function Summary({ chosen, currency, slot, staff, staffId, depositCents, timezone }: any) {
  const who = staffId === 'any' ? 'Any available' : staff.find((s: any) => s.id === staffId)?.name;
  return (
    <dl className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-slate-500">Services</dt><dd className="text-right font-medium">{chosen.map((s: any) => s.name).join(', ')}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500">With</dt><dd className="font-medium">{who}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-slate-500">When</dt><dd className="font-medium">{slot ? formatDateTime(slot.startAt, timezone) : ''}</dd></div>
      <div className="flex justify-between gap-3 border-t border-slate-200 pt-2"><dt className="text-slate-500">Total</dt><dd className="font-semibold">{money(chosen.reduce((n: number, s: any) => n + s.priceCents, 0), currency)}</dd></div>
      {depositCents > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-500">Deposit today</dt><dd className="font-semibold text-brand-700">{money(depositCents, currency)}</dd></div>}
    </dl>
  );
}

function Confirmation({ b, c, chosen, staff, slot }: { b: PublicBusiness; c: Confirmed; chosen: PublicService[]; staff: PublicStaff[]; slot: Slot }) {
  const who = staff.find((s) => s.id === slot.staffId)?.name ?? 'Your team';
  const manageHref = `/booking/${c.id}?t=${c.manageToken}`;
  function downloadIcs() {
    const ics = toIcs({
      uid: c.id, startIso: c.startAt, endIso: c.endAt, summary: `${chosen.map((s) => s.name).join(' + ')} at ${b.name}`,
      description: `With ${who}. Manage your booking: ${window.location.origin}${manageHref}`, location: b.name,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booking.ics';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200" role="status">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700" aria-hidden="true">✓</div>
      <h2 className="mt-4 text-xl font-semibold">Booking confirmed</h2>
      <p className="mt-1 text-slate-600">{formatDateTime(c.startAt, b.timezone)} with {who}</p>
      <p className="mt-1 text-sm text-slate-500">{chosen.map((s) => s.name).join(', ')}</p>
      {c.depositCents > 0 && <p className="mt-3 text-sm text-slate-600">Deposit of {money(c.depositCents, b.currency)} received.</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={downloadIcs} className="min-h-11 rounded-lg border border-slate-300 font-medium">Add to calendar (.ics)</button>
        <a href={manageHref} className="flex min-h-11 items-center justify-center rounded-lg bg-brand-600 font-semibold text-white">Manage booking</a>
      </div>
      <p className="mt-6 text-xs text-slate-500">{b.depositPolicy}</p>
    </div>
  );
}

// Load Stripe.js once, only when a live deposit needs it.
let stripeLoading: Promise<any> | null = null;
function loadStripe(): Promise<any> {
  if ((window as any).Stripe) return Promise.resolve((window as any).Stripe);
  if (!stripeLoading) {
    stripeLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => resolve((window as any).Stripe);
      s.onerror = () => reject(new Error('stripe load failed'));
      document.head.appendChild(s);
    });
  }
  return stripeLoading;
}
