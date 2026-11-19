// Client self-service: reschedule to another open slot, or cancel (policy shown before confirming).
import { useEffect, useState } from 'react';
import { api, money } from './api';
import { addDaysToDateKey, formatDateTime, toIcs } from '../../lib/time';

interface View {
  id: string; status: string; startAt: string; endAt: string; paymentStatus: string; depositCents: number; priceCents: number;
  currency: string; business: { name: string; slug: string; timezone: string; email: string; phone: string };
  services: string[]; staffName: string; clientName: string; policy: { late: boolean; hoursUntil: number; forfeitsDeposit: boolean; windowHours: number; text: string };
  serviceIds?: string[]; staffId?: string | null;
}
interface Props { booking: View; token: string; serviceIds: string[]; staffId: string | null; todayKey: string; }

export default function ManageBooking({ booking: initial, token, serviceIds, staffId, todayKey }: Props) {
  const [b, setB] = useState(initial);
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel' | 'done'>('view');
  const [date, setDate] = useState(todayKey);
  const [slots, setSlots] = useState<{ startAt: string; time: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isCancelled = b.status === 'cancelled';
  const canChange = b.status === 'confirmed' && Date.parse(b.startAt) > Date.now();

  useEffect(() => {
    if (mode !== 'reschedule') return;
    setSlots(null);
    const qs = new URLSearchParams({ slug: b.business.slug, serviceIds: serviceIds.join(','), staffId: staffId ?? 'any', date });
    api<{ slots: { startAt: string; time: string }[] }>(`/api/availability?${qs}`).then((d) => setSlots(d.slots)).catch((e) => { setError(e.message); setSlots([]); });
  }, [mode, date]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ status: string; paymentStatus: string }>(`/api/bookings/${b.id}`, { method: 'PATCH', body: { token, action: 'cancel' } });
      setB({ ...b, status: res.status, paymentStatus: res.paymentStatus });
      setMode('done');
      setMessage('Your booking has been cancelled.');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function reschedule(startAt: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ startAt: string; endAt: string }>(`/api/bookings/${b.id}`, { method: 'PATCH', body: { token, action: 'reschedule', startAt } });
      setB({ ...b, startAt: res.startAt, endAt: res.endAt });
      setMode('done');
      setMessage('Your appointment has been moved.');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  function downloadIcs() {
    const ics = toIcs({ uid: b.id, startIso: b.startAt, endIso: b.endAt, summary: `${b.services.join(' + ')} at ${b.business.name}`, description: `With ${b.staffName}`, location: b.business.name });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'booking.ics'; a.click();
    URL.revokeObjectURL(url);
  }

  const dateChoices = Array.from({ length: 14 }, (_, i) => addDaysToDateKey(todayKey, i));
  const tz = b.business.timezone;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <p className="text-sm text-slate-500">{b.business.name}</p>
        <h2 className="mt-1 text-xl font-semibold">{formatDateTime(b.startAt, tz)}</h2>
        <p className="mt-1 text-slate-600">{b.services.join(', ')} · with {b.staffName}</p>
        <p className="mt-1 text-sm">
          Status: <span className="font-medium capitalize">{b.status.replace('_', ' ')}</span>
          {b.depositCents > 0 && <> · Deposit {money(b.depositCents, b.currency)} ({b.paymentStatus.replace('_', ' ')})</>}
        </p>
        {message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      </div>

      {mode === 'view' && !isCancelled && (
        <div className="grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={downloadIcs} className="min-h-11 rounded-lg border border-slate-300 bg-white font-medium">Add to calendar</button>
          <button type="button" disabled={!canChange} onClick={() => setMode('reschedule')} className="min-h-11 rounded-lg bg-brand-600 font-semibold text-white disabled:opacity-40">Reschedule</button>
          <button type="button" disabled={!canChange} onClick={() => setMode('cancel')} className="min-h-11 rounded-lg border border-rose-300 bg-white font-semibold text-rose-700 disabled:opacity-40">Cancel</button>
        </div>
      )}
      {!canChange && !isCancelled && b.status === 'confirmed' && <p className="text-sm text-slate-500">This appointment has already started, so it can no longer be changed online. Contact {b.business.name} if you need help.</p>}

      {mode === 'reschedule' && (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="resch">
          <h3 id="resch" className="font-semibold">Choose a new time</h3>
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {dateChoices.map((d) => (
              <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)}
                className={`min-h-14 min-w-[5.5rem] shrink-0 snap-start rounded-xl border px-3 text-sm font-medium ${date === d ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                {new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(new Date(`${d}T12:00:00Z`))}
              </button>
            ))}
          </div>
          {slots === null && <div className="skeleton h-24" aria-busy="true" />}
          {slots?.length === 0 && <p className="text-sm text-slate-500">No free times on this day.</p>}
          {slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button key={s.startAt} type="button" disabled={busy} onClick={() => reschedule(s.startAt)} className="min-h-11 rounded-lg border border-slate-300 text-sm font-medium hover:border-brand-500 disabled:opacity-50">{s.time}</button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setMode('view')} className="min-h-11 text-sm text-slate-600">Back</button>
        </section>
      )}

      {mode === 'cancel' && (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6" aria-labelledby="canc">
          <h3 id="canc" className="font-semibold">Cancel this appointment?</h3>
          {b.policy.late ? (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              <p className="font-semibold">Late cancellation policy applies</p>
              <p className="mt-1">You are inside the {b.policy.windowHours}-hour window.{b.policy.forfeitsDeposit ? ` Your ${money(b.depositCents, b.currency)} deposit will be kept.` : ' Your deposit will be refunded.'}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Free cancellation</p>
              <p className="mt-1">You are outside the {b.policy.windowHours}-hour window.{b.depositCents > 0 ? ' Your deposit will be refunded.' : ''}</p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setMode('view')} className="min-h-11 rounded-lg border border-slate-300 font-medium">Keep booking</button>
            <button type="button" disabled={busy} onClick={cancel} className="min-h-11 rounded-lg bg-rose-600 font-semibold text-white disabled:opacity-60">{busy ? 'Cancelling…' : 'Yes, cancel'}</button>
          </div>
        </section>
      )}

      {error && mode !== 'cancel' && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {isCancelled && <p className="text-sm text-slate-600">This booking is cancelled. <a className="text-brand-700 underline" href={`/book/${b.business.slug}`}>Book again</a></p>}
      <p className="text-xs text-slate-500">{b.policy.text}</p>
    </div>
  );
}
