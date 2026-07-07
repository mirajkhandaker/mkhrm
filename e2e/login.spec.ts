import { test, expect } from '@playwright/test';
import { DEMO_USERS, login } from './utils';

test('logs in and reaches a role-aware dashboard', async ({ page }) => {
  await login(page, DEMO_USERS.employee.email, DEMO_USERS.employee.password);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // A logged-in employee sees the shell nav, not the login form.
  const sidebar = page.getByRole('navigation');
  await expect(sidebar.getByRole('link', { name: 'Attendance' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Leave' })).toBeVisible();
});

test('rejects an invalid password with an error message', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#email').fill(DEMO_USERS.employee.email);
  await page.locator('#password').fill('WrongPassword!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});
