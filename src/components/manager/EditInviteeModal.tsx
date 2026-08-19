import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { EventInviteeWithProfile, RsvpStatus } from '../../lib/supabase/types';
import { supabase } from '../../lib/supabase/client';
import { ageValidator, emailValidator, phoneValidator, requiredValidator } from '../../utils/validation';
import { useValidatedInput } from '../../hooks/useValidatedInput';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const rsvpOptions: { value: RsvpStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'attending', label: 'מגיע/ה', icon: CheckCircle2 },
  { value: 'declined', label: 'לא מגיע/ה', icon: XCircle },
];

interface EditInviteeModalProps {
  invitee: EventInviteeWithProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditInviteeModal({ invitee, onClose, onSaved }: EditInviteeModalProps) {
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>('attending');
  const [submitting, setSubmitting] = useState(false);

  const fullName = useValidatedInput('', requiredValidator('שם מלא'));
  const email = useValidatedInput('', emailValidator);
  const phone = useValidatedInput('', phoneValidator);
  const age = useValidatedInput('', ageValidator);

  useEffect(() => {
    if (!invitee) return;
    fullName.setValue(invitee.full_name ?? '');
    email.setValue(invitee.email ?? '');
    phone.setValue(invitee.phone ?? '');
    age.setValue(invitee.age != null ? String(invitee.age) : '');
    setRsvpStatus(invitee.rsvp_status === 'declined' ? 'declined' : 'attending');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitee]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!invitee) return;

    const validations = [fullName.validateNow(), email.validateNow(), phone.validateNow(), age.validateNow()];
    if (validations.some((valid) => !valid)) return;

    setSubmitting(true);
    const { error } = await supabase
      .from('event_invitees')
      .update({
        full_name: fullName.value,
        email: email.value,
        phone: phone.value,
        age: Number(age.value),
        rsvp_status: rsvpStatus,
      })
      .eq('id', invitee.id);
    setSubmitting(false);

    if (error) {
      toast.error('עדכון הנרשם נכשל');
      return;
    }

    toast.success('הנרשם עודכן בהצלחה');
    onSaved();
    onClose();
  }

  return (
    <Modal open={!!invitee} title="עריכת נרשם" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          id="editInviteeFullName"
          label="שם מלא"
          required
          value={fullName.value}
          error={fullName.error ?? undefined}
          onChange={(e) => fullName.onChange(e.target.value)}
          onBlur={fullName.onBlur}
        />
        <Input
          id="editInviteeEmail"
          type="email"
          label="אימייל"
          required
          value={email.value}
          error={email.error ?? undefined}
          onChange={(e) => email.onChange(e.target.value)}
          onBlur={email.onBlur}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="editInviteePhone"
            type="tel"
            label="טלפון"
            required
            value={phone.value}
            error={phone.error ?? undefined}
            onChange={(e) => phone.onChange(e.target.value)}
            onBlur={phone.onBlur}
          />
          <Input
            id="editInviteeAge"
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

        <div className="grid grid-cols-2 gap-2">
          {rsvpOptions.map(({ value, label, icon: Icon }) => (
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
            שמירה
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="flex-1">
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}
