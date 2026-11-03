/** Exercise two-way appearance journeys with real styles and untouched local data. */
import { test, expect, localUser, localSession, localPost } from './fixtures.js';

/** Read presentation values from actual browser-rendered surfaces and text. */
async function presentation(page) {
  return page.locator('[data-theme]').evaluate((root) => ({
    background: getComputedStyle(root).backgroundColor,
    foreground: getComputedStyle(root).color,
    surface: getComputedStyle(root.querySelector('header')).backgroundColor,
    controlText: getComputedStyle(root.querySelector('button[aria-label^="Switch to"]')).color,
  }));
}

/** Retain raw values for all local keys, including unrelated browser records. */
async function records(page) {
  return page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]),
  ));
}

for (const width of [1280, 390]) {
  for (const role of ['guest', 'user', 'admin']) {
    test(`${role} switches real surfaces and text at ${width}px without data changes`, async ({ page, browserErrors }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(({ localUser, localSession, localPost, role }) => {
        localStorage.setItem('writespace_users', JSON.stringify([localUser]));
        localStorage.setItem('writespace_posts', JSON.stringify([localPost]));
        localStorage.setItem('unrelated', 'preserve');
        if (role !== 'guest') localStorage.setItem('writespace_session', JSON.stringify({ ...localSession, role }));
      }, { localUser, localSession, localPost, role });
      await page.goto(role === 'guest' ? '/' : role === 'user' ? '/blogs' : '/admin');
      const root = page.locator('[data-theme]');
      await expect(root).toHaveAttribute('data-theme', 'light');
      await expect(page.getByRole('main').getByText(localPost.title, { exact: true })).toBeVisible();
      const before = await records(page);
      const light = await presentation(page);
      const toggle = page.getByRole('button', { name: 'Switch to Dark appearance' });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(root).toHaveAttribute('data-theme', 'dark');
      const dark = await presentation(page);
      for (const property of Object.keys(light)) expect(dark[property]).not.toBe(light[property]);
      await page.getByRole('button', { name: 'Switch to Light appearance' }).click();
      await expect(root).toHaveAttribute('data-theme', 'light');
      expect(await presentation(page)).toEqual(light);
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(root).toHaveAttribute('data-theme', 'dark');
      await page.keyboard.press('Space');
      await expect(root).toHaveAttribute('data-theme', 'light');
      await page.keyboard.press('Enter');
      await expect(root).toHaveAttribute('data-theme', 'dark');
      if (width < 640) await page.getByRole('button', { name: 'Toggle navigation' }).click();
      const nav = page.getByRole('navigation', { name: role === 'guest' ? 'Public navigation' : 'Main navigation' });
      await nav.getByRole('link', { name: role === 'guest' ? 'Login' : role === 'user' ? 'Write' : 'Users', exact: true }).click();
      await expect(page).toHaveURL(role === 'guest' ? /\/login$/ : role === 'user' ? /\/write$/ : /\/users$/);
      await expect(root).toHaveAttribute('data-theme', 'dark');
      const reverse = page.getByRole('button', { name: 'Switch to Light appearance' });
      await expect(reverse).toBeVisible();
      await reverse.click();
      await expect(root).toHaveAttribute('data-theme', 'light');
      if (role === 'guest') {
        if (width < 640) await page.getByRole('button', { name: 'Toggle navigation' }).click();
        await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Get Started' }).click();
        await expect(page).toHaveURL(/\/register$/);
        await expect(page.getByRole('button', { name: 'Switch to Dark appearance' })).toBeVisible();
        await expect(root).toHaveAttribute('data-theme', 'light');
      }
      expect(await records(page)).toEqual(before);
      expect(browserErrors).toEqual([]);
    });
  }
}
