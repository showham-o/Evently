import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { EventForm } from '../../components/manager/EventForm';
import type { EventFormValues } from '../../components/manager/EventForm';

export function CreateEventPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: EventFormValues) {
    if (!profile) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from('events')
      .insert({
        title: values.title,
        description: values.description || null,
        location: values.location || null,
        event_date: new Date(values.event_date).toISOString(),
        max_capacity: values.max_capacity ? Number(values.max_capacity) : null,
        minimum_age: values.minimum_age ? Number(values.minimum_age) : null,
        status: values.status,
        created_by: profile.id,
      })
      .select()
      .single();

    setSubmitting(false);

    if (error || !data) {
      toast.error('יצירת האירוע נכשלה');
      return;
    }

    toast.success('האירוע נוצר בהצלחה');
    navigate('/manager');
  }

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">אירוע חדש</h1>
      <Card className="p-6">
        <EventForm submitting={submitting} submitLabel="יצירת אירוע" onSubmit={handleSubmit} />
      </Card>
    </PageContainer>
  );
}
