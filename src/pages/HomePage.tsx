import { useEffect, useState } from 'react';
import { CalendarX } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthProvider';
import type { EventWithCreator } from '../lib/supabase/types';
import { groupEventsBySeries } from '../utils/recurrence';
import { PageContainer } from '../components/layout/PageContainer';
import { EventCard } from '../components/events/EventCard';
import { EventCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

type EventListItem = EventWithCreator & { occurrenceCount: number };

export function HomePage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('*, creator:profiles!created_by(id,full_name)')
        .eq('status', 'published')
        .order('event_date', { ascending: true });

      if (!mounted) return;
      // A recurring series is stored as one row per occurrence (each with
      // its own capacity/invitee list) - collapse to one card per series.
      const list = groupEventsBySeries((data ?? []) as unknown as EventWithCreator[]);
      setEvents(list);

      const countsResult: Record<string, number> = {};
      await Promise.all(
        list.map(async (event) => {
          const { count } = await supabase
            .from('event_invitees')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('rsvp_status', 'attending')
            .eq('registration_status', 'approved');
          countsResult[event.id] = count ?? 0;
        }),
      );

      if (!mounted) return;
      setCounts(countsResult);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // invite_only events are unlisted from general browsing - only their own
  // managers see them here. Computed at render time (not baked into the
  // fetch) so it reacts correctly once auth/profile resolves, whichever
  // finishes loading second.
  const isManagerOf = (event: EventWithCreator) =>
    profile?.role === 'super_admin' || event.manager_ids.includes(profile?.id ?? '');
  const visibleEvents = events.filter((event) => event.registration_mode !== 'invite_only' || isManagerOf(event));

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">אירועים קרובים</h1>
        <p className="mt-1 text-slate-500">מצאו אירועים ואשרו הגעה במקום אחד</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : visibleEvents.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="אין אירועים כרגע"
          description="כשיפורסמו אירועים חדשים הם יופיעו כאן"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              approvedCount={counts[event.id]}
              creatorName={event.creator?.full_name}
              occurrenceCount={event.occurrenceCount}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
