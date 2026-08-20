import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Lock,
  MapPin,
  Repeat,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { useEvent } from '../hooks/useEvent';
import { getMyInvitee } from '../utils/rsvp';
import { supabase } from '../lib/supabase/client';
import type { Event, EventInvitee } from '../lib/supabase/types';
import { PageContainer } from '../components/layout/PageContainer';
import { PageSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RsvpForm } from '../components/events/RsvpForm';
import { GuestRsvpForm } from '../components/events/GuestRsvpForm';
import { AttendeeList } from '../components/events/AttendeeList';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BackButton } from '../components/ui/BackButton';
import { Seo, getSiteUrl } from '../components/seo/Seo';
import { formatEventDate, formatShortDateTime } from '../utils/format';

const EVENT_DESCRIPTION_MAX_LENGTH = 160;

function buildEventJsonLd(event: {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  status: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.event_date,
    eventStatus:
      event.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    description: event.description || event.title,
    location: event.location
      ? { '@type': 'Place', name: event.location }
      : { '@type': 'VirtualLocation', url: `${getSiteUrl()}/e/${event.id}` },
    url: `${getSiteUrl()}/e/${event.id}`,
  };
}

function LoginPromptCard() {
  return (
    <Card className="p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-slate-900">יש להתחבר כדי לאשר הגעה</h3>
      <p className="mb-5 text-sm text-slate-500">התחברו או הירשמו כדי לאשר את הגעתכם לאירוע</p>
      <div className="flex justify-center gap-3">
        <Link to="/login">
          <Button variant="outline">התחברות</Button>
        </Link>
        <Link to="/register">
          <Button>הרשמה</Button>
        </Link>
      </div>
    </Card>
  );
}

/** Shown for `invite_only` events instead of the guest/RSVP form when the
 * viewer either isn't logged in, or is logged in but has no invitee row
 * (nobody added them). Logged-out viewers still get a login link, since an
 * invited registered user should be able to log in and respond - just no
 * registration/guest-RSVP offer, since that wouldn't help someone who
 * wasn't pre-invited. */
