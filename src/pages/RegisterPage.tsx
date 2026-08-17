import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthProvider';
import { Card } from '../components/ui/Card';
import { Input, PasswordInput } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/layout/PageContainer';

export function RegisterPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'אירעה שגיאה בהרשמה');
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      auth_user_id: data.user.id,
      full_name: fullName,
      email,
      phone: phone || null,
      age: age ? Number(age) : null,
      role: 'registered_user',
    });

    // A duplicate-key conflict means a DB trigger already created the profile row - not a real error.
    if (profileError && profileError.code !== '23505') {
      setError('החשבון נוצר אך אירעה שגיאה בשמירת הפרופיל, נסו להתחבר');
      setSubmitting(false);
      navigate('/login');
      return;
    }

    toast.success('נרשמת בהצלחה!');
    navigate('/');
  }

  return (
    <PageContainer className="flex items-center justify-center">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">הרשמה</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="fullName"
            label="שם מלא"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            id="email"
            type="email"
            label="אימייל"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            id="phone"
            type="tel"
            label="טלפון"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            id="age"
            type="number"
            label="גיל"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <PasswordInput
            id="password"
            label="סיסמה"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <PasswordInput
            id="confirmPassword"
            label="אימות סיסמה"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            {submitting ? 'נרשם...' : 'הרשמה'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          כבר יש לך חשבון?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            התחברות
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}
