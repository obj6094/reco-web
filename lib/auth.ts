export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function isValidPassword(value: string): boolean {
  return PASSWORD_PATTERN.test(value);
}

export function getDisplayName(
  nickname: string | null | undefined,
  username: string | null | undefined
): string {
  return nickname?.trim() || username?.trim() || "user";
}
