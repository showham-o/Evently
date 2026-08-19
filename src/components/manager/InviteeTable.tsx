import { useState } from 'react';
import { toast } from 'sonner';
import { Check, PencilLine, Trash2, Users, X } from 'lucide-react';
import type { EventInviteeWithProfile } from '../../lib/supabase/types';
import { supabase } from '../../lib/supabase/client';
import { StatusBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { EditInviteeModal } from './EditInviteeModal';

interface InviteeTableProps {
  invitees: EventInviteeWithProfile[];
  onChanged: () => void;
}

export function InviteeTable({ invitees, onChanged }: InviteeTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingInvitee, setEditingInvitee] = useState<EventInviteeWithProfile | null>(null);

  async function updateStatus(id: string, registration_status: 'approved' | 'rejected') {
    setUpdatingId(id);
    const { error } = await supabase.from('event_invitees').update({ registration_status }).eq('id', id);
    setUpdatingId(null);

    if (error) {
      toast.error('עדכון הסטטוס נכשל');
      return;
    }

    toast.success('הסטטוס עודכן');
    onChanged();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from('event_invitees').delete().eq('id', id);
    setDeletingId(null);

    if (error) {
      toast.error('מחיקת הנרשם נכשלה');
      return;
    }

    toast.success('הנרשם נמחק בהצלחה');
    setConfirmingDeleteId(null);
    onChanged();
  }

  if (invitees.length === 0) {
    return <EmptyState icon={Users} title="אין עדיין נרשמים" description="נרשמים לאירוע יופיעו כאן" />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-start text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-3 text-start font-medium">שם</th>
            <th className="px-4 py-3 text-start font-medium">אימייל</th>
            <th className="px-4 py-3 text-start font-medium">אישור הגעה</th>
            <th className="px-4 py-3 text-start font-medium">סטטוס רישום</th>
            <th className="px-4 py-3 text-start font-medium">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invitees.map((invitee) => (
            <tr key={invitee.id}>
              <td className="px-4 py-3 text-slate-900">
                {invitee.profile?.full_name ?? invitee.full_name}
                {!invitee.profile && <span className="ms-2 text-xs font-normal text-slate-400">(אורח)</span>}
              </td>
              <td className="px-4 py-3 text-slate-500">{invitee.profile?.email ?? invitee.email}</td>
              <td className="px-4 py-3">
                <StatusBadge status={invitee.rsvp_status} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={invitee.registration_status} />
              </td>
              <td className="px-4 py-3">
                {confirmingDeleteId === invitee.id ? (
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      className="!px-2.5 !py-1.5"
                      loading={deletingId === invitee.id}
                      onClick={() => handleDelete(invitee.id)}
                    >
                      אישור מחיקה
                    </Button>
                    <Button
                      variant="ghost"
                      className="!px-2.5 !py-1.5"
                      disabled={deletingId === invitee.id}
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      ביטול
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {invitee.registration_status === 'waiting_list' && (
                      <>
                        <Button
                          variant="outline"
                          className="!px-2.5 !py-1.5"
                          loading={updatingId === invitee.id}
                          onClick={() => updateStatus(invitee.id, 'approved')}
                          aria-label="אישור"
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          variant="outline"
                          className="!px-2.5 !py-1.5"
                          loading={updatingId === invitee.id}
                          onClick={() => updateStatus(invitee.id, 'rejected')}
                          aria-label="דחייה"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    {!invitee.profile && (
                      <Button
                        variant="outline"
                        className="!px-2.5 !py-1.5"
                        onClick={() => setEditingInvitee(invitee)}
                        aria-label="עריכה"
                      >
                        <PencilLine className="h-4 w-4 text-slate-600" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="!px-2.5 !py-1.5"
                      onClick={() => setConfirmingDeleteId(invitee.id)}
                      aria-label="מחיקה"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <EditInviteeModal invitee={editingInvitee} onClose={() => setEditingInvitee(null)} onSaved={onChanged} />
    </div>
  );
}
