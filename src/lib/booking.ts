// Server-side booking rules: quoting, staff assignment, transactional creation, cancellation policy.
// Server-only (uses Firestore). Pure slot math lives in availability.ts.
import type { Appointment, Business, Quote, Service, Staff } from './types';
import { getOpenSlots, type BusyInterval } from './availability';
import { dateKeyInTz } from './time';
import {
  getBusinessById, getServices, listAppointments, listStaff, findClient, saveClient, recomputeClientStats,
  updateAppointment, findAppointmentByIntent,
} from './repo';
import { verifyDeposit, refundDeposit } from './payments';
import { notifyClient } from './notifications';
import { token, uid } from './ids';

const MIN = 60_000;
export const MIN_NOTICE_MIN = 60;

export class BookingError extends Error {
  constructor(public code: 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'PAYMENT' | 'FORBIDDEN', message: string, public status = 400) {
    super(message);
  }
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Price, duration, buffer, and deposit for a set of services. Percent deposits are 0-100; fixed are cents. */
export async function quoteFor(business: Business, serviceIds: string[]): Promise<{ quote: Quote; services: Service[] }> {
  if (!serviceIds.length) throw new BookingError('VALIDATION', 'Select at least one service');
  const list = await getServices(serviceIds);
  if (list.length !== new Set(serviceIds).size || list.some((s) => s.businessId !== business.id || !s.active)) {
    throw new BookingError('VALIDATION', 'One or more services are unavailable');
  }
  const priceCents = list.reduce((n, s) => n + s.priceCents, 0);
  const depositCents = list.reduce((n, s) => {
    if (s.depositType === 'percent') return n + Math.round((s.priceCents * s.depositValue) / 100);
    if (s.depositType === 'fixed') return n + s.depositValue;
    return n;
  }, 0);
  return {
    services: list,
    quote: {
      durationMin: list.reduce((n, s) => n + s.durationMin, 0),
      bufferMin: list.reduce((n, s) => n + s.bufferMin, 0),
      priceCents,
      depositCents: Math.min(depositCents, priceCents),
      serviceNames: list.map((s) => s.name),
    },
  };
}

/** Busy intervals for a staff member, from a preloaded appointment list. Blocks with staffId null are business-wide. */
export function busyFrom(appts: Appointment[], staffId: string | null, excludeId?: string): BusyInterval[] {
  return appts
    .filter((a) => a.status !== 'cancelled' && a.id !== excludeId)
    .filter((a) => a.staffId === staffId || (a.kind === 'block' && a.staffId === null))
    .map((a) => ({ startMs: Date.parse(a.startAt), endMs: Date.parse(a.endAt) + a.bufferMin * MIN }));
}

function eligibleStaff(staff: Staff[], serviceIds: string[], preferred: string | 'any') {
  return staff.filter((s) => s.active && serviceIds.every((id) => s.serviceIds.includes(id)) && (preferred === 'any' || s.id === preferred));
}

/** Open slots for a date across eligible staff, de-duplicated by start time. */
export async function getDaySlots(opts: { businessId: string; serviceIds: string[]; staffId: string | 'any'; date: string; nowMs?: number }) {
  const business = await getBusinessById(opts.businessId);
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  const { quote } = await quoteFor(business, opts.serviceIds);
  const [staff, appts] = await Promise.all([listStaff(business.id), listAppointments(business.id)]);
  const earliestMs = (opts.nowMs ?? Date.now()) + MIN_NOTICE_MIN * MIN;
  const byStart = new Map<string, { startAt: string; time: string; staffId: string }>();
  for (const st of eligibleStaff(staff, opts.serviceIds, opts.staffId)) {
    const slots = getOpenSlots({
      timezone: business.timezone, businessHours: business.hours, staffHours: st.hours, date: opts.date,
      durationMin: quote.durationMin, bufferMin: quote.bufferMin, busy: busyFrom(appts, st.id), earliestMs,
    });
    for (const s of slots) if (!byStart.has(s.startAt)) byStart.set(s.startAt, { ...s, staffId: st.id });
  }
  return [...byStart.values()].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Pick a staff member able to take exactly this start time, from preloaded data. */
function pickStaff(args: {
  business: Business; staff: Staff[]; appts: Appointment[]; serviceIds: string[]; staffId: string | 'any';
  startAt: string; durationMin: number; bufferMin: number; excludeId?: string; enforceNotice: boolean;
}): Staff | null {
  const date = dateKeyInTz(args.startAt, args.business.timezone);
  for (const st of eligibleStaff(args.staff, args.serviceIds, args.staffId)) {
    const slots = getOpenSlots({
      timezone: args.business.timezone, businessHours: args.business.hours, staffHours: st.hours, date,
      durationMin: args.durationMin, bufferMin: args.bufferMin, busy: busyFrom(args.appts, st.id, args.excludeId),
      earliestMs: args.enforceNotice ? Date.now() + MIN_NOTICE_MIN * MIN : undefined,
    });
    if (slots.some((s) => s.startAt === args.startAt)) return st;
  }
  return null;
}

export interface CreateBookingInput {
  businessId: string;
  serviceIds: string[];
  staffId: string | 'any';
  startAt: string;
  client: { name: string; email: string; phone: string };
  notes?: string;
  source: 'online' | 'dashboard';
  kind?: 'booking' | 'walkin';
  paymentIntentId?: string | null;
}

/**
 * Create a booking. Deposit is verified (online only) BEFORE the transaction. The conflict check
 * and insert then run inside a Firestore transaction, so two simultaneous requests cannot both win.
 */
export async function createBooking(input: CreateBookingInput): Promise<Appointment> {
  const business = await getBusinessById(input.businessId);
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);

  const name = input.client.name.trim();
  const email = input.client.email.trim().toLowerCase();
  const phone = input.client.phone.trim();
  if (name.length < 2) throw new BookingError('VALIDATION', 'Please enter your name');
  if (!email && !phone) throw new BookingError('VALIDATION', 'Enter an email or phone number');
  if (email && !isEmail(email)) throw new BookingError('VALIDATION', 'Email address looks invalid');

  const start = Date.parse(input.startAt);
  if (Number.isNaN(start)) throw new BookingError('VALIDATION', 'Invalid start time');
  if (input.source === 'online' && start < Date.now() + MIN_NOTICE_MIN * MIN) {
    throw new BookingError('VALIDATION', `Bookings need at least ${MIN_NOTICE_MIN} minutes notice`);
  }

  const { quote } = await quoteFor(business, input.serviceIds);
  const needsDeposit = input.source === 'online' && quote.depositCents > 0;
  let paymentStatus: Appointment['paymentStatus'] = quote.priceCents > 0 ? 'unpaid' : 'n/a';

  if (needsDeposit) {
    if (!input.paymentIntentId) throw new BookingError('PAYMENT', 'A deposit payment is required to confirm this booking', 402);
    if (await findAppointmentByIntent(input.paymentIntentId)) throw new BookingError('CONFLICT', 'This payment has already been used', 409);
    const check = await verifyDeposit(input.paymentIntentId, quote.depositCents, business.stripeAccountId);
    if (!check.ok) throw new BookingError('PAYMENT', check.reason ?? 'Deposit could not be verified', 402);
    paymentStatus = 'deposit_paid';
  }

  const db = (await import('./firebase-admin')).adminDb();
  const apptRef = db.collection('appointments').doc(`apt_${uid()}`);
  const staffList = await listStaff(business.id);
  const client = await upsertClient(business.id, { name, email, phone });
  const endAt = new Date(start + quote.durationMin * MIN).toISOString();

  const appt = await db.runTransaction(async (tx) => {
    const q = await tx.get(db.collection('appointments').where('businessId', '==', business.id));
    const appts = q.docs.map((d) => d.data() as Appointment);
    const staff = pickStaff({
      business, staff: staffList, appts, serviceIds: input.serviceIds, staffId: input.staffId,
      startAt: input.startAt, durationMin: quote.durationMin, bufferMin: quote.bufferMin, enforceNotice: input.source === 'online',
    });
    if (!staff) throw new BookingError('CONFLICT', 'That time is no longer available. Please choose another slot.', 409);
    const row: Appointment = {
      id: apptRef.id, businessId: business.id, kind: input.kind ?? 'booking', staffId: staff.id, clientId: client.id,
      serviceIds: input.serviceIds, title: quote.serviceNames.join(' + '), startAt: input.startAt, endAt, bufferMin: quote.bufferMin,
      status: 'confirmed', priceCents: quote.priceCents, depositCents: needsDeposit ? quote.depositCents : 0, paymentStatus,
      paymentIntentId: input.paymentIntentId ?? null, clientName: name, clientEmail: email, clientPhone: phone, notes: input.notes ?? '',
      source: input.source, manageToken: token(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    tx.set(apptRef, row);
    return row;
  });

  await recomputeClientStats(client.id);
  await notifyClient('confirmation', business, appt, appt.title, timeLabel(business, appt.startAt)).catch(() => {});
  return appt;
}

async function upsertClient(businessId: string, c: { name: string; email: string; phone: string }) {
  const existing = await findClient(businessId, c.email, c.phone);
  if (existing) {
    return saveClient({ ...existing, name: c.name || existing.name, email: c.email || existing.email, phone: c.phone || existing.phone });
  }
  return saveClient({
    id: `cli_${uid()}`, businessId, name: c.name, email: c.email, phone: c.phone, notes: '',
    totalVisits: 0, totalSpentCents: 0, noShowCount: 0, lastVisitAt: null, createdAt: new Date().toISOString(),
  });
}

/** Business-only: block time (lunch, training, closure). Rejects overlaps with bookings or other blocks. */
export async function createBlock(input: { businessId: string; staffId: string | null; startAt: string; endAt: string; title: string }): Promise<Appointment> {
  const s = Date.parse(input.startAt);
  const e = Date.parse(input.endAt);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) throw new BookingError('VALIDATION', 'Block end must be after start');
  const db = (await import('./firebase-admin')).adminDb();
  const ref = db.collection('appointments').doc(`apt_${uid()}`);
  return db.runTransaction(async (tx) => {
    const q = await tx.get(db.collection('appointments').where('businessId', '==', input.businessId));
    const busy = busyFrom(q.docs.map((d) => d.data() as Appointment), input.staffId);
    if (busy.some((b) => s < b.endMs && b.startMs < e)) throw new BookingError('CONFLICT', 'Overlaps an existing appointment or block', 409);
    const row: Appointment = {
      id: ref.id, businessId: input.businessId, kind: 'block', staffId: input.staffId, clientId: null, serviceIds: [],
      title: input.title.trim() || 'Blocked', startAt: input.startAt, endAt: input.endAt, bufferMin: 0,
      status: 'confirmed', priceCents: 0, depositCents: 0, paymentStatus: 'n/a', paymentIntentId: null,
      clientName: '', clientEmail: '', clientPhone: '', notes: '', source: 'dashboard', manageToken: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    tx.set(ref, row);
    return row;
  });
}

/** Reschedule keeping duration and staff (or re-assign if staffId is 'any'). Transactional. */
export async function reschedule(appt: Appointment, newStartAt: string, enforceNotice: boolean): Promise<Appointment> {
  const business = await getBusinessById(appt.businessId);
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  const durationMin = Math.round((Date.parse(appt.endAt) - Date.parse(appt.startAt)) / MIN);
  const db = (await import('./firebase-admin')).adminDb();
  const staffList = await listStaff(business.id);
  const ref = db.collection('appointments').doc(appt.id);
  return db.runTransaction(async (tx) => {
    const q = await tx.get(db.collection('appointments').where('businessId', '==', business.id));
    const appts = q.docs.map((d) => d.data() as Appointment);
    const staff = pickStaff({
      business, staff: staffList, appts, serviceIds: appt.serviceIds, staffId: appt.staffId ?? 'any', startAt: newStartAt,
      durationMin, bufferMin: appt.bufferMin, excludeId: appt.id, enforceNotice,
    });
    if (!staff) throw new BookingError('CONFLICT', 'That time is not available', 409);
    const next = { ...appt, staffId: appt.kind === 'block' ? appt.staffId : staff.id, startAt: newStartAt,
      endAt: new Date(Date.parse(newStartAt) + durationMin * MIN).toISOString(), updatedAt: new Date().toISOString() };
    tx.set(ref, next);
    return next;
  });
}

function timeLabel(business: Business, iso: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: business.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

// ---------- Policies ----------

export function cancellationPolicy(business: Business, appt: Appointment, nowMs = Date.now()) {
  const hoursUntil = (Date.parse(appt.startAt) - nowMs) / (60 * MIN);
  const late = hoursUntil < business.cancellationWindowHours;
  const forfeitsDeposit = late && business.lateCancelDepositForfeit && appt.depositCents > 0 && appt.paymentStatus === 'deposit_paid';
  return { hoursUntil, late, forfeitsDeposit, windowHours: business.cancellationWindowHours };
}

/**
 * Apply a status change with its money side-effects and refresh CRM stats.
 * origin 'client' applies the late-cancellation policy; 'dashboard' is business-initiated (refund).
 */
export async function setStatus(appt: Appointment, status: Appointment['status'], origin: 'client' | 'dashboard'): Promise<Appointment> {
  const business = await getBusinessById(appt.businessId);
  if (!business) throw new BookingError('NOT_FOUND', 'Business not found', 404);
  let paymentStatus = appt.paymentStatus;
  const depositPaid = appt.paymentStatus === 'deposit_paid';

  if (status === 'completed' && appt.priceCents > 0 && (paymentStatus === 'unpaid' || paymentStatus === 'deposit_paid')) paymentStatus = 'paid';
  if (status === 'no_show' && depositPaid) paymentStatus = 'forfeited';
  if (status === 'cancelled' && depositPaid) {
    if (origin === 'client' && cancellationPolicy(business, appt).forfeitsDeposit) paymentStatus = 'forfeited';
    else {
      await refundDeposit(appt.paymentIntentId, business.stripeAccountId);
      paymentStatus = 'refunded';
    }
  }

  const updated = (await updateAppointment(appt.id, { status, paymentStatus })) as Appointment;
  if (appt.clientId) await recomputeClientStats(appt.clientId);
  if (status === 'cancelled' && appt.kind !== 'block') {
    await notifyClient('cancellation', business, updated, appt.title, timeLabel(business, appt.startAt)).catch(() => {});
  }
  return updated;
}

