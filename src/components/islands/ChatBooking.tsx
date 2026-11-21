// Guided booking: the assistant asks one question at a time. Choices are buttons; free text where needed.
// Same APIs as the form: availability, then bookings. Scripted (no AI model), so answers are predictable.
import { useEffect, useRef, useState } from 'react';
import { api, money } from './api';
import type { PublicService, PublicStaff, PublicBusiness } from './BookingFlow';
import { addDaysToDateKey, formatDateTime } from '../../lib/time';

interface Props { business: PublicBusiness; services: PublicService[]; staff: PublicStaff[]; todayKey: string; }
type Msg = { from: 'bot' | 'me'; text: string };
type Slot = { startAt: string; time: string; staffId: string };
type Step = 'name' | 'service' | 'staff' | 'day' | 'time' | 'contact' | 'confirm' | 'done' | 'deposit';

export default function ChatBooking({ business, services, staff, todayKey }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>('name');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [data, setData] = useState<{ name?: string; service?: PublicService; staffId?: string; day?: string; slot?: Slot; contact?: string; bookingId?: string; manageToken?: string }>({});
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const bookable = services.filter((s) => s.depositType === 'none' || !business.paymentsEnabled);
  const eligible = (serviceId: string) => staff.filter((m) => m.serviceIds.includes(serviceId));
  const days = Array.from({ length: 7 }, (_, i) => addDaysToDateKey(todayKey, i + 1));

  // Each new step: the assistant "types", then asks.
  function say(lines: string[]) {
    setBusy(true);
    lines.forEach((line, i) => setTimeout(() => {
      setMsgs((m) => [...m, { from: 'bot', text: line }]);
      if (i === lines.length - 1) setBusy(false);
    }, 450 * (i + 1)));
  }
  function me(t: string) { setMsgs((m) => [...m, { from: 'me', text: t }]); }

  useEffect(() => { say(['Hi! I can book your appointment in a few quick questions.', "What's your name?"]); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, step]);

  function answerName(name: string) {
    const clean = name.trim();
    if (clean.length < 2) return;
    me(clean);
    setData((d) => ({ ...d, name: clean }));
    setStep('service');
    say([`Lovely to meet you, ${clean.split(' ')[0]}.`, 'Which service would you like?']);
  }

  function pickService(s: PublicService) {
    me(s.name);
    setData((d) => ({ ...d, service: s }));
    if (s.depositType !== 'none' && business.paymentsEnabled) {
      setStep('deposit');
      return say(['This service takes a deposit, so please book it with the booking form. It shows the secure payment step.']);
    }
    const team = eligible(s.id);
    if (team.length === 0) return say(['Sorry, nobody is set up for that service yet. Please choose another one.']);
    setStep('staff');
    say(['Who would you like to see?']);
  }

  function pickStaff(id: string) {
    me(id === 'any' ? 'Anyone available' : staff.find((m) => m.id === id)?.name ?? '');
    setData((d) => ({ ...d, staffId: id }));
    setStep('day');
    say(['Which day suits you?']);
  }

  async function pickDay(day: string) {
    me(formatDateTime(`${day}T12:00:00Z`, business.timezone).split(',')[0] + ' ' + new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: business.timezone }));
    setData((d) => ({ ...d, day }));
    setStep('time');
    setSlots(null);
    setBusy(true);
    try {
      const qs = new URLSearchParams({ slug: business.slug, serviceIds: data.service!.id, staffId: data.staffId ?? 'any', date: day });
      const res = await api<{ slots: Slot[] }>(`/api/availability?${qs}`);
      setSlots(res.slots);
      setBusy(false);
      say(res.slots.length ? ['Here are the free times. Pick one.'] : ['No free times that day. Pick another day, or go back.']);
      if (!res.slots.length) setStep('day');
    } catch (e: any) {
      setBusy(false);
      say([`Sorry, I could not check times: ${e.message}`]);
    }
  }

  function pickSlot(s: Slot) {
    me(s.time);
    setData((d) => ({ ...d, slot: s }));
    setStep('contact');
    say(['What is the best phone number or email to confirm on?']);
  }

  function answerContact(v: string) {
    const clean = v.trim();
    if (!/@/.test(clean) && clean.replace(/\D/g, '').length < 7) return;
    me(clean);
    setData((d) => ({ ...d, contact: clean }));
    setStep('confirm');
    const s = data.service!;
    const who = data.staffId === 'any' || !data.staffId ? 'anyone available' : staff.find((m) => m.id === data.staffId)?.name;
    say([
      'Please check your booking:',
      `${s.name} with ${who}, ${formatDateTime(data.slot!.startAt, business.timezone)}${s.priceCents ? `, ${money(s.priceCents, business.currency)}` : ''}.`,
      'Shall I confirm it?',
    ]);
  }

  async function confirm() {
    me('Yes, confirm');
    setBusy(true);
    const isEmail = /@/.test(data.contact ?? '');
    try {
      const created = await api<{ id: string; manageToken: string; startAt: string }>('/api/bookings', {
        body: {
          businessSlug: business.slug, serviceIds: [data.service!.id], staffId: data.slot!.staffId, startAt: data.slot!.startAt,
          client: { name: data.name, email: isEmail ? data.contact : '', phone: isEmail ? '' : data.contact },
        },
      });
      setData((d) => ({ ...d, bookingId: created.id, manageToken: created.manageToken }));
      setStep('done');
      say([`You're booked, ${data.name?.split(' ')[0]}! We'll send the confirmation to ${data.contact}.`]);
    } catch (e: any) {
      setBusy(false);
      setStep('confirm');
      say([`Sorry, that did not go through: ${e.message}`, 'Would you like to pick another time?']);
      setStep('time');
    }
  }

  function startOver() {
    me('Start over');
    setData({});
    setSlots(null);
    setStep('name');
    say(["No problem. What's your name?"]);
  }

  const inputCls = 'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

  return (
    <section className="flex min-h-[70dvh] flex-col rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" aria-label="Guided booking">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" role="log" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`anim-fade-up flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.from === 'me' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}>{m.text}</p>
          </div>
        ))}
        {busy && <div className="flex justify-start"><span className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-slate-500" aria-label="Assistant is typing"><span className="inline-flex gap-1"><i className="h-2 w-2 animate-bounce rounded-full bg-slate-400" /><i className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:.15s]" /><i className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:.3s]" /></span></span></div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 p-4 sm:p-5">
        {!busy && step === 'name' && <NameInput value={text} setValue={setText} onSubmit={(v) => { answerName(v); setText(''); }} cls={inputCls} />}
        {!busy && step === 'contact' && <NameInput value={text} setValue={setText} onSubmit={(v) => { answerContact(v); setText(''); }} cls={inputCls} placeholder="Phone or email" />}

        {!busy && step === 'service' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {bookable.map((s) => (
              <button key={s.id} type="button" onClick={() => pickService(s)} className="flex min-h-14 items-center justify-between rounded-xl border border-slate-300 px-4 text-left hover:border-brand-500 hover:bg-brand-50">
                <span><span className="block font-medium">{s.name}</span><span className="text-xs text-slate-500">{s.durationMin} min</span></span>
                <span className="text-sm font-semibold">{s.priceCents ? money(s.priceCents, business.currency) : 'Free'}</span>
              </button>
            ))}
            {bookable.length === 0 && <p className="text-sm text-slate-600">No services are available online yet.</p>}
          </div>
        )}

        {!busy && step === 'staff' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => pickStaff('any')} className="min-h-14 rounded-xl border border-slate-300 px-4 text-left font-medium hover:border-brand-500 hover:bg-brand-50">Anyone available</button>
            {eligible(data.service!.id).map((m) => (
              <button key={m.id} type="button" onClick={() => pickStaff(m.id)} className="flex min-h-14 items-center gap-3 rounded-xl border border-slate-300 px-4 text-left hover:border-brand-500 hover:bg-brand-50">
                <span className="h-7 w-7 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden="true" />
                <span><span className="block font-medium">{m.name}</span><span className="text-xs text-slate-500">{m.role}</span></span>
              </button>
            ))}
          </div>
        )}

        {!busy && step === 'day' && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {days.map((d) => (
              <button key={d} type="button" onClick={() => pickDay(d)} className="min-h-14 rounded-xl border border-slate-300 text-sm font-medium hover:border-brand-500 hover:bg-brand-50">
                {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: business.timezone })}
              </button>
            ))}
          </div>
        )}

        {!busy && step === 'time' && slots && slots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button key={s.startAt} type="button" onClick={() => pickSlot(s)} className="min-h-11 rounded-lg border border-slate-300 text-sm font-semibold tabular-nums hover:border-brand-500 hover:bg-brand-50">{s.time}</button>
            ))}
          </div>
        )}

        {!busy && step === 'confirm' && (
          <div className="flex gap-3">
            <button type="button" onClick={confirm} className="min-h-12 flex-1 rounded-xl bg-brand-600 font-semibold text-white">Yes, confirm</button>
            <button type="button" onClick={startOver} className="min-h-12 rounded-xl border border-slate-300 px-4 font-medium">Start over</button>
          </div>
        )}

        {!busy && step === 'deposit' && (
          <a href={`/book/${business.slug}?mode=form`} className="flex min-h-12 items-center justify-center rounded-xl bg-brand-600 font-semibold text-white">Open the booking form</a>
        )}

        {!busy && step === 'done' && data.bookingId && (
          <div className="flex gap-3">
            <a href={`/booking/${data.bookingId}?t=${data.manageToken}`} className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-600 font-semibold text-white">Manage booking</a>
            <button type="button" onClick={startOver} className="min-h-12 rounded-xl border border-slate-300 px-4 font-medium">Book another</button>
          </div>
        )}
      </div>
    </section>
  );
}

function NameInput({ value, setValue, onSubmit, cls, placeholder = 'Type your name' }: { value: string; setValue: (v: string) => void; onSubmit: (v: string) => void; cls: string; placeholder?: string }) {
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={cls} aria-label={placeholder} />
      <button type="submit" disabled={value.trim().length < 2} className="min-h-12 shrink-0 rounded-xl bg-brand-600 px-5 font-semibold text-white disabled:opacity-40">Send</button>
    </form>
  );
}
