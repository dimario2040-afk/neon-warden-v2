import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1200);
await page.keyboard.down('KeyD');
for (let i = 0; i < 16; i++) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => ({ r: window.__GAME__.room, x: +window.__GAME__.player.x.toFixed(1), y: +window.__GAME__.player.y.toFixed(1), g: window.__GAME__.player.ground, vx: +window.__GAME__.player.vx.toFixed(1) }));
  console.log(i, JSON.stringify(s));
}
await page.keyboard.up('KeyD');
await browser.close();
