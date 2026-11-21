// Customer and business notifications via beautifully designed SMTP email and optional SMS/Twilio.
import { sendEmail } from './email';
import {
  customerBookingCancelledEmail,
  customerBookingConfirmedEmail,
  customerBookingReminderEmail,
} from './email-templates';
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

async function deliverEmail(to: string, subject: string, html: string, text?: string) {
  await sendEmail({ to, subject, html, text });
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

/** Fire the customer notifications for an event, honouring the business toggles. */
export async function notifyClient(
  kind: NotificationKind,
  business: Business,
  appt: Appointment,
  serviceName: string,
  timeLabel: string,
  staffName?: string
) {
  if (!business.notifications[kind]) return;
  const plainText = buildMessage(kind, business, appt, serviceName, timeLabel);

  if (appt.clientEmail) {
    let emailData: { subject: string; html: string };
    if (kind === 'confirmation') {
      emailData = customerBookingConfirmedEmail({ business, appt, timeLabel, staffName });
    } else if (kind === 'cancellation') {
      emailData = customerBookingCancelledEmail({ business, appt, timeLabel });
    } else {
      emailData = customerBookingReminderEmail({ business, appt, timeLabel });
    }
    await deliverEmail(appt.clientEmail, emailData.subject, emailData.html, plainText);
  }

  if (appt.clientPhone) {
    await deliverSms(appt.clientPhone, plainText).catch(() => {});
  }
}
