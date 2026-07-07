import { test, expect } from '@playwright/test';
import { DEMO_USERS, login } from './utils';

test('employee clocks in and out for the day', async ({ page }) => {
  await login(page, DEMO_USERS.employee.email, DEMO_USERS.employee.password);
  await page.goto('/attendance');

  // Clock in/out is once-per-day: a repeat run on the same real calendar day may find
  // the employee already clocked out, in which case the button is hidden entirely and
  // only the "completed" message remains. That's the correct terminal state to assert.
  const alreadyDone = page.getByText("You've completed your shift for today.");
  const clockButton = page.getByRole('button', { name: /Clock In|Clock Out/ });

  await expect(alreadyDone.or(clockButton)).toBeVisible({ timeout: 15_000 });
  if (await alreadyDone.isVisible().catch(() => false)) {
    return;
  }

  const initialLabel = await clockButton.textContent();
  if (initialLabel?.includes('Clock In')) {
    await clockButton.click();
    await expect(page.getByRole('button', { name: 'Clock Out' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^In: /)).toBeVisible();
  }

  await page.getByRole('button', { name: 'Clock Out' }).click();
  await expect(alreadyDone).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Out: /)).toBeVisible();
});
