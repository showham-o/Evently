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
import { Seo } from '../components/seo/Seo';
import { useValidatedInput } from '../hooks/useValidatedInput';
import { confirmPasswordValidator, passwordValidator } from '../utils/validation';

export function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const password = useValidatedInput('', passwordValidator);
  const confirmPassword = useValidatedInput('', confirmPasswordValidator(() => password.value));
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageSkeleton />;

  if (!user) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Seo title="קישור לא תקף | Evently" description="קישור איפוס הסיסמה אינו תקף." path="/reset-password" noindex />
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

    const validations = [password.validateNow(), confirmPassword.validateNow()];
    if (validations.some((valid) => !valid)) return;

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: password.value });
    setSubmitting(false);

    if (updateError) {
      toast.error('עדכון הסיסמה נכשל, נסו לבקש קישור חדש');
      return;
    }

    toast.success('הסיסמה עודכנה בהצלחה');
    navigate('/');
  }

  return (
    <PageContainer className="flex items-center justify-center">
      <Seo title="איפוס סיסמה | Evently" description="קביעת סיסמה חדשה לחשבון Evently שלך." path="/reset-password" noindex />
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">קביעת סיסמה חדשה</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <PasswordInput
            id="password"
            label="סיסמה חדשה"
            required
            value={password.value}
            error={password.error ?? undefined}
            onChange={(e) => password.onChange(e.target.value)}
            onBlur={password.onBlur}
            placeholder="••••••••"
          />
          <PasswordInput
            id="confirmPassword"
            label="אימות סיסמה חדשה"
            required
            value={confirmPassword.value}
            error={confirmPassword.error ?? undefined}
            onChange={(e) => confirmPassword.onChange(e.target.value)}
            onBlur={confirmPassword.onBlur}
            placeholder="••••••••"
          />
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            {submitting ? 'מעדכן...' : 'עדכון סיסמה'}
          </Button>
        </form>
      </Card>
    </PageContainer>
  );
}
