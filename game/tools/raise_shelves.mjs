// raise_shelves.mjs: полки над проходными дорожками поднимаем до lane+2.7 (низ 2.1 > головы 1.9),
// предметы/враги на них snapping'ом следуют.
import { readFileSync, writeFileSync } from 'fs';
import { ROOMS } from '../src/rooms.js';
let src = readFileSync('src/rooms.js', 'utf-8');
const moves = [];
for (const r of ROOMS) {
  const thick = r.solids.filter(s => s[3] >= 1.5).map(s => [s[0], s[0] + s[2], s[1] + s[3]]);
  for (const s of r.solids) {
    if (s[3] > 0.7) continue;
    const top = s[1] + s[3];
    let lane = -1e9;
    for (const [a, b, t] of thick) {
      const ov = Math.min(s[0] + s[2], b) - Math.max(s[0], a);
      if (ov > 0.5 && t <= s[1] + 0.01) lane = Math.max(lane, t);
    }
    if (lane < -1e8) continue;
    if (s[1] - lane < 2.05) {
      const newTop = +(lane + 2.7).toFixed(2);
      const dy = +(newTop - top).toFixed(2);
      if (dy <= 0) continue;
      const old = `[${s[0]},${s[1]},${s[2]},${s[3]}]`;
      const neu = `[${s[0]},${+(s[1] + dy).toFixed(2)},${s[2]},${s[3]}]`;
      if (!src.includes(old)) { console.log('miss', r.id, old); continue; }
      src = src.replace(old, neu);
      s[1] = +(s[1] + dy).toFixed(2);
      moves.push([r.id, dy, s[0], s[1] + s[3]]);
      // snap стоящих на полке
      const onIt = (o) => o && Math.abs(o.y - (top)) < 0.05 && o.x >= s[0] - .5 && o.x <= s[0] + s[2] + .5;
      for (const it of r.items || []) if (onIt(it)) { it.y = +(it.y + dy).toFixed(2); const a = `y:${it.y - dy}`, b = `y:${it.y}`; src = src.replace(`id:"${it.id}",kind:"${it.kind}",x:${it.x},y:${it.y - dy}`, `id:"${it.id}",kind:"${it.kind}",x:${it.x},y:${it.y}`); }
      for (const en of r.enemies || []) if (onIt(en)) { const a = `{t:"${en.t}",x:${en.x},y:${en.y - dy}}`, b = `{t:"${en.t}",x:${en.x},y:${en.y}}`; if (src.includes(a)) src = src.replace(a, b); en.y = +(en.y + dy).toFixed(2); }
    }
  }
}
writeFileSync('src/rooms.js', src);
console.log('raised:', moves.length);
for (const m of moves.slice(0, 40)) console.log('  ', m.join(' '));
