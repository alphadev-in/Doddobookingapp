# Doddo — Phase 1 MVP

Online booking, multi-staff calendar, client CRM and deposit protection. Built with Astro (SSR/hybrid),
React islands, Tailwind v4, Firebase Auth (email/password) and Cloud Firestore, with Stripe deposits
(sandbox fallback when no key is set).

## Quick start

```bash
npm install
cp .env.example .env        # fill in what you have; everything optional runs in sandbox mode
npm run dev                 # http://localhost:4321
```

## Firebase setup (required)

The web config is already in `src/lib/firebase-client.ts` (project `doddocouk`). Do these once in the Firebase console:

1. **Authentication → Sign-in method → Email/Password → Enable.**
2. **Firestore Database → Create database** (production mode). Then deploy the rules: `firebase deploy --only firestore:rules`.
   The rules deny all client access; the app reads and writes only through the server.
3. **Project settings → Service accounts → Generate new private key.** Put the whole JSON on one line in `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```
   Without it, every server data call fails with "Could not load the default credentials" (you will see this as a 500).
   For local dev you can instead run `gcloud auth application-default login`.

## Stripe setup (optional, for real deposits)

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` (test keys first).
2. For Stripe Connect, create a connected account for the business and save its `acct_…` id in **Settings → Payments**.
   Payment intents are then created on that account. Leave it empty to charge the platform account.
3. Add a webhook endpoint pointing to `/api/payments/webhook` and set `STRIPE_WEBHOOK_SECRET`.
   Events: `payment_intent.succeeded`, `payment_intent.payment_failed`.

Without `STRIPE_SECRET_KEY`, deposits are simulated (sandbox). The amount is still computed on the server and shown in the UI.

## Project structure

```
src/
  middleware.ts              Gate /dashboard, /onboarding behind the Firebase session cookie
  layouts/                   BaseLayout, DashboardLayout (sidebar on desktop, bottom nav on mobile)
  components/astro/          Static pieces: StatCard, EmptyState, SkeletonRows
  components/islands/        React islands (client:load): Calendar, BookingFlow, ManageBooking,
                             Onboarding, ServicesManager, TeamManager, ClientsManager,
                             SettingsPanel, AuthForm, CopyLink, LogoutButton, Drawer
  lib/
    types.ts                 Domain interfaces (Business, Staff, Service, Client, Appointment)
    availability.ts          Pure slot engine
    time.ts                  Timezone helpers (pure, shared by server and islands)
    booking.ts               Quotes, staff assignment, transactional create/reschedule, cancellation policy
    repo.ts                  Firestore data layer (async, admin SDK)
    payments.ts              Stripe REST calls, sandbox fallback, webhook signature check
    notifications.ts         Email/SMS stubs (console in dev)
    session.ts / page-auth.ts Auth helpers for APIs and pages
    firebase-admin.ts        Server-only Firebase Admin init
    firebase-client.ts       Browser Firebase Auth
    validate.ts              Input validation for owner writes
  pages/
    index.astro              Static marketing page (zero JS)
    login.astro, signup.astro, onboarding.astro
    dashboard/               index, calendar, services, team, clients, settings
    book/[slug].astro        Public booking flow (SSR)
    booking/[bookingId].astro Client manage page (requires ?t= token)
    api/                     See below
```

### API

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /api/availability?slug&serviceIds&staffId&date` | public | Open slots for a day |
| `POST /api/bookings` | public | Client booking (verifies deposit first) |
| `GET/PATCH /api/bookings/[id]?token=` | manage token | View, reschedule, or cancel own booking |
| `POST /api/payments/intent` | public | Create deposit PaymentIntent (amount computed server-side) |
| `POST /api/payments/webhook` | Stripe signature | Sync payment status |
| `GET/POST /api/appointments` | owner | List (with from/to), create walk-in/phone/block |
| `GET/PATCH/DELETE /api/appointments/[id]` | owner | Status, reschedule, notes, delete |
| `GET/POST /api/services`, `PATCH/DELETE /api/services/[id]` | owner | Catalog |
| `GET/POST /api/staff`, `PATCH/DELETE /api/staff/[id]` | owner | Team |
| `GET /api/clients`, `GET/PATCH /api/clients/[id]` | owner | CRM (notes are private) |
| `GET/PATCH /api/business`, `POST /api/businesses` | owner | Settings, onboarding |
| `POST/DELETE /api/auth/session` | Firebase ID token | Create or clear the session cookie |

## How the slot engine works

`src/lib/availability.ts` is pure. For a given day it:

1. Looks up the business's weekday hours and converts them to UTC using the business timezone (DST-safe).
2. Intersects them with the staff member's hours for that day, if any.
3. Walks the window in 15-minute steps and keeps a start only if `start + service duration` fits inside the window.
4. Rejects a start if `[start, start + duration + buffer)` overlaps any busy interval. Existing bookings count as busy until their end **plus their buffer**.
5. Drops starts earlier than now + 60 minutes (booking notice).

`getDaySlots` runs this for every eligible staff member and merges the results, so "Any available" returns the earliest free member for each time.
Conflict checks are repeated inside a Firestore transaction at write time, so two people cannot take the same slot.

## Known limits (Phase 1)

- **Dashboard auth is per owner.** Each Firebase user owns one business. There are no staff logins yet.
- **Firestore queries** read all of a business's appointments and filter in memory. Fine for hundreds of bookings. Add a `startAt` range index before scaling.
- **Reminders** are not scheduled. `notifyClient` runs for confirmations and cancellations; the 24-hour reminder needs a cron job (Cloud Scheduler or Vercel Cron) that calls it.
- **Email/SMS** are console stubs. Wire Resend/Postmark and Twilio in `src/lib/notifications.ts`.
- **Stripe live mode** has been built against the API but not run against live keys. Test with test keys first.
- **Timezones:** availability and display use the business timezone. Client devices show the same times.
