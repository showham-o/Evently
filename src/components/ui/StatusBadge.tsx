type BadgeTone = 'green' | 'amber' | 'red' | 'slate' | 'indigo';

const toneClasses: Record<BadgeTone, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-primary-100 text-primary-700',
};

const statusConfig: Record<string, { label: string; tone: BadgeTone }> = {
  // event status
  draft: { label: 'טיוטה', tone: 'slate' },
  published: { label: 'פורסם', tone: 'green' },
  // NOTE: 'cancelled' is also a valid RegistrationStatus value (event_invitees.registration_status).
  // Both dimensions share the label 'בוטל', so no duplicate key is needed. Event-status cancelled
  // stays red by default here. A caller rendering a cancelled *registration* (user withdrew their
  // own RSVP, not an alarm state) should override the tone explicitly, e.g.
  // <StatusBadge status="cancelled" tone="slate" /> — the label still resolves from this entry.
  cancelled: { label: 'בוטל', tone: 'red' },
  completed: { label: 'הסתיים', tone: 'slate' },
  full: { label: 'מלא', tone: 'red' },
  // registration status
  approved: { label: 'מאושר', tone: 'green' },
  waiting_list: { label: 'רשימת המתנה', tone: 'amber' },
  rejected_age: { label: 'נדחה - גיל', tone: 'red' },
  rejected: { label: 'נדחה', tone: 'red' },
  // rsvp status
  attending: { label: 'מגיע/ה', tone: 'green' },
  declined: { label: 'לא מגיע/ה', tone: 'slate' },
  maybe: { label: 'אולי', tone: 'amber' },
  // logistics status
  pending: { label: 'ממתין', tone: 'amber' },
  ordered: { label: 'הוזמן', tone: 'indigo' },
  received: { label: 'התקבל', tone: 'green' },
  // roles
  super_admin: { label: 'מנהל-על', tone: 'indigo' },
  event_manager: { label: 'מנהל אירועים', tone: 'indigo' },
  registered_user: { label: 'משתמש רשום', tone: 'slate' },
  guest: { label: 'אורח', tone: 'slate' },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  tone?: BadgeTone;
}

export function StatusBadge({ status, label, tone }: StatusBadgeProps) {
  const config = statusConfig[status];
  const resolvedTone = tone ?? config?.tone ?? 'slate';
  const resolvedLabel = label ?? config?.label ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[resolvedTone]}`}
    >
      {resolvedLabel}
    </span>
  );
}
