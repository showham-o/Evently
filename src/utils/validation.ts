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
