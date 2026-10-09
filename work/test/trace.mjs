import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1500);
await page.keyboard.down('KeyD');
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({ r: window.__GAME__.room, x: +window.__GAME__.player.x.toFixed(1), y: +window.__GAME__.player.y.toFixed(1), g: window.__GAME__.player.ground }));
  console.log(i, JSON.stringify(s));
}
await page.keyboard.up('KeyD');
// bench probe
await page.evaluate(() => window.__DBG.tp('n4')); await page.waitForTimeout(500);
await page.keyboard.down('KeyD'); await page.waitForTimeout(1300); await page.keyboard.up('KeyD');
const px = await page.evaluate(() => +window.__GAME__.player.x.toFixed(1));
await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
const bench = await page.evaluate(() => window.__GAME__.save.bench);
console.log('n4 x=', px, 'bench=', JSON.stringify(bench));
// boss probe
await page.evaluate(() => window.__DBG.tp('n7')); await page.waitForTimeout(800);
const bs = await page.evaluate(() => window.__GAME__.enemies.map(e => ({ t: e.t, b: e.isBoss, d: e.dead })));
console.log('n7 enemies:', JSON.stringify(bs));
await page.evaluate(() => window.__DBG.killboss()); await page.waitForTimeout(400);
console.log('bosses:', await page.evaluate(() => window.__GAME__.save.bosses));
await browser.close();
