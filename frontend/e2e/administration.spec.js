/** Exercise real demo login, overview editing/deletion and separate admin-route boundaries. */
import { test, expect, localUser, localSession, localPost } from './fixtures.js';

const posts = Array.from({ length: 6 }, (_, index) => ({
  ...localPost,
  id: `00000000-0000-4000-8000-00000000000${index}`,
  title: `Publication ${index}`,
  createdAt: `2026-01-0${index + 1}T09:00:00.000Z`,
  updatedAt: `2026-01-0${index + 1}T09:00:00.000Z`,
}));

test('demo login → dashboard → edit another author’s post → cancel and confirm dashboard deletion', async ({ page, browserErrors }) => {
  await page.addInitScript(({ users, posts }) => {
    localStorage.setItem('writespace_users', JSON.stringify(users));
    localStorage.setItem('writespace_posts', JSON.stringify(posts));
  }, { users: [localUser], posts });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  const stats = page.getByRole('region', { name: 'Publication statistics' });
  for (const [label, value] of [['Total Posts', '6'], ['Total Users', '2'], ['Total Admins', '1'], ['Total users', '?']]) {
    await expect(stats.locator('dl').filter({ has: page.getByText(label, { exact: true }) }).locator('dd')).toHaveText(value);
  }
  await expect(page.getByText(/Source ambiguity:/)).toBeVisible();
  const recent = page.getByRole('region', { name: 'Recent posts' });
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText([
    'Publication 5', 'Publication 4', 'Publication 3', 'Publication 2', 'Publication 1',
  ]);
  const before = await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'),
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(before.posts).toEqual(posts);
  expect(before.session.role).toBe('admin');
  await recent.getByRole('link', { name: 'Edit', exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/edit/${posts[5].id}$`));
  await expect(page.getByLabel('Title')).toHaveValue(posts[5].title);
  await page.getByLabel('Title').fill('Admin edited publication');
  await page.getByLabel('Content').fill('Edited by the demo admin; original authorship remains.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Admin edited publication' })).toBeVisible();
  const edited = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(edited.slice(0, 5)).toEqual(posts.slice(0, 5));
  expect(edited[5]).toEqual({
    ...posts[5], title: 'Admin edited publication',
    content: 'Edited by the demo admin; original authorship remains.', updatedAt: expect.any(String),
  });
  expect(new Date(edited[5].updatedAt).toISOString()).toBe(edited[5].updatedAt);
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const target = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Admin edited publication' }) });
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete this post?');
    await dialog.dismiss();
  });
  await target.getByRole('button', { name: 'Delete', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(edited);
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await target.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Post deleted.');
  await expect(page.getByRole('heading', { name: 'Admin edited publication' })).toHaveCount(0);
  expect(await page.evaluate(() => ({
    users: localStorage.getItem('writespace_users'),
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }))).toEqual({ ...before, posts: posts.slice(0, 5) });
  expect(browserErrors).toEqual([]);
});

test('guest deep entry to /admin redirects to login without exposing overview or changing data', async ({ page, browserErrors }) => {
  await page.addInitScript(({ user, post }) => {
    localStorage.setItem('writespace_users', JSON.stringify([user]));
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
  }, { user: localUser, post: localPost });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([localPost]);
  expect(browserErrors).toEqual([]);
});

test('ordinary account deep entry to /admin redirects to blogs without overview controls', async ({ page, browserErrors }) => {
  await page.addInitScript(({ user, post, session }) => {
    localStorage.setItem('writespace_users', JSON.stringify([user]));
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
    localStorage.setItem('writespace_session', JSON.stringify(session));
  }, { user: localUser, post: localPost, session: localSession });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: localPost.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Manage Users', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([localPost]);
  expect(browserErrors).toEqual([]);
});
