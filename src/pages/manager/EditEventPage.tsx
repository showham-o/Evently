import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { useEvent } from '../../hooks/useEvent';
import type { Event } from '../../lib/supabase/types';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { EventForm } from '../../components/manager/EventForm';
import type { EventFormValues } from '../../components/manager/EventForm';
import { ManagerPanel } from '../../components/manager/ManagerPanel';

export function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { event: fetchedEvent, loading } = useEvent(eventId);
  const [event, setEvent] = useState<Event | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (fetchedEvent) setEvent(fetchedEvent);
  }, [fetchedEvent]);

  if (loading) return <PageSkeleton />;

  if (!event) {
    return (
      <PageContainer>
        <Card className="p-6 text-center text-slate-500">האירוע לא נמצא</Card>
      </PageContainer>
    );
  }

  const canManage = profile?.role === 'super_admin' || event.manager_ids.includes(profile?.id ?? '');

  if (!canManage) {
    return (
      <PageContainer>
        <Card className="p-6 text-center text-slate-500">אין לך הרשאה לערוך אירוע זה</Card>
      </PageContainer>
    );
  }

  async function handleSubmit(values: EventFormValues) {
    setSubmitting(true);

    const { error } = await supabase
      .from('events')
      .update({
        title: values.title,
        description: values.description || null,
        location: values.location || null,
        event_date: new Date(values.event_date).toISOString(),
        max_capacity: values.max_capacity ? Number(values.max_capacity) : null,
        minimum_age: values.minimum_age ? Number(values.minimum_age) : null,
        status: values.status,
      })
      .eq('id', eventId);

    setSubmitting(false);

    if (error) {
      toast.error('עדכון האירוע נכשל');
      return;
    }

    toast.success('האירוע עודכן בהצלחה');
    navigate('/manager');
  }

  function handleManagersChanged(updated: Event) {
    setEvent(updated);
    // Removing yourself means you no longer have access to this page.
    if (profile && !updated.manager_ids.includes(profile.id) && profile.role !== 'super_admin') {
      toast.info('הוסרת מניהול האירוע');
      navigate('/manager');
    }
  }

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">עריכת אירוע</h1>
      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <EventForm initial={event} submitting={submitting} submitLabel="שמירת שינויים" onSubmit={handleSubmit} />
        </Card>

        {profile && (
          <ManagerPanel event={event} currentProfileId={profile.id} onChanged={handleManagersChanged} />
        )}
      </div>
    </PageContainer>
  );
}
