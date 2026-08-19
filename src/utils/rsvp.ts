import { supabase } from '../lib/supabase/client';
import type { Event, EventInvitee, RegistrationStatus, RsvpStatus } from '../lib/supabase/types';

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

export async function hasAnyInvitees(eventId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('event_invitees')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) throw error;
  return (count ?? 0) > 0;
}

function decideRegistrationStatus(
  event: Pick<Event, 'max_capacity' | 'minimum_age'>,
  age: number | null,
  approvedCount: number,
  rsvpStatus: RsvpStatus,
): RegistrationStatus {
  if (rsvpStatus !== 'attending') {
    // Not attending / maybe doesn't consume capacity or trigger age/capacity gating.
    return 'approved';
  }

  if (event.minimum_age != null && age != null && age < event.minimum_age) {
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
  const registrationStatus = decideRegistrationStatus(event, profile.age, approvedCount, rsvpStatus);

  const { data: existing, error: existingError } = await supabase
    .from('event_invitees')
    .select('id')
    .eq('event_id', eventId)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existingError) throw existingError;

  const fields = {
    profile_id: profileId,
    rsvp_status: rsvpStatus,
    registration_status: registrationStatus,
    registration_source: 'web',
  };

  if (existing) {
    const { data, error } = await supabase
      .from('event_invitees')
      .update(fields)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as EventInvitee;
  }

  const { data, error } = await supabase
    .from('event_invitees')
    .insert({ event_id: eventId, ...fields })
    .select()
    .single();

  if (error) throw error;
  return data as EventInvitee;
}

export interface GuestDetails {
  fullName: string;
  email: string;
  phone: string;
  age: number;
}

export async function submitGuestRsvp(
  eventId: string,
  guest: GuestDetails,
  rsvpStatus: RsvpStatus,
  options?: { bypassRegistrationModeCheck?: boolean },
): Promise<EventInvitee> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('max_capacity, minimum_age, registration_mode')
    .eq('id', eventId)
    .single();

  if (eventError) throw eventError;
  // Public self-service guest RSVP only works when the event allows it; an
  // event manager adding a non-registered invitee manually (see
  // AddInviteeModal) bypasses this, since they have explicit authority to
  // add anyone regardless of the event's public registration setting.
  if (!options?.bypassRegistrationModeCheck && event.registration_mode !== 'anyone') {
    throw new Error('האירוע פתוח לרישום למשתמשים רשומים בלבד');
  }

  const approvedCount = await getApprovedCount(eventId);
  const registrationStatus = decideRegistrationStatus(event, guest.age, approvedCount, rsvpStatus);

  // Guests have no profile_id, so dedupe by email among other guest rows
  // only (profile_id IS NULL) - never match a registered user's RSVP.
  const { data: existing, error: existingError } = await supabase
    .from('event_invitees')
    .select('id')
    .eq('event_id', eventId)
    .eq('email', guest.email)
    .is('profile_id', null)
    .maybeSingle();

  if (existingError) throw existingError;

  const fields = {
    full_name: guest.fullName,
    email: guest.email,
    phone: guest.phone,
    age: guest.age,
    rsvp_status: rsvpStatus,
    registration_status: registrationStatus,
    registration_source: 'guest',
  };

  if (existing) {
    const { data, error } = await supabase
      .from('event_invitees')
      .update(fields)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as EventInvitee;
  }

  const { data, error } = await supabase
    .from('event_invitees')
    .insert({ event_id: eventId, ...fields })
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

/**
 * Looks up the most recent guest RSVP (profile_id IS NULL) for an email, so
 * the registration form can be pre-filled if someone who previously RSVP'd
 * as a guest decides to create a real account.
 */
export async function findGuestDetailsByEmail(
  email: string,
): Promise<{ fullName: string | null; phone: string | null; age: number | null } | null> {
  const { data, error } = await supabase
    .from('event_invitees')
    .select('full_name, email, phone, age')
    .eq('email', email)
    .is('profile_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to look up guest invitee', error);
    return null;
  }
  if (!data) return null;

  return { fullName: data.full_name, phone: data.phone, age: data.age };
}

/** Attaches any prior guest RSVPs (by matching email) to a newly created profile. */
export async function linkGuestInviteesToProfile(email: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('event_invitees')
    .update({ profile_id: profileId })
    .eq('email', email)
    .is('profile_id', null);

  if (error) console.error('Failed to link guest invitees to new profile', error);
}
