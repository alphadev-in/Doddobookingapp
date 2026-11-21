// Interactive appointment calendar. Day view = one column per team member (swipe horizontally on mobile);
// week view = seven days for one selected team member. Click an empty slot to create; click a block to manage.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Drawer from './Drawer';
import { api, money } from './api';
import { addDaysToDateKey, dateKeyInTz, formatMoney, timeInTz, zonedToUtcMs } from '../../lib/time';
import type { Appointment, Service, Staff } from '../../lib/types';

interface Props { timezone: string; currency: string; todayKey: string; }

const START_H = 7;
const END_H = 21;
const PX_PER_MIN = 1.1; // 66px per hour
const SNAP = 15;
const COL_W_MOBILE = 150;
const COL_W_DESKTOP = 200;

const STATUS_STYLE: Record<Appointment['status'], string> = {
  confirmed: 'bg-white',
  completed: 'bg-emerald-50',
  cancelled: 'bg-slate-100 opacity-60 line-through',
  no_show: 'bg-rose-50',
};
const PAYMENT_BADGE: Record<string, { label: string; cls: string } | undefined> = {
  deposit_paid: { label: 'Deposit paid', cls: 'bg-sky-100 text-sky-800' },
  paid: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-800' },
  unpaid: { label: 'Pay on site', cls: 'bg-amber-100 text-amber-800' },
  refunded: { label: 'Refunded', cls: 'bg-slate-200 text-slate-700' },
  forfeited: { label: 'Deposit kept', cls: 'bg-rose-100 text-rose-800' },
};

const minutesOfDay = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toIso = (date: string, hhmm: string, tz: string) => new Date(zonedToUtcMs(date, hhmm, tz)).toISOString();
const hhmmOf = (iso: string, tz: string) => timeInTz(iso, tz);

