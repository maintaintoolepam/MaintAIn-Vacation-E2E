/**
 * Auth helpers for Basic Auth used across all tests.
 *
 * Default test credentials – override via environment variables
 * TEST_USER and TEST_PASSWORD if needed.
 */

export const TEST_USER = process.env.TEST_USER ?? 'user';
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'user123';

export const ADMIN_USER = 'admin';
export const ADMIN_PASSWORD = 'admin123';

export const BACKEND_URL = 'http://localhost:8181';

/**
 * Returns a Base64-encoded Basic Auth header value.
 */
export function basicAuthHeader(
  username: string = TEST_USER,
  password: string = TEST_PASSWORD,
): string {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Convenience: returns the headers object ready to spread into fetch / request calls.
 */
export function authHeaders(
  username?: string,
  password?: string,
): Record<string, string> {
  return {
    Authorization: basicAuthHeader(username, password),
  };
}

/**
 * Deletes ALL existing vacations for the test user.
 * Call this in beforeEach to guarantee a clean state.
 */
export async function deleteAllVacations(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.get(`${BACKEND_URL}/api/vacations`, {
    headers: authHeaders(),
  });
  if (!res.ok()) return;
  const vacations: Array<{ id: string }> = await res.json();
  for (const v of vacations) {
    await request.delete(`${BACKEND_URL}/api/vacations/${v.id}`, {
      headers: authHeaders(),
    });
  }
}
