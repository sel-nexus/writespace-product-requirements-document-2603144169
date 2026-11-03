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
    await expect(page.getByRole('button', { name: 'Account for Synthetic Writer', exact: true })).toBeVisible();
    const accounts = await page.evaluate(() => localStorage.getItem('writespace_users'));
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')));
    expect(session).toEqual({
      userId: JSON.parse(accounts)[0].id, displayName: 'Synthetic Writer', username: 'Demo.Writer', role: 'user',
    });
    await page.getByRole('button', { name: 'Account for Synthetic Writer' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBe(accounts);
    await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username').fill('demo.writer');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
    await page.getByLabel('Password').fill('demo-only');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
    await page.reload();
    await expect(page).toHaveURL(/\/blogs$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
    await expect(page.getByRole('button', { name: 'Account for Synthetic Writer', exact: true })).toBeVisible();
    if (width < 640) {
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Write', exact: true })).not.toBeVisible();
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
    }
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Write', exact: true }).click();
    await expect(page).toHaveURL(/\/write$/);
    await page.getByRole('button', { name: 'Account for Synthetic Writer' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByLabel('Username').fill('admin');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('button', { name: 'Account for Admin', exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
      userId: 'admin', username: 'admin', displayName: 'Admin', role: 'admin',
    });
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
