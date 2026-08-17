import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import { useEvent } from '../../hooks/useEvent';
import { useEventInvitees } from '../../hooks/useEventInvitees';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { InviteeTable } from '../../components/manager/InviteeTable';

export function EventInviteesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { profile } = useAuth();
  const { event, loading: eventLoading } = useEvent(eventId);
  const { invitees, loading: inviteesLoading, refetch } = useEventInvitees(eventId);

  if (eventLoading) return <PageSkeleton />;

  if (!event) {
    return (
      <PageContainer>
        <Card className="p-6 text-center text-slate-500">האירוע לא נמצא</Card>
      </PageContainer>
    );
  }

  const canManage =
    profile?.role === 'super_admin' ||
    event.created_by === profile?.id ||
    (event.co_managers ?? []).includes(profile?.id ?? '');

  if (!canManage) {
    return (
      <PageContainer>
        <Card className="p-6 text-center text-slate-500">אין לך הרשאה לצפות בנרשמים לאירוע זה</Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">נרשמים: {event.title}</h1>
      <p className="mb-6 text-slate-500">ניהול אישורי הגעה ורשימת המתנה</p>

      {inviteesLoading ? <PageSkeleton /> : <InviteeTable invitees={invitees} onChanged={refetch} />}
    </PageContainer>
  );
}
