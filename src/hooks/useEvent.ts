import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import type { Event } from '../lib/supabase/types';
import { getApprovedCount } from '../utils/rsvp';

interface UseEventResult {
  event: Event | null;
  approvedCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEvent(eventId: string | undefined): UseEventResult {
  const [event, setEvent] = useState<Event | null>(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);

    try {
      const [{ data, error: eventError }, count] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).single(),
        getApprovedCount(eventId),
      ]);

      if (eventError) throw eventError;
      setEvent(data as Event);
      setApprovedCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת האירוע');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, approvedCount, loading, error, refetch: fetchEvent };
}
