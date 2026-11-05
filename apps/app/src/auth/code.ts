/**
 * The small, boring rules about the two things a person types: an email address
 * and the code from their inbox. Pure functions, so they are tested directly.
 */

/**
 * How many digits the emailed code has — decided by the project, not by us.
 *
 * Supabase's `OTP_LENGTH` is a project setting: GoTrue's own default is six, and
 * the hosted project currently mints **eight** (measured, not guessed — see
 * `pnpm test:auth:live`). Hard-coding six made the verify screen silently cut
 * every real code down to its first six digits, so every real sign-in failed.
 * The field therefore accepts the whole plausible range and the server is the
 * judge; the live suite fails if a minted code ever falls outside it.
 */
export const CODE_MIN_LENGTH = 6;
export const CODE_MAX_LENGTH = 8;

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
 * Digits only, capped at the longest code the project could send.
 *
 * Phones happily paste " 123 456 " or "123456\n" from a mail client, and a
 * numeric keypad can still emit a comma. Everything that is not a digit is
 * dropped so the field is always a valid code or a shorter prefix of one.
 */
export function digitsOnly(input: string, max: number = CODE_MAX_LENGTH): string {
  return input.replace(/\D/g, '').slice(0, max);
}

/** Long enough to be a whole code, short enough to be one. */
export function isCompleteCode(input: string): boolean {
  return input.length >= CODE_MIN_LENGTH && input.length <= CODE_MAX_LENGTH && /^\d+$/.test(input);
}
