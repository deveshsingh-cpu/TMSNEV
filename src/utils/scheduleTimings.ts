export interface ResolvedRouteScheduleTimings {
  morningArrivalTime: string;
  eveningDepartureTime: string;
}

export interface TimeReconciliationResult {
  actualMinutes: number | null;
  scheduledMinutes: number | null;
  diffMinutes: number | null;
  isLate: boolean;
  isOnTime: boolean;
}

export function getDefaultMorningArrivalTime(tripNumber?: number): string {
  const num = Number(tripNumber || 1);
  if (num === 1) return '08:00 AM';
  if (num === 2) return '08:45 AM';
  return '09:15 AM';
}

export function getDefaultEveningDepartureTime(tripNumber?: number): string {
  const num = Number(tripNumber || 1);
  if (num === 1) return '01:00 PM';
  if (num === 2) return '01:30 PM';
  return '02:00 PM';
}

export function resolveRouteScheduleTimings(
  route?: { arrivalTime?: string; departureTime?: string; tripNumber?: number } | null,
  service?: { arrivalTime?: string; departureTime?: string; tripNumber?: number } | null
): ResolvedRouteScheduleTimings {
  const tripNum = Number(route?.tripNumber ?? service?.tripNumber ?? 1);
  const rawArrival = String(route?.arrivalTime || service?.arrivalTime || '').trim();
  const rawDeparture = String(route?.departureTime || service?.departureTime || '').trim();

  return {
    morningArrivalTime: rawArrival || getDefaultMorningArrivalTime(tripNum),
    eveningDepartureTime: rawDeparture || getDefaultEveningDepartureTime(tripNum),
  };
}

/**
 * Parses 12-hour ("08:05 AM", "1:30 PM", "12:15pm") or 24-hour ("08:05", "13:30", "8.45")
 * time strings into minutes since midnight (0..1439). Returns null if empty/invalid.
 */
export function parseTimeToMinutes(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned === '—' || cleaned === '-') return null;

  const match = cleaned.match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})(?:\s*[:.]\s*\d{1,2})?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) {
    return null;
  }

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'AM') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours < 0 || hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Converts any valid time string to HTML `<input type="time">` 24-hour "HH:MM" value.
 */
export function toHtmlTimeInputValue(raw?: string | null): string {
  const mins = parseTimeToMinutes(raw);
  if (mins === null) return '';
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Formats any valid time string cleanly as 12-hour "HH:MM AM/PM".
 */
export function formatTime12Hour(raw?: string | null): string {
  const mins = parseTimeToMinutes(raw);
  if (mins === null) return String(raw || '').trim();
  const totalHours = Math.floor(mins / 60);
  const mm = mins % 60;
  const meridiem = totalHours >= 12 ? 'PM' : 'AM';
  const hh12 = totalHours % 12 === 0 ? 12 : totalHours % 12;
  return `${String(hh12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${meridiem}`;
}

/**
 * Reconciles an actual attendance arrival/departure time against the scheduled time.
 * On or before scheduled time => isOnTime (black font).
 * Strictly beyond scheduled time => isLate (red font).
 */
export function compareActualToScheduledTime(
  actual?: string | null,
  scheduled?: string | null
): TimeReconciliationResult {
  const actualMinutes = parseTimeToMinutes(actual);
  const scheduledMinutes = parseTimeToMinutes(scheduled);
  if (actualMinutes === null || scheduledMinutes === null) {
    return {
      actualMinutes,
      scheduledMinutes,
      diffMinutes: null,
      isLate: false,
      isOnTime: false,
    };
  }
  const diffMinutes = actualMinutes - scheduledMinutes;
  return {
    actualMinutes,
    scheduledMinutes,
    diffMinutes,
    isLate: diffMinutes > 0,
    isOnTime: diffMinutes <= 0,
  };
}
