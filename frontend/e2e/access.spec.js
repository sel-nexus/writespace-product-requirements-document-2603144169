/** Real registration/logout/login and demo-admin click journeys, without mocks. */
import { test, expect } from './fixtures.js';

for (const width of [1280, 390]) {
  test(`ordinary and demo access journey at ${width}px`, async ({ page, browserErrors }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/write');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('link', { name: 'Create account', exact: true }).click();
    await page.getByLabel('Display name').fill('Synthetic Writer');
    await page.getByLabel('Username', { exact: true }).fill('Demo.Writer');
    await page.getByLabel('Password', { exact: true }).fill('demo-only');
    await page.getByLabel('Confirm password').fill('demo-only');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('status')).toHaveText('Signed in locally as Synthetic Writer.');
    const accounts = await page.evaluate(() => localStorage.getItem('writespace_users'));
    await page.getByRole('button', { name: 'Account for Synthetic Writer' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(accounts);
    await page.getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username').fill('demo.writer');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
    await page.getByLabel('Password').fill('demo-only');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Signed in locally as Synthetic Writer.');
    if (width < 640) {
      await expect(page.getByRole('link', { name: 'Write', exact: true })).not.toBeVisible();
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
    }
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Write', exact: true }).click();
    await expect(page).toHaveURL(/\/write$/);
    await page.getByRole('button', { name: 'Account for Synthetic Writer' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('status')).toHaveText('Signed in locally as Admin.');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe('admin');
    if (width < 640) await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page).toHaveURL(/\/users$/);
    await page.getByRole('button', { name: 'Account for Admin' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(accounts);
    expect(browserErrors).toEqual([]);
  });
}
