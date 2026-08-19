import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Event, EventInvitee, RsvpStatus } from '../../lib/supabase/types';
import { isEventFull, submitGuestRsvp } from '../../utils/rsvp';
import { ageValidator, emailValidator, phoneValidator, requiredValidator } from '../../utils/validation';
import { useValidatedInput } from '../../hooks/useValidatedInput';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface GuestRsvpFormProps {
  event: Event;
  approvedCount: number;
  onSubmitted: (invitee: EventInvitee) => void;
}

// "אולי" (maybe) isn't offered to unregistered guests - only registered
// users get that option, via RsvpForm.
const options: { value: RsvpStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'attending', label: 'מגיע/ה', icon: CheckCircle2 },
  { value: 'declined', label: 'לא מגיע/ה', icon: XCircle },
];

export function GuestRsvpForm({ event, approvedCount, onSubmitted }: GuestRsvpFormProps) {
  const [selected, setSelected] = useState<RsvpStatus | null>(null);
  const fullName = useValidatedInput('', requiredValidator('שם מלא'));
  const email = useValidatedInput('', emailValidator);
  const phone = useValidatedInput('', phoneValidator);
  const age = useValidatedInput('', ageValidator);
  const [submitting, setSubmitting] = useState(false);

  const full = isEventFull(event, approvedCount);
  const canSubmit = !!selected && !!fullName.value && !!email.value && !!phone.value && !!age.value;

  async function handleSubmit() {
    if (!selected) return;

    const validations = [
      fullName.validateNow(),
      email.validateNow(),
      phone.validateNow(),
      age.validateNow(),
    ];
    if (validations.some((valid) => !valid)) return;

    setSubmitting(true);
    try {
      const invitee = await submitGuestRsvp(
        event.id,
        { fullName: fullName.value, email: email.value, phone: phone.value, age: Number(age.value) },
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
        <Input
          id="guestFullName"
          label="שם מלא"
          required
          value={fullName.value}
          error={fullName.error ?? undefined}
          onChange={(e) => fullName.onChange(e.target.value)}
          onBlur={fullName.onBlur}
        />
        <Input
          id="guestEmail"
          type="email"
          label="אימייל"
          required
          value={email.value}
          error={email.error ?? undefined}
          onChange={(e) => email.onChange(e.target.value)}
          onBlur={email.onBlur}
        />
        <Input
          id="guestPhone"
          type="tel"
          label="טלפון"
          required
          value={phone.value}
          error={phone.error ?? undefined}
          onChange={(e) => phone.onChange(e.target.value)}
          onBlur={phone.onBlur}
        />
        <Input
          id="guestAge"
          type="number"
          min={1}
          max={130}
          label="גיל"
          required
          value={age.value}
          error={age.error ?? undefined}
          onChange={(e) => age.onChange(e.target.value)}
          onBlur={age.onBlur}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
