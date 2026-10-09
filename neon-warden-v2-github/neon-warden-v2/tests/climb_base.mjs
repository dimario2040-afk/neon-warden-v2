// climb_base.mjs — base-tier (без способностей) подъёмы по цепям n3 (Площадь Голограмм) и n5 (Вертикаль Дождя):
// каждый hop детерминированно ставит игрока в точку разбега и проверяет посадку на целевую полку, финал — люк наверх.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
const CHAIN = [
  [5,'D',11,0,2.7,0], [13,'D',19,0,5.2,2.7], [22.5,'D',27,0,7.6,5.2], [24.5,'A',17,0,10,7.6],
  [19.5,'D',27,0,12.4,10], [25,'A',16,0,14.8,12.4], [19.5,'D',27,0,17.2,14.8], [25,'A',21,0,19.2,17.2],
];
const ROOMS = { n3: { up: 'n5', hatch: 20, steps: CHAIN }, n5: { up: 'n7', hatch: 20, steps: CHAIN } };
let fail = 0;
for (const rid of Object.keys(ROOMS)) {
  const cfg = ROOMS[rid];
  await page.evaluate(r => { window.__DBG.tp(r); window.__DBG.killall(); }, rid);
  await page.waitForTimeout(500);
  const px = () => page.evaluate(r => window.__GAME__.player.x - window.__GAME__.roomInfo(r).ox, rid);
  let aborted = false;
  for (let si = 0; si < cfg.steps.length; si++) {
    const [lx, dir, tx, dash, topY, fromY] = cfg.steps[si];
    if ((await page.evaluate(() => window.__GAME__.room)) !== rid) { aborted = true; break; }
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const o = await page.evaluate(r => window.__GAME__.roomInfo(r), rid);
      await page.evaluate(([x, y]) => { const p = window.__GAME__.player; p.x = x; p.y = y; p.vx = 0; p.vy = 0; }, [o.ox + lx, o.oy + fromY + 0.05]);
      await page.waitForTimeout(150);
      await page.keyboard.down('Space');
      await page.waitForTimeout(70);
      if (dash) await page.keyboard.press('KeyK');
      const k = dir === 'D' ? 'KeyD' : 'KeyA';
      await page.keyboard.down(k);
      await page.waitForTimeout(450);
      await page.keyboard.up('Space');
      for (let i = 0; i < 10; i++) { if (Math.abs((await px()) - tx) < 0.5) break; await page.waitForTimeout(50); }
      await page.keyboard.up(k);
      await page.waitForTimeout(650);
      const st = await page.evaluate(r => ({ rm: window.__GAME__.room, y: window.__GAME__.player.y - window.__GAME__.roomInfo(r).oy }), rid);
      if (st.rm !== rid) { aborted = true; break; }
      if (Math.abs(st.y - topY) < 0.35) done = true;
      else console.log('     retry', rid, 'step', si, 'y', st.y.toFixed(2), 'want', topY);
    }
    if (aborted) break;
    if (!done) { console.log('  STEP FAIL', rid, 'step', si); fail++; break; }
  }
  if (!aborted) {
    for (let i = 0; i < 3 && (await page.evaluate(() => window.__GAME__.room)) === rid; i++) {
      const o = await page.evaluate(r => window.__GAME__.roomInfo(r), rid);
      await page.evaluate(([x, y]) => { const p = window.__GAME__.player; p.x = x; p.y = y; p.vx = 0; p.vy = 0; }, [o.ox + cfg.hatch, o.oy + 19.2 + 0.05]);
      await page.waitForTimeout(150);
      await page.keyboard.down('Space'); await page.waitForTimeout(450); await page.keyboard.up('Space');
      await page.waitForTimeout(800);
    }
  }
  const fin = await page.evaluate(() => ({ r: window.__GAME__.room, hp: window.__GAME__.player.hp }));
  const climbed = fin.r === cfg.up && fin.hp > 0;
  if (!climbed) fail++;
  console.log((climbed ? '  OK  ' : ' FAIL ') + `base climb ${rid} -> ${fin.r} (hp ${fin.hp})`);
}
console.log(fail === 0 ? 'CLIMB BASE: PASS' : 'CLIMB BASE: ' + fail + ' FAILURES');
await browser.close();
process.exit(fail === 0 ? 0 : 1);
