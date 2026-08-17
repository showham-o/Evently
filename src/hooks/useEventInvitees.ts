import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import type { EventInviteeWithProfile } from '../lib/supabase/types';

interface UseEventInviteesResult {
  invitees: EventInviteeWithProfile[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEventInvitees(eventId: string | undefined): UseEventInviteesResult {
  const [invitees, setInvitees] = useState<EventInviteeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitees = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('event_invitees')
        .select('*, profile:profiles(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setInvitees((data ?? []) as unknown as EventInviteeWithProfile[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנרשמים');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchInvitees();
  }, [fetchInvitees]);

  return { invitees, loading, error, refetch: fetchInvitees };
}
