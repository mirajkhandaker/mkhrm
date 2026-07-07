import { test, expect } from '@playwright/test';
import { DEMO_USERS, login, isoDate, nextWeekday } from './utils';

test('employee applies for leave and manager approves it', async ({ browser }) => {
  // Two separate browser contexts (not one shared page) so each actor's rotating
  // refresh-token cookie lives in its own jar — reusing one page across logins as
  // different users races the refresh cycle of the previous session against the new one.
  const employeeContext = await browser.newContext();
  const managerContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  const managerPage = await managerContext.newPage();

  try {
    // Pick a date far enough ahead to never collide with a prior run of this test,
    // nudged off weekends so the day-counting preview shows a non-zero day count.
    const daysAhead = 50 + (Math.floor(Date.now() / 1000) % 2000);
    const start = nextWeekday(new Date(Date.now() + daysAhead * 86_400_000));
    const end = nextWeekday(new Date(start.getTime() + 2 * 86_400_000));
    const startStr = isoDate(start);
    const endStr = isoDate(end);
    const marker = `E2E test leave application ${Date.now()}`;

    // 1. Employee submits a leave application.
    await login(employeePage, DEMO_USERS.employee.email, DEMO_USERS.employee.password);
    await employeePage.goto('/leave/apply');

    await employeePage.locator('#leaveTypeId').selectOption({ label: 'Casual Leave' });
    await employeePage.locator('#startDate').fill(startStr);
    await employeePage.locator('#endDate').fill(endStr);
    await employeePage.locator('#reason').fill(marker);
    await employeePage.getByRole('button', { name: 'Submit Application' }).click();

    await expect(employeePage).toHaveURL(/\/leave$/, { timeout: 15_000 });
    const row = employeePage.locator('div.flex.items-center.gap-4.px-5.py-3', { hasText: marker });
    await expect(row.getByText('pending')).toBeVisible();

    // 2. Manager approves it from My Approvals.
    await login(managerPage, DEMO_USERS.manager.email, DEMO_USERS.manager.password);
    await managerPage.goto('/approvals');

    // Wait for the inbox to finish loading (either cards or the empty state) before counting.
    const pendingLeaveCards = managerPage.getByText('Leave Request');
    await expect(pendingLeaveCards.first().or(managerPage.getByText('All caught up'))).toBeVisible({ timeout: 15_000 });
    const countBefore = await pendingLeaveCards.count();
    expect(countBefore).toBeGreaterThan(0);
    await pendingLeaveCards.first().click();
    await managerPage.getByRole('button', { name: 'Approve' }).click();

    // The acted-on card is removed from the pending inbox.
    await expect(pendingLeaveCards).toHaveCount(countBefore - 1, { timeout: 15_000 });

    // 3. Employee sees this specific application marked approved.
    await employeePage.goto('/leave');
    await expect(row.getByText('approved')).toBeVisible({ timeout: 15_000 });
  } finally {
    await employeeContext.close();
    await managerContext.close();
  }
});
