/** Exercise real registration persistence and reload without future access journeys. */
import { test, expect } from './fixtures.js';

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`register, persist and reload at ${viewport.width}px`, async ({ page, browserErrors }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.getByRole('link', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByText('Required', { exact: true })).toHaveCount(4);
    await page.getByLabel('Display name', { exact: true }).fill('Synthetic Writer');
    await page.getByLabel('Username', { exact: true }).fill('Demo.Writer');
    await page.getByLabel('Password', { exact: true }).fill('demo-only');
    await page.getByLabel('Confirm password', { exact: true }).fill('demo-only');
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('status')).toHaveText('Signed in locally as Synthetic Writer.');
    const persisted = await page.evaluate(() => ({
      users: JSON.parse(localStorage.getItem('writespace_users')),
      session: JSON.parse(localStorage.getItem('writespace_session')),
    }));
    expect(persisted.users).toHaveLength(1);
    expect(persisted.users[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      displayName: 'Synthetic Writer', username: 'Demo.Writer', password: 'demo-only',
      role: 'user', createdAt: expect.any(String),
    });
    expect(new Date(persisted.users[0].createdAt).toISOString()).toBe(persisted.users[0].createdAt);
    expect(persisted.session).toEqual({
      userId: persisted.users[0].id, displayName: 'Synthetic Writer', username: 'Demo.Writer', role: 'user',
    });
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Signed in locally as Synthetic Writer.');
    expect(await page.evaluate(() => ({
      users: JSON.parse(localStorage.getItem('writespace_users')),
      session: JSON.parse(localStorage.getItem('writespace_session')),
    }))).toEqual(persisted);
    expect(browserErrors).toEqual([]);
  });
}
