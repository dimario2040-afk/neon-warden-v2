// boss_press.mjs — поведение ПРЕСС-777: цикл состояний, телеграфы, явный урон, punish-окно.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1000);
let fail = 0; const ok = (c, m) => { console.log((c ? '  OK  ' : ' FAIL ') + m); if (!c) fail++; };

await page.evaluate(() => window.__DBG.tp('p6'));
await page.waitForTimeout(600);
const has = () => page.evaluate(() => !!window.__GAME__.enemies.find(e => e.t === 'press_777' && !e.dead));
ok(await has(), 'boss press_777 spawned in p6');

// 1) цикл состояний за 14s: intro→track→aim→slam→…→overheat
const states = await page.evaluate(async () => {
  const seen = []; let over = 0, slams = 0, markerSeen = 0, ventOpen = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 14000) {
    await new Promise(r => setTimeout(r, 100));
    const e = window.__GAME__.enemies.find(x => x.t === 'press_777');
    if (!e || e.dead) break;
    if (!seen.length || seen[seen.length - 1] !== e.bstate) seen.push(e.bstate);
    if (e.bstate === 'slam') slams = Math.max(slams, e.volley || 0);
    if (e.bstate === 'overheat') over++;
    if (e.marker && e.marker.visible) markerSeen++;
    const vm = e.g.userData.eye && e.g.userData.eye.material; if (vm && vm.emissiveIntensity > 5) ventOpen++;
    window.__GAME__.player.inv = 5; // наблюдатель без урона
  }
  return { seen, over, slams, markerSeen, ventOpen };
});
console.log('  states:', states.seen.join('→'), '| overheat samples:', states.over, '| slams:', states.slams, '| marker:', states.markerSeen, '| ventOpen:', states.ventOpen);
ok(states.seen.includes('intro') && states.seen.includes('aim') && states.seen.includes('slam'), 'cycle: intro→…→aim→slam present');
ok(states.over > 5, 'overheat (punish-window) reached after volley');
ok(states.markerSeen > 5, 'marker-column telegraph visible during aim/slam');
ok(states.ventOpen > 3, 'vent opens (white-hot) during overheat');

// 2) урона нет ТОЛЬКО когда нет волн и не идёт слам (track/aim/overheat/rise без орбов)
const phantom = await page.evaluate(async () => {
  const G = window.__GAME__; const p = G.player;
  const e = G.enemies.find(x => x.t === 'press_777');
  const info = G.roomInfo('p6');
  let exposed = 0, hurt = 0; const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    await new Promise(r => setTimeout(r, 90));
    const safe = ['intro','track','aim','overheat','rise'].includes(e.bstate) && G.orbs.length === 0;
    if (safe) { p.inv = 0; p.hp = p.maxHp; p.x = info.ox + 3; p.y = info.oy + 0.05; p.vx = 0; p.vy = 0; exposed++;
      await new Promise(r => setTimeout(r, 60));
      if (p.hp < p.maxHp) hurt++;
    } else p.inv = 5;
  }
  return { exposed, hurt };
});
ok(phantom.exposed >= 3 && phantom.hurt === 0, 'no damage outside slam/waves (exposed ' + phantom.exposed + ', hurt ' + phantom.hurt + ')');

// 3) урон колонны: стоим под меткой во время слама → ровно один hit 22
const colHit = await page.evaluate(async () => {
  const G = window.__GAME__; const p = G.player;
  const e = G.enemies.find(x => x.t === 'press_777');
  const hp0 = p.maxHp; p.hp = hp0; p.inv = 0;
  // ждём aim, затем встаем на slamX
  const t0 = Date.now(); let took = 0;
  while (Date.now() - t0 < 9000) {
    await new Promise(r => setTimeout(r, 60));
    if (e.bstate === 'aim' && e.slamX !== undefined) { p.x = e.slamX; p.y = e.roomFloor + 0.05; p.vx = 0; p.vy = 0; p.inv = 0; }
    if (p.hp < hp0) { took = hp0 - p.hp; p.hp = hp0; p.inv = 5; break; }
  }
  return took;
});
ok(colHit === 22, 'slam column deals exactly 22 once (got ' + colHit + ')');

// 4) волны после импакта существуют
const waves = await page.evaluate(async () => {
  const G = window.__GAME__; const e = G.enemies.find(x => x.t === 'press_777');
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) { await new Promise(r => setTimeout(r, 80)); if (e.bstate === 'slam' && e.headY <= e.roomFloor + 0.5) break; }
  await new Promise(r => setTimeout(r, 250));
  return window.__GAME__.orbs.length;
});
ok(waves >= 2, 'shockwave orbs spawned on impact (' + waves + ')');

// 5) overheat = уязвимость: бьём гвоздём в окне
const vuln = await page.evaluate(async () => {
  const G = window.__GAME__; const p = G.player; const e = G.enemies.find(x => x.t === 'press_777');
  const t0 = Date.now();
  while (Date.now() - t0 < 12000 && e.bstate !== 'overheat') await new Promise(r => setTimeout(r, 80));
  if (e.bstate !== 'overheat') return -1;
  const hp0 = e.hp;
  p.x = e.x + 1.2; p.y = e.roomFloor + 0.05; p.inv = 5; p.attackCd = 0; p.attack = 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }));
  await new Promise(r => setTimeout(r, 400));
  return hp0 - e.hp;
});
ok(vuln > 0, 'nail hits during overheat window (dmg ' + vuln + ')');

// скриншоты телеграфов
await page.evaluate(async () => { const e = window.__GAME__.enemies.find(x => x.t === 'press_777'); const t0 = Date.now(); while (Date.now() - t0 < 8000 && e.bstate !== 'aim') await new Promise(r => setTimeout(r, 60)); });
await page.screenshot({ path: 'press_aim.png' });
await page.evaluate(async () => { const e = window.__GAME__.enemies.find(x => x.t === 'press_777'); const t0 = Date.now(); while (Date.now() - t0 < 12000 && e.bstate !== 'overheat') await new Promise(r => setTimeout(r, 60)); });
await page.screenshot({ path: 'press_overheat.png' });
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
console.log(fail === 0 ? 'BOSS PRESS: PASS' : 'BOSS PRESS: ' + fail + ' FAILURES');
await browser.close();
process.exit(fail === 0 ? 0 : 1);
