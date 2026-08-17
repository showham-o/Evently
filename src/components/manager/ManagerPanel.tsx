import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { UserMinus, UserPlus } from 'lucide-react';
import type { Event, Profile } from '../../lib/supabase/types';
import { supabase } from '../../lib/supabase/client';
import { addManager, findProfileByEmail, MAX_MANAGERS, removeManager } from '../../utils/managers';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ManagerPanelProps {
  event: Event;
  currentProfileId: string;
  onChanged: (event: Event) => void;
}

export function ManagerPanel({ event, currentProfileId, onChanged }: ManagerPanelProps) {
  const [managers, setManagers] = useState<Profile[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadManagers() {
      setLoadingManagers(true);
      const { data } = await supabase.from('profiles').select('*').in('id', event.manager_ids);
      if (mounted) {
        setManagers((data ?? []) as Profile[]);
        setLoadingManagers(false);
      }
    }

    loadManagers();
    return () => {
      mounted = false;
    };
  }, [event.manager_ids]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);

    try {
      const targetProfile = await findProfileByEmail(email.trim());
      if (!targetProfile) {
        toast.error('לא נמצא משתמש רשום עם אימייל זה');
        return;
      }
      if (targetProfile.role === 'guest') {
        toast.error('לא ניתן למנות אורח כמנהל אירוע');
        return;
      }

      const updated = await addManager(event, targetProfile.id);
      onChanged(updated);
      setEmail('');
      toast.success('המנהל נוסף בהצלחה');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'הוספת המנהל נכשלה');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(managerId: string) {
    setRemovingId(managerId);
    try {
      const updated = await removeManager(event, managerId, managerId === currentProfileId);
      onChanged(updated);
      toast.success('המנהל הוסר בהצלחה');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'הסרת המנהל נכשלה');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="p-6">
      <h3 className="mb-1 text-lg font-semibold text-slate-900">מנהלי האירוע</h3>
      <p className="mb-4 text-sm text-slate-500">עד {MAX_MANAGERS} מנהלים לאירוע ({event.manager_ids.length}/{MAX_MANAGERS})</p>

      {loadingManagers ? (
        <p className="text-sm text-slate-400">טוען...</p>
      ) : (
        <ul className="mb-5 flex flex-col gap-2">
          {managers.map((manager) => (
            <li
              key={manager.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {manager.full_name}
                  {manager.id === currentProfileId && <span className="text-slate-400"> (את/ה)</span>}
                </p>
                <p className="text-xs text-slate-500">{manager.email}</p>
              </div>
              <Button
                variant="ghost"
                className="!px-2.5 !py-1.5"
                loading={removingId === manager.id}
                onClick={() => handleRemove(manager.id)}
                aria-label="הסרת מנהל"
              >
                <UserMinus className="h-4 w-4 text-red-600" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {event.manager_ids.length < MAX_MANAGERS && (
        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              id="managerEmail"
              type="email"
              label="הוספת מנהל לפי אימייל"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <Button type="submit" variant="outline" icon={<UserPlus className="h-4 w-4" />} loading={adding}>
            הוספה
          </Button>
        </form>
      )}
    </Card>
  );
}
