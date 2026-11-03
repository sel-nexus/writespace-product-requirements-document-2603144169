/** Exercise live reading journeys with real localStorage; defer execution to the lead. */
import { test, expect, localPost, localSession } from './fixtures.js';

const otherId = '11111111-1111-4111-8111-111111111111';
const fullContent = '  First paragraph\n\n\tIndented writing\n<script>alert(1)</script>\n'
  + 'x'.repeat(140) + '\nFull reader ending';

/** Seed complete synthetic records once without resetting data on reader reload.
 * Args:
 *   page: Isolated live browser page before its initial navigation.
 *   session: Synthetic identity, or null for a guest.
 *   posts: Complete posts or intentionally malformed bytes for error-state entry.
 * Returns:
 *   An installed entry script; no application or storage API is mocked.
 */
async function seedReading(page, session, posts) {
  await page.addInitScript(({ identity, rows }) => {
    if (sessionStorage.getItem('reading-fixture-seeded')) return;
    sessionStorage.setItem('reading-fixture-seeded', 'true');
    if (identity) localStorage.setItem('writespace_session', JSON.stringify(identity));
    localStorage.setItem('writespace_posts', typeof rows === 'string' ? rows : JSON.stringify(rows));
  }, { identity: session, rows: posts });
}

for (const [width, columns] of [[375, 1], [800, 2], [1200, 3]]) {
  test(`list to reader by click at width ${width} renders ${columns} columns and survives reload`, async ({ page, browserErrors }) => {
    await page.setViewportSize({ width, height: 900 });
    const posts = [
      { ...localPost, title: 'Older post' },
      { ...localPost, id: otherId, title: 'Newest first tie', content: fullContent, createdAt: '2026-02-01T00:00:00.000Z' },
      { ...localPost, id: '22222222-2222-4222-8222-222222222222', title: 'Newest second tie',
        createdAt: '2026-02-01T00:00:00.000Z' },
      { ...localPost, id: '33333333-3333-4333-8333-333333333333', title: 'Oldest post',
        createdAt: '2025-01-01T00:00:00.000Z' },
    ];
    await seedReading(page, localSession, posts);
    await page.goto('/blogs');
    const grid = page.getByRole('region', { name: 'Blog posts' });
    await expect(grid.getByRole('heading', { level: 2 })).toHaveText([
      'Newest first tie', 'Newest second tie', 'Older post', 'Oldest post',
    ]);
    await expect(grid.getByRole('article')).toHaveCount(4);
    await expect.poll(() => grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const first = grid.getByRole('article').first();
    await expect(first.locator('a p')).toHaveText(fullContent.slice(0, 120));
    await expect(first.getByText(localPost.authorName, { exact: true })).toBeVisible();
    await expect(first.getByRole('img', { name: 'User avatar' })).toHaveText('📚');
    await expect(first.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
    await expect(page.getByText(/Full reader ending/)).toHaveCount(0);
    await first.getByRole('link', { name: /Newest first tie/ }).click();
    await expect(page).toHaveURL(new RegExp(`/blog/${otherId}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Newest first tie');
    const body = page.locator('article .whitespace-pre-wrap');
    expect(await body.textContent()).toBe(fullContent);
    await expect(body).toHaveCSS('white-space', 'pre-wrap');
    await expect(page.locator('article script, article img')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Newest first tie');
    expect(await page.locator('article .whitespace-pre-wrap').textContent()).toBe(fullContent);
    await page.getByRole('link', { name: 'Back to blogs', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(grid.getByRole('article')).toHaveCount(4);
    expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify(posts));
    expect(browserErrors).toEqual([]);
  });
}

test('owner cancels then confirms deletion from a clicked reader and reload preserves deletion', async ({ page, browserErrors }) => {
  const survivor = { ...localPost, id: otherId, title: 'Surviving post' };
  const posts = [localPost, survivor];
  await seedReading(page, localSession, posts);
  await page.goto('/blogs');
  await page.getByRole('region', { name: 'Blog posts' }).getByRole('link', { name: /A Quiet Morning/ }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${localPost.id}$`));
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${localPost.id}$`));
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify(posts));
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('region', { name: 'Blog posts' }).getByRole('heading')).toHaveText(['Surviving post']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([survivor]);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Blog posts' }).getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: localPost.title, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([survivor]);
  expect(browserErrors).toEqual([]);
});

test('non-owner reads another author without edit or delete controls before and after reload', async ({ page, browserErrors }) => {
  const authored = { ...localPost, authorId: 'admin', authorName: 'Publication Owner', authorRole: 'Admin' };
  await seedReading(page, localSession, [authored]);
  await page.goto('/blogs');
  const grid = page.getByRole('region', { name: 'Blog posts' });
  await expect(grid.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(grid.getByRole('img', { name: 'Admin avatar' })).toHaveText('👑');
  await grid.getByRole('link', { name: /A Quiet Morning/ }).click();
  await expect(page.getByRole('heading', { name: localPost.title })).toBeVisible();
  await expect(page.getByText(authored.authorName, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: localPost.title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify([authored]));
  expect(browserErrors).toEqual([]);
});

for (const role of ['admin', 'Admin']) {
  test(`${role} can read and delete another author's post through activated controls`, async ({ page, browserErrors }) => {
    await seedReading(page, { ...localSession, userId: 'admin', role }, [localPost]);
    await page.goto('/blogs');
    const grid = page.getByRole('region', { name: 'Blog posts' });
    await expect(grid.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
    await grid.getByRole('link', { name: /A Quiet Morning/ }).click();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', `/edit/${localPost.id}`);
    page.once('dialog', async (dialog) => { await dialog.accept(); });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Write', exact: true })).toHaveAttribute('href', '/write');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
    await page.reload();
    await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe(role);
    expect(browserErrors).toEqual([]);
  });
}

for (const path of ['/blogs', `/blog/${localPost.id}`]) {
  test(`guest deep entry ${path} redirects to login without revealing reader data`, async ({ page, browserErrors }) => {
    await seedReading(page, null, [localPost]);
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: localPost.title })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify([localPost]));
    expect(browserErrors).toEqual([]);
  });
}

test('missing reader entry shows exact not-found state and back click opens actual list', async ({ page, browserErrors }) => {
  await seedReading(page, localSession, [localPost]);
  await page.goto(`/blog/${otherId}`);
  await expect(page.getByRole('heading', { name: 'Post not found', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: localPost.title })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify([localPost]));
  expect(browserErrors).toEqual([]);
});

test('corrupt reading storage shows safe empty state and keeps bad bytes on reload', async ({ page, browserErrors }) => {
  await seedReading(page, localSession, '{broken');
  await page.goto('/blogs');
  await expect(page.getByRole('alert')).toContainText('Existing data is unchanged; changes are disabled.');
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{broken');
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Existing data is unchanged; changes are disabled.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{broken');
  expect(browserErrors).toEqual([]);
});

test('ordinary empty list has exact copy and an activated Write CTA without changing posts', async ({ page, browserErrors }) => {
  await seedReading(page, localSession, []);
  await page.goto('/blogs');
  await expect(page.getByText('No blogs yet. Be the first to write one!', { exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('[]');
  expect(browserErrors).toEqual([]);
});
