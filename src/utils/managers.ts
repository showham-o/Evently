import { supabase } from '../lib/supabase/client';
import type { Event, Profile } from '../lib/supabase/types';

export const MAX_MANAGERS = 3;

export const SOLE_MANAGER_SELF_REMOVE_ERROR =
  'לא ניתן להסיר את עצמך מניהול האירוע - חייב להיות לפחות מנהל אחד נוסף. יש למנות מנהל אחר או למחוק את האירוע.';

export async function addManager(event: Event, newManagerProfileId: string): Promise<Event> {
  if (event.manager_ids.includes(newManagerProfileId)) {
    throw new Error('המשתמש כבר מנהל את האירוע');
  }
  if (event.manager_ids.length >= MAX_MANAGERS) {
    throw new Error('לא ניתן להוסיף יותר משלושה מנהלים לאירוע');
  }

  const nextManagerIds = [...event.manager_ids, newManagerProfileId];
  const { data, error } = await supabase
    .from('events')
    .update({ manager_ids: nextManagerIds })
    .eq('id', event.id)
    .select()
    .single();

  if (error) throw error;
  return data as Event;
}

export async function removeManager(event: Event, managerProfileId: string, isSelf: boolean): Promise<Event> {
  if (event.manager_ids.length <= 1) {
    throw new Error(isSelf ? SOLE_MANAGER_SELF_REMOVE_ERROR : 'לא ניתן להסיר את המנהל היחיד של האירוע');
  }

  const nextManagerIds = event.manager_ids.filter((id) => id !== managerProfileId);
  const { data, error } = await supabase
    .from('events')
    .update({ manager_ids: nextManagerIds })
    .eq('id', event.id)
    .select()
    .single();

  if (error) throw error;
  return data as Event;
}

export async function findProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/**
 * Removes a profile from manager_ids across every event it manages. Where that
 * profile is the sole manager, replaceWithProfileId is substituted in so the
 * event is never left orphaned. Used for admin demote (client-side) and
 * mirrored server-side in the delete-account Edge Function for force-delete.
 */
export async function reassignManagedEvents(targetProfileId: string, replaceWithProfileId: string): Promise<void> {
  const { data, error } = await supabase.from('events').select('*').contains('manager_ids', [targetProfileId]);

  if (error) throw error;
  const events = (data ?? []) as Event[];

  for (const event of events) {
    const withoutTarget = event.manager_ids.filter((id) => id !== targetProfileId);
    const nextManagerIds = withoutTarget.length > 0 ? withoutTarget : [replaceWithProfileId];

    const { error: updateError } = await supabase
      .from('events')
      .update({ manager_ids: nextManagerIds })
      .eq('id', event.id);

    if (updateError) throw updateError;
  }
}
