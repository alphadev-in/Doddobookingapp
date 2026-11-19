// Core domain types. These map 1:1 onto Supabase/Postgres tables when you swap the store.

export type DayHours = { open: boolean; start: string; end: string }; // "HH:mm" wall-clock in business tz
export type WeekHours = Record<string, DayHours>; // keys "0".."6" (Sun..Sat)

export type DepositType = 'none' | 'percent' | 'fixed';

export interface Business {
  id: string;
  ownerUid: string; // Firebase Auth uid of the business owner
  slug: string;
  name: string;
  email: string;
  phone: string;
  timezone: string; // IANA, e.g. "Europe/London"
  stripeAccountId: string | null; // Stripe Connect connected account (acct_...)
  currency: string; // ISO 4217, e.g. "GBP"
  hours: WeekHours;
  depositPolicy: string; // human-readable text shown at checkout
  cancellationWindowHours: number; // cancellations inside this window are "late"
  lateCancelDepositForfeit: boolean; // late cancel keeps the deposit
  notifications: {
    confirmation: boolean;
    reminder24h: boolean;
    cancellation: boolean;
  };
  templates: { confirmation: string; reminder24h: string; cancellation: string };
  createdAt: string;
}

export interface Staff {
  id: string;
  businessId: string;
  name: string;
  role: string;
  color: string; // hex accent for calendar
  active: boolean;
  serviceIds: string[];
  hours: WeekHours; // per-day working hours
}

export interface Service {
  id: string;
  businessId: string;
  name: string;
  category: string;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  depositType: DepositType;
  depositValue: number; // percent (0-100) or cents depending on depositType
  active: boolean;
}

export interface Client {
  id: string;
  businessId: string;
  name: string;
  email: string;
  phone: string;
  notes: string; // private staff notes
  totalVisits: number;
  totalSpentCents: number;
  noShowCount: number;
  lastVisitAt: string | null;
  createdAt: string;
}

export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentKind = 'booking' | 'walkin' | 'block';
export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'refunded' | 'forfeited' | 'n/a';

export interface Appointment {
  id: string;
  businessId: string;
  kind: AppointmentKind;
  staffId: string | null;
  clientId: string | null;
  serviceIds: string[];
  title: string; // block title, or service summary
  startAt: string; // ISO UTC
  endAt: string; // ISO UTC (service end, excl. buffer)
  bufferMin: number;
  status: AppointmentStatus;
  priceCents: number;
  depositCents: number;
  paymentStatus: PaymentStatus;
  paymentIntentId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes: string;
  source: 'online' | 'dashboard';
  manageToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  depositCents: number;
  serviceNames: string[];
}
