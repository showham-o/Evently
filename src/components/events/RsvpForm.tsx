import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import type { Event, EventInvitee, Profile, RsvpStatus } from '../../lib/supabase/types';
import { isEventFull, submitRsvp } from '../../utils/rsvp';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';

interface RsvpFormProps {
  event: Event;
  profile: Profile;
  approvedCount: number;
  existingInvitee: EventInvitee | null;
  onSubmitted: (invitee: EventInvitee) => void;
}

const options: { value: RsvpStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'attending', label: 'מגיע/ה', icon: CheckCircle2 },
  { value: 'not_attending', label: 'לא מגיע/ה', icon: XCircle },
  { value: 'maybe', label: 'אולי', icon: HelpCircle },
];

export function RsvpForm({ event, profile, approvedCount, existingInvitee, onSubmitted }: RsvpFormProps) {
  const [selected, setSelected] = useState<RsvpStatus | null>(existingInvitee?.rsvp_status ?? null);
  const [submitting, setSubmitting] = useState(false);

  const full = isEventFull(event, approvedCount);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const invitee = await submitRsvp(event.id, profile.id, selected);
      onSubmitted(invitee);

      if (invitee.registration_status === 'rejected_age') {
        toast.error('לא ניתן להירשם - לא עומד/ת בדרישת הגיל המינימלי לאירוע');
      } else if (invitee.registration_status === 'waiting_list') {
        toast.warning('האירוע מלא - נוספת/ם לרשימת ההמתנה');
      } else {
        toast.success('הרישום עודכן בהצלחה');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'אירעה שגיאה, נסו שוב');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h3 className="mb-1 text-lg font-semibold text-slate-900">אישור הגעה</h3>
      <p className="mb-4 text-sm text-slate-500">
        שלום {profile.full_name}, נשמח לדעת אם תוכל/י להגיע לאירוע
      </p>

      {full && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          האירוע מלא - ההרשמה סגורה
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSelected(value)}
            className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-medium transition-colors ${
              selected === value
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>

      {existingInvitee && (
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          הסטטוס הנוכחי שלך:
          <StatusBadge status={existingInvitee.registration_status} />
        </div>
      )}

      <Button onClick={handleSubmit} disabled={!selected} loading={submitting} className="w-full">
        {submitting ? 'שולח...' : 'שליחת אישור הגעה'}
      </Button>
    </Card>
  );
}
