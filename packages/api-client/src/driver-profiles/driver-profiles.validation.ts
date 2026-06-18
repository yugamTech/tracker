/**
 * KYC field validation for driver profiles — shared so the driver-app UI and the
 * backend DTO enforce the same rules. Pure functions, no framework deps.
 */

/** Minimum length for a free-text residential address (when provided). */
export const ADDRESS_MIN_LENGTH = 10;

/** Indian DL pattern: 2 letters + 2 digits + 11 digits = 16 alphanumerics, e.g. `MH12 20231234567`. */
const LICENSE_RE = /^[A-Z]{2}\d{2}\s?\d{11}$/;

/** Strip all whitespace from an Aadhaar entry, leaving just the digits the user typed. */
export function normaliseAadhaar(value: string): string {
  return value.replace(/\s+/g, '');
}

/** Display an Aadhaar as `XXXX XXXX XXXX` (only when it's 12 digits, else returned as-is). */
export function formatAadhaar(value: string): string {
  const digits = normaliseAadhaar(value);
  if (digits.length !== 12) return value;
  return digits.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
}

/** Canonical licence form: uppercased, single space, e.g. `MH12 20231234567`. */
export function normaliseLicense(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, '');
  // Re-insert the conventional space after the 4-char state+RTO prefix.
  return compact.replace(/^([A-Z]{2}\d{2})(\d{11})$/, '$1 $2');
}

export function isValidAadhaar(value: string): boolean {
  return /^\d{12}$/.test(normaliseAadhaar(value));
}

export function isValidLicense(value: string): boolean {
  return LICENSE_RE.test(value.toUpperCase().trim());
}

/** A real `YYYY-MM-DD` calendar date (rejects e.g. 2027-02-31). */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Round-trip guards against rollovers like 2027-02-31 → 2027-03-03.
  return d.toISOString().slice(0, 10) === value;
}

/** True if a valid date string is strictly in the future (after today, UTC day). */
export function isFutureDate(value: string, now: Date = new Date()): boolean {
  if (!isValidDateString(value)) return false;
  const todayUtc = now.toISOString().slice(0, 10);
  return value > todayUtc;
}

export interface KycInput {
  aadhaarNumber?: string;
  address?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
}

/** Per-field error messages; an empty object means the input is valid. */
export type KycErrors = Partial<Record<keyof KycInput, string>>;

/**
 * Validate the editable KYC fields. Every field is optional, but if supplied it
 * must satisfy its format rule. Mirror of the backend class-validator constraints.
 */
export function validateKyc(input: KycInput, now: Date = new Date()): KycErrors {
  const errors: KycErrors = {};

  const aadhaar = input.aadhaarNumber?.trim();
  if (aadhaar && !isValidAadhaar(aadhaar)) {
    errors.aadhaarNumber = 'Aadhaar must be exactly 12 digits.';
  }

  const address = input.address?.trim();
  if (address !== undefined && address.length > 0 && address.length < ADDRESS_MIN_LENGTH) {
    errors.address = `Address must be at least ${ADDRESS_MIN_LENGTH} characters.`;
  }

  const license = input.licenseNumber?.trim();
  if (license && !isValidLicense(license)) {
    errors.licenseNumber = 'Enter a valid DL, e.g. MH12 20231234567.';
  }

  const expiry = input.licenseExpiry?.trim();
  if (expiry) {
    if (!isValidDateString(expiry)) {
      errors.licenseExpiry = 'Enter a real date as YYYY-MM-DD.';
    } else if (!isFutureDate(expiry, now)) {
      errors.licenseExpiry = 'Licence has expired — enter a future expiry date.';
    }
  }

  return errors;
}
