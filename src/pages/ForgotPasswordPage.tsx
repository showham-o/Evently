import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/layout/PageContainer';
import { useValidatedInput } from '../hooks/useValidatedInput';
import { emailValidator } from '../utils/validation';

export function ForgotPasswordPage() {
  const email = useValidatedInput('', emailValidator);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.validateNow()) return;

    setSubmitting(true);

    await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // Always show the same success state regardless of whether the email
    // exists, so this can't be used to enumerate registered accounts.
    setSubmitting(false);
    setSent(true);
  }

  return (
    <PageContainer className="flex items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">איפוס סיסמה</h1>
          <p className="mt-1 text-sm text-slate-500">נשלח אליך קישור לאיפוס הסיסמה באימייל</p>
        </div>

        {sent ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
            אם קיים חשבון עם כתובת האימייל שהזנת, נשלח אליו מייל עם קישור לאיפוס הסיסמה.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <Input
              id="email"
              type="email"
              label="אימייל"
              required
              value={email.value}
              error={email.error ?? undefined}
              onChange={(e) => email.onChange(e.target.value)}
              onBlur={email.onBlur}
              placeholder="you@example.com"
            />
            <Button type="submit" loading={submitting} className="mt-2 w-full">
              {submitting ? 'שולח...' : 'שליחת קישור לאיפוס'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            חזרה להתחברות
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}
