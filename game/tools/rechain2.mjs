// rechain2.mjs — v2.2: сплошные полки + спирали head-clearance. Полная замена блока solids каждой N-комнаты
// и пересадка предметов/врагов, стоявших на удалённых полках.
import { readFileSync, writeFileSync } from 'fs';
import { ROOMS } from '../src/rooms.js';
let src = readFileSync('src/rooms.js', 'utf-8');
const fmt = (v) => { const r = Math.round(v * 100) / 100; return Number.isInteger(r) ? String(r) : String(r); };
const log = [];
for (const r of ROOMS) {
  const dn = (r.doors || []).find(d => d.s === 'N');
  if (!dn) continue;
  let F = 0;
  for (const [x, y, w, h] of r.solids) if (h >= 1.5 && y + h <= 12.5) F = Math.max(F, y + h);
  const floors = r.solids.filter(s => s[3] >= 1.5);
  const keep = r.solids.filter(s => s[3] <= 0.7 && s[1] + s[3] <= F + 2.0);   // lane-полки остаются
  const dropped = r.solids.filter(s => s[3] <= 0.7 && s[1] + s[3] > F + 2.0);  // старая цепь уходит
  const topT = 19.2, first = F + 2.7;
  const n = Math.max(3, Math.round((topT - first) / 2.1) + 1);
  const tops = []; for (let i = 0; i < n; i++) tops.push(Math.round((first + (topT - first) * i / (n - 1)) * 10) / 10);
  const at = dn.at;
  let C = [at - 18, at - 10, at - 2];
  if (C[0] < 0.5) C = [at - 2, at + 6, at + 14];
  if (C[2] + 4 > r.w - 0.5) C = [at - 18, at - 10, at - 2];
  const ctopIdx = C.indexOf(at - 2);
  const start = ((ctopIdx - (n - 1)) % 3 + 3) % 3;   // order[(n-1)] === колонка люка
  const order = [C[start % 3], C[(start + 1) % 3], C[(start + 2) % 3]];
  const spiral = tops.map((t, i) => [order[i % 3], Math.round((t - 0.6) * 10) / 10, 4, 0.6]);
  const newSolids = [...floors, ...keep, ...spiral];
  // пересадка
  const remapXY = (x, y) => {
    const sup = dropped.find(s => x >= s[0] - .5 && x <= s[0] + s[2] + .5 && Math.abs(y - (s[1] + s[3])) < 0.06);
    if (!sup) return null;
    let best = null, bd = 1e9;
    for (const sh of spiral) { const d = Math.abs(sh[0] + 2 - x) + Math.abs(sh[1] + sh[3] - y) * .3; if (d < bd) { bd = d; best = sh; } }
    return [Math.min(best[0] + 3.4, Math.max(best[0] + 0.6, x)), best[1] + best[3]];
  };
  // заменяем solids-строку в сегменте комнаты
  const i0 = src.indexOf(`id:"${r.id}"`);
  const i1 = src.indexOf('R({', i0 + 10);
  let seg = src.slice(i0, i1 === -1 ? undefined : i1);
  seg = seg.replace(/solids:\[.*?\]\],/s, 'solids:' + JSON.stringify(newSolids) + ',');
  // items / enemies: правим координаты стоявших на удалённых полках
  seg = seg.replace(/x:([\d.]+),y:([\d.]+)/g, (mm, xs, ys) => {
    const p = remapXY(+xs, +ys);
    return p ? `x:${fmt(p[0])},y:${fmt(p[1])}` : mm;
  });
  src = src.slice(0, i0) + seg + (i1 === -1 ? '' : src.slice(i1));
  log.push(`${r.id}: F=${F} dropped=${dropped.length} spiral=${spiral.length} cols=${order.map(c => c.toFixed(0)).join('/')} tops=${tops[0]}..${tops[n - 1]}`);
}
writeFileSync('src/rooms.js', src);
console.log(log.join('\n'));
