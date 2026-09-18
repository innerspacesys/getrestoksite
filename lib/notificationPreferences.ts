export function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function notificationRecipient(user: { email?: string; notificationEmail?: string }): string | null {
  const override = user.notificationEmail?.trim();
  if (override && validEmail(override)) return override;
  const account = user.email?.trim();
  return account && validEmail(account) ? account : null;
}
