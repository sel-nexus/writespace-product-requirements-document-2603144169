/** Capture representative presentation evidence without repeating journey tests. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ headless: true });
const evidence = [];
await mkdir('../theme-screenshots', { recursive: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(baseURL);
    await page.getByRole('heading', { name: 'Latest from the Blog' }).waitFor();
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.getByRole('button', { name: 'Switch to Dark appearance' }).click();
      if (width === 390 && mode === 'dark') await page.getByRole('button', { name: 'Toggle navigation' }).click();
      const tree = await page.accessibility.snapshot();
      const styles = await page.locator('[data-theme]').evaluate((root) => {
        const style = getComputedStyle(root);
        return { mode: root.dataset.theme, font: style.fontFamily, background: style.backgroundColor,
          foreground: style.color, width: root.clientWidth, scrollWidth: root.scrollWidth,
          header: getComputedStyle(root.querySelector('header')).backgroundColor };
      });
      evidence.push(`VIEW ${width} ${mode}\nACCESSIBILITY\n${JSON.stringify(tree, null, 2)}\nSTYLES\n${JSON.stringify(styles)}\nHTML\n${await page.content()}`);
      await page.screenshot({ path: `../theme-screenshots/landing-${width}-${mode}.png`, fullPage: true });
    }
    await page.close();
  }
  await writeFile('../theme-preflight.txt', evidence.join('\n\n'), 'utf8');
} finally {
  await browser.close();
}
