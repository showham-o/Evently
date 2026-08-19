import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import type { Event, EventInvitee, RsvpStatus } from '../../lib/supabase/types';
import { submitGuestRsvp, submitRsvp } from '../../utils/rsvp';
import { findProfileByEmail } from '../../utils/managers';
import { ageValidator, emailValidator, phoneValidator, requiredValidator } from '../../utils/validation';
import { useValidatedInput } from '../../hooks/useValidatedInput';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

type InviteeKind = 'registered' | 'guest';

const registeredOptions: { value: RsvpStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'attending', label: 'מגיע/ה', icon: CheckCircle2 },
  { value: 'declined', label: 'לא מגיע/ה', icon: XCircle },
  { value: 'maybe', label: 'אולי', icon: HelpCircle },
];

// Same rule as the public guest RSVP form: no "maybe" for non-registered invitees.
const guestOptions: { value: RsvpStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'attending', label: 'מגיע/ה', icon: CheckCircle2 },
  { value: 'declined', label: 'לא מגיע/ה', icon: XCircle },
];

interface AddInviteeModalProps {
  open: boolean;
  event: Event;
  onClose: () => void;
  onAdded: (invitee: EventInvitee) => void;
}

export function AddInviteeModal({ open, event, onClose, onAdded }: AddInviteeModalProps) {
  const [kind, setKind] = useState<InviteeKind>('registered');
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('attending');
  const [submitting, setSubmitting] = useState(false);

  const registeredEmail = useValidatedInput('', emailValidator);
  const guestFullName = useValidatedInput('', requiredValidator('שם מלא'));
  const guestEmail = useValidatedInput('', emailValidator);
  const guestPhone = useValidatedInput('', phoneValidator);
  const guestAge = useValidatedInput('', ageValidator);

  function reset() {
    setKind('registered');
    setRsvpStatus('attending');
    registeredEmail.setValue('');
    guestFullName.setValue('');
    guestEmail.setValue('');
    guestPhone.setValue('');
    guestAge.setValue('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (kind === 'registered') {
      if (!registeredEmail.validateNow()) return;

      setSubmitting(true);
      try {
        const profile = await findProfileByEmail(registeredEmail.value);
        if (!profile) {
          toast.error('לא נמצא משתמש רשום עם אימייל זה');
          return;
        }

        const invitee = await submitRsvp(event.id, profile.id, rsvpStatus);
        onAdded(invitee);
        reportOutcome(invitee.registration_status);
        handleClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'הוספת הנרשם נכשלה');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const validations = [
      guestFullName.validateNow(),
      guestEmail.validateNow(),
      guestPhone.validateNow(),
      guestAge.validateNow(),
    ];
    if (validations.some((valid) => !valid)) return;

    setSubmitting(true);
    try {
      const invitee = await submitGuestRsvp(
        event.id,
        {
          fullName: guestFullName.value,
          email: guestEmail.value,
          phone: guestPhone.value,
          age: Number(guestAge.value),
        },
        rsvpStatus,
        { bypassRegistrationModeCheck: true },
      );
      onAdded(invitee);
      reportOutcome(invitee.registration_status);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'הוספת הנרשם נכשלה');
    } finally {
      setSubmitting(false);
    }
  }

  function reportOutcome(status: EventInvitee['registration_status']) {
    if (status === 'rejected_age') {
      toast.error('הנרשם נוסף אך נדחה - אינו עומד בדרישת הגיל המינימלי');
    } else if (status === 'waiting_list') {
      toast.warning('האירוע מלא - הנרשם נוסף לרשימת ההמתנה');
    } else {
      toast.success('הנרשם נוסף בהצלחה');
    }
  }

  const options = kind === 'registered' ? registeredOptions : guestOptions;

  return (
    <Modal open={open} title="הוספת נרשם" onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setKind('registered')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              kind === 'registered' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            משתמש רשום
          </button>
          <button
            type="button"
            onClick={() => setKind('guest')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              kind === 'guest' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            לא רשום למערכת
          </button>
        </div>

        {kind === 'registered' ? (
          <Input
            id="inviteeEmail"
            type="email"
            label="אימייל המשתמש"
            required
            value={registeredEmail.value}
            error={registeredEmail.error ?? undefined}
            onChange={(e) => registeredEmail.onChange(e.target.value)}
            onBlur={registeredEmail.onBlur}
            placeholder="user@example.com"
          />
        ) : (
          <>
            <Input
              id="inviteeFullName"
              label="שם מלא"
              required
              value={guestFullName.value}
              error={guestFullName.error ?? undefined}
              onChange={(e) => guestFullName.onChange(e.target.value)}
              onBlur={guestFullName.onBlur}
            />
            <Input
              id="inviteeGuestEmail"
              type="email"
              label="אימייל"
              required
              value={guestEmail.value}
              error={guestEmail.error ?? undefined}
              onChange={(e) => guestEmail.onChange(e.target.value)}
              onBlur={guestEmail.onBlur}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="inviteeGuestPhone"
                type="tel"
                label="טלפון"
                required
                value={guestPhone.value}
                error={guestPhone.error ?? undefined}
                onChange={(e) => guestPhone.onChange(e.target.value)}
                onBlur={guestPhone.onBlur}
              />
              <Input
                id="inviteeGuestAge"
                type="number"
                min={1}
                max={130}
                label="גיל"
                required
                value={guestAge.value}
                error={guestAge.error ?? undefined}
                onChange={(e) => guestAge.onChange(e.target.value)}
                onBlur={guestAge.onBlur}
              />
            </div>
          </>
        )}

        <div className={`grid grid-cols-1 gap-2 ${options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRsvpStatus(value)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                rsvpStatus === value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <Button type="submit" loading={submitting} className="flex-1">
            הוספה
          </Button>
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting} className="flex-1">
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}
