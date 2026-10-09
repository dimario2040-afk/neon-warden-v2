import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
await page.evaluate(() => { for (const a of ['servo','wall','hack2','phase']) window.__DBG.give(a); window.__DBG.tp('m1'); });
await page.waitForTimeout(500);
await page.evaluate(() => { const G = window.__GAME__; const info = G.roomInfo('m1'); const p = G.player; p.x = info.ox + 20; p.y = info.F + 1.2; p.vx = 0; p.vy = -6; });
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(100);
  console.log(i, await page.evaluate(() => { const p = window.__GAME__.player; return JSON.stringify({ r: window.__GAME__.room, y: +p.y.toFixed(2), vy: +p.vy.toFixed(1) }); }));
}
await browser.close();
