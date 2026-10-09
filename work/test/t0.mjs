import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,200)); });
await page.goto(new URL('../../game/dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(1200);
console.log(await page.evaluate(() => JSON.stringify({ game: typeof window.__GAME__, dbg: typeof window.__DBG__, keys: typeof window.__KEYS, room: window.__GAME__?.room })));
await browser.close();
