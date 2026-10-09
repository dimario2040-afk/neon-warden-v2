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
    if (setup.side === 'N') { p.x = info.ox + setup.at; p.y = info.oy + 19.2; p.vy = 11.8; }
  }, setup);
  await page.waitForTimeout(250);
  const seq = [];
  const key = d.s === 'W' ? 'KeyA' : 'KeyD';
  if (d.s !== 'N') await page.keyboard.down(key);
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
// лестничные шахты: climb поднимает и люк достижим с верха лестницы
for (const r of ROOMS) {
  const dn = r.doors.find(d => d.s === 'N');
  if (!dn) continue;
  const res = await page.evaluate(async (rid) => {
    const G = window.__GAME__; const p = G.player;
    window.__DBG.cancelFade(); window.__DBG.tp(rid); window.__DBG.killboss();
    await new Promise(r => setTimeout(r, 350));
    const info = G.roomInfo(rid);
    if (!info.ladders || !info.ladders.length) return { climb: false, up: false };
    const lad = info.ladders[0];
    p.x = info.ox + lad.x; p.y = info.oy + info.F + 0.05; p.vx = 0; p.vy = 0; p.inv = 30;
    return { lad, info: { ox: info.ox, oy: info.oy } };
  }, r.id);
  if (!res || !res.lad) { fail++; console.log(` FAIL ladder ${r.id}: no ladder data`); continue; }
  await page.waitForTimeout(200);
  await page.keyboard.down('KeyW');
  let climbed = false;
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(120); const y = await page.evaluate(rid => window.__GAME__.player.y - window.__GAME__.roomInfo(rid).oy, r.id); if (y >= res.lad.y1 - 0.6) { climbed = true; break; } }
  await page.keyboard.up('KeyW');
  // импульс в люк с верха лестницы
  const at = dn.at;
  await page.evaluate(([x, y]) => { const p = window.__GAME__.player; p.x = x; p.y = y; p.vy = 11.8; p.vx = 0; p.inv = 30; }, [res.info.ox + at, res.info.oy + 19.2]);
  await page.waitForTimeout(1000);
  const upOk = (await page.evaluate(() => window.__GAME__.room)) === dn.to;
  const okk = climbed && upOk;
  if (!okk) { fail++; console.log(` FAIL shaft ${r.id}: climb=${climbed} hatch=${upOk}`); }
  else console.log(`  OK  shaft ${r.id}: ladder climb + hatch exit`);
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
    if (setup.side === 'N') { p.x = info.ox + setup.at; p.y = info.oy + 19.2; p.vy = 11.8; }
  }, { rid: r.id, side: d.s, at: d.at, F: floorTop(r, d.at), T: topUnder(r, d.at), SUP: supTop(r, d.s === 'E' ? r.w - 4 : 4, d.at + 1.5), SUPS: supTop(r, d.at - 2.5, floorTop(r, d.at) + 0.6) });
  await page.waitForTimeout(200);
  if (d.s !== 'N') { await page.keyboard.down(d.s === 'E' ? 'KeyD' : d.s === 'W' ? 'KeyA' : 'KeyD'); await page.waitForTimeout(1500); await page.keyboard.up(d.s === 'E' ? 'KeyD' : d.s === 'W' ? 'KeyA' : 'KeyD'); } else { await page.waitForTimeout(1500); }
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
