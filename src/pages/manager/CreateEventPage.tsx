import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import { addLogisticsItem } from '../../utils/logistics';
import { computeOccurrences, describeRecurrence } from '../../utils/recurrence';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { EventForm } from '../../components/manager/EventForm';
import type { EventFormValues } from '../../components/manager/EventForm';
import { StagedLogisticsPanel } from '../../components/manager/StagedLogisticsPanel';
import type { StagedLogisticsItem } from '../../components/manager/StagedLogisticsPanel';
import { BackButton } from '../../components/ui/BackButton';
import { Seo } from '../../components/seo/Seo';

export function CreateEventPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [logisticsItems, setLogisticsItems] = useState<StagedLogisticsItem[]>([]);
  const [formDirty, setFormDirty] = useState(false);

  async function handleSubmit(values: EventFormValues) {
    if (!profile) return;
    setSubmitting(true);

    const sharedFields = {
      title: values.title,
      description: values.description || null,
      location: values.location || null,
      max_capacity: values.max_capacity ? Number(values.max_capacity) : null,
      minimum_age: values.minimum_age ? Number(values.minimum_age) : null,
      status: values.status,
      registration_mode: values.registration_mode,
      hide_attendee_count: values.hide_attendee_count,
      attendee_list_visibility: values.attendee_list_visibility,
      created_by: profile.id,
      manager_ids: [profile.id],
    };

    let rows: { event_date: string; recurrence_label: string | null; recurrence_group_id: string | null }[];
    if (values.recurrence.type === 'recurring') {
      const { frequency, weekday, time, startDate, endDate } = values.recurrence;
      const occurrences = computeOccurrences({
        frequency,
        time,
        startDate,
        endDate: endDate || null,
        weekday,
      });
      if (occurrences.length === 0) {
        setSubmitting(false);
        toast.error('לא נמצאו מועדים בטווח שנבחר');
        return;
      }
      const label = describeRecurrence(frequency, time, weekday);
      const groupId = crypto.randomUUID();
      rows = occurrences.map((date) => ({
        event_date: date.toISOString(),
        recurrence_label: label,
        recurrence_group_id: groupId,
      }));
    } else {
      rows = [{ event_date: new Date(values.event_date).toISOString(), recurrence_label: null, recurrence_group_id: null }];
    }

    const { data, error } = await supabase
      .from('events')
      .insert(rows.map((row) => ({ ...sharedFields, ...row })))
      .select();

    if (error || !data || data.length === 0) {
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
    // attach them to). For a recurring series, they're attached only to the
    // first occurrence - ordering supplies once for a weekly meeting series
    // doesn't imply ordering them again for every future week.
    if (logisticsItems.length > 0) {
      const firstEventId = data[0].id;
      const results = await Promise.allSettled(
        logisticsItems.map(({ id: _id, ...item }) => addLogisticsItem(firstEventId, item)),
      );
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        toast.error(`${failedCount} פריטי לוגיסטיקה לא נשמרו - ניתן להוסיפם שוב בעריכת האירוע`);
      }
    }

    setSubmitting(false);
    toast.success(data.length > 1 ? `נוצרו ${data.length} מופעים של האירוע בהצלחה` : 'האירוע נוצר בהצלחה');
    navigate('/manager');
  }

  return (
    <PageContainer className="max-w-2xl">
      <Seo title="אירוע חדש | Evently" description="יצירת אירוע חדש." path="/manager/events/new" noindex />
      <BackButton className="mb-4" isDirty={formDirty} />
      <h1 className="mb-6 text-2xl font-bold text-slate-900">אירוע חדש</h1>
      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <EventForm
            submitting={submitting}
            submitLabel="יצירת אירוע"
            onSubmit={handleSubmit}
            allowRecurrence
            onDirtyChange={setFormDirty}
          />
        </Card>

        <StagedLogisticsPanel items={logisticsItems} onChange={setLogisticsItems} />
      </div>
    </PageContainer>
  );
}
