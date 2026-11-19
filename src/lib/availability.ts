// Slot availability engine. PURE: no I/O, no Node APIs, fully unit-testable.
// Given business hours, staff hours, the service's duration + buffer, and existing busy
// intervals (which already include their own buffers), it returns every bookable start time.
import type { WeekHours } from './types';
import { timeInTz, weekdayOfDateKey, zonedToUtcMs } from './time';

export interface BusyInterval {
  startMs: number;
  endMs: number; // end INCLUDING the existing appointment's buffer
}

export interface AvailabilityInput {
  timezone: string;
  businessHours: WeekHours;
  staffHours?: WeekHours | null; // omit/null = no staff constraint
  date: string; // "YYYY-MM-DD" in business timezone
  durationMin: number; // total service duration
  bufferMin: number; // prep/cleanup buffer that must also be free
  busy: BusyInterval[];
  stepMin?: number; // slot grid, default 15
  earliestMs?: number; // do not offer slots starting before this instant (now + notice)
}

export interface OpenSlot {
  startAt: string; // ISO UTC
  time: string; // "HH:mm" wall-clock in business timezone
}

const MIN = 60_000;

/** Intersect [a0,a1) and [b0,b1); returns null when empty. */
function intersect(a0: number, a1: number, b0: number, b1: number): [number, number] | null {
  const s = Math.max(a0, b0);
  const e = Math.min(a1, b1);
  return e > s ? [s, e] : null;
}

export function getOpenSlots(input: AvailabilityInput): OpenSlot[] {
  const { timezone, date, durationMin, bufferMin, busy } = input;
  const step = (input.stepMin ?? 15) * MIN;
  const dow = String(weekdayOfDateKey(date));

  const biz = input.businessHours[dow];
  if (!biz?.open) return [];
  let window = intersect(
    zonedToUtcMs(date, biz.start, timezone), zonedToUtcMs(date, biz.end, timezone),
    -Infinity, Infinity,
  );
  if (!window) return [];

  if (input.staffHours) {
    const st = input.staffHours[dow];
    if (!st?.open) return [];
    window = intersect(window[0], window[1], zonedToUtcMs(date, st.start, timezone), zonedToUtcMs(date, st.end, timezone));
    if (!window) return [];
  }

  const serviceMs = durationMin * MIN;
  const occupiedMs = (durationMin + bufferMin) * MIN;
  const [winStart, winEnd] = window;
  const slots: OpenSlot[] = [];

  for (let t = winStart; t + serviceMs <= winEnd; t += step) {
    if (input.earliestMs !== undefined && t < input.earliestMs) continue;
    const candEnd = t + occupiedMs;
    const clash = busy.some((b) => t < b.endMs && b.startMs < candEnd);
    if (clash) continue;
    slots.push({ startAt: new Date(t).toISOString(), time: timeInTz(t, timezone) });
  }
  return slots;
}

/** Convenience: is a specific [start, start+duration+buffer) window free for this staff? */
export function isWindowFree(startMs: number, durationMin: number, bufferMin: number, busy: BusyInterval[]): boolean {
  const end = startMs + (durationMin + bufferMin) * MIN;
  return !busy.some((b) => startMs < b.endMs && b.startMs < end);
}