export default function Calendar({ timezone, currency, todayKey }: Props) {
  const [view, setView] = useState<'day' | 'week'>('week');
  const [date, setDate] = useState(todayKey);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const go = (next: string, d: 'next' | 'prev') => { setDir(d); setDate(next); };
  const [staffId, setStaffId] = useState<string>('');
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [create, setCreate] = useState<{ staffId: string | null; startHHmm: string; date: string; kind: 'walkin' | 'booking' | 'block' } | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const days = useMemo(() => (view === 'day' ? [date] : Array.from({ length: 7 }, (_, i) => addDaysToDateKey(date, i))), [view, date]);
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);
  const columns = view === 'day' ? activeStaff : activeStaff.filter((s) => !staffId || s.id === staffId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = toIso(days[0], '00:00', timezone);
      const to = toIso(addDaysToDateKey(days[days.length - 1], 1), '00:00', timezone);
      const data = await api<{ appointments: Appointment[] }>(`/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      setAppts(data.appointments);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days, timezone]);

  useEffect(() => {
    Promise.all([api<{ services: Service[] }>('/api/services'), api<{ staff: Staff[] }>('/api/staff')])
      .then(([s, st]) => {
        setServices(s.services);
        setStaff(st.staff);
        if (!staffId && st.staff[0]) setStaffId(st.staff.find((x) => x.active)?.id ?? st.staff[0].id);
      })
      .catch((e) => setError(e.message));
    // Quick action "+ New Appointment" from the dashboard opens the create drawer.
    if (new URLSearchParams(window.location.search).has('new')) setCreate({ staffId: null, startHHmm: '10:00', date: todayKey, kind: 'walkin' });
  }, []);

  useEffect(() => { load(); }, [load]);

  const colW = typeof window !== 'undefined' && window.innerWidth >= 768 ? COL_W_DESKTOP : COL_W_MOBILE;
  const totalH = (END_H - START_H) * 60 * PX_PER_MIN;
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);

  const apptsFor = (day: string, sid: string | null) =>
    appts.filter((a) => dateKeyInTz(a.startAt, timezone) === day && (a.kind === 'block' ? a.staffId === null || a.staffId === sid : a.staffId === sid));

  function onGridClick(e: React.MouseEvent<HTMLDivElement>, day: string, sid: string | null) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = Math.round((e.clientY - rect.top) / PX_PER_MIN / SNAP) * SNAP + START_H * 60;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    setCreate({ staffId: sid, date: day, startHHmm: `${hh}:${mm}`, kind: 'walkin' });
  }

  const staffName = (id: string | null) => staff.find((s) => s.id === id)?.name ?? 'Whole business';
  const staffColor = (id: string | null) => staff.find((s) => s.id === id)?.color ?? '#64748b';

  return (
    <div className="space-y-4">
      {/* Toolbar: stacks on phones so nothing overflows the viewport */}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="flex rounded-lg border border-slate-300 bg-white p-1" role="tablist" aria-label="View">
          {(['day', 'week'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`min-h-11 rounded-md px-4 text-sm font-medium capitalize ${view === v ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>{v}</button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-1 sm:justify-start">
          <button type="button" aria-label="Previous" className="h-11 w-11 rounded-lg border border-slate-300 bg-white" onClick={() => go(addDaysToDateKey(date, view === 'day' ? -1 : -7), 'prev')}>‹</button>
          <button type="button" className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium" onClick={() => go(todayKey, todayKey < date ? 'prev' : 'next')}>Today</button>
          <button type="button" aria-label="Next" className="h-11 w-11 rounded-lg border border-slate-300 bg-white" onClick={() => go(addDaysToDateKey(date, view === 'day' ? 1 : 7), 'next')}>›</button>
        </div>
        <input type="date" aria-label="Jump to date" value={date} onChange={(e) => e.target.value && go(e.target.value, e.target.value < date ? 'prev' : 'next')}
          className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm sm:w-auto" />
        {view === 'week' && (
          <select aria-label="Team member" value={staffId} onChange={(e) => setStaffId(e.target.value)} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            {activeStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setCreate({ staffId: null, date: todayKey, startHHmm: '10:00', kind: 'block' })}
          className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium">+ Block time</button>
        <button type="button" onClick={() => setCreate({ staffId: activeStaff[0]?.id ?? null, date, startHHmm: '10:00', kind: 'walkin' })}
          className="h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">+ New appointment</button>
        {loading && <span className="text-xs text-slate-500" aria-live="polite">Loading…</span>}
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {view === 'week' && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden" aria-label="Jump to day">
          {days.map((d) => {
            const dt = new Date(`${d}T12:00:00Z`);
            const isToday = d === todayKey;
            return (
              <button key={d} type="button" onClick={() => {
                const col = document.querySelector<HTMLElement>(`#cal-grid [data-day="${d}"]`);
                col?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
              }}
                className={`flex min-h-11 min-w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl border px-2 text-xs font-semibold tabular-nums ${isToday ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                <span>{new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(dt)}</span>
                <span className="text-sm">{dt.getUTCDate()}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeStaff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">Add a team member to see their calendar.</div>
      ) : (
        <div id="cal-grid" key={date + view} className={`relative overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${dir === 'next' ? 'slide-next' : 'slide-prev'}`}>
          <div className="flex" style={{ minWidth: 56 + columns.length * colW }}>
            {/* Time rail */}
            <div className="sticky left-0 z-20 w-14 shrink-0 bg-white border-r border-slate-200" style={{ height: totalH + 40 }}>
              <div className="h-10" />
              {hours.map((h) => (
                <div key={h} className="absolute left-0 w-14 pr-2 text-right text-[11px] text-slate-500" style={{ top: 40 + (h - START_H) * 60 * PX_PER_MIN - 6 }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {(view === 'day' ? columns : days.map((d) => ({ id: d, label: d }))).map((col: any) => {
              const isDay = view === 'week';
              const dayKey = isDay ? col.id : date;
              const sid = isDay ? staffId : col.id;
              const colStaff = isDay ? staff.find((s) => s.id === staffId) : col;
              const label = isDay
                ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone }).format(new Date(`${dayKey}T12:00:00Z`))
                : col.name;
              const list = apptsFor(dayKey, sid);
              return (
                <div key={isDay ? dayKey : col.id} data-day={isDay ? dayKey : undefined} className="shrink-0 border-r border-slate-200 last:border-r-0" style={{ width: colW }}>
                  <div className="flex h-10 items-center gap-2 px-2 border-b border-slate-200 bg-slate-50" style={{ borderTop: `3px solid ${isDay ? colStaff?.color ?? '#6366f1' : col.color}` }}>
                    <span className={`whitespace-nowrap text-xs font-semibold tabular-nums ${isDay && dayKey === todayKey ? 'rounded-full bg-brand-600 px-2 py-0.5 text-white' : ''}`}>{label}</span>
                  </div>
                  <div className="relative cursor-cell" style={{ height: totalH + 40 }}
                    onClick={(e) => onGridClick(e, dayKey, sid)}
                    role="button" tabIndex={0} aria-label={`Create appointment at a time in ${label}`}
                    onKeyDown={(e) => { if (e.key === 'Enter') setCreate({ staffId: sid, date: dayKey, startHHmm: '10:00', kind: 'walkin' }); }}>
                    <div className="absolute inset-x-0 top-10 bottom-0 pointer-events-none">
                      {hours.map((h) => (
                        <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - START_H) * 60 * PX_PER_MIN }} />
                      ))}
                    </div>
                    {list.map((a) => {
                      const startM = minutesOfDay(hhmmOf(a.startAt, timezone));
                      const endM = minutesOfDay(hhmmOf(a.endAt, timezone)) + (dateKeyInTz(a.endAt, timezone) !== dayKey ? 24 * 60 : 0);
                      const top = 40 + (startM - START_H * 60) * PX_PER_MIN;
                      const height = Math.max(24, (endM - startM) * PX_PER_MIN);
                      const accent = a.kind === 'block' ? '#94a3b8' : staffColor(a.staffId);
                      const pay = PAYMENT_BADGE[a.paymentStatus];
                      if (a.kind === 'block') {
                        return (
                          <button key={a.id} type="button" onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                            className="absolute left-1 right-1 z-10 overflow-hidden rounded-md border border-slate-300 p-1.5 text-left text-xs text-slate-700"
                            style={{ top, height, backgroundImage: 'repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 6px,#e2e8f0 6px,#e2e8f0 12px)' }}>
                            <span className="font-medium">{a.title}</span>
                            {a.staffId === null && <span className="block text-[10px] text-slate-500">All team</span>}
                          </button>
                        );
                      }
                      return (
                        <button key={a.id} type="button" onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                          className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border border-slate-200 p-1.5 text-left text-xs shadow-sm hover:shadow ${STATUS_STYLE[a.status]}`}
                          style={{ top, height, borderLeft: `4px solid ${accent}` }}>
                          <span className="block text-[10px] text-slate-500">{hhmmOf(a.startAt, timezone)}–{hhmmOf(a.endAt, timezone)}</span>
                          <span className="block truncate font-semibold">{a.clientName || 'Walk-in'}</span>
                          {height > 44 && <span className="block truncate text-slate-600">{a.title}</span>}
                          {height > 60 && pay && <span className={`mt-0.5 inline-block rounded px-1 text-[10px] ${pay.cls}`}>{pay.label}</span>}
                          {a.status === 'no_show' && <span className="block text-[10px] font-semibold text-rose-700">No-show</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500">Times shown in {timezone}. Tap an empty slot to add an appointment. Swipe sideways to see more team members.</p>

      {create && (
        <CreateDrawer state={create} onClose={() => setCreate(null)} services={services} staff={activeStaff} timezone={timezone} currency={currency}
          onSaved={(savedDay) => { setCreate(null); if (savedDay === date) load(); else setDate(savedDay); }} />
      )}
      {selected && (
        <DetailDrawer appt={selected} timezone={timezone} currency={currency} services={services} staffName={staffName}
          onClose={() => setSelected(null)} onChanged={(a) => { setSelected(a); load(); }} onDeleted={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}

function CreateDrawer({ state, onClose, services, staff, timezone, currency, onSaved }: {
  state: { staffId: string | null; startHHmm: string; date: string; kind: 'walkin' | 'booking' | 'block' };
  onClose: () => void; services: Service[]; staff: Staff[]; timezone: string; currency: string; onSaved: (day: string) => void;
}) {
  const [kind, setKind] = useState(state.kind);
  const [date, setDate] = useState(state.date);
  const [time, setTime] = useState(state.startHHmm);
  const [endTime, setEndTime] = useState(() => {
    const m = minutesOfDay(state.startHHmm) + 60;
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  });
  const [sid, setSid] = useState<string>(state.staffId ?? staff[0]?.id ?? '');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('Lunch break');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeServices = services.filter((s) => s.active);
  const svcTotal = activeServices.filter((s) => serviceIds.includes(s.id)).reduce((n, s) => n + s.priceCents, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (kind !== 'block') {
      if (name.trim().length < 2) return setError('Enter the client\'s name (at least 2 letters).');
      if (serviceIds.length === 0) return setError('Choose at least one service.');
      if (!sid) return setError('Choose a team member.');
    }
    setBusy(true);
    try {
      if (kind === 'block') {
        await api('/api/appointments', { body: { kind: 'block', title, staffId: sid || null, startAt: toIso(date, time, timezone), endAt: toIso(date, endTime, timezone) } });
      } else {
        await api('/api/appointments', { body: { kind, staffId: sid, serviceIds, startAt: toIso(date, time, timezone), client: { name, phone, email }, notes } });
      }
      onSaved(date);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-brand-500/30';
  return (
    <Drawer open onClose={onClose} title={kind === 'block' ? 'Block time' : 'New appointment'}
      footer={
        <button form="create-form" type="submit" disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : kind === 'block' ? 'Block time' : 'Save appointment'}</button>
      }>
      {error && <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <form id="create-form" noValidate onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type">
          {([['walkin', 'Walk-in'], ['booking', 'Phone'], ['block', 'Block']] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={`min-h-11 rounded-lg border text-sm font-medium ${kind === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300'}`}>{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Date<input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label className="block text-sm font-medium">Team<select className={input} value={sid} onChange={(e) => setSid(e.target.value)}>
            {kind === 'block' && <option value="">Whole business</option>}
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label className="block text-sm font-medium">Start<input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} required /></label>
          {kind === 'block' ? (
            <label className="block text-sm font-medium">End<input type="time" className={input} value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></label>
          ) : (
            <div className="self-end text-sm text-slate-500 pb-3">Ends after service duration</div>
          )}
        </div>
        {kind === 'block' ? (
          <label className="block text-sm font-medium">Title<input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
        ) : (
          <>
            <fieldset>
              <legend className="text-sm font-medium">Services</legend>
              <div className="mt-2 grid gap-2">
                {activeServices.map((s) => (
                  <label key={s.id} className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${serviceIds.includes(s.id) ? 'border-brand-600 bg-brand-50' : 'border-slate-300'}`}>
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={serviceIds.includes(s.id)} onChange={(e) => setServiceIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id))} />
                      {s.name}
                    </span>
                    <span className="text-slate-500">{s.durationMin}m · {money(s.priceCents, currency)}</span>
                  </label>
                ))}
              </div>
              {serviceIds.length > 0 && <p className="mt-2 text-sm text-slate-600">Total {money(svcTotal, currency)}</p>}
            </fieldset>
            <label className="block text-sm font-medium">Client name<input className={input} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="off" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">Phone<input type="tel" className={input} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
              <label className="block text-sm font-medium">Email<input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            </div>
            <label className="block text-sm font-medium">Notes<textarea className={input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </>
        )}
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Drawer>
  );
}

function DetailDrawer({ appt, timezone, currency, services, staffName, onClose, onChanged, onDeleted }: {
  appt: Appointment; timezone: string; currency: string; services: Service[]; staffName: (id: string | null) => string;
  onClose: () => void; onChanged: (a: Appointment) => void; onDeleted: () => void;
}) {
  const [when, setWhen] = useState({ date: dateKeyInTz(appt.startAt, timezone), time: hhmmOf(appt.startAt, timezone) });
  const [notes, setNotes] = useState(appt.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBlock = appt.kind === 'block';
  const isPast = Date.parse(appt.endAt) < Date.now();
  const pay = PAYMENT_BADGE[appt.paymentStatus];

  async function run(fn: () => Promise<Appointment>) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await fn());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const patch = (body: Record<string, unknown>) => run(() => api<Appointment>(`/api/appointments/${appt.id}`, { method: 'PATCH', body }));
  const setStatus = (status: Appointment['status']) => patch({ status });

  return (
    <Drawer open onClose={onClose} title={isBlock ? appt.title : appt.clientName || 'Appointment'}>
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">When</dt><dd className="font-medium">{dateKeyInTz(appt.startAt, timezone)} · {hhmmOf(appt.startAt, timezone)}–{hhmmOf(appt.endAt, timezone)}</dd></div>
          <div><dt className="text-slate-500">With</dt><dd className="font-medium">{staffName(appt.staffId)}</dd></div>
          {!isBlock && <>
            <div className="col-span-2"><dt className="text-slate-500">Services</dt><dd className="font-medium">{appt.title}</dd></div>
            <div><dt className="text-slate-500">Price</dt><dd className="font-medium">{formatMoney(appt.priceCents, currency)}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd className="font-medium capitalize">{appt.status.replace('_', ' ')}</dd></div>
            {appt.clientPhone && <div><dt className="text-slate-500">Phone</dt><dd><a className="text-brand-700" href={`tel:${appt.clientPhone}`}>{appt.clientPhone}</a></dd></div>}
            {appt.clientEmail && <div><dt className="text-slate-500">Email</dt><dd className="truncate">{appt.clientEmail}</dd></div>}
            {pay && <div className="col-span-2"><span className={`inline-block rounded px-2 py-1 text-xs font-medium ${pay.cls}`}>{pay.label}{appt.depositCents ? ` · deposit ${formatMoney(appt.depositCents, currency)}` : ''}</span></div>}
          </>}
        </dl>

        {!isBlock && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button disabled={busy || appt.status === 'completed'} onClick={() => setStatus('completed')} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-40">Mark completed</button>
            <button disabled={busy || appt.status === 'no_show'} onClick={() => setStatus('no_show')} className="min-h-11 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white disabled:opacity-40">No-show</button>
            <button disabled={busy || appt.status === 'cancelled'} onClick={() => setStatus('cancelled')} className="min-h-11 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-700 disabled:opacity-40">Cancel</button>
          </div>
        )}

        {appt.status !== 'cancelled' && !isPast && (
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold">Reschedule</legend>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" aria-label="New date" className="min-h-11 rounded-lg border border-slate-300 px-2" value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} />
              <input type="time" aria-label="New time" className="min-h-11 rounded-lg border border-slate-300 px-2" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} />
            </div>
            <button disabled={busy} onClick={() => patch({ startAt: toIso(when.date, when.time, timezone) })} className="mt-3 min-h-11 w-full rounded-lg border border-slate-300 text-sm font-medium disabled:opacity-40">Save new time</button>
          </fieldset>
        )}

        {!isBlock && (
          <div>
            <label className="block text-sm font-semibold" htmlFor="appt-notes">Appointment notes</label>
            <textarea id="appt-notes" rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-base" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button disabled={busy} onClick={() => patch({ notes })} className="mt-2 min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40">Save notes</button>
          </div>
        )}

        {isBlock && (
          <button disabled={busy} onClick={async () => {
            if (!confirm('Remove this blocked time?')) return;
            setBusy(true);
            try { await api(`/api/appointments/${appt.id}`, { method: 'DELETE' }); onDeleted(); } catch (e: any) { setError(e.message); setBusy(false); }
          }} className="min-h-11 w-full rounded-lg border border-rose-300 text-sm font-semibold text-rose-700">Remove block</button>
        )}

        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </div>
    </Drawer>
  );
}
