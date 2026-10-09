import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
console.log('upd before:', await page.evaluate(() => JSON.stringify(window.__UPD)));
await page.keyboard.down('KeyD'); await page.waitForTimeout(500);
console.log('upd during:', await page.evaluate(() => JSON.stringify(window.__UPD)));
await page.keyboard.up('KeyD');
await browser.close();
