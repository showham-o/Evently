import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import type { Profile } from '../../lib/supabase/types';
import { reassignManagedEvents } from '../../utils/managers';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Seo } from '../../components/seo/Seo';

export function AdminPage() {
  const { profile: currentAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  async function loadProfiles() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  // Role changes are locked down at the DB level (regular column UPDATE
  // grants exclude `role`), so promotion/demotion goes through the
  // admin_set_role security-definer RPC, which itself verifies the caller
  // is a super_admin.
  async function promoteToManager(id: string) {
    setUpdatingId(id);
    const { error } = await supabase.rpc('admin_set_role', {
      target_profile_id: id,
      new_role: 'event_manager',
    });
    setUpdatingId(null);

    if (error) {
      toast.error('העדכון נכשל');
      return;
    }

    toast.success('המשתמש קודם למנהל אירועים');
    loadProfiles();
  }

  async function demoteToRegisteredUser(target: Profile) {
    if (!currentAdmin) return;
    setUpdatingId(target.id);

    try {
      // Any event where this manager would become orphaned falls back to the admin performing the demotion.
      await reassignManagedEvents(target.id, currentAdmin.id);

      const { error } = await supabase.rpc('admin_set_role', {
        target_profile_id: target.id,
        new_role: 'registered_user',
      });
      if (error) throw error;

      toast.success('המשתמש הורד לתפקיד משתמש רשום');
      loadProfiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'העדכון נכשל');
    } finally {
      setUpdatingId(null);
    }
  }

  async function forceDeleteUser(target: Profile) {
    setDeletingId(target.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { targetUserId: target.id },
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success('החשבון נמחק בהצלחה');
      setConfirmingDeleteId(null);
      loadProfiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'מחיקת החשבון נכשלה');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <PageContainer>
      <Seo title="ניהול מערכת | Evently" description="ניהול משתמשים והרשאות." path="/admin" noindex />
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <ShieldCheck className="h-6 w-6 text-primary-600" />
        ניהול מערכת
      </h1>
      <p className="mb-6 text-slate-500">ניהול תפקידים וחשבונות משתמשים</p>

      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start font-medium">שם</th>
                <th className="px-4 py-3 text-start font-medium">אימייל</th>
                <th className="px-4 py-3 text-start font-medium">תפקיד</th>
                <th className="px-4 py-3 text-start font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-900">{p.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.role} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.role === 'registered_user' && (
                        <Button variant="outline" loading={updatingId === p.id} onClick={() => promoteToManager(p.id)}>
                          קידום למנהל אירועים
                        </Button>
                      )}
                      {p.role === 'event_manager' && (
                        <Button
                          variant="outline"
                          loading={updatingId === p.id}
                          onClick={() => demoteToRegisteredUser(p)}
                        >
                          הורדה למשתמש רשום
                        </Button>
                      )}
                      {p.role !== 'super_admin' &&
                        (confirmingDeleteId === p.id ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="danger"
                              loading={deletingId === p.id}
                              onClick={() => forceDeleteUser(p)}
                            >
                              אישור מחיקה
                            </Button>
                            <Button variant="ghost" onClick={() => setConfirmingDeleteId(null)} disabled={deletingId === p.id}>
                              ביטול
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            icon={<Trash2 className="h-4 w-4 text-red-600" />}
                            onClick={() => setConfirmingDeleteId(p.id)}
                            aria-label="מחיקת משתמש"
                          />
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
