import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthProvider';
import { deleteArchivedProfile, findActiveArchivedProfile } from '../utils/archive';
import { findGuestDetailsByEmail, linkGuestInviteesToProfile } from '../utils/rsvp';
import { isValidEmail, isValidPhone } from '../utils/validation';
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
  const [archivedProfileId, setArchivedProfileId] = useState<string | null>(null);

  async function handleEmailBlur() {
    if (!email) return;

    const archived = await findActiveArchivedProfile(email);
    if (archived) {
      setArchivedProfileId(archived.id);
      setFullName((current) => current || archived.full_name || '');
      setPhone((current) => current || archived.phone || '');
      setAge((current) => current || (archived.age != null ? String(archived.age) : ''));
      toast.info('מצאנו חשבון קודם עם אימייל זה - שחזרנו את פרטיך');
      return;
    }
    setArchivedProfileId(null);

    // No deleted-account history - check for a prior guest RSVP with this email instead.
    const guestDetails = await findGuestDetailsByEmail(email);
    if (guestDetails) {
      setFullName((current) => current || guestDetails.fullName || '');
      setPhone((current) => current || guestDetails.phone || '');
      setAge((current) => current || (guestDetails.age != null ? String(guestDetails.age) : ''));
      toast.info('מצאנו את הפרטים שמילאת בהרשמה קודמת כאורח לאירוע');
    }
  }

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !phone || !age) {
      setError('יש למלא שם מלא, אימייל, טלפון וגיל');
      return;
    }
    if (!isValidEmail(email)) {
      setError('כתובת אימייל לא תקינה');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('מספר טלפון לא תקין');
      return;
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setSubmitting(true);

    // full_name/phone/age ride along as auth user metadata; a DB trigger
    // (handle_new_auth_user) reads them to create the matching profiles row
    // in the same transaction as signup, so there's no separate insert here.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          age: age || null,
        },
      },
    });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'אירעה שגיאה בהרשמה');
      setSubmitting(false);
      return;
    }

    if (archivedProfileId) {
      await deleteArchivedProfile(archivedProfileId);
    }

    // Attach any prior guest RSVPs (this email, no account yet) to the new profile.
    const { data: newProfile } = await supabase.from('profiles').select('id').eq('auth_user_id', data.user.id).maybeSingle();
    if (newProfile) {
      await linkGuestInviteesToProfile(email, newProfile.id);
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
            onBlur={handleEmailBlur}
            placeholder="you@example.com"
          />
          <Input
            id="phone"
            type="tel"
            label="טלפון"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            id="age"
            type="number"
            label="גיל"
            min={0}
            max={120}
            required
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
