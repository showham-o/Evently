import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { useEvent } from '../../hooks/useEvent';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { Card } from '../../components/ui/Card';
import { EventForm } from '../../components/manager/EventForm';
import type { EventFormValues } from '../../components/manager/EventForm';

export function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { event, loading } = useEvent(eventId);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageSkeleton />;

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

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">עריכת אירוע</h1>
      <Card className="p-6">
        <EventForm initial={event} submitting={submitting} submitLabel="שמירת שינויים" onSubmit={handleSubmit} />
      </Card>
    </PageContainer>
  );
}
