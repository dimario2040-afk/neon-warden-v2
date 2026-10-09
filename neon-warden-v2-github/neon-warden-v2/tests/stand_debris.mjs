import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
// pu5: стоим на полке 9.3 под сдвинутой верхней полкой
await page.evaluate(() => { window.__DBG.tp('pu5'); const G = window.__GAME__; const i = G.roomInfo('pu5'); G.player.x = i.ox + 29; G.player.y = i.oy + 9.3 + 0.05; G.player.vx = 0; G.player.vy = 0; });
await page.waitForTimeout(1200);
const st = await page.evaluate(() => ({ y: +window.__GAME__.player.y.toFixed(2), oy: window.__GAME__.roomInfo('pu5').oy, g: window.__GAME__.player.ground, r: window.__GAME__.room }));
console.log('pu5 stand:', JSON.stringify(st), '=> local', (st.y - st.oy).toFixed(2));
await page.screenshot({ path: 'stand_pu5.png' });
// debris: убиваем врагов в n3 и ловим кадры распада
await page.evaluate(() => window.__DBG.tp('n3')); await page.waitForTimeout(700);
await page.evaluate(() => window.__DBG.killall());
await page.waitForTimeout(300);
await page.screenshot({ path: 'debris.png' });
await page.waitForTimeout(1500);
const leak = await page.evaluate(() => window.__GAME__.sceneChildren);
console.log('scene children after debris decay:', leak);
await browser.close();
