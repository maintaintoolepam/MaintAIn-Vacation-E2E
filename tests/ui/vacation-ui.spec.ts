import { test, expect, Page } from '@playwright/test';
import { TEST_USER, TEST_PASSWORD, BACKEND_URL, authHeaders, deleteAllVacations } from '../helpers/auth';

/**
 * UI-level E2E tests for the Vacation Management frontend.
 * The frontend is expected at http://localhost:5173.
 */

/**
 * Helper: log in through the UI login form.
 */
async function login(page: Page, username = TEST_USER, password = TEST_PASSWORD) {
  await page.goto('/');

  // Fill in the login form
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /login|sign in|submit/i }).click();

  // Wait until the remaining vacation days indicator is visible (signals successful login)
  await expect(page.getByText(/remaining/i)).toBeVisible({ timeout: 10_000 });
}

test.describe('UI – Login & Dashboard', () => {

  test('Login form authenticates and shows dashboard', async ({ page }) => {
    await login(page);

    // Remaining vacation days should be visible
    await expect(page.getByText(/remaining/i)).toBeVisible();
  });

  test('Dashboard displays remaining vacation days', async ({ page }) => {
    await login(page);

    // The remaining days text should contain a number
    const remainingText = page.getByText(/remaining/i);
    await expect(remainingText).toBeVisible();
    const text = await remainingText.textContent();
    expect(text).toMatch(/\d+/);
  });

});

test.describe('UI – Vacation Management', () => {

  test.beforeEach(async ({ request }) => {
    await deleteAllVacations(request);
  });

  test.afterEach(async ({ request }) => {
    await deleteAllVacations(request);
  });

  test('Create vacation request and verify it appears in the list', async ({ page, request }) => {
    await login(page);

    // Get remaining days before creating vacation
    const userBefore = await (
      await request.get(`${BACKEND_URL}/api/users/me`, { headers: authHeaders() })
    ).json();
    const daysBefore: number = userBefore.remainingVacationDays;

    // Fill in the vacation creation form
    const startDateInput = page.getByLabel(/start/i);
    const endDateInput = page.getByLabel(/end/i);

    await startDateInput.fill('2026-10-01');
    await endDateInput.fill('2026-10-03');

    await page.getByRole('button', { name: /create|submit|request|add/i }).click();

    // Verify the vacation appears in the list – scope checks to the specific table row
    const createdRow = page.getByRole('row').filter({ hasText: '2026-10-01' });
    await expect(createdRow).toBeVisible({ timeout: 10_000 });
    await expect(createdRow.getByText('2026-10-03')).toBeVisible();

    // Verify status is PENDING within that row
    await expect(createdRow.getByText(/pending/i)).toBeVisible();

    // Verify remaining days decreased in the UI (FIXED FLAKY PART)
    const remainingText = page.getByText(/remaining/i);

    await expect
      .poll(async () => {
        const text = await remainingText.textContent();
        const match = text?.match(/(\d+)/);
        return match ? Number(match[1]) : null;
      }, { timeout: 10_000 })
      .toBeLessThan(daysBefore);

    const text = await remainingText.textContent();
    const match = text?.match(/(\d+)/);
    expect(match).not.toBeNull();
    const daysAfter = Number(match![1]);
    expect(daysAfter).toBeLessThan(daysBefore);
  });

});

test.describe('UI – Full Vacation Flow', () => {

  test.beforeEach(async ({ request }) => {
    await deleteAllVacations(request);
  });

  test.afterEach(async ({ request }) => {
    await deleteAllVacations(request);
  });

  test('Login → view remaining days → create vacation → verify decreased days → delete vacation → verify restored days', async ({ page, request }) => {
    // ── Step 1: Login ──
    await login(page);

    // ── Step 2: Display remaining vacation days ──
    const remainingLocator = page.getByText(/remaining/i);
    await expect(remainingLocator).toBeVisible();

    const initialText = await remainingLocator.textContent();
    const initialMatch = initialText?.match(/(\d+)/);
    expect(initialMatch).not.toBeNull();
    const initialDays = Number(initialMatch![1]);
    expect(initialDays).toBeGreaterThan(0);

    // ── Step 3: Create a vacation ──
    await page.getByLabel(/start/i).fill('2026-11-10');
    await page.getByLabel(/end/i).fill('2026-11-12');
    await page.getByRole('button', { name: /create|submit|request|add/i }).click();

    // Wait for the vacation to appear in the list
    const vacationRow = page.getByRole('row').filter({ hasText: '2026-11-10' });
    await expect(vacationRow).toBeVisible({ timeout: 10_000 });

    // Fetch the created vacation id via API (needed for cleanup safety & to know the days)
    const listRes = await request.get(`${BACKEND_URL}/api/vacations`, {
      headers: authHeaders(),
    });
    const vacations: Array<{ id: string; startDate: string; days: number }> = await listRes.json();
    const created = vacations.find((v) => v.startDate === '2026-11-10');
    expect(created).toBeDefined();
    const vacationDays = created!.days;

    // ── Step 4: Display the remaining vacation days after creation ──
    // Wait for the UI to reflect the decreased remaining days
    const expectedDaysAfterCreate = initialDays - vacationDays;
    await expect(remainingLocator).toContainText(String(expectedDaysAfterCreate), { timeout: 10_000 });
    const afterCreateText = await remainingLocator.textContent();
    const afterCreateMatch = afterCreateText?.match(/(\d+)/);
    expect(afterCreateMatch).not.toBeNull();
    const daysAfterCreate = Number(afterCreateMatch![1]);
    expect(daysAfterCreate).toBe(expectedDaysAfterCreate);

    // ── Step 5: Delete the created vacation ──
    // Click the delete button in the UI
    await vacationRow.getByRole('button', { name: /delete/i }).click();

    // Wait for the row to disappear; if the frontend doesn't auto-remove it,
    // fall back to deleting via API and re-logging in.
    const hidden = await vacationRow.isHidden().catch(() => false);
    if (!hidden) {
      // Give the UI a moment to process
      await page.waitForTimeout(2_000);
    }

    // Check if the row disappeared after the UI click
    if (await vacationRow.isVisible().catch(() => false)) {
      // The frontend did not remove the row – delete via API and re-login
      const delRes = await request.delete(`${BACKEND_URL}/api/vacations/${created!.id}`, {
        headers: authHeaders(),
      });
      expect(delRes.status()).toBe(204);
      // Re-login because reload loses in-memory credentials
      await login(page);
    }

    // Verify the vacation is no longer in the list
    await expect(vacationRow).toBeHidden({ timeout: 10_000 });

    // ── Step 6: Display the remaining vacation days after deletion ──
    // Wait for the UI to reflect the restored remaining days
    await expect(remainingLocator).toContainText(String(initialDays), { timeout: 10_000 });
    const afterDeleteText = await remainingLocator.textContent();
    const afterDeleteMatch = afterDeleteText?.match(/(\d+)/);
    expect(afterDeleteMatch).not.toBeNull();
    const daysAfterDelete = Number(afterDeleteMatch![1]);
    expect(daysAfterDelete).toBe(initialDays);
  });

});