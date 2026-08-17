import { useEffect, useState } from 'react';
import { CalendarX } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import type { Event } from '../lib/supabase/types';
import { PageContainer } from '../components/layout/PageContainer';
import { EventCard } from '../components/events/EventCard';
import { EventCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .order('event_date', { ascending: true });

      if (!mounted) return;
      const list = (data ?? []) as Event[];
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
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="אין אירועים כרגע"
          description="כשיפורסמו אירועים חדשים הם יופיעו כאן"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} approvedCount={counts[event.id]} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
