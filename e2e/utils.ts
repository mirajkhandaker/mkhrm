import { Page, expect } from '@playwright/test';

export const DEMO_USERS = {
  admin: { email: 'admin@hrm.local', password: '123456' },
  manager: { email: 'manager@hrm.local', password: '123456' },
  employee: { email: 'employee@hrm.local', password: '123456' },
};

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Nudges a date forward to the next Mon–Fri weekday. */
export function nextWeekday(d: Date): Date {
  const copy = new Date(d);
  while (copy.getDay() === 0 || copy.getDay() === 6) {
    copy.setDate(copy.getDate() + 1);
  }
  return copy;
}
