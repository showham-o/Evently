import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Lock, MapPin, Users } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { useEvent } from '../hooks/useEvent';
import { getMyInvitee } from '../utils/rsvp';
import type { EventInvitee } from '../lib/supabase/types';
import { PageContainer } from '../components/layout/PageContainer';
import { PageSkeleton } from '../components/ui/Skeleton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RsvpForm } from '../components/events/RsvpForm';
import { GuestRsvpForm } from '../components/events/GuestRsvpForm';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BackButton } from '../components/ui/BackButton';
import { formatEventDate } from '../utils/format';

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

export function EventDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { event, approvedCount, loading: eventLoading, error, refetch } = useEvent(eventId);

  const [myInvitee, setMyInvitee] = useState<EventInvitee | null>(null);
  const [inviteeLoading, setInviteeLoading] = useState(true);

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

  // Auth state and event data can resolve independently - only render once both are settled,
  // so a logged-in user never sees a flash of the login prompt.
  if (authLoading || eventLoading) return <PageSkeleton />;

  if (error || !event) {
    return (
      <PageContainer>
        <BackButton className="mb-4" />
        <Card className="p-6 text-center text-slate-500">האירוע לא נמצא</Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-3xl">
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
        </div>
      </Card>

      {!user ? (
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
    </PageContainer>
  );
}
