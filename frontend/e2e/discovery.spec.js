/** Exercise real discovery links and capture preflight evidence for later execution. */
import { test, expect, localPost, localSession } from './fixtures.js';
import { mkdir, writeFile } from 'node:fs/promises';

const notice = 'Local-only demo: data and authentication are client-side. Credentials are stored in plain text. '
  + 'There is no backend, database, or network service. Do not use real or sensitive credentials.';

/** Attach rendered HTML, accessibility, typography and screenshot evidence.
 * Args:
 *   page: Live discovery browser page.
 *   info: Playwright result attachment destination.
 *   name: Representative viewport and state label.
 * Returns:
 *   A completed set of review attachments, without changing application state.
 */
async function capturePreflight(page, info, name) {
  await info.attach(`${name}-html`, { body: await page.content(), contentType: 'text/html' });
  await info.attach(`${name}-accessibility`, {
    body: JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2),
    contentType: 'application/json',
  });
  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.querySelector('main'));
    const heading = getComputedStyle(document.querySelector('h1'));
    const header = getComputedStyle(document.querySelector('header'));
    const preview = document.querySelector('[aria-label="Featured post preview"]');
    return {
      bodyFont: body.fontFamily, bodyColor: body.color, background: body.backgroundColor,
      headingFont: heading.fontFamily, headingSize: heading.fontSize, headerPosition: header.position,
      previewAnimation: preview ? getComputedStyle(preview).animationName : null,
    };
  });
  await info.attach(`${name}-styles`, { body: JSON.stringify(styles, null, 2), contentType: 'application/json' });
  await mkdir('review-evidence', { recursive: true });
  await writeFile(`review-evidence/${name}.html`, await page.content());
  await writeFile(`review-evidence/${name}-accessibility.json`,
    JSON.stringify(await page.accessibility.snapshot({ interestingOnly: false }), null, 2));
  await writeFile(`review-evidence/${name}-styles.json`, JSON.stringify(styles, null, 2));
  await page.screenshot({ path: `review-evidence/${name}.png`, fullPage: true });
  await info.attach(`${name}-screenshot`, { path: `review-evidence/${name}.png`, contentType: 'image/png' });
}

test('guest entry actions navigate only after clicks from the empty landing', async ({ page, browserErrors }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByText(notice)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Features' }).getByRole('article')).toHaveCount(3);
  await expect(page).toHaveURL(/\/$/);
  await capturePreflight(page, info, 'desktop-empty');
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await page.getByRole('link', { name: 'Back to WriteSpace', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('newest-three local preview click redirects guest to login without mutation', async ({ page, browserErrors }, info) => {
  const posts = [
    { ...localPost, title: 'Oldest local post' },
    { ...localPost, id: '11111111-1111-4111-8111-111111111111', title: 'Second local post',
      createdAt: '2026-01-12T12:00:00.000Z' },
    { ...localPost, id: '22222222-2222-4222-8222-222222222222', title: 'Newest local post',
      content: 'x'.repeat(120) + 'not in preview', createdAt: '2026-01-14T12:00:00.000Z' },
    { ...localPost, id: '33333333-3333-4333-8333-333333333333', title: 'Third local post',
      createdAt: '2026-01-11T12:00:00.000Z' },
  ];
  await page.addInitScript((rows) => localStorage.setItem('writespace_posts', JSON.stringify(rows)), posts);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'Newest local post', 'Second local post', 'Third local post',
  ]);
  await expect(latest.getByRole('article')).toHaveCount(3);
  await expect(latest.getByText('x'.repeat(120), { exact: true })).toBeVisible();
  await expect(page.getByText(/not in preview/)).toHaveCount(0);
  await capturePreflight(page, info, 'desktop-populated');
  await latest.getByRole('link', { name: /Newest local post/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify(posts));
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(browserErrors).toEqual([]);
});

test('featured local preview click redirects guest to login without mutation', async ({ page, browserErrors }) => {
  await page.addInitScript((post) => {
    if (sessionStorage.getItem('featured-fixture-seeded')) return;
    sessionStorage.setItem('featured-fixture-seeded', 'true');
    localStorage.setItem('writespace_posts', JSON.stringify([post]));
  }, localPost);
  await page.goto('/');
  const featured = page.getByRole('complementary', { name: 'Featured post preview' });
  await expect(featured.getByRole('heading', { name: localPost.title, exact: true })).toBeVisible();
  await featured.getByRole('link', { name: /A Quiet Morning/ }).focus();
  await featured.getByRole('link', { name: /A Quiet Morning/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(JSON.stringify([localPost]));
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(browserErrors).toEqual([]);
});

for (const role of ['user', 'admin', 'Admin']) {
  test(`authenticated ${role} activates both dashboard links`, async ({ page, browserErrors }, info) => {
    const identity = { ...localSession, role };
    const destination = role === 'user' ? /\/blogs$/ : /\/admin$/;
    await page.addInitScript((value) => localStorage.setItem('writespace_session', JSON.stringify(value)), identity);
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Public navigation' });
    await expect(nav.getByText(identity.displayName)).toBeVisible();
    await expect(nav.getByRole('img', { name: role === 'user' ? 'User avatar' : 'Admin avatar' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await capturePreflight(page, info, `desktop-${role}`);
    await nav.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
    await expect(page).toHaveURL(destination);
    await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(destination);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).role)).toBe(role);
    expect(browserErrors).toEqual([]);
  });
}

test('mobile hamburger supports keyboard toggle and activated guest navigation', async ({ page, browserErrors }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((post) => localStorage.setItem('writespace_posts', JSON.stringify([post])), localPost);
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  const nav = page.getByRole('navigation', { name: 'Public navigation' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).not.toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Featured post preview' })).toHaveCSS('animation-name', 'none');
  await capturePreflight(page, info, 'mobile-closed-reduced-motion');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(nav).toBeVisible();
  await capturePreflight(page, info, 'mobile-open');
  await toggle.click();
  await expect(nav).not.toBeVisible();
  await toggle.click();
  await nav.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  expect(browserErrors).toEqual([]);
});

test('invalid local posts show warning and preserve bytes through footer entry', async ({ page, browserErrors }, info) => {
  await page.addInitScript(() => localStorage.setItem('writespace_posts', '{broken'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Existing data is unchanged');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await capturePreflight(page, info, 'desktop-invalid-posts');
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'All Blogs' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{broken');
  expect(browserErrors).toEqual([]);
});
