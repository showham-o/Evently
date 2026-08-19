import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';
import type { Event, EventInvitee } from '../lib/supabase/types';

export interface MyInviteeRow extends EventInvitee {
  event: Event;
}

interface UseMyInviteesResult {
  invitees: MyInviteeRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useMyInvitees(profileId: string | undefined): UseMyInviteesResult {
  const [invitees, setInvitees] = useState<MyInviteeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitees = useCallback(async () => {
    if (!profileId) {
      setInvitees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('event_invitees')
        .select('*, event:events(*)')
        .eq('profile_id', profileId);

      if (fetchError) throw fetchError;

      const now = Date.now();
      const upcoming = ((data ?? []) as unknown as MyInviteeRow[])
        .filter((row) => row.event && new Date(row.event.event_date).getTime() >= now)
        .sort((a, b) => new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime());

      setInvitees(upcoming);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת האירועים שלי');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchInvitees();
  }, [fetchInvitees]);

  return { invitees, loading, error, refetch: fetchInvitees };
}
