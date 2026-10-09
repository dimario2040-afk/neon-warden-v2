// portal_audit.mjs — проверка ВСЕХ порталов (двери E/W/N/S + лифты) в живом движке:
// подход → триггер зоны → прибытие в целевую комнату (и lock-стороны: заблокировано/открыто).
// Запуск: cd game/tests && npm i playwright-core && npx playwright install chromium && node portal_audit.mjs
import { chromium } from 'playwright-core';
import { ROOMS, ROOM_BY_ID } from '../src/rooms.js';
const floorTop = (r, at) => { let f = 0; for (const [x,y,w,h] of r.solids) { if (h < 1.5 || y + h > 12.5) continue; if (Math.min(Math.abs(x-at), Math.abs(x+w-at)) < 5) f = Math.max(f, y+h); } return f; };
const supTop = (r, lx, cap) => { let t = -1e9; for (const [x,y,w,h] of r.solids) { const top = y+h; if (top > cap + 0.01) continue; if (lx >= x-0.3 && lx <= x+w+0.3) t = Math.max(t, top); } return t === -1e9 ? 0 : t; };
const topUnder = (r, at) => { let t = 0; for (const [x,y,w,h] of r.solids) { if (h > 0.7) continue; if (at >= x - 1 && at <= x + w + 1) t = Math.max(t, y + h); } return t; };

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
await page.evaluate(() => { for (const a of ['servo','wall','hack2','phase']) window.__DBG.give(a); window.__DBG.save().cores.push('core_prom','core_stoki','core_pusto'); });

