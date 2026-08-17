import { supabase } from '../lib/supabase/client';
import type { Event, EventInvitee, Profile, RegistrationStatus, RsvpStatus } from '../lib/supabase/types';

export async function getApprovedCount(eventId: string): Promise<number> {
  const { count, error } = await supabase
    .from('event_invitees')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('rsvp_status', 'attending')
    .eq('registration_status', 'approved');

  if (error) throw error;
  return count ?? 0;
}

export function isEventFull(event: Pick<Event, 'max_capacity'>, approvedCount: number): boolean {
  return !!event.max_capacity && event.max_capacity > 0 && approvedCount >= event.max_capacity;
}

function decideRegistrationStatus(
  event: Pick<Event, 'max_capacity' | 'minimum_age'>,
  profile: Pick<Profile, 'age'>,
  approvedCount: number,
  rsvpStatus: RsvpStatus,
): RegistrationStatus {
  if (rsvpStatus !== 'attending') {
    // Not attending / maybe doesn't consume capacity or trigger age/capacity gating.
    return 'approved';
  }

  if (event.minimum_age != null && profile.age != null && profile.age < event.minimum_age) {
    return 'rejected_age';
  }

  if (isEventFull(event, approvedCount)) {
    return 'waiting_list';
  }

  return 'approved';
}

export async function submitRsvp(
  eventId: string,
  profileId: string,
  rsvpStatus: RsvpStatus,
): Promise<EventInvitee> {
  const [{ data: event, error: eventError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('events').select('max_capacity, minimum_age').eq('id', eventId).single(),
    supabase.from('profiles').select('age').eq('id', profileId).single(),
  ]);

  if (eventError) throw eventError;
  if (profileError) throw profileError;

  const approvedCount = await getApprovedCount(eventId);
  const registrationStatus = decideRegistrationStatus(event, profile, approvedCount, rsvpStatus);

  const { data: existing, error: existingError } = await supabase
    .from('event_invitees')
    .select('id')
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { data, error } = await supabase
      .from('event_invitees')
      .update({ rsvp_status: rsvpStatus, registration_status: registrationStatus })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as EventInvitee;
  }

  const { data, error } = await supabase
    .from('event_invitees')
    .insert({
      event_id: eventId,
      profile_id: profileId,
      rsvp_status: rsvpStatus,
      registration_status: registrationStatus,
      registration_source: 'web',
    })
    .select()
    .single();

  if (error) throw error;
  return data as EventInvitee;
}

export async function getMyInvitee(eventId: string, profileId: string): Promise<EventInvitee | null> {
  const { data, error } = await supabase
    .from('event_invitees')
    .select('*')
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) throw error;
  return data as EventInvitee | null;
}
