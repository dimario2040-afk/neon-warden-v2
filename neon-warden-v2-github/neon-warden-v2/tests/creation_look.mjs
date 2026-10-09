import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
await page.waitForTimeout(1200);                                      // splash->title (авто)
await page.keyboard.press('Enter'); await page.waitForTimeout(900);   // title->creation
let fail = 0; const ok = (c, m) => { console.log((c ? '  OK  ' : ' FAIL ') + m); if (!c) fail++; };
// режим PATH по умолчанию: цифры меняют путь
await page.keyboard.press('Digit2'); await page.waitForTimeout(200);
const path1 = await page.evaluate(() => document.querySelector('.crPath.sel')?.textContent || '');
ok(path1.includes('2'), 'path mode: Digit2 selects path 2 (' + path1.slice(0, 24) + ')');
// Tab -> режим NAME: цифры печатаются в имя
await page.keyboard.press('Tab'); await page.waitForTimeout(200);
await page.keyboard.type('V123'); await page.waitForTimeout(200);
const nameVal = await page.evaluate(() => document.getElementById('crName').value);
ok(nameVal === 'V123', 'name mode: digits type into name, got "' + nameVal + '"');
const path2 = await page.evaluate(() => document.querySelector('.crPath.sel')?.textContent || '');
ok(path2.includes('2'), 'path unchanged while typing name');
// Tab -> path, W/S цикл
await page.keyboard.press('Tab'); await page.waitForTimeout(150);
await page.keyboard.press('KeyS'); await page.waitForTimeout(400);
const path3 = await page.evaluate(() => document.querySelector('#crPaths .crPath.sel')?.textContent || 'NONE');
ok(path3.includes('СТАЛКЕР'), 'path mode: KeyS cycles to path 3 (' + path3.slice(0, 24) + ')');
await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
const sv = await page.evaluate(() => ({ name: window.__GAME__.save.heroName, lp: window.__GAME__.save.lifepath, hc: window.__GAME__.save.hackCost }));
ok(sv.name === 'V123' && sv.lp === 'stalker', 'save: name V123 + lifepath stalker (' + JSON.stringify(sv) + ')');
// look quality: P -> quality, скрин
await page.waitForTimeout(1500);
await page.keyboard.press('KeyP'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'look_quality.png' });
ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors[0] : ''));
console.log(fail === 0 ? 'CREATION+LOOK: PASS' : 'CREATION+LOOK: ' + fail + ' FAILURES');
await browser.close();
process.exit(fail === 0 ? 0 : 1);
