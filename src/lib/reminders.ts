// 24-hour reminder job. Called by an external scheduler (Cloud Scheduler, Vercel Cron, GitHub Actions)
// hitting GET /api/cron/reminders with Authorization: Bearer $CRON_SECRET, roughly every 15 minutes.
import { getBusinessById, listAppointmentsStartingBetween, updateAppointment } from './repo';
import { notifyClient } from './notifications';
import { timeInTz } from './time';

const HOUR = 3_600_000;

export async function sendReminders(now = Date.now()) {
  // Window: appointments starting between 23h and 25h from now, so a 15-minute schedule never misses one.
  const appts = await listAppointmentsStartingBetween(new Date(now + 23 * HOUR).toISOString(), new Date(now + 25 * HOUR).toISOString());
  const businesses = new Map<string, Awaited<ReturnType<typeof getBusinessById>>>();
  let sent = 0;
  let failed = 0;
  for (const a of appts) {
    if (a.status !== 'confirmed' || a.kind !== 'booking' || a.reminderSentAt) continue;
    if (!businesses.has(a.businessId)) businesses.set(a.businessId, await getBusinessById(a.businessId));
    const biz = businesses.get(a.businessId);
    if (!biz || !biz.notifications.reminder24h) continue;
    try {
      await notifyClient('reminder24h', biz, a, a.title, `${new Intl.DateTimeFormat('en-GB', { timeZone: biz.timezone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(a.startAt))} ${timeInTz(a.startAt, biz.timezone)}`);
      await updateAppointment(a.id, { reminderSentAt: new Date().toISOString() });
      sent++;
    } catch (e) {
      failed++;
      console.error('reminder failed', a.id, e);
    }
  }
  return { checked: appts.length, sent, failed };
}
