// Input validation for owner-facing writes. Throws BookingError(VALIDATION) with a readable message.
import { BookingError } from './booking';
import type { DayHours, DepositType, Service, Staff, WeekHours } from './types';

const str = (v: unknown, field: string, max = 200, min = 0) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < min) throw new BookingError('VALIDATION', `${field} is required`);
  if (s.length > max) throw new BookingError('VALIDATION', `${field} is too long`);
  return s;
};
const int = (v: unknown, field: string, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new BookingError('VALIDATION', `${field} must be a whole number between ${min} and ${max}`);
  return n;
};
const timeOk = (t: unknown) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function validateSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) {
    throw new BookingError('VALIDATION', 'Booking link can use lowercase letters, numbers and hyphens (3-40 characters)');
  }
  return slug;
}

export function validateHours(h: any): WeekHours {
  const out: WeekHours = {};
  for (let d = 0; d <= 6; d++) {
    const v = h?.[String(d)] as DayHours | undefined;
    const open = !!v?.open;
    if (open && (!timeOk(v?.start) || !timeOk(v?.end) || v!.end <= v!.start)) {
      throw new BookingError('VALIDATION', `Check the hours for ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}`);
    }
    out[String(d)] = { open, start: v?.start ?? '09:00', end: v?.end ?? '18:00' };
  }
  return out;
}

export function validateBusinessSettings(b: any) {
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = str(b.name, 'Business name', 120, 2);
  if (b.email !== undefined) data.email = str(b.email, 'Email', 200);
  if (b.phone !== undefined) data.phone = str(b.phone, 'Phone', 40);
  if (b.timezone !== undefined) {
    try { new Intl.DateTimeFormat('en-GB', { timeZone: String(b.timezone) }); } catch { throw new BookingError('VALIDATION', 'Unknown timezone'); }
    data.timezone = String(b.timezone);
  }
  if (b.currency !== undefined) data.currency = str(b.currency, 'Currency', 3, 3).toUpperCase();
  if (b.hours !== undefined) data.hours = validateHours(b.hours);
  if (b.stripeAccountId !== undefined) {
    if (b.stripeAccountId !== null && !/^acct_[A-Za-z0-9]{6,}$/.test(String(b.stripeAccountId))) throw new BookingError('VALIDATION', 'Stripe account id should look like acct_…');
    data.stripeAccountId = b.stripeAccountId || null;
  }
  if (b.paymentsEnabled !== undefined) data.paymentsEnabled = !!b.paymentsEnabled;
  if (b.slotIntervalMin !== undefined) {
    const v = Number(b.slotIntervalMin);
    if (![5, 10, 15, 20, 30, 60].includes(v)) throw new BookingError('VALIDATION', 'Time slot must be 5, 10, 15, 20, 30 or 60 minutes');
    data.slotIntervalMin = v;
  }
  if (b.depositPolicy !== undefined) data.depositPolicy = str(b.depositPolicy, 'Deposit policy', 1000);
  if (b.cancellationWindowHours !== undefined) data.cancellationWindowHours = int(b.cancellationWindowHours, 'Cancellation window', 0, 720);
  if (b.lateCancelDepositForfeit !== undefined) data.lateCancelDepositForfeit = !!b.lateCancelDepositForfeit;
  if (b.notifications !== undefined) data.notifications = { confirmation: !!b.notifications.confirmation, reminder24h: !!b.notifications.reminder24h, cancellation: !!b.notifications.cancellation };
  if (b.templates !== undefined) {
    data.templates = {
      confirmation: str(b.templates.confirmation, 'Confirmation template', 500),
      reminder24h: str(b.templates.reminder24h, 'Reminder template', 500),
      cancellation: str(b.templates.cancellation, 'Cancellation template', 500),
    };
  }
  return data as Partial<Record<string, any>>;
}

const DEPOSIT_TYPES: DepositType[] = ['none', 'percent', 'fixed'];

export function validateService(s: any): Omit<Service, 'id' | 'businessId'> & { id?: string; businessId?: string } {
  const depositType = DEPOSIT_TYPES.includes(s.depositType) ? (s.depositType as DepositType) : 'none';
  const depositValue = depositType === 'none' ? 0 : int(s.depositValue, 'Deposit', 0, depositType === 'percent' ? 100 : 1_000_000);
  return {
    id: s.id,
    name: str(s.name, 'Service name', 120, 2),
    category: str(s.category, 'Category', 60) || 'General',
    durationMin: int(s.durationMin, 'Duration', 5, 480),
    bufferMin: int(s.bufferMin ?? 0, 'Buffer', 0, 120),
    priceCents: int(s.priceCents, 'Price', 0, 10_000_000),
    depositType,
    depositValue,
    active: s.active === undefined ? true : !!s.active,
  };
}

export function validateStaff(s: any): Omit<Staff, 'id' | 'businessId'> & { id?: string; businessId?: string } {
  const color = typeof s.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : '#6366f1';
  return {
    id: s.id,
    name: str(s.name, 'Name', 120, 2),
    role: str(s.role, 'Role', 80) || 'Team member',
    color,
    active: s.active === undefined ? true : !!s.active,
    serviceIds: Array.isArray(s.serviceIds) ? s.serviceIds.map(String) : [],
    hours: validateHours(s.hours ?? {}),
  };
}
