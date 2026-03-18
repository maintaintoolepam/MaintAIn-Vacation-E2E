import { test, expect } from '@playwright/test';
import { BACKEND_URL, authHeaders, deleteAllVacations } from '../helpers/auth';

/**
 * API-level E2E tests for the Vacation Management backend.
 * These tests call the REST API directly (no browser needed).
 */

test.describe('API – Authentication', () => {

  test('1 – Access protected endpoint without auth → 401', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/users/me`);
    expect(response.status()).toBe(401);
  });

  test('2 – Successful authenticated request → 200', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/users/me`, {
      headers: authHeaders(),
    });
    expect(response.status()).toBe(200);
  });

});

test.describe('API – User Profile', () => {

  test('3 – Fetch current user returns expected fields', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/users/me`, {
      headers: authHeaders(),
    });
    expect(response.ok()).toBeTruthy();

    const user = await response.json();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('remainingVacationDays');
    expect(typeof user.remainingVacationDays).toBe('number');
  });

});

test.describe('API – Vacations', () => {

  test.beforeEach(async ({ request }) => {
    await deleteAllVacations(request);
  });

  test.afterEach(async ({ request }) => {
    await deleteAllVacations(request);
  });

  test('4 – Create vacation request', async ({ request }) => {
    const payload = {
      startDate: '2026-07-01',
      endDate: '2026-07-05',
    };

    const response = await request.post(`${BACKEND_URL}/api/vacations`, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      data: payload,
    });

    expect(response.ok()).toBeTruthy();

    const vacation = await response.json();

    expect(vacation).toHaveProperty('id');
    expect(vacation.startDate).toBe('2026-07-01');
    expect(vacation.endDate).toBe('2026-07-05');
    expect(typeof vacation.days).toBe('number');
    expect(vacation.days).toBeGreaterThan(0);
    expect(vacation.status).toBe('PENDING');
  });

  test('5 – Verify vacation appears in list', async ({ request }) => {
    // Create a vacation first
    const createRes = await request.post(`${BACKEND_URL}/api/vacations`, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      data: { startDate: '2026-08-10', endDate: '2026-08-14' },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();

    // Fetch list
    const listRes = await request.get(`${BACKEND_URL}/api/vacations`, {
      headers: authHeaders(),
    });
    expect(listRes.ok()).toBeTruthy();

    const vacations: Array<{ id: string }> = await listRes.json();
    const found = vacations.some((v) => v.id === created.id);
    expect(found).toBeTruthy();
  });

  test('6 – Remaining vacation days decrease after creating a vacation', async ({ request }) => {
    // Get remaining days before
    const beforeRes = await request.get(`${BACKEND_URL}/api/users/me`, {
      headers: authHeaders(),
    });
    expect(beforeRes.ok()).toBeTruthy();
    const beforeUser = await beforeRes.json();
    const daysBefore: number = beforeUser.remainingVacationDays;

    // Create a vacation
    const createRes = await request.post(`${BACKEND_URL}/api/vacations`, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      data: { startDate: '2026-09-01', endDate: '2026-09-03' },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    const vacationDays: number = created.days;

    // Get remaining days after
    const afterRes = await request.get(`${BACKEND_URL}/api/users/me`, {
      headers: authHeaders(),
    });
    expect(afterRes.ok()).toBeTruthy();
    const afterUser = await afterRes.json();
    const daysAfter: number = afterUser.remainingVacationDays;

    expect(daysAfter).toBe(daysBefore - vacationDays);
  });

});
