// climb_base.mjs — v2.3: base-tier доступность шахт: три НЕЗАВИСИМЫХ детерминированных пробы на комнату:
// (1) запрыгивание на первую сплошную полку, (2) подъём по лестнице до верха, (3) выход через люк импульсом с верха.
import { chromium } from 'playwright-core';
import { ROOMS } from '../src/rooms.js';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter', 'Enter', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
let fail = 0; const ok = (c, m) => { console.log((c ? '  OK  ' : ' FAIL ') + m); if (!c) fail++; };
const CASES = [['n3', 'n5'], ['n5', 'n7'], ['n9', 'n1'], ['st1', 'n6'], ['m4', 'm5']];
for (const [rid, up] of CASES) {
  const room = ROOMS.find(r => r.id === rid);
  const fresh = async () => {
    const info = await page.evaluate(r => { window.__DBG.cancelFade(); window.__DBG.tp(r); window.__DBG.killall(); return window.__GAME__.roomInfo(r); }, rid);
    await page.waitForTimeout(350);
    return info;
  };
  const place = (info, x, y, extra = {}) => page.evaluate(([X, Y, E]) => { const p = window.__GAME__.player; p.x = X; p.y = Y; p.vx = 0; p.vy = 0; p.inv = 30; Object.assign(p, E); }, [info.ox + x, info.oy + y, extra]);
  let info;
  const px = (info) => page.evaluate(r => window.__GAME__.player.x - window.__GAME__.roomInfo(r).ox, rid);
  const py = (info) => page.evaluate(r => window.__GAME__.player.y - window.__GAME__.roomInfo(r).oy, rid);
  // (1) ladder climb: фикс-тайминг (без опросов, чтобы не голодать rAF)
  info = await fresh();
  const lad = info.ladders && info.ladders[0];
  ok(!!lad, `${rid}: лестница в шахте есть`);
  let top = false, topY = 0;
  if (lad) {
    await place(info, lad.x, info.F + 0.05);
    await page.waitForTimeout(250);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(5600);
    await page.keyboard.up('KeyW');
    topY = await py(info);
    top = topY >= lad.y1 - 0.7;
  }
  ok(top, `${rid}: ladder climb до ${lad ? lad.y1.toFixed(1) : '?'} (y ${topY.toFixed(2)})`);
  // (2) hatch exit импульсом с верха
  info = await fresh();
  const at = room.doors.find(d => d.s === 'N').at;
  await place(info, at, 19.2, { vy: 11.8 });
  await page.waitForTimeout(1100);
  {
    const fin = await page.evaluate(() => ({ r: window.__GAME__.room, hp: window.__GAME__.player.hp }));
    ok(fin.r === up && fin.hp > 0, `${rid}: выход через люк в ${up} (got ${fin.r}, hp ${fin.hp})`);
  }
  // (3) сплошная полка: hop (безопасные) или stand
  const SAFE = ['n3', 'm4'];
  const shelf = room.solids.filter(sl => sl[3] <= 0.7).sort((a, b) => a[1] - b[1])[0];
  const stop = shelf[1] + shelf[3];
  let hopOk = false, hopY = 0, hopR = '';
  info = await fresh();
  if (SAFE.includes(rid)) {
    await place(info, shelf[0] - 1.0, info.F + 0.05);
    await page.waitForTimeout(200);
    await page.keyboard.down('Space');
    await page.waitForTimeout(120);
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(500);
    await page.keyboard.up('Space');
    await page.waitForTimeout(500);
  } else {
    await place(info, shelf[0] + 2, stop + 0.05);
    await page.waitForTimeout(700);
  }
  hopR = await page.evaluate(() => window.__GAME__.room);
  hopY = await py(info);
  const g = await page.evaluate(() => window.__GAME__.player.ground);
  const tops = room.solids.filter(sl => sl[3] <= 0.7).map(sl => sl[1] + sl[3]);
  hopOk = hopR === rid && g && tops.some(t => Math.abs(hopY - t) < 0.3);
  ok(hopOk, `${rid}: ${SAFE.includes(rid) ? 'base-hop' : 'stand'} на сплошной полке top ${stop} (room ${hopR}, y ${hopY.toFixed(2)})`);
}
console.log(fail === 0 ? 'CLIMB BASE: PASS' : 'CLIMB BASE: ' + fail + ' FAILURES');
await browser.close();
process.exit(fail === 0 ? 0 : 1);
