import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { EventAttendeeSummary } from '../../lib/supabase/types';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';

interface AttendeeListProps {
  eventId: string;
}

/**
 * Renders "who's registered" for an event, backed by the `event_attendee_summary`
 * view. The view already filters rows server-side to whatever the current
 * caller is allowed to see per the event's attendee_list_visibility setting -
 * no client-side permission logic here. An empty result may mean "nobody
 * registered" or "you're not allowed to see this"; that ambiguity is fine.
 */
export function AttendeeList({ eventId }: AttendeeListProps) {
  const [rows, setRows] = useState<EventAttendeeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase.from('event_attendee_summary').select('*').eq('event_id', eventId);

      if (mounted) {
        if (!error && data) setRows(data as EventAttendeeSummary[]);
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [eventId]);

  // Secondary section - stay unobtrusive while loading rather than blocking
  // the rest of the page on it.
  if (loading) return null;

  if (rows.length === 0) {
    return <p className="mt-6 text-center text-sm text-slate-400">אין עדיין נרשמים גלויים</p>;
  }

  return (
    <Card className="mt-6 p-6">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">מי נרשם לאירוע</h3>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li
            key={`${row.full_name ?? 'guest'}-${index}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
          >
            <span>{row.full_name ?? 'ללא שם'}</span>
            <StatusBadge status={row.rsvp_status} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
