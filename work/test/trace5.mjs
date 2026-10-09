import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
await page.keyboard.down('KeyD');
for (let i=0;i<8;i++){
  await page.waitForTimeout(150);
  console.log(await page.evaluate(() => { const p = window.__GAME__.player; return JSON.stringify({ x:+p.x.toFixed(2), vx:+p.vx.toFixed(2), g:p.ground, foc:p.focusing, climb:p.climbing, dash:p.dash, jam:p.jamT, inv:+p.inv.toFixed(2), keys: window.__KEYS.KeyD }); }));
}
await page.keyboard.up('KeyD');
await browser.close();
