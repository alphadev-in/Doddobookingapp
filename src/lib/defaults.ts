import type { WeekHours } from './types';

/** Mon-Fri 09:00-18:00, Sat 10:00-16:00, Sun closed. Used by onboarding and new staff. */
export function defaultHours(): WeekHours {
  const d = (open: boolean, start = '09:00', end = '18:00') => ({ open, start, end });
  return { '0': d(false), '1': d(true), '2': d(true), '3': d(true), '4': d(true), '5': d(true), '6': d(true, '10:00', '16:00') };
}
