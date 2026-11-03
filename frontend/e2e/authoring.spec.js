/** Exercise real registration, authoring, reload and confirmed deletion without mocks. */
import { test, expect } from './fixtures.js';

test('register → create → reader → edit → reload → cancel/confirm delete', async ({ page, browserErrors }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Synthetic Author');
  await page.getByLabel('Username', { exact: true }).fill('author.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const identity = await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Publish post' }).click();
  await expect(page.getByText('Required', { exact: true })).toHaveCount(2);
  await expect(page.getByLabel('Title')).toBeFocused();
  const content = '  Synthetic first paragraph.\n\nSecond paragraph <b>plain text</b>.  ';
  await page.getByLabel('Title').fill('Synthetic publication');
  await page.getByLabel('Content').fill(content);
  await expect(page.getByText(`${content.length} characters`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Publish post' }).click();
  await expect(page).toHaveURL(/\/blog\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Synthetic publication' })).toBeVisible();
  expect(await page.locator('article .whitespace-pre-wrap').textContent()).toBe(content);
  const created = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(created).toHaveLength(1);
  expect(created[0]).toEqual({
    id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
    title: 'Synthetic publication', content,
    authorId: identity.session.userId, authorName: identity.session.displayName, authorRole: identity.session.role,
    createdAt: expect.any(String), updatedAt: created[0].createdAt,
  });
  expect(new Date(created[0].createdAt).toISOString()).toBe(created[0].createdAt);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue(created[0].title);
  await expect(page.getByLabel('Content')).toHaveValue(content);
  await page.getByLabel('Title').fill('Canceled draft');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: created[0].title })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(created);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  const editedContent = 'Edited synthetic text.\n\nExact reload content.';
  await page.getByLabel('Title').fill('Edited publication');
  await page.getByLabel('Content').fill(editedContent);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Edited publication' })).toBeVisible();
  const edited = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(edited).toEqual([{ ...created[0], title: 'Edited publication', content: editedContent, updatedAt: expect.any(String) }]);
  expect(new Date(edited[0].updatedAt).toISOString()).toBe(edited[0].updatedAt);
  expect(Date.parse(edited[0].updatedAt)).toBeGreaterThan(Date.parse(created[0].updatedAt));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Edited publication' })).toBeVisible();
  expect(await page.locator('article .whitespace-pre-wrap').textContent()).toBe(editedContent);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(edited);
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete this post?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edited publication' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(edited);
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => ({
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    users: localStorage.getItem('writespace_users'),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }))).toEqual({ posts: [], ...identity });
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title').fill('Discarded creation');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
  expect(browserErrors).toEqual([]);
});
