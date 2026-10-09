import { chromium } from 'playwright-core';
import { ROOMS, ROOM_BY_ID } from '../src/rooms.js';
const floorTop = (r, at) => { let f = 0; for (const [x,y,w,h] of r.solids) { if (h < 1.5 || y + h > 12.5) continue; if (Math.min(Math.abs(x-at), Math.abs(x+w-at)) < 5) f = Math.max(f, y+h); } return f; };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1200);
// все способности, чтобы гейты не мешали проверке геометрии
await page.evaluate(() => { for (const a of ['servo','wall','hack2','phase']) window.__DBG.give(a); });

console.log('globals:', await page.evaluate(() => JSON.stringify({ game: typeof window.__GAME__, dbg: typeof window.__DBG, room: window.__GAME__?.room })));
const pairs = [];
for (const r of ROOMS) for (const d of r.doors) if (d.s === 'S' && !d.lock) pairs.push([r.id, d.to, d.at]); // верх -> низ (lock-двери пропускаем: замок — корректное поведение)
let fail = 0;
for (const [up, down, at] of pairs) {
  const FLOCAL = floorTop(ROOM_BY_ID[up], at);
  const res = await page.evaluate(async ([up, down, at, FLOCAL]) => {
    const G = window.__GAME__;
    window.__DBG.tp(up); window.__DBG.killboss();
    await new Promise(r => setTimeout(r, 350));
    G.player.inv = 30; // геометрия-тест: без урона/нокбэков от врагов
    const info = G.roomInfo(up);
    const p = G.player;
    p.x = info.ox + at; p.y = info.oy + FLOCAL + 1.2; p.vx = 0; p.vy = -6; // над дыркой S, падаем
    const seq = [];
    for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 250)); seq.push(G.room); }
    return { seq, hp: p.hp, max: p.maxHp, y: +p.y.toFixed(1) };
  }, [up, down, at, FLOCAL]);
  const arrived = res.seq.includes(down);
  const bounced = res.seq.indexOf(down) !== -1 && res.seq.slice(res.seq.indexOf(down) + 2).includes(up);
  const stable = res.seq.slice(-3).every(r => r === down);
  const alive = res.hp > 0;
  const okk = arrived && stable && alive && !bounced;
  if (!okk) fail++;
  console.log((okk ? '  OK  ' : ' FAIL ') + `down ${up}→${down} seq=${[...new Set(res.seq)].join('>')} hp=${res.hp}/${res.max} y=${res.y}`);
}
// подъёмы через N-люк: прыжок из-под люка
for (const [up, down, at] of pairs) {
  const FLOCAL = floorTop(ROOM_BY_ID[up], at);
  const res = await page.evaluate(async ([up, down, at, FLOCAL]) => {
    const G = window.__GAME__;
    window.__DBG.tp(down); window.__DBG.killboss();
    await new Promise(r => setTimeout(r, 350));
    G.player.inv = 30;
    const info = G.roomInfo(down);
    const p = G.player;
    p.x = info.ox + at; p.y = info.oy + 20.2; p.vx = 0; p.vy = 6; // прыжок сквозь потолочный люк
    const seq = [];
    for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 250)); seq.push(G.room); }
    return { seq, hp: p.hp, max: p.maxHp, y: +p.y.toFixed(1) };
  }, [up, down, at]);
  const arrived = res.seq.includes(up);
  const bounced = res.seq.indexOf(up) !== -1 && res.seq.slice(res.seq.indexOf(up) + 2).includes(down);
  const stable = res.seq.slice(-3).every(r => r === up);
  const alive = res.hp > 0;
  const okk = arrived && stable && alive && !bounced;
  if (!okk) fail++;
  console.log((okk ? '  OK  ' : ' FAIL ') + `up   ${down}→${up} seq=${[...new Set(res.seq)].join('>')} hp=${res.hp}/${res.max} y=${res.y}`);
}
console.log('errors:', errors.length ? errors.slice(0,4).join(' | ') : 'none');
console.log(fail === 0 ? 'TRANSITIONS: PASS' : `TRANSITIONS: ${fail} FAILURES`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
