/**
 * Free Access Whitelist
 *
 * Add email addresses here to grant free Pro access (unlimited dream analyses).
 * These users will be treated as Pro subscribers without needing to pay.
 *
 * Usage: Simply add email addresses to the array below.
 * The check is case-insensitive, so "User@Email.com" matches "user@email.com".
 */

export const FREE_ACCESS_EMAILS: string[] = [
  // Family & Friends
  'angieives1127@yahoo.com',

  // Add more emails below:
  // 'example@email.com',
];

/**
 * Check if an email has free Pro access
 */
export function hasFreeAccess(email: string): boolean {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase().trim();
  return FREE_ACCESS_EMAILS.some(
    (freeEmail) => freeEmail.toLowerCase().trim() === normalizedEmail
  );
}
