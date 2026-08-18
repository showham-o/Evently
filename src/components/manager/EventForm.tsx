import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Event, EventStatus, RegistrationMode } from '../../lib/supabase/types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface EventFormValues {
  title: string;
  description: string;
  location: string;
  event_date: string;
  max_capacity: string;
  minimum_age: string;
  status: EventStatus;
  registration_mode: RegistrationMode;
}

interface EventFormProps {
  initial?: Event;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => void;
  /** true once the event has at least one invitee - registration_mode can no longer change. */
  lockRegistrationMode?: boolean;
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
];

export function EventForm({ initial, submitting, submitLabel, onSubmit, lockRegistrationMode }: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    location: initial?.location ?? '',
    event_date: toDateTimeLocal(initial?.event_date),
    max_capacity: initial?.max_capacity != null ? String(initial.max_capacity) : '',
    minimum_age: initial?.minimum_age != null ? String(initial.minimum_age) : '',
    status: initial?.status ?? 'draft',
    registration_mode: initial?.registration_mode ?? 'registered_only',
  });

  function update<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="title"
        label="שם האירוע"
        required
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

      <Input
        id="event_date"
        type="datetime-local"
        label="תאריך ושעה"
        required
        value={values.event_date}
        onChange={(e) => update('event_date', e.target.value)}
      />

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
