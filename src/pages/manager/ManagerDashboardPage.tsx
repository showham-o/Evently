import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  PencilLine,
  Repeat,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import type { EventWithCreator } from '../../lib/supabase/types';
import { groupEventsBySeries } from '../../utils/recurrence';
import { PageContainer } from '../../components/layout/PageContainer';
import { EventCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatShortDateTime } from '../../utils/format';

type EventListItem = EventWithCreator & { occurrenceCount: number };

function seriesKey(event: EventWithCreator): string {
  return event.recurrence_group_id ?? event.id;
}

export function ManagerDashboardPage() {
  const { profile } = useAuth();
  const [allEvents, setAllEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  async function loadEvents() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*, creator:profiles!created_by(id,full_name)')
      .order('event_date', { ascending: false });

    const all = (data ?? []) as unknown as EventWithCreator[];
    const mine = profile.role === 'super_admin' ? all : all.filter((event) => event.manager_ids.includes(profile.id));
    setAllEvents(mine);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleDelete(eventId: string) {
    setDeletingId(eventId);
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    setDeletingId(null);

    if (error) {
      toast.error('מחיקת האירוע נכשלה');
      return;
    }

    toast.success('האירוע נמחק בהצלחה');
    setConfirmingDeleteId(null);
    setAllEvents((current) => current.filter((e) => e.id !== eventId));
  }

  function toggleExpanded(key: string) {
    setExpandedSeries((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // A recurring series is stored as one row per occurrence (each independently
  // bookable, with its own capacity/invitees) - collapse to one card per
  // series by default, with an option to expand and manage every occurrence.
  const events: EventListItem[] = groupEventsBySeries(allEvents);
  const eventsBySeriesKey = new Map<string, EventWithCreator[]>();
  for (const event of allEvents) {
    const key = seriesKey(event);
    const list = eventsBySeriesKey.get(key);
    if (list) list.push(event);
    else eventsBySeriesKey.set(key, [event]);
  }

  function renderEventCard(event: EventWithCreator, options?: { compact?: boolean }) {
    return (
      <Card key={event.id} className={options?.compact ? 'flex flex-col gap-2.5 p-4' : 'flex flex-col gap-3 p-5'}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={options?.compact ? 'text-sm font-semibold text-slate-900' : 'font-semibold text-slate-900'}>
            {event.title}
          </h3>
          <StatusBadge status={event.status} />
        </div>
        <p className="text-sm text-slate-500">{formatShortDateTime(event.event_date)}</p>
        {!options?.compact && event.creator && (
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <UserIcon className="h-4 w-4 shrink-0" />
            {event.creator.full_name}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <Link to={`/manager/events/${event.id}/edit`} className="flex-1">
            <Button variant="outline" icon={<PencilLine className="h-4 w-4" />} className="w-full">
              עריכה
            </Button>
          </Link>
          <Link to={`/manager/events/${event.id}/invitees`} className="flex-1">
            <Button variant="outline" icon={<UsersIcon className="h-4 w-4" />} className="w-full">
              נרשמים
            </Button>
          </Link>
        </div>

        {confirmingDeleteId === event.id ? (
          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={deletingId === event.id}
              onClick={() => handleDelete(event.id)}
              className="flex-1"
            >
              אישור מחיקה
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmingDeleteId(null)}
              disabled={deletingId === event.id}
              className="flex-1"
            >
              ביטול
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            icon={<Trash2 className="h-4 w-4 text-red-600" />}
            onClick={() => setConfirmingDeleteId(event.id)}
            className="text-red-600"
          >
            מחיקת אירוע
          </Button>
        )}
      </Card>
    );
  }

  return (
    <PageContainer>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LayoutDashboard className="h-6 w-6 text-primary-600" />
            ניהול אירועים
          </h1>
          <p className="mt-1 text-slate-500">האירועים שאתם מנהלים או שותפים בניהולם</p>
        </div>
        <Link to="/manager/events/new">
          <Button icon={<CalendarPlus className="h-4 w-4" />}>אירוע חדש</Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="עדיין אין לך אירועים"
          description="צרו אירוע חדש כדי להתחיל"
          action={
            <Link to="/manager/events/new">
              <Button>יצירת אירוע</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {events.map((event) => {
            const key = seriesKey(event);
            const seriesEvents = eventsBySeriesKey.get(key) ?? [event];
            const otherOccurrences = seriesEvents.filter((e) => e.id !== event.id);
            const expanded = expandedSeries.has(key);

            return (
              <div key={event.id} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-2">
                  {renderEventCard(event)}
                  {event.recurrence_label && (
                    <p className="flex items-center gap-1.5 text-sm text-slate-500">
                      <Repeat className="h-4 w-4 shrink-0" />
                      {event.recurrence_label}
                    </p>
                  )}
                  {otherOccurrences.length > 0 && (
                    <Button
                      variant="ghost"
                      icon={expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      onClick={() => toggleExpanded(key)}
                      className="self-start !px-2.5 !py-1.5 text-slate-500"
                    >
                      {expanded ? 'הסתרת מופעים נוספים' : `הצגת ${otherOccurrences.length} מופעים נוספים בסדרה`}
                    </Button>
                  )}
                </div>

                {expanded &&
                  otherOccurrences.map((occurrence) => (
                    <div key={occurrence.id} className="flex flex-col gap-2">
                      {renderEventCard(occurrence, { compact: true })}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
