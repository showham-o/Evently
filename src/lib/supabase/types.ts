export type ProfileRole = 'super_admin' | 'event_manager' | 'registered_user' | 'guest';

export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  age: number | null;
  role: ProfileRole;
  created_at?: string;
}

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export type RegistrationMode = 'registered_only' | 'anyone';

export interface Event {
  id: string;
  created_by: string | null;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  status: EventStatus;
  max_capacity: number | null;
  minimum_age: number | null;
  manager_ids: string[];
  registration_mode: RegistrationMode;
  created_at?: string;
}

export type RsvpStatus = 'attending' | 'declined' | 'maybe';

export type RegistrationStatus = 'approved' | 'waiting_list' | 'rejected_age' | 'rejected' | 'cancelled';

export interface EventInvitee {
  id: string;
  event_id: string;
  profile_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
  rsvp_status: RsvpStatus;
  registration_status: RegistrationStatus;
  registration_source: string;
  created_at?: string;
}

export interface EventInviteeWithProfile extends EventInvitee {
  profile: Profile | null;
}

export interface ArchivedProfile {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  age: number | null;
  role: ProfileRole | null;
  archived_at: string;
  expires_at: string;
}
