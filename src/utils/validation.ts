const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// Israeli phone numbers: leading 0, then 8-9 digits (covers mobile 05X-XXXXXXX
// and landline 0X-XXXXXXX). Spaces/dashes are stripped before checking.
export function isValidPhone(phone: string): boolean {
  const digitsOnly = phone.replace(/[\s-]/g, '');
  return /^0\d{8,9}$/.test(digitsOnly);
}

export function isValidAge(age: string): boolean {
  if (!/^\d+$/.test(age.trim())) return false;
  const n = Number(age);
  return Number.isInteger(n) && n >= 1 && n <= 130;
}

/**
 * Field-level validators: each takes the raw input value and returns an
 * error message (Hebrew, shown under the field) or null when valid. Meant
 * for use with useValidatedInput - required-ness is baked into each so a
 * blank mandatory field reports "required" rather than a format error.
 */

export function requiredValidator(fieldLabel: string) {
  return (value: string): string | null => (value.trim() ? null : `שדה ${fieldLabel} הוא שדה חובה`);
}

export function emailValidator(value: string): string | null {
  if (!value.trim()) return 'שדה אימייל הוא שדה חובה';
  return isValidEmail(value) ? null : 'כתובת אימייל לא תקינה';
}

export function phoneValidator(value: string): string | null {
  if (!value.trim()) return 'שדה טלפון הוא שדה חובה';
  return isValidPhone(value) ? null : 'מספר טלפון לא תקין';
}

export function ageValidator(value: string): string | null {
  if (!value.trim()) return 'שדה גיל הוא שדה חובה';
  return isValidAge(value) ? null : 'יש להזין גיל תקין (1-130)';
}

export function passwordValidator(value: string): string | null {
  if (!value) return 'שדה סיסמה הוא שדה חובה';
  return value.length >= 6 ? null : 'הסיסמה חייבת להכיל לפחות 6 תווים';
}

export function confirmPasswordValidator(getPassword: () => string) {
  return (value: string): string | null => {
    if (!value) return 'שדה אימות סיסמה הוא שדה חובה';
    return value === getPassword() ? null : 'הסיסמאות אינן תואמות';
  };
}