function InviteOnlyCard({ showLogin }: { showLogin: boolean }) {
  return (
    <Card className="p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Lock className="h-6 w-6" />
      </div>
      <h3 className={showLogin ? 'mb-1 text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-900'}>
        {showLogin ? 'אירוע זה פתוח למוזמנים בלבד' : 'לא הוזמנת לאירוע זה'}
      </h3>
      {showLogin && (
        <>
          <p className="mb-5 text-sm text-slate-500">אם קיבלת הזמנה לאירוע זה, יש להתחבר לחשבונך</p>
          <div className="flex justify-center gap-3">
            <Link to="/login">
              <Button variant="outline">התחברות</Button>
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

export function EventDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { event, approvedCount, loading: eventLoading, error, refetch } = useEvent(eventId);

  const [myInvitee, setMyInvitee] = useState<EventInvitee | null>(null);
  const [inviteeLoading, setInviteeLoading] = useState(true);
  const [seriesSiblings, setSeriesSiblings] = useState<Event[]>([]);
  const [seriesExpanded, setSeriesExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadInvitee() {
      if (!eventId || !profile) {
        setInviteeLoading(false);
        return;
      }
      setInviteeLoading(true);
      const invitee = await getMyInvitee(eventId, profile.id);
      if (mounted) {
        setMyInvitee(invitee);
        setInviteeLoading(false);
      }
    }

    loadInvitee();
    return () => {
      mounted = false;
    };
  }, [eventId, profile]);

  useEffect(() => {
    let mounted = true;

    async function loadSeriesSiblings() {
      if (!event?.recurrence_group_id) {
        setSeriesSiblings([]);
        return;
      }
      const { data, error: siblingsError } = await supabase
        .from('events')
        .select('*')
        .eq('recurrence_group_id', event.recurrence_group_id)
        .order('event_date', { ascending: true });

      if (mounted && !siblingsError && data) {
        setSeriesSiblings(data as Event[]);
      }
    }

    loadSeriesSiblings();
    return () => {
      mounted = false;
    };
  }, [event?.recurrence_group_id]);

  // Auth state and event data can resolve independently - only render once both are settled,
  // so a logged-in user never sees a flash of the login prompt.
  if (authLoading || eventLoading) return <PageSkeleton />;

  const isManager = !!event && (profile?.role === 'super_admin' || event.manager_ids.includes(profile?.id ?? ''));

  // Cancelled events are visible only to super_admin and the event's own
  // managers (creator/co-managers) - everyone else, including someone who
  // already registered, is shown the same "not found" treatment as a
  // genuinely missing event, so a stale link doesn't leak that a cancelled
  // event still exists.
  if (error || !event || (event.status === 'cancelled' && !isManager)) {
    return (
      <PageContainer>
        <Seo
          title="האירוע לא נמצא | Evently"
          description="האירוע המבוקש אינו קיים או שאינו זמין עוד."
          path={`/e/${eventId ?? 'not-found'}`}
          noindex
        />
        <BackButton className="mb-4" />
        <Card className="p-6 text-center text-slate-500">האירוע לא נמצא</Card>
      </PageContainer>
    );
  }

  const canSeeCount = !event.hide_attendee_count || isManager;
  // Same cancelled-visibility rule applied to sibling occurrences, so a
  // non-manager never sees a link to a cancelled occurrence they can't
  // actually open.
  const otherOccurrences = seriesSiblings.filter(
    (sibling) => sibling.id !== event.id && (sibling.status !== 'cancelled' || isManager),
  );

  const seoDescription = event.description
    ? event.description.length > EVENT_DESCRIPTION_MAX_LENGTH
      ? `${event.description.slice(0, EVENT_DESCRIPTION_MAX_LENGTH - 1)}…`
      : event.description
    : `${event.title} - ${formatEventDate(event.event_date)}${event.location ? ` ב${event.location}` : ''}`;

  return (
    <PageContainer className="max-w-3xl">
      <Seo
        title={`${event.title} | Evently`}
        description={seoDescription}
        path={`/e/${event.id}`}
        noindex={event.status !== 'published'}
        jsonLd={buildEventJsonLd(event)}
      />
      <BackButton className="mb-4" />
      <Card className="mb-6 p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
          <StatusBadge status={event.status} />
        </div>

        {event.description && <p className="mb-4 whitespace-pre-line text-slate-600">{event.description}</p>}

        <div className="flex flex-col gap-2 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {formatEventDate(event.event_date)}
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              {event.location}
            </div>
          )}
          {event.recurrence_label && (
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 shrink-0" />
              {event.recurrence_label}
            </div>
          )}
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 shrink-0" />
            {event.creator ? `נוצר על ידי ${event.creator.full_name}` : 'נוצר על ידי משתמש שאינו זמין יותר'}
          </div>
          {canSeeCount && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              {!!event.max_capacity && event.max_capacity > 0 ? (
                <span>
                  <span dir="ltr" className="inline-block">
                    {approvedCount} / {event.max_capacity}
                  </span>{' '}
                  נרשמים מאושרים
                </span>
              ) : (
                <span>{approvedCount} נרשמים מאושרים</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {otherOccurrences.length > 0 && (
        <div className="mb-6">
          <Button
            variant="ghost"
            icon={seriesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            onClick={() => setSeriesExpanded((current) => !current)}
            className="!px-2.5 !py-1.5 text-slate-500"
          >
            {seriesExpanded ? 'הסתרת מופעים נוספים' : `הצגת ${otherOccurrences.length} מופעים נוספים בסדרה`}
          </Button>
          {seriesExpanded && (
            <div className="mt-2 flex flex-col gap-1 rounded-xl border border-slate-200 p-2">
              {otherOccurrences.map((sibling) => (
                <Link
                  key={sibling.id}
                  to={`/e/${sibling.id}`}
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  {formatShortDateTime(sibling.event_date)}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {event.registration_mode === 'invite_only' ? (
        !user ? (
          <InviteOnlyCard showLogin />
        ) : !profile || inviteeLoading ? (
          <PageSkeleton />
        ) : !myInvitee ? (
          <InviteOnlyCard showLogin={false} />
        ) : (
          <RsvpForm
            event={event}
            profile={profile}
            approvedCount={approvedCount}
            existingInvitee={myInvitee}
            onSubmitted={(invitee) => {
              setMyInvitee(invitee);
              refetch();
            }}
          />
        )
      ) : !user ? (
        event.registration_mode === 'anyone' ? (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
              <p className="text-sm text-slate-600">כבר יש לכם חשבון? התחברו כדי למלא את הפרטים אוטומטית</p>
              <div className="flex shrink-0 gap-2">
                <Link to="/login">
                  <Button variant="outline">התחברות</Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline">הרשמה</Button>
                </Link>
              </div>
            </Card>
            <GuestRsvpForm event={event} approvedCount={approvedCount} onSubmitted={() => refetch()} />
          </div>
        ) : (
          <LoginPromptCard />
        )
      ) : !profile || inviteeLoading ? (
        <PageSkeleton />
      ) : (
        <RsvpForm
          event={event}
          profile={profile}
          approvedCount={approvedCount}
          existingInvitee={myInvitee}
          onSubmitted={(invitee) => {
            setMyInvitee(invitee);
            refetch();
          }}
        />
      )}

      <AttendeeList eventId={event.id} />
    </PageContainer>
  );
}
