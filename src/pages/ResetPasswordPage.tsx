import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../lib/supabase/client';
import { Card } from '../components/ui/Card';
import { PasswordInput } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/layout/PageContainer';
import { PageSkeleton } from '../components/ui/Skeleton';

export function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <PageSkeleton />;

  if (!user) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-xl font-bold text-slate-900">הקישור פג תוקף</h1>
          <p className="mb-6 text-sm text-slate-500">
            קישור איפוס הסיסמה אינו תקף או שפג תוקפו. יש לבקש קישור חדש.
          </p>
          <Link to="/forgot-password">
            <Button>בקשת קישור חדש</Button>
          </Link>
        </Card>
      </PageContainer>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError('עדכון הסיסמה נכשל, נסו לבקש קישור חדש');
      return;
    }

    toast.success('הסיסמה עודכנה בהצלחה');
    navigate('/');
  }

  return (
    <PageContainer className="flex items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">קביעת סיסמה חדשה</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PasswordInput
            id="password"
            label="סיסמה חדשה"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <PasswordInput
            id="confirmPassword"
            label="אימות סיסמה חדשה"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            {submitting ? 'מעדכן...' : 'עדכון סיסמה'}
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
}
