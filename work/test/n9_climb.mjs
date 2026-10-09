// n9_climb.mjs — base-tier (без способностей) выбраться из Секрет-подвала вверх через люк.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => { window.__DBG.tp('n9'); window.__DBG.killall(); });
await page.waitForTimeout(500);
const OX = await page.evaluate(() => window.__GAME__.roomInfo('n9').ox);
const OY = await page.evaluate(() => window.__GAME__.roomInfo('n9').oy);
const steps = [ // [launchX, dir, targetX] — окна разбега посчитаны из физики (ноги выше верха полки к моменту входа в её X)
  [16.5, 'D', 23], [21.5, 'A', 16], [17.5, 'D', 22], [21.5, 'A', 16],
  [17.5, 'D', 22], [21.5, 'D', 26.7], [25.5, 'D', 30.7], [30, 'D', 30],
];
const px = () => page.evaluate(() => window.__GAME__.player.x - window.__GAME__.roomInfo('n9').ox);
const py = () => page.evaluate(() => window.__GAME__.player.y - window.__GAME__.roomInfo('n9').oy);
const targets = [6.1, 8.7, 10.9, 13.1, 15.3, 17.5, 19.2];
for (let si = 0; si < steps.length; si++) {
  const [lx, dir, tx] = steps[si];
  for (let attempt = 0; attempt < 3; attempt++) {
    for (let i = 0; i < 40; i++) {
      const x = await px();
      if (Math.abs(x - lx) < 0.3) break;
      const k = x < lx ? 'KeyD' : 'KeyA';
      await page.keyboard.down(k); await page.waitForTimeout(80); await page.keyboard.up(k);
    }
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    await page.waitForTimeout(80);
    const k = dir === 'D' ? 'KeyD' : 'KeyA';
    await page.keyboard.press('KeyK'); // dash — базовый глагол: добор горизонтали в прыжке
    await page.keyboard.down(k);
    for (let i = 0; i < 12; i++) { if (Math.abs((await px()) - tx) < 0.45) break; await page.waitForTimeout(60); }
    await page.keyboard.up(k);
    await page.waitForTimeout(650);
    if ((await page.evaluate(() => window.__GAME__.room)) !== 'n9') break;
    const y = await py();
    console.log('   step', si, 'attempt', attempt, 'y', y.toFixed(2), 'x', (await px()).toFixed(2));
    if (si < targets.length && Math.abs(y - targets[si]) < 0.4) break;
  }
  if ((await page.evaluate(() => window.__GAME__.room)) !== 'n9') break;
}
// финальный прыжок в люк (если ещё в n9)
for (let i = 0; i < 3 && (await page.evaluate(() => window.__GAME__.room)) === 'n9'; i++) {
  for (let j = 0; j < 30; j++) { const x = await px(); if (Math.abs(x - 30) < 0.4) break; const k = x < 30 ? 'KeyD' : 'KeyA'; await page.keyboard.down(k); await page.waitForTimeout(90); await page.keyboard.up(k); }
  await page.keyboard.down('Space'); await page.waitForTimeout(450); await page.keyboard.up('Space'); await page.waitForTimeout(700);
}
const fin = await page.evaluate(() => ({ r: window.__GAME__.room, hp: window.__GAME__.player.hp }));
console.log((fin.r === 'n1' && fin.hp > 0 ? '  OK  ' : ' FAIL ') + `base-tier climb out of n9 -> ${fin.r} hp ${fin.hp}`);
await page.screenshot({ path: 'n9_climb.png' });
await browser.close();
process.exit(fin.r === 'n1' ? 0 : 1);
