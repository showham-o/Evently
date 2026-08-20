import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import type { AttendeeListVisibility, Event, EventStatus, RegistrationMode } from '../../lib/supabase/types';
import type { RecurrenceFrequency } from '../../utils/recurrence';
import { FREQUENCY_LABELS, isEndDateRequired, maxRecurrenceEndDate, parseLocalDate, WEEKDAY_LABELS } from '../../utils/recurrence';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export type RecurrenceValue =
  | { type: 'once' }
  | {
      type: 'recurring';
      frequency: RecurrenceFrequency;
      weekday: number; // only meaningful when frequency === 'weekly'
      time: string;
      startDate: string;
      endDate: string; // empty string = no end date (only valid when frequency === 'yearly')
    };

export interface EventFormValues {
  title: string;
  description: string;
  location: string;
  event_date: string;
  max_capacity: string;
  minimum_age: string;
  status: EventStatus;
  registration_mode: RegistrationMode;
  hide_attendee_count: boolean;
  attendee_list_visibility: AttendeeListVisibility;
  recurrence: RecurrenceValue;
}

interface EventFormProps {
  initial?: Event;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => void;
  /** true once the event has at least one invitee - registration_mode can no longer change. */
  lockRegistrationMode?: boolean;
  /** Only offered when creating a new event - editing always targets a single occurrence. */
  allowRecurrence?: boolean;
  /** Called whenever the form's dirty state changes (values differ from their initial snapshot). */
  onDirtyChange?: (dirty: boolean) => void;
}

function buildInitialValues(initial?: Event): EventFormValues {
  return {
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    location: initial?.location ?? '',
    event_date: toDateTimeLocal(initial?.event_date),
    max_capacity: initial?.max_capacity != null ? String(initial.max_capacity) : '',
    minimum_age: initial?.minimum_age != null ? String(initial.minimum_age) : '',
    status: initial?.status ?? 'draft',
    registration_mode: initial?.registration_mode ?? 'registered_only',
    hide_attendee_count: initial?.hide_attendee_count ?? false,
    attendee_list_visibility: initial?.attendee_list_visibility ?? 'managers',
    recurrence: { type: 'once' },
  };
}

function toDateTimeLocal(isoDate?: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const statusOptions: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'טיוטה' },
  { value: 'published', label: 'פורסם' },
  { value: 'cancelled', label: 'בוטל' },
  { value: 'completed', label: 'הסתיים' },
];

const registrationModeOptions: { value: RegistrationMode; label: string }[] = [
  { value: 'registered_only', label: 'רק משתמשים רשומים' },
  { value: 'anyone', label: 'כל אחד, כולל משתמשים לא רשומים' },
  { value: 'invite_only', label: 'רק מוזמנים יכולים להירשם' },
];

const attendeeListVisibilityOptions: { value: AttendeeListVisibility; label: string }[] = [
  { value: 'managers', label: 'מנהלי האירוע בלבד' },
  { value: 'managers_and_invitees', label: 'מנהלים ומי שהוזמן לאירוע' },
  { value: 'logged_in', label: 'כל משתמש מחובר' },
  { value: 'public', label: 'כולם, כולל מי שלא מחובר' },
];

