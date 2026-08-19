export const WEEKDAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'יומי',
  weekly: 'שבועי',
  monthly: 'חודשי',
  yearly: 'שנתי',
};

// Yearly recurrence has no required end date (an annual event, e.g. a
// birthday, isn't naturally bounded to a year like the others) - when the
// manager leaves it open, this many future occurrences are materialized as
// actual event rows so the series stays a finite, real set of bookable
// events rather than something unbounded.
export const YEARLY_DEFAULT_OCCURRENCES = 10;

/** Parses a "YYYY-MM-DD" date-input value as a local-time date (avoids the
 * UTC-midnight shift that `new Date("YYYY-MM-DD")` causes). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isEndDateRequired(frequency: RecurrenceFrequency): boolean {
  return frequency !== 'yearly';
}

/** daily/weekly/monthly are capped at one year from the start date; yearly is open. */
export function maxRecurrenceEndDate(startDate: string): Date {
  const max = parseLocalDate(startDate);
  max.setFullYear(max.getFullYear() + 1);
  return max;
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTargetMonth));
  return d;
}

function withTime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export interface RecurrenceParams {
  frequency: RecurrenceFrequency;
  time: string;
  startDate: string;
  /** Required for daily/weekly/monthly; optional (open-ended) for yearly. */
  endDate: string | null;
  /** Only meaningful when frequency === 'weekly'. */
  weekday?: number;
}

export function computeOccurrences({ frequency, time, startDate, endDate, weekday }: RecurrenceParams): Date[] {
  const [hours, minutes] = time.split(':').map(Number);
  const start = parseLocalDate(startDate);
  const end = endDate ? parseLocalDate(endDate) : null;
  const occurrences: Date[] = [];

  if (frequency === 'weekly') {
    const cursor = new Date(start);
    const daysUntilWeekday = ((weekday ?? start.getDay()) - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + daysUntilWeekday);
    while (end && cursor <= end) {
      occurrences.push(withTime(cursor, hours, minutes));
      cursor.setDate(cursor.getDate() + 7);
    }
    return occurrences;
  }

  if (frequency === 'daily') {
    const cursor = new Date(start);
    while (end && cursor <= end) {
      occurrences.push(withTime(cursor, hours, minutes));
      cursor.setDate(cursor.getDate() + 1);
    }
    return occurrences;
  }

  if (frequency === 'monthly') {
    let i = 0;
    let cursor = addMonthsClamped(start, i);
    while (end && cursor <= end) {
      occurrences.push(withTime(cursor, hours, minutes));
      i += 1;
      cursor = addMonthsClamped(start, i);
    }
    return occurrences;
  }

  // yearly - open-ended unless an end date was given
  let i = 0;
  while (true) {
    const cursor = new Date(start.getFullYear() + i, start.getMonth(), start.getDate());
    if (end && cursor > end) break;
    occurrences.push(withTime(cursor, hours, minutes));
    i += 1;
    if (!end && i >= YEARLY_DEFAULT_OCCURRENCES) break;
  }
  return occurrences;
}

export function describeRecurrence(frequency: RecurrenceFrequency, time: string, weekday?: number): string {
  switch (frequency) {
    case 'daily':
      return `חוזר כל יום בשעה ${time}`;
    case 'weekly':
      return `חוזר כל יום ${WEEKDAY_LABELS[weekday ?? 0]} בשעה ${time}`;
    case 'monthly':
      return `חוזר כל חודש בשעה ${time}`;
    case 'yearly':
      return `חוזר כל שנה בשעה ${time}`;
  }
}
