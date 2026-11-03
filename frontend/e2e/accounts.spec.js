/** Exercise real account creation/login and mobile protected deletes without mocks. */
import { test, expect } from './fixtures.js';

test('administrator creates an account, logs out, and the new account logs in', async ({ page, browserErrors }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
  await page.getByLabel('Display name').fill('Demo Writer');
  await page.getByLabel('Username', { exact: true }).fill('Writer');
  await page.getByLabel('Password', { exact: true }).fill('demo-new');
  await page.getByLabel('Role', { exact: true }).selectOption('user');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Account created locally.');
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(accounts).toHaveLength(1);
  expect(accounts[0]).toMatchObject({ username: 'Writer', displayName: 'Demo Writer', role: 'user', password: 'demo-new' });
  expect(accounts[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Date(accounts[0].createdAt).toISOString()).toBe(accounts[0].createdAt);
  await page.getByRole('button', { name: 'Account for Admin' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(accounts);
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill(' writer ');
  await page.getByLabel('Password', { exact: true }).fill('demo-new');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
    userId: accounts[0].id, username: 'Writer', displayName: 'Demo Writer', role: 'user',
  });
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test('mobile cards protect bootstrap/self and cancel or persist eligible deletion', async ({ page, browserErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Account admin' }).getByRole('button')).toBeDisabled();
  await expect(page.getByRole('table')).not.toBeVisible();
  for (const [username, role] of [['Owner', 'Admin'], ['Writer', 'user']]) {
    await page.getByLabel('Display name').fill(`Demo ${username}`);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill('demo-new');
    await page.getByLabel('Role', { exact: true }).selectOption(role);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Account created locally.');
  }
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  await page.getByRole('button', { name: 'Account for Admin' }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Login', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('Owner');
  await page.getByLabel('Password', { exact: true }).fill('demo-new');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Account Owner' }).getByRole('button')).toBeDisabled();
  await expect(page.getByRole('article', { name: 'Account admin' }).getByRole('button')).toBeDisabled();
  const writerDelete = page.getByRole('article', { name: 'Account Writer' }).getByRole('button');
  page.once('dialog', (dialog) => dialog.dismiss());
  await writerDelete.click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(original);
  await expect(page.getByRole('article', { name: 'Account Writer' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await writerDelete.click();
  await expect(page.getByRole('status')).toHaveText('Account deleted locally.');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([original[0]]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe('Admin');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Account Writer' })).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
