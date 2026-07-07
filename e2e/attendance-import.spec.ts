import { test, expect } from '@playwright/test';
import { DEMO_USERS, login, isoDate, nextWeekday } from './utils';

test('HR uploads and commits an attendance import', async ({ page }) => {
  // A date far enough in the past to never collide with seeded demo attendance
  // records (yesterday / 2–3 days ago) or a prior run of this test.
  const daysAgo = 30 + (Math.floor(Date.now() / 1000) % 1000);
  const workDate = isoDate(nextWeekday(new Date(Date.now() - daysAgo * 86_400_000)));

  const csv = `EmployeeCode,Date,TimeIn,TimeOut\nEMP-001,${workDate},09:05,17:10\n`;

  await login(page, DEMO_USERS.admin.email, DEMO_USERS.admin.password);
  await page.goto('/attendance/import');

  // 1. Upload.
  await page.locator('#file').setInputFiles({
    name: 'attendance.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Upload' }).click();

  // 2. Map columns.
  await expect(page.getByRole('heading', { name: '2. Map columns' })).toBeVisible({ timeout: 15_000 });
  await page.locator('#empCol').selectOption('EmployeeCode');
  await page.locator('#dateCol').selectOption('Date');
  await page.getByRole('button', { name: 'TimeIn' }).click();
  await page.getByRole('button', { name: 'TimeOut' }).click();
  await page.getByRole('button', { name: 'Continue to preview' }).click();

  // 3. Preview shows the row matched and validated with no errors.
  await expect(page.getByRole('heading', { name: '3. Preview & confirm' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('0 error')).toBeVisible();
  await expect(page.getByText('EMP-001')).toBeVisible();

  // 4. Commit.
  await page.getByRole('button', { name: 'Commit valid rows' }).click();
  await expect(page.getByRole('heading', { name: '4. Done' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Committed 1 of 1 rows/)).toBeVisible();
});
