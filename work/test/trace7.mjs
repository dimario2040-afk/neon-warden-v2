import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
await page.keyboard.down('KeyD');
for (let i=0;i<16;i++){
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  console.log(i, await page.evaluate(() => { const p=window.__GAME__.player; return JSON.stringify({ r: window.__GAME__.room, x:+p.x.toFixed(1), y:+p.y.toFixed(1), vx:+p.vx.toFixed(1), g:p.ground }); }));
}
await page.keyboard.up('KeyD');
await browser.close();
