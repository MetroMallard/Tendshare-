/**
 * The small, boring rules about the two things a person types: an email address
 * and a six-digit code. Pure functions, so they are tested directly.
 */

/** How many digits the emailed code has. */
export const CODE_LENGTH = 6;

/**
 * Trim and lower-case. Email local parts are technically case-sensitive, but no
 * mail provider a family uses treats them that way, and two rows for the same
 * person would be a worse bug than the theoretical one.
 */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Deliberately forgiving: something@something.tld, no spaces, no obvious
 * mistakes. The real check is whether the email arrives, and refusing a valid
 * unusual address is worse than letting a typo through to a clear error.
 */
export function isPlausibleEmail(input: string): boolean {
  const email = normaliseEmail(input);

  if (email.length === 0 || email.length > 254 || /\s/.test(email)) {
    return false;
  }

  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return false;
  }

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.startsWith('.') || local.endsWith('.')) {
    return false;
  }

  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }

  const labels = domain.split('.');
  return labels.every((label) => label.length > 0) && (labels.at(-1)?.length ?? 0) >= 2;
}

/**
 * Digits only, capped at the code length.
 *
 * Phones happily paste " 123 456 " or "123456\n" from a mail client, and a
 * numeric keypad can still emit a comma. Everything that is not a digit is
 * dropped so the field is always a valid code or a shorter prefix of one.
 */
export function digitsOnly(input: string, max: number = CODE_LENGTH): string {
  return input.replace(/\D/g, '').slice(0, max);
}

export function isCompleteCode(input: string): boolean {
  return input.length === CODE_LENGTH && /^\d+$/.test(input);
}
