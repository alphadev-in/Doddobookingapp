// Notification stubs. Swap `deliver*` for Resend/Postmark (email) and Twilio (SMS).
// Reminders need a scheduler (cron, Supabase pg_cron, or a queue) to call `sendReminders`.
import type { Appointment, Business } from './types';

export type NotificationKind = 'confirmation' | 'reminder24h' | 'cancellation';

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

export function buildMessage(kind: NotificationKind, business: Business, appt: Appointment, serviceName: string, timeLabel: string) {
  return render(business.templates[kind], {
    name: appt.clientName.split(' ')[0] || 'there',
    service: serviceName,
    business: business.name,
    time: timeLabel,
  });
}

async function deliverEmail(to: string, subject: string, body: string) {
  // TODO: replace with provider call. Stubbed to console in dev.
  console.info(`[email:stub] to=${to} subject="${subject}" body="${body}"`);
}

async function deliverSms(to: string, body: string) {
  // TODO: replace with Twilio/MessageBird call.
  console.info(`[sms:stub] to=${to} body="${body}"`);
}

/** Fire the customer notifications for an event, honouring the business toggles. */
export async function notifyClient(kind: NotificationKind, business: Business, appt: Appointment, serviceName: string, timeLabel: string) {
  if (!business.notifications[kind]) return;
  const body = buildMessage(kind, business, appt, serviceName, timeLabel);
  const subject = kind === 'confirmation' ? 'Booking confirmed' : kind === 'cancellation' ? 'Booking cancelled' : 'Appointment reminder';
  if (appt.clientEmail) await deliverEmail(appt.clientEmail, subject, body);
  if (appt.clientPhone) await deliverSms(appt.clientPhone, body);
}
