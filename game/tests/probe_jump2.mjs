import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => { window.__DBG.tp('n3'); window.__DBG.killall(); const G=window.__GAME__; const i=G.roomInfo('n3'); G.player.x=i.ox+5; G.player.y=i.oy+0.05; G.player.vx=0; G.player.vy=0; });
await page.waitForTimeout(250);
await page.keyboard.down('Space');
await page.waitForTimeout(70);
await page.keyboard.down('KeyD');
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(60);
  console.log(i, await page.evaluate(() => { const p = window.__GAME__.player; const o = window.__GAME__.roomInfo('n3'); return JSON.stringify({ x: +(p.x - o.ox).toFixed(2), y: +(p.y - o.oy).toFixed(2), vy: +p.vy.toFixed(1), g: p.ground }); }));
}
await page.keyboard.up('KeyD'); await page.keyboard.up('Space');
await browser.close();
