import { supabase } from '../lib/supabase/client';
import type { ArchivedProfile } from '../lib/supabase/types';

export async function findActiveArchivedProfile(email: string): Promise<ArchivedProfile | null> {
  const { data, error } = await supabase
    .from('archived_profiles')
    .select('*')
    .eq('email', email)
    .gt('expires_at', new Date().toISOString())
    .order('archived_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to look up archived profile', error);
    return null;
  }

  return data as ArchivedProfile | null;
}

export async function deleteArchivedProfile(id: string): Promise<void> {
  const { error } = await supabase.from('archived_profiles').delete().eq('id', id);
  if (error) console.error('Failed to clean up archived profile', error);
}
