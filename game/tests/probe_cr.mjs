import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(5200);
await page.keyboard.press('Enter'); await page.waitForTimeout(900);
await page.keyboard.press('Tab'); await page.waitForTimeout(150);
await page.keyboard.press('KeyS'); await page.waitForTimeout(250);
console.log(await page.evaluate(() => ({
  html: document.getElementById('crPaths').innerHTML.slice(0, 300),
  hint: document.getElementById('crHint')?.textContent,
  active: document.activeElement?.id || document.activeElement?.tagName,
})));
await browser.close();
