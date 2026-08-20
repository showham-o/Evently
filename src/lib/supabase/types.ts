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

export type RegistrationMode = 'registered_only' | 'anyone' | 'invite_only';

export type AttendeeListVisibility = 'managers' | 'managers_and_invitees' | 'logged_in' | 'public';

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
  hide_attendee_count: boolean;
  attendee_list_visibility: AttendeeListVisibility;
  recurrence_label: string | null;
  recurrence_group_id: string | null;
  created_at?: string;
}

export interface EventCreator {
  id: string;
  full_name: string;
}

export interface EventWithCreator extends Event {
  creator: EventCreator | null;
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

/** Row shape of the `event_attendee_summary` view - name+status only, never
 * email/phone/age. Visibility is pre-filtered server-side per the event's
 * attendee_list_visibility setting, so any row returned to the client is
 * already safe to display as-is. */
export interface EventAttendeeSummary {
  event_id: string;
  full_name: string | null;
  rsvp_status: RsvpStatus;
  registration_status: RegistrationStatus;
}

export type LogisticsStatus = 'pending' | 'ordered' | 'received' | 'cancelled';

export interface EventLogisticsItem {
  id: string;
  event_id: string;
  item_name: string;
  quantity: number | null;
  supplier_name: string | null;
  cost: number | null;
  status: LogisticsStatus;
  created_at?: string;
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