let fail = 0;
const tryDoor = async (rid, d) => {
  const r = ROOM_BY_ID[rid];
  const setup = { rid, side: d.s, at: d.at, F: floorTop(r, d.at), T: topUnder(r, d.at), SUP: supTop(r, d.s === 'E' ? r.w - 4 : 4, d.at + 1.5), SUPS: supTop(r, d.at - 2.5, floorTop(r, d.at) + 0.6) };
  await page.evaluate(async (setup) => {
    const G = window.__GAME__; const p = G.player;
    window.__DBG.tp(setup.rid); window.__DBG.killboss();
    await new Promise(r => setTimeout(r, 300));
    p.inv = 30; p.vx = 0; p.vy = 0;
    const info = G.roomInfo(setup.rid);
    if (setup.side === 'E') { p.x = info.ox + info.w - 4; p.y = info.oy + setup.SUP + 0.05; }
    if (setup.side === 'W') { p.x = info.ox + 4; p.y = info.oy + setup.SUP + 0.05; }
    if (setup.side === 'S') { p.x = info.ox + setup.at - 2.5; p.y = info.oy + setup.SUPS + 0.05; }
    if (setup.side === 'N') { p.x = info.ox + setup.at; p.y = info.oy + setup.T + 0.05; }
  }, setup);
  await page.waitForTimeout(250);
  const seq = [];
  const key = d.s === 'W' ? 'KeyA' : 'KeyD';
  if (d.s === 'N') { await page.keyboard.press('Space'); }
  else await page.keyboard.down(key);
  let arrivedAt = -1;
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(180);
    const rr = await page.evaluate(() => window.__GAME__.room);
    seq.push(rr);
    await page.evaluate(() => { window.__GAME__.player.inv = 30; });
    if (rr === d.to && arrivedAt < 0) arrivedAt = i;
    if (arrivedAt >= 0 && i >= arrivedAt + 2) break;           // прибыли — отпускаем ввод
    if (d.s !== 'N' && d.s !== 'S' && i % 3 === 1) await page.keyboard.press('Space');
    if (d.s !== 'N' && d.s !== 'S' && i % 4 === 2) await page.keyboard.press('KeyK');
    if (d.s === 'N' && i === 3) await page.keyboard.press('Space');
  }
  if (d.s !== 'N') await page.keyboard.up(key);
  await page.waitForTimeout(700);
  seq.push(await page.evaluate(() => window.__GAME__.room));
  const hp = await page.evaluate(() => window.__GAME__.player.hp);
  const arrived = seq.includes(d.to);
  const stable = seq.slice(-2).every(x => x === d.to);
  const okk = arrived && stable && hp > 0;
  if (!okk) { fail++; console.log(` FAIL ${rid}.${d.s}→${d.to} seq=${[...new Set(seq)].join('>')} hp=${hp}`); }
  else console.log(`  OK  ${rid}.${d.s}→${d.to}`);
};
for (const r of ROOMS) for (const d of r.doors) {
  // lock-двери проверяем отдельно с двух сторон; здесь пропускаем lock-сторону
  if (d.lock) continue;
  await tryDoor(r.id, d);
}
// манёвр с верхней полки под люком: (a) прыжок вверх через люк, (b) сход вниз с полки без застревания
for (const r of ROOMS) {
  const dn = r.doors.find(d => d.s === 'N');
  if (!dn) continue;
  const T = topUnder(r, dn.at);
  // (a) вверх
  const up = await page.evaluate(async (setup) => {
    const G = window.__GAME__; const p = G.player;
    window.__DBG.tp(setup.rid); window.__DBG.killboss();
    await new Promise(r => setTimeout(r, 300));
    p.inv = 30; p.vx = 0; p.vy = 0;
    const info = G.roomInfo(setup.rid);
    p.x = info.ox + setup.at; p.y = info.oy + setup.T + 0.05;
    return G.room;
  }, { rid: r.id, at: dn.at, T });
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  const upRoom = await page.evaluate(() => window.__GAME__.room);
  const okUp = upRoom === dn.to;
  // (b) сход с полки вниз
  await page.evaluate(async (setup) => {
    const G = window.__GAME__; const p = G.player;
    window.__DBG.tp(setup.rid); window.__DBG.killboss();
    await new Promise(r => setTimeout(r, 300));
    p.inv = 30; p.vx = 0; p.vy = 0;
    const info = G.roomInfo(setup.rid);
    p.x = info.ox + setup.at; p.y = info.oy + setup.T + 0.05;
  }, { rid: r.id, at: dn.at, T });
  await page.waitForTimeout(250);
  await page.keyboard.down('KeyA'); await page.waitForTimeout(900); await page.keyboard.up('KeyA');
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => ({ r: window.__GAME__.room, y: window.__GAME__.player.y, oy: window.__GAME__.roomInfo(window.__GAME__.room).oy, T: 0 }));
  const descended = st.r === r.id && (st.y - st.oy) < T - 0.8;
  const okk = okUp && descended;
  if (!okk) { fail++; console.log(` FAIL shelf ${r.id}: up=${upRoom} (want ${dn.to}), descended=${descended} (y local ${(st.y - st.oy).toFixed(1)} vs T ${T})`); }
  else console.log(`  OK  shelf ${r.id}: up+jump & step-down free`);
}
// lock-стороны: с замочной стороны проход закрыт, с обратной — открыт
for (const r of ROOMS) for (const d of r.doors) {
  if (!d.lock) continue;
  await page.evaluate(async (rid) => {
    const G = window.__GAME__; const p = G.player;
    window.__DBG.clearLocks();
    window.__DBG.tp(rid); window.__DBG.killboss();
    await new Promise(r => setTimeout(r, 300));
    p.inv = 30; p.vx = 0; p.vy = 0;
  }, r.id);
  const dd = d;
  await page.evaluate(async (setup) => {
    const G = window.__GAME__; const p = G.player; const info = G.roomInfo(setup.rid);
    const r2 = setup;
    if (setup.side === 'E') { p.x = info.ox + info.w - 4; p.y = info.oy + setup.SUP + 0.05; }
    if (setup.side === 'W') { p.x = info.ox + 4; p.y = info.oy + setup.SUP + 0.05; }
    if (setup.side === 'S') { p.x = info.ox + setup.at - 2.5; p.y = info.oy + setup.SUPS + 0.05; }
    if (setup.side === 'N') { p.x = info.ox + setup.at; p.y = info.oy + setup.T + 0.05; }
  }, { rid: r.id, side: d.s, at: d.at, F: floorTop(r, d.at), T: topUnder(r, d.at), SUP: supTop(r, d.s === 'E' ? r.w - 4 : 4, d.at + 1.5), SUPS: supTop(r, d.at - 2.5, floorTop(r, d.at) + 0.6) });
  await page.waitForTimeout(200);
  if (d.s === 'N') await page.keyboard.press('Space');
  else await page.keyboard.down(d.s === 'E' ? 'KeyD' : d.s === 'W' ? 'KeyA' : 'KeyD');
  await page.waitForTimeout(1500);
  if (d.s !== 'N') await page.keyboard.up(d.s === 'E' ? 'KeyD' : d.s === 'W' ? 'KeyA' : 'KeyD');
  const blocked = (await page.evaluate(() => window.__GAME__.room)) === r.id;
  console.log((blocked ? '  OK  ' : ' FAIL ') + `lock ${r.id}.${d.s} closed from lock side`);
  if (!blocked) fail++;
}
// лифт m2 (после смерти СМОТРИТЕЛЯ)
const lift = await page.evaluate(async () => {
  const G = window.__GAME__; const p = G.player;
  window.__DBG.tp('m2'); window.__DBG.killboss();
  await new Promise(r => setTimeout(r, 400));
  const info = G.roomInfo('m2');
  p.x = info.ox + 35.5; p.y = info.oy + 0.2; p.vx = 0; p.vy = 0; p.inv = 30;
  await new Promise(r => setTimeout(r, 300));
  window.__DBG.interact ? window.__DBG.interact() : null;
  for (const k of ['KeyE']) { window.dispatchEvent(new KeyboardEvent('keydown', { code: k })); window.dispatchEvent(new KeyboardEvent('keyup', { code: k })); }
  await new Promise(r => setTimeout(r, 900));
  return G.room;
});
console.log((lift === 'm3' ? '  OK  ' : ' FAIL ') + `lift m2→m3 (got ${lift})`);
if (lift !== 'm3') fail++;
console.log('errors:', errors.length ? errors.slice(0, 4).join(' | ') : 'none');
console.log(fail === 0 ? 'PORTAL AUDIT: PASS' : `PORTAL AUDIT: ${fail} FAILURES`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
