// Beautifully designed HTML email templates for Doddo.
import { emailLayout } from './email';
import type { Appointment, Business } from './types';

const getSiteUrl = () => (process.env.PUBLIC_SITE_URL || 'https://doddo.co.uk').replace(/\/+$/, '');

/** 1. Subscription Confirmation Email (Sent to Business Owner upon Stripe payment) */
export function subscriptionActivatedEmail({
  businessName,
  planName = 'Standard Plan',
  amount = '£5.00',
  currentPeriodEnd,
}: {
  businessName: string;
  planName?: string;
  amount?: string;
  currentPeriodEnd?: string | null;
}) {
  const siteUrl = getSiteUrl();
  const periodEndFormatted = currentPeriodEnd
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(currentPeriodEnd))
    : 'Next month';

  const content = `
    <!-- Badge -->
    <div style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 12px; border-radius: 9999px; margin-bottom: 20px;">
      ✓ Subscription Active
    </div>

    <!-- Title -->
    <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      Welcome to Doddo, ${businessName}!
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
      Your Doddo subscription has been successfully activated. Your live online booking calendar, appointment alerts, and client management tools are now fully unlocked.
    </p>

    <!-- Plan Summary Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 28px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 14px; color: #64748b; padding-bottom: 8px;">Plan</td>
              <td align="right" style="font-size: 15px; font-weight: 700; color: #0f172a; padding-bottom: 8px;">${planName}</td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #64748b; padding-bottom: 8px;">Amount</td>
              <td align="right" style="font-size: 15px; font-weight: 700; color: #6366f1; padding-bottom: 8px;">${amount} / month</td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #64748b;">Next billing date</td>
              <td align="right" style="font-size: 14px; font-weight: 600; color: #334155;">${periodEndFormatted}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Call to Action -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <a href="${siteUrl}/dashboard" style="display: block; width: 100%; box-sizing: border-box; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; text-align: center; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);">
            Open Your Dashboard →
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Subscription Activated — Welcome to Doddo, ${businessName}!`,
    html: emailLayout(content, `Your Doddo subscription is now active for ${businessName}.`),
  };
}

/** 2. Customer Appointment Confirmation */
export function customerBookingConfirmedEmail({
  business,
  appt,
  timeLabel,
  staffName,
}: {
  business: Business;
  appt: Appointment;
  timeLabel: string;
  staffName?: string;
}) {
  const siteUrl = getSiteUrl();
  const manageUrl = `${siteUrl}/booking/${appt.id}?t=${appt.manageToken}`;
  const depositText = appt.depositCents > 0
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: business.currency }).format(appt.depositCents / 100)
    : null;

  const content = `
    <!-- Badge -->
    <div style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 12px; border-radius: 9999px; margin-bottom: 20px;">
      ✓ Booking Confirmed
    </div>

    <!-- Title -->
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      Your appointment with ${business.name}
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
      Hi ${appt.clientName.split(' ')[0] || 'there'}, your booking has been received and confirmed.
    </p>

    <!-- Appointment Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Service</td>
              <td align="right" style="font-size: 14px; font-weight: 700; color: #0f172a; padding-bottom: 8px;">${appt.title}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Date & Time</td>
              <td align="right" style="font-size: 14px; font-weight: 700; color: #6366f1; padding-bottom: 8px;">${timeLabel}</td>
            </tr>
            ${staffName ? `
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Staff Member</td>
              <td align="right" style="font-size: 14px; font-weight: 600; color: #334155; padding-bottom: 8px;">${staffName}</td>
            </tr>
            ` : ''}
            ${depositText ? `
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Deposit Paid</td>
              <td align="right" style="font-size: 14px; font-weight: 700; color: #059669; padding-bottom: 8px;">${depositText}</td>
            </tr>
            ` : ''}
            ${business.addressLine1 ? `
            <tr>
              <td style="font-size: 13px; color: #64748b; vertical-align: top;">Location</td>
              <td align="right" style="font-size: 13px; color: #334155;">
                ${business.addressLine1}${business.city ? `, ${business.city}` : ''}${business.postcode ? ` ${business.postcode}` : ''}
              </td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>

    <!-- Call to Action -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
      <tr>
        <td align="center">
          <a href="${manageUrl}" style="display: block; width: 100%; box-sizing: border-box; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; text-align: center; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);">
            Manage or Reschedule Booking
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 12px; text-align: center; color: #94a3b8;">
      Need to make changes? You can easily reschedule or cancel using the link above.
    </p>
  `;

  return {
    subject: `Booking Confirmed: ${appt.title} at ${business.name}`,
    html: emailLayout(content, `Your booking for ${appt.title} at ${business.name} is confirmed for ${timeLabel}.`),
  };
}

/** 3. Business Owner: New Appointment Alert */
export function businessNewBookingEmail({
  business,
  appt,
  timeLabel,
  staffName,
}: {
  business: Business;
  appt: Appointment;
  timeLabel: string;
  staffName?: string;
}) {
  const siteUrl = getSiteUrl();
  const calendarUrl = `${siteUrl}/dashboard/calendar`;
  const depositText = appt.depositCents > 0
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: business.currency }).format(appt.depositCents / 100)
    : null;

  const content = `
    <!-- Badge -->
    <div style="display: inline-block; background-color: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 12px; border-radius: 9999px; margin-bottom: 20px;">
      🔔 New Appointment
    </div>

    <!-- Title -->
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      New booking from ${appt.clientName || 'A client'}
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
      A new online booking has been placed and added to your calendar.
    </p>

    <!-- Details Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Client</td>
              <td align="right" style="font-size: 14px; font-weight: 700; color: #0f172a; padding-bottom: 8px;">${appt.clientName}</td>
            </tr>
            ${appt.clientEmail ? `
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Email</td>
              <td align="right" style="font-size: 14px; color: #334155; padding-bottom: 8px;">${appt.clientEmail}</td>
            </tr>
            ` : ''}
            ${appt.clientPhone ? `
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Phone</td>
              <td align="right" style="font-size: 14px; color: #334155; padding-bottom: 8px;">${appt.clientPhone}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Service</td>
              <td align="right" style="font-size: 14px; font-weight: 700; color: #0f172a; padding-bottom: 8px;">${appt.title}</td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Time</td>
              <td align="right" style="font-size: 14px; font-weight: 700; color: #6366f1; padding-bottom: 8px;">${timeLabel}</td>
            </tr>
            ${staffName ? `
            <tr>
              <td style="font-size: 13px; color: #64748b; padding-bottom: 8px;">Team Member</td>
              <td align="right" style="font-size: 14px; font-weight: 600; color: #334155; padding-bottom: 8px;">${staffName}</td>
            </tr>
            ` : ''}
            ${depositText ? `
            <tr>
              <td style="font-size: 13px; color: #64748b;">Deposit Collected</td>
              <td align="right" style="font-size: 14px; font-weight: 700; color: #059669;">${depositText}</td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>

    <!-- Call to Action -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <a href="${calendarUrl}" style="display: block; width: 100%; box-sizing: border-box; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; text-align: center; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);">
            View on Calendar →
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `New Booking: ${appt.clientName || 'Client'} · ${appt.title} (${timeLabel})`,
    html: emailLayout(content, `New appointment from ${appt.clientName}: ${appt.title} on ${timeLabel}.`),
  };
}

