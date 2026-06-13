/**
 * Coerce a user-entered number into the `+91XXXXXXXXXX` E.164 form identity is
 * keyed by. Identity is global, keyed by this exact string, so an admin-created
 * person (student's parent or staff member) must match what the user later types
 * at OTP login (10 digits) or they can never log in. Shared by student + staff
 * creation so both onboarding paths normalize identically.
 */
export function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (input.trim().startsWith('+')) return `+${digits}`;
  return `+91${digits}`;
}
