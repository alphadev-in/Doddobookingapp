// Customer notifications. Email uses Resend when RESEND_API_KEY and EMAIL_FROM are set; SMS uses Twilio
// when TWILIO_* keys are set. Without keys the message is logged (dev) and nothing is sent.
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
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email:not-configured] to=${to} subject="${subject}"`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: body }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
}

async function deliverSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.info(`[sms:not-configured] to=${to}`);
    return;
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`SMS failed: ${res.status}`);
}

/** Fire the customer notifications for an event, honouring the business toggles. Errors are thrown to the caller. */
export async function notifyClient(kind: NotificationKind, business: Business, appt: Appointment, serviceName: string, timeLabel: string) {
  if (!business.notifications[kind]) return;
  const body = buildMessage(kind, business, appt, serviceName, timeLabel);
  const subject = kind === 'confirmation' ? 'Booking confirmed' : kind === 'cancellation' ? 'Booking cancelled' : 'Appointment reminder';
  if (appt.clientEmail) await deliverEmail(appt.clientEmail, subject, body);
  if (appt.clientPhone) await deliverSms(appt.clientPhone, body);
}