/** 4. Customer: Cancellation Email */
export function customerBookingCancelledEmail({
  business,
  appt,
  timeLabel,
}: {
  business: Business;
  appt: Appointment;
  timeLabel: string;
}) {
  const siteUrl = getSiteUrl();
  const bookAgainUrl = `${siteUrl}/book/${business.slug}`;

  const content = `
    <!-- Badge -->
    <div style="display: inline-block; background-color: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 12px; border-radius: 9999px; margin-bottom: 20px;">
      Appointment Cancelled
    </div>

    <!-- Title -->
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      Booking cancelled
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
      Hi ${appt.clientName.split(' ')[0] || 'there'}, your appointment for <strong>${appt.title}</strong> on <strong>${timeLabel}</strong> at <strong>${business.name}</strong> has been cancelled.
    </p>

    <!-- Re-book CTA -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <a href="${bookAgainUrl}" style="display: block; width: 100%; box-sizing: border-box; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; text-align: center; padding: 14px 28px; border-radius: 12px;">
            Book a New Appointment
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Booking Cancelled: ${appt.title} at ${business.name}`,
    html: emailLayout(content, `Your appointment for ${appt.title} at ${business.name} has been cancelled.`),
  };
}

/** 5. Customer: 24h Reminder Email */
export function customerBookingReminderEmail({
  business,
  appt,
  timeLabel,
}: {
  business: Business;
  appt: Appointment;
  timeLabel: string;
}) {
  const siteUrl = getSiteUrl();
  const manageUrl = `${siteUrl}/booking/${appt.id}?t=${appt.manageToken}`;

  const content = `
    <!-- Badge -->
    <div style="display: inline-block; background-color: #fef3c7; color: #d97706; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 12px; border-radius: 9999px; margin-bottom: 20px;">
      Appointment Reminder
    </div>

    <!-- Title -->
    <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.3;">
      See you tomorrow!
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
      Hi ${appt.clientName.split(' ')[0] || 'there'}, this is a friendly reminder of your upcoming booking at <strong>${business.name}</strong>.
    </p>

    <!-- Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #0f172a;">${appt.title}</p>
      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #6366f1;">${timeLabel}</p>
      ${business.addressLine1 ? `<p style="margin: 8px 0 0; font-size: 13px; color: #64748b;">${business.addressLine1}${business.city ? `, ${business.city}` : ''}</p>` : ''}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <a href="${manageUrl}" style="display: block; width: 100%; box-sizing: border-box; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; text-align: center; padding: 14px 28px; border-radius: 12px;">
            View Booking Details
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Reminder: ${appt.title} tomorrow at ${business.name}`,
    html: emailLayout(content, `Reminder: Your appointment for ${appt.title} at ${business.name} is tomorrow (${timeLabel}).`),
  };
}
