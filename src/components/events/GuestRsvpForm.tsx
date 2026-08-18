import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import type { Event, EventInvitee, RsvpStatus } from '../../lib/supabase/types';
import { isEventFull, submitGuestRsvp } from '../../utils/rsvp';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface GuestRsvpFormProps {
  event: Event;
  approvedCount: number;
  onSubmitted: (invitee: EventInvitee) => void;
}

const options: { value: RsvpStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'attending', label: 'מגיע/ה', icon: CheckCircle2 },
  { value: 'declined', label: 'לא מגיע/ה', icon: XCircle },
  { value: 'maybe', label: 'אולי', icon: HelpCircle },
];

export function GuestRsvpForm({ event, approvedCount, onSubmitted }: GuestRsvpFormProps) {
  const [selected, setSelected] = useState<RsvpStatus | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const full = isEventFull(event, approvedCount);
  const canSubmit = !!selected && !!fullName && !!email && !!phone && !!age;

  async function handleSubmit() {
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    try {
      const invitee = await submitGuestRsvp(
        event.id,
        { fullName, email, phone, age: Number(age) },
        selected,
      );
      onSubmitted(invitee);

      if (invitee.registration_status === 'rejected_age') {
        toast.error('לא ניתן להירשם - לא עומד/ת בדרישת הגיל המינימלי לאירוע');
      } else if (invitee.registration_status === 'waiting_list') {
        toast.warning('האירוע מלא - נוספת/ם לרשימת ההמתנה');
      } else {
        toast.success('הרישום נשלח בהצלחה');
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
      <p className="mb-4 text-sm text-slate-500">אירוע זה פתוח גם למי שאינו רשום למערכת - מלאו את פרטיכם</p>

      {full && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          האירוע מלא - ההרשמה סגורה
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="guestFullName" label="שם מלא" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input
          id="guestEmail"
          type="email"
          label="אימייל"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input id="guestPhone" type="tel" label="טלפון" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          id="guestAge"
          type="number"
          min={0}
          max={120}
          label="גיל"
          required
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
      </div>

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

      <Button onClick={handleSubmit} disabled={!canSubmit} loading={submitting} className="w-full">
        {submitting ? 'שולח...' : 'שליחת אישור הגעה'}
      </Button>
    </Card>
  );
}
