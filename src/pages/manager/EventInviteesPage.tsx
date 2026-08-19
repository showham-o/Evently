import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import { useEvent } from '../../hooks/useEvent';
import { useEventInvitees } from '../../hooks/useEventInvitees';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { InviteeTable } from '../../components/manager/InviteeTable';
import { AddInviteeModal } from '../../components/manager/AddInviteeModal';
import { BackButton } from '../../components/ui/BackButton';

export function EventInviteesPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { profile } = useAuth();
  const { event, loading: eventLoading } = useEvent(eventId);
  const { invitees, loading: inviteesLoading, refetch } = useEventInvitees(eventId);
  const [addModalOpen, setAddModalOpen] = useState(false);

  if (eventLoading) return <PageSkeleton />;

  if (!event) {
    return (
      <PageContainer>
        <BackButton className="mb-4" />
        <Card className="p-6 text-center text-slate-500">האירוע לא נמצא</Card>
      </PageContainer>
    );
  }

  const canManage = profile?.role === 'super_admin' || event.manager_ids.includes(profile?.id ?? '');

  if (!canManage) {
    return (
      <PageContainer>
        <BackButton className="mb-4" />
        <Card className="p-6 text-center text-slate-500">אין לך הרשאה לצפות בנרשמים לאירוע זה</Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <BackButton className="mb-4" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold text-slate-900">נרשמים: {event.title}</h1>
          <p className="text-slate-500">ניהול אישורי הגעה ורשימת המתנה</p>
        </div>
        <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setAddModalOpen(true)}>
          הוספת נרשם
        </Button>
      </div>

      {inviteesLoading ? <PageSkeleton /> : <InviteeTable invitees={invitees} onChanged={refetch} />}

      <AddInviteeModal
        open={addModalOpen}
        event={event}
        onClose={() => setAddModalOpen(false)}
        onAdded={refetch}
      />
    </PageContainer>
  );
}
