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
  about: string; // short description shown on the booking page
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  logoUrl: string; // data: URL (resized JPEG/PNG/WebP), '' when not set
  coverUrl: string; // data: URL, '' when not set
  bookingMode: 'form' | 'chat'; // online booking style: standard form, or guided question-by-question chat
  paymentsEnabled: boolean; // false = no deposit/payment step in the public booking flow
  slotIntervalMin: 5 | 10 | 15 | 20 | 30 | 60; // grid for offered start times
  subscription: {
    plan: 'trial' | 'standard';
    status: 'incomplete' | 'trialing' | 'active' | 'paused' | 'cancelled';
    trialEndsAt: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodEnd?: string | null;
  };
  createdAt: string;
}

export type UserRole = 'business' | 'customer';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Notification {
  id: string;
  businessId?: string; // set for business recipients
  customerEmail?: string; // set for customer recipients (lowercase)
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export interface PushSubscriptionRow {
  id: string;
  businessId?: string; // business owner's devices
  customerEmail?: string; // customer's devices (lowercase)
  endpoint: string;
  keys: { p256dh: string; auth: string };
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
  reminderSentAt?: string | null; // set once the 24h reminder has gone out
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

/** A business may use the dashboard only while its subscription is active (or in a Stripe trial). */
export const isSubscribed = (b: { subscription: { status: string } }) =>
  b.subscription.status === 'active' || b.subscription.status === 'trialing';
