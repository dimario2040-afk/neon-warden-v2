import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('PAGEERR', String(e).split('\n')[0]));
await page.goto(new URL('../dist/neon-warden_V2.html', import.meta.url).href);
await page.waitForTimeout(4200);
for (const k of ['Enter','Enter','Enter']) { await page.keyboard.press(k); await page.waitForTimeout(700); }
await page.waitForTimeout(800);
await page.evaluate(() => window.__DBG.tp('p6'));
await page.waitForTimeout(2500);
console.log(await page.evaluate(() => {
  const ov = [...document.querySelectorAll('div,pre')].map(d => d.textContent || '').filter(t => t.includes('LOOP ERROR')).join(' | ').slice(0, 600);
  const e = window.__GAME__.enemies.find(x => x.t === 'press_777');
  return JSON.stringify({ overlay: ov || 'none', bstate: e?.bstate, bt: e?.bt, headY: e?.headY, phase: e?.phase });
}));
await browser.close();
