import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthProvider';
import { Card } from '../components/ui/Card';
import { Input, PasswordInput } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/layout/PageContainer';

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    const redirectTo = (location.state as { from?: Location })?.from ?? '/';
    return <Navigate to={typeof redirectTo === 'string' ? redirectTo : '/'} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError('אימייל או סיסמה שגויים');
      setSubmitting(false);
      return;
    }

    toast.success('התחברת בהצלחה');
    navigate('/');
  }

  return (
    <PageContainer className="flex items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <LogIn className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">התחברות</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="אימייל"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <PasswordInput
            id="password"
            label="סיסמה"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <div className="text-end">
            <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700">
              שכחתי סיסמה
            </Link>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            {submitting ? 'מתחבר...' : 'התחברות'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          אין לך חשבון?{' '}
          <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
            הרשמה
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}
