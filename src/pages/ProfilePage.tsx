import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../lib/supabase/client';
import { PageContainer } from '../components/layout/PageContainer';
import { PageSkeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';
import { Input, PasswordInput } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { isValidEmail } from '../utils/validation';

export function ProfilePage() {
  const { profile, user, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [savingDetails, setSavingDetails] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <PageSkeleton />;
  if (!profile || !user) return <PageSkeleton />;

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();

    if (!isValidEmail(email)) {
      toast.error('כתובת אימייל לא תקינה');
      return;
    }

    setSavingDetails(true);
    try {
      if (email !== profile!.email) {
        const { error: authError } = await supabase.auth.updateUser({ email });
        if (authError) throw authError;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, email })
        .eq('id', profile!.id);

      if (profileError) throw profileError;

      await refreshProfile();
      toast.success('הפרטים עודכנו בהצלחה');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'עדכון הפרטים נכשל');
    } finally {
      setSavingDetails(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      toast.error('עדכון הסיסמה נכשל');
      return;
    }

    setPassword('');
    setConfirmPassword('');
    toast.success('הסיסמה עודכנה בהצלחה');
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setConfirmingDelete(false);
        return;
      }

      toast.success('החשבון נמחק בהצלחה');
      await signOut();
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'מחיקת החשבון נכשלה');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageContainer className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          <UserRound className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">הפרופיל שלי</h1>
          <p className="text-sm text-slate-500">ניהול פרטי החשבון שלך</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">פרטים אישיים</h2>
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
            <Input id="fullName" label="שם מלא" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input
              id="email"
              type="email"
              label="אימייל"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" loading={savingDetails} className="w-full sm:w-auto">
              שמירת פרטים
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">שינוי סיסמה</h2>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <PasswordInput
              id="newPassword"
              label="סיסמה חדשה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <PasswordInput
              id="confirmNewPassword"
              label="אימות סיסמה חדשה"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Button type="submit" loading={savingPassword} className="w-full sm:w-auto">
              עדכון סיסמה
            </Button>
          </form>
        </Card>

        <Card className="border-red-200 p-6">
          <div className="mb-4 flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">מחיקת חשבון</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            פעולה זו תמחק את החשבון שלך לצמיתות. פרטיך יישמרו בארכיון למשך שנה למקרה שתרצה/י להירשם מחדש.
          </p>

          {!confirmingDelete ? (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              מחיקת החשבון שלי
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="danger" loading={deleting} onClick={handleDeleteAccount}>
                אישור מחיקה סופית
              </Button>
              <Button variant="outline" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                ביטול
              </Button>
            </div>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
