import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';
import type { Profile } from '../../lib/supabase/types';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';

export function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadProfiles() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    setProfiles((data ?? []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  async function promoteToManager(id: string) {
    setUpdatingId(id);
    const { error } = await supabase.from('profiles').update({ role: 'event_manager' }).eq('id', id);
    setUpdatingId(null);

    if (error) {
      toast.error('העדכון נכשל');
      return;
    }

    toast.success('המשתמש קודם למנהל אירועים');
    loadProfiles();
  }

  return (
    <PageContainer>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
        <ShieldCheck className="h-6 w-6 text-primary-600" />
        ניהול מערכת
      </h1>
      <p className="mb-6 text-slate-500">קידום משתמשים לתפקיד מנהל אירועים</p>

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
                    {p.role === 'registered_user' && (
                      <Button
                        variant="outline"
                        loading={updatingId === p.id}
                        onClick={() => promoteToManager(p.id)}
                      >
                        קידום למנהל אירועים
                      </Button>
                    )}
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
