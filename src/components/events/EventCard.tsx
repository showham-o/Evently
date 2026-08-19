import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Repeat, User as UserIcon, Users } from 'lucide-react';
import type { Event } from '../../lib/supabase/types';
import { StatusBadge } from '../ui/StatusBadge';
import { formatEventDate } from '../../utils/format';

interface EventCardProps {
  event: Event;
  approvedCount?: number;
  creatorName?: string | null;
  /** Total occurrences in this event's recurring series, if it's part of one. */
  occurrenceCount?: number;
  linkTo?: string;
}

export function EventCard({ event, approvedCount, creatorName, occurrenceCount, linkTo }: EventCardProps) {
  const isFull =
    !!event.max_capacity && event.max_capacity > 0 && (approvedCount ?? 0) >= event.max_capacity;

  return (
    <Link
      to={linkTo ?? `/e/${event.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900 group-hover:text-primary-700">
          {event.title}
        </h3>
        <StatusBadge status={isFull ? 'full' : event.status} />
      </div>

      <div className="flex flex-col gap-1.5 text-sm text-slate-500">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 shrink-0" />
          {formatEventDate(event.event_date)}
        </div>
        {event.recurrence_label && (
          <div className="flex items-center gap-1.5">
            <Repeat className="h-4 w-4 shrink-0" />
            {event.recurrence_label}
            {!!occurrenceCount && occurrenceCount > 1 && ` · ${occurrenceCount} מופעים`}
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" />
            {event.location}
          </div>
        )}
        {creatorName && (
          <div className="flex items-center gap-1.5">
            <UserIcon className="h-4 w-4 shrink-0" />
            {creatorName}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 shrink-0" />
          {!!event.max_capacity && event.max_capacity > 0 ? (
            <span>
              <span dir="ltr" className="inline-block">
                {approvedCount ?? 0} / {event.max_capacity}
              </span>{' '}
              נרשמים
            </span>
          ) : (
            <span>{approvedCount ?? 0} נרשמים</span>
          )}
        </div>
      </div>
    </Link>
  );
}
