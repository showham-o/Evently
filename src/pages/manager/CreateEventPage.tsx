import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { addLogisticsItem } from '../../utils/logistics';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { EventForm } from '../../components/manager/EventForm';
import type { EventFormValues } from '../../components/manager/EventForm';
import { StagedLogisticsPanel } from '../../components/manager/StagedLogisticsPanel';
import type { StagedLogisticsItem } from '../../components/manager/StagedLogisticsPanel';

export function CreateEventPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [logisticsItems, setLogisticsItems] = useState<StagedLogisticsItem[]>([]);

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
        registration_mode: values.registration_mode,
        created_by: profile.id,
        manager_ids: [profile.id],
      })
      .select()
      .single();

    if (error || !data) {
      setSubmitting(false);
      toast.error('יצירת האירוע נכשלה');
      return;
    }

    // Creating an event elevates a registered_user to event_manager (super_admin stays as-is).
    // Role changes are locked down at the DB level, so this goes through a
    // security-definer RPC rather than a direct table update.
    if (profile.role === 'registered_user') {
      const { error: roleError } = await supabase.rpc('elevate_to_event_manager');

      if (!roleError) {
        await refreshProfile();
      }
    }

    // Logistics items were staged locally (the event didn't exist yet to
    // attach them to) - persist them now that it does.
    if (logisticsItems.length > 0) {
      const results = await Promise.allSettled(
        logisticsItems.map(({ id: _id, ...item }) => addLogisticsItem(data.id, item)),
      );
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        toast.error(`${failedCount} פריטי לוגיסטיקה לא נשמרו - ניתן להוסיפם שוב בעריכת האירוע`);
      }
    }

    setSubmitting(false);
    toast.success('האירוע נוצר בהצלחה');
    navigate('/manager');
  }

  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">אירוע חדש</h1>
      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <EventForm submitting={submitting} submitLabel="יצירת אירוע" onSubmit={handleSubmit} />
        </Card>

        <StagedLogisticsPanel items={logisticsItems} onChange={setLogisticsItems} />
      </div>
    </PageContainer>
  );
}
