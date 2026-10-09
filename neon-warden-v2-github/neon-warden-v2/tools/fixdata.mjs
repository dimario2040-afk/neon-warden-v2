// fixdata.mjs — нормализация semantics: у тонких платформ (h<=0.7) y = ВЕРХ (как задумано автором цепочек);
// сундуки/наземные враги, стоящие на них, сдвигаются на -0.6; стоящие на толстых полах — не трогаются.
import { readFileSync, writeFileSync } from 'fs';
import { ROOMS } from '../src/rooms.js';
let src = readFileSync('src/rooms.js', 'utf-8');
// 1) thin solids: y -= 0.6  (pattern: ,0.6] or ,0.6} inside solids arrays) — делаем точной заменой по данным
for (const r of ROOMS) {
  for (const s of r.solids) {
    if (s[3] <= 0.7) {
      const old = `[${s[0]},${s[1]},${s[2]},${s[3]}]`;
      const neu = `[${s[0]},${+(s[1] - 0.6).toFixed(2)},${s[2]},${s[3]}]`;
      if (src.includes(old)) src = src.replace(old, neu);
      else console.log('miss solid', r.id, old);
      s[1] = +(s[1] - 0.6).toFixed(2);
    }
  }
  const thinTops = r.solids.filter(s => s[3] <= 0.7).map(s => [s[0], s[0] + s[2], s[1] + s[3]]);
  const oneTops = (r.oneway || []).map(o => [o[0], o[0] + o[2], o[1]]);
  const shift = (obj) => {
    const onThin = thinTops.some(([a, b, t]) => obj.x >= a - .5 && obj.x <= b + .5 && Math.abs(t - (obj.y - 0.6)) < 0.05);
    const onOne = oneTops.some(([a, b, t]) => obj.x >= a - .5 && obj.x <= b + .5 && Math.abs(t - (obj.y - 0.6)) < 0.05);
    if (onThin || onOne) obj.y = +(obj.y - 0.6).toFixed(2);
  };
  for (const it of r.items || []) shift(it);
  for (const en of r.enemies || []) { const def = ['sine_drone','orbit_drone','jammer','scan_turret'].includes(en.t) ? 'fly' : 'walk'; if (def === 'walk') shift(en); else { /* fly: anchor оставим */ } }
}
writeFileSync('src/rooms.js', src);
console.log('rooms.js normalized');