const frequencyOptions: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export function EventForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
  lockRegistrationMode,
  allowRecurrence,
  onDirtyChange,
}: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(() => buildInitialValues(initial));
  const initialSnapshotRef = useRef(JSON.stringify(values));
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);

  useEffect(() => {
    onDirtyChange?.(JSON.stringify(values) !== initialSnapshotRef.current);
  }, [values, onDirtyChange]);

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateRecurrence(patch: Partial<Extract<RecurrenceValue, { type: 'recurring' }>>) {
    setValues((prev) => ({
      ...prev,
      recurrence: {
        type: 'recurring',
        frequency: prev.recurrence.type === 'recurring' ? prev.recurrence.frequency : 'weekly',
        weekday: prev.recurrence.type === 'recurring' ? prev.recurrence.weekday : 2,
        time: prev.recurrence.type === 'recurring' ? prev.recurrence.time : '16:00',
        startDate: prev.recurrence.type === 'recurring' ? prev.recurrence.startDate : '',
        endDate: prev.recurrence.type === 'recurring' ? prev.recurrence.endDate : '',
        ...patch,
      },
    }));
  }

  function validateRecurrence(): boolean {
    if (values.recurrence.type !== 'recurring') return true;
    const { frequency, startDate, endDate } = values.recurrence;

    if (!startDate) {
      setRecurrenceError('יש לבחור תאריך התחלה');
      return false;
    }

    if (!isEndDateRequired(frequency)) {
      // Yearly: end date is optional (open-ended), but if given must make sense.
      if (endDate && parseLocalDate(endDate) < parseLocalDate(startDate)) {
        setRecurrenceError('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
        return false;
      }
      setRecurrenceError(null);
      return true;
    }

    if (!endDate) {
      setRecurrenceError('יש לבחור תאריך סיום');
      return false;
    }
    if (parseLocalDate(endDate) < parseLocalDate(startDate)) {
      setRecurrenceError('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
      return false;
    }
    if (parseLocalDate(endDate) > maxRecurrenceEndDate(startDate)) {
      setRecurrenceError('טווח החזרה מוגבל לשנה אחת לכל היותר מתאריך ההתחלה');
      return false;
    }
    setRecurrenceError(null);
    return true;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateRecurrence()) {
      toast.error('יש לתקן את פרטי החזרה על האירוע');
      return;
    }
    onSubmit(values);
  }

  const recurring = values.recurrence.type === 'recurring' ? values.recurrence : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="title"
        label="שם האירוע"
        required
        maxLength={30}
        value={values.title}
        onChange={(e) => update('title', e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-slate-700">
          תיאור
        </label>
        <textarea
          id="description"
          rows={4}
          value={values.description}
          onChange={(e) => update('description', e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>

      <Input
        id="location"
        label="מיקום"
        value={values.location}
        onChange={(e) => update('location', e.target.value)}
      />

      {allowRecurrence && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="recurrenceType" className="text-sm font-medium text-slate-700">
            סוג אירוע
          </label>
          <select
            id="recurrenceType"
            value={values.recurrence.type}
            onChange={(e) => {
              if (e.target.value === 'once') {
                setValues((prev) => ({ ...prev, recurrence: { type: 'once' } }));
                setRecurrenceError(null);
              } else {
                updateRecurrence({});
              }
            }}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="once">אירוע חד פעמי</option>
            <option value="recurring">אירוע חוזר</option>
          </select>
        </div>
      )}

      {recurring ? (
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="recurrenceFrequency" className="text-sm font-medium text-slate-700">
                תדירות
              </label>
              <select
                id="recurrenceFrequency"
                value={recurring.frequency}
                onChange={(e) => updateRecurrence({ frequency: e.target.value as RecurrenceFrequency, endDate: '' })}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              >
                {frequencyOptions.map((freq) => (
                  <option key={freq} value={freq}>
                    {FREQUENCY_LABELS[freq]}
                  </option>
                ))}
              </select>
            </div>
            <Input
              id="recurrenceTime"
              type="time"
              label="שעה"
              required
              value={recurring.time}
              onChange={(e) => updateRecurrence({ time: e.target.value })}
            />
          </div>

          {recurring.frequency === 'weekly' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="recurrenceWeekday" className="text-sm font-medium text-slate-700">
                יום בשבוע
              </label>
              <select
                id="recurrenceWeekday"
                value={recurring.weekday}
                onChange={(e) => updateRecurrence({ weekday: Number(e.target.value) })}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={index} value={index}>
                    יום {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="recurrenceStartDate"
              type="date"
              label="תאריך התחלה"
              required
              value={recurring.startDate}
              onChange={(e) => updateRecurrence({ startDate: e.target.value })}
            />
            <Input
              id="recurrenceEndDate"
              type="date"
              label={isEndDateRequired(recurring.frequency) ? 'תאריך סיום' : 'תאריך סיום (אופציונלי)'}
              required={isEndDateRequired(recurring.frequency)}
              value={recurring.endDate}
              onChange={(e) => updateRecurrence({ endDate: e.target.value })}
            />
          </div>

          <p className="text-sm text-slate-500">
            {isEndDateRequired(recurring.frequency)
              ? 'טווח החזרה מוגבל לשנה אחת לכל היותר מתאריך ההתחלה.'
              : 'אירוע שנתי ללא תאריך סיום - אם לא ייבחר תאריך סיום, ייווצרו מופעים ל-10 השנים הקרובות.'}
          </p>
          {recurrenceError && <p className="text-sm text-red-600">{recurrenceError}</p>}
        </div>
      ) : (
        <Input
          id="event_date"
          type="datetime-local"
          label="תאריך ושעה"
          required
          value={values.event_date}
          onChange={(e) => update('event_date', e.target.value)}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="max_capacity"
          type="number"
          min={0}
          label="קיבולת מקסימלית (0 = ללא הגבלה)"
          value={values.max_capacity}
          onChange={(e) => update('max_capacity', e.target.value)}
        />
        <Input
          id="minimum_age"
          type="number"
          min={0}
          label="גיל מינימלי"
          value={values.minimum_age}
          onChange={(e) => update('minimum_age', e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="hide_attendee_count" className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            id="hide_attendee_count"
            type="checkbox"
            checked={values.hide_attendee_count}
            onChange={(e) => update('hide_attendee_count', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500/30"
          />
          הסתרת מספר הנרשמים ממבקרים
        </label>
        <p className="text-sm text-slate-500">מנהלי האירוע תמיד יראו את המספר המלא</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="attendee_list_visibility" className="text-sm font-medium text-slate-700">
          מי רשאי לראות מי נרשם לאירוע
        </label>
        <select
          id="attendee_list_visibility"
          value={values.attendee_list_visibility}
          onChange={(e) => update('attendee_list_visibility', e.target.value as AttendeeListVisibility)}
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          {attendeeListVisibilityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="registration_mode" className="text-sm font-medium text-slate-700">
          מי יכול להירשם לאירוע
        </label>
        <select
          id="registration_mode"
          value={values.registration_mode}
          disabled={lockRegistrationMode}
          onChange={(e) => update('registration_mode', e.target.value as RegistrationMode)}
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-slate-100 disabled:text-slate-500"
        >
          {registrationModeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {lockRegistrationMode && (
          <p className="text-sm text-slate-500">
            לא ניתן לשנות הגדרה זו לאחר שמישהו נרשם לאירוע.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-sm font-medium text-slate-700">
          סטטוס
        </label>
        <select
          id="status"
          value={values.status}
          onChange={(e) => update('status', e.target.value as EventStatus)}
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" loading={submitting} className="mt-2 w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
