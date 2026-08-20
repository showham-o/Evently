import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthProvider';
import { useValidatedInput } from '../hooks/useValidatedInput';
import { deleteArchivedProfile, findActiveArchivedProfile } from '../utils/archive';
import { findGuestDetailsByEmail, linkGuestInviteesToProfile } from '../utils/rsvp';
import {
  ageValidator,
  confirmPasswordValidator,
  emailValidator,
  FULL_NAME_MAX_LENGTH,
  fullNameValidator,
  passwordValidator,
  phoneValidator,
} from '../utils/validation';
import { Card } from '../components/ui/Card';
import { Input, PasswordInput } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/layout/PageContainer';
import { Seo } from '../components/seo/Seo';

export function RegisterPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const fullName = useValidatedInput('', fullNameValidator);
  const email = useValidatedInput('', emailValidator);
  const phone = useValidatedInput('', phoneValidator);
  const age = useValidatedInput('', ageValidator);
  const password = useValidatedInput('', passwordValidator);
  const confirmPassword = useValidatedInput('', confirmPasswordValidator(() => password.value));

  const [submitting, setSubmitting] = useState(false);
  const [archivedProfileId, setArchivedProfileId] = useState<string | null>(null);

  async function handleEmailBlur() {
    email.onBlur();
    if (!email.value) return;

    const archived = await findActiveArchivedProfile(email.value);
    if (archived) {
      setArchivedProfileId(archived.id);
      if (!fullName.value) fullName.setValue(archived.full_name || '');
      if (!phone.value) phone.setValue(archived.phone || '');
      if (!age.value) age.setValue(archived.age != null ? String(archived.age) : '');
      toast.info('מצאנו חשבון קודם עם אימייל זה - שחזרנו את פרטיך');
      return;
    }
    setArchivedProfileId(null);

    // No deleted-account history - check for a prior guest RSVP with this email instead.
    const guestDetails = await findGuestDetailsByEmail(email.value);
    if (guestDetails) {
      if (!fullName.value) fullName.setValue(guestDetails.fullName || '');
      if (!phone.value) phone.setValue(guestDetails.phone || '');
      if (!age.value) age.setValue(guestDetails.age != null ? String(guestDetails.age) : '');
      toast.info('מצאנו את הפרטים שמילאת בהרשמה קודמת כאורח לאירוע');
    }
  }

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validations = [
      fullName.validateNow(),
      email.validateNow(),
      phone.validateNow(),
      age.validateNow(),
      password.validateNow(),
      confirmPassword.validateNow(),
    ];
    if (validations.some((valid) => !valid)) return;

    setSubmitting(true);

    // full_name/phone/age ride along as auth user metadata; a DB trigger
    // (handle_new_auth_user) reads them to create the matching profiles row
    // in the same transaction as signup, so there's no separate insert here.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          full_name: fullName.value,
          phone: phone.value || null,
          age: age.value || null,
        },
      },
    });

    if (signUpError || !data.user) {
      toast.error(signUpError?.message ?? 'אירעה שגיאה בהרשמה');
      setSubmitting(false);
      return;
    }

    if (archivedProfileId) {
      await deleteArchivedProfile(archivedProfileId);
    }

    // Attach any prior guest RSVPs (this email, no account yet) to the new profile.
    const { data: newProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();
    if (newProfile) {
      await linkGuestInviteesToProfile(email.value, newProfile.id);
    }

    toast.success('נרשמת בהצלחה!');
    navigate('/');
  }

  return (
    <PageContainer className="flex items-center justify-center">
      <Seo title="הרשמה | Evently" description="פתחו חשבון Evently חדש כדי לאשר הגעה לאירועים." path="/register" noindex />
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">הרשמה</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            id="fullName"
            label="שם מלא"
            required
            maxLength={FULL_NAME_MAX_LENGTH}
            value={fullName.value}
            error={fullName.error ?? undefined}
            onChange={(e) => fullName.onChange(e.target.value)}
            onBlur={fullName.onBlur}
          />
          <Input
            id="email"
            type="email"
            label="אימייל"
            required
            value={email.value}
            error={email.error ?? undefined}
            onChange={(e) => email.onChange(e.target.value)}
            onBlur={handleEmailBlur}
            placeholder="you@example.com"
          />
          <Input
            id="phone"
            type="tel"
            label="טלפון"
            required
            value={phone.value}
            error={phone.error ?? undefined}
            onChange={(e) => phone.onChange(e.target.value)}
            onBlur={phone.onBlur}
          />
          <Input
            id="age"
            type="number"
            label="גיל"
            min={1}
            max={130}
            required
            value={age.value}
            error={age.error ?? undefined}
            onChange={(e) => age.onChange(e.target.value)}
            onBlur={age.onBlur}
          />
          <PasswordInput
            id="password"
            label="סיסמה"
            required
            value={password.value}
            error={password.error ?? undefined}
            onChange={(e) => password.onChange(e.target.value)}
            onBlur={password.onBlur}
            placeholder="••••••••"
          />
          <PasswordInput
            id="confirmPassword"
            label="אימות סיסמה"
            required
            value={confirmPassword.value}
            error={confirmPassword.error ?? undefined}
            onChange={(e) => confirmPassword.onChange(e.target.value)}
            onBlur={confirmPassword.onBlur}
            placeholder="••••••••"
          />
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
