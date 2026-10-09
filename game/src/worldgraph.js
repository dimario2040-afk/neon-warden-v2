// worldgraph.js — граф комнат метроидвании + BFS-прогрессия + валидация (чистый модуль, без THREE).
import { ROOMS, ROOM_BY_ID, START_ROOM, ABILITIES, CORES } from "./rooms.js";

export const OPP = { E: "W", W: "E", N: "S", S: "N" };

// Ключ двери: roomA|sideA|roomB (нормализованный)
export function doorKey(a, side, b) { const [x, y] = [a, b].sort(); return `${x}~${y}~${side === "E" || side === "W" ? "EW" : "NS"}`; }

export function doorsOf(room) { return room.doors || []; }

// Все рёбра графа: {a, b, sideA, sideB, gate, lock}
export function buildEdges() {
  const edges = [];
  const problems = [];
  for (const r of ROOMS) {
    for (const d of doorsOf(r)) {
      const other = ROOM_BY_ID[d.to];
      if (!other) { problems.push(`room ${r.id}: door to unknown ${d.to}`); continue; }
      const back = doorsOf(other).find(od => od.to === r.id && od.s === OPP[d.s]);
      if (!back) { problems.push(`door ${r.id}.${d.s}->${d.to} has no reciprocal ${other.id}.${OPP[d.s]}`); continue; }
      // gate должен быть ровно с одной стороны пары
      const gates = [d.gate, back.gate].filter(Boolean);
      if (gates.length > 1 && d.gate !== back.gate) problems.push(`door pair ${r.id}-${d.to}: conflicting gates ${d.gate}/${back.gate}`);
      const key = doorKey(r.id, d.s, d.to);
      if (!edges.find(e => e.key === key)) {
        edges.push({ key, a: r.id, b: d.to, sideA: d.s, sideB: back.s, gate: d.gate || back.gate || null, lockA: !!d.lock, lockB: !!back.lock });
      }
    }
  }
  return { edges, problems };
}

// Проверка флага: abilities-set + cores
export function hasFlag(set, flag) {
  if (!flag) return true;
  if (flag === "cores3") return CORES.every(c => set.cores.includes(c));
  if (flag.startsWith("boss:")) return set.bosses.includes(flag.slice(5));
  if (ABILITIES[flag]) return !!set.abilities[flag];
  return !!set.cores.includes(flag);
}
export function emptySet() { return { abilities: {}, cores: [], bosses: [] }; }
export function setKey(s) { return Object.keys(s.abilities).filter(k => s.abilities[k]).sort().join("") + "|" + s.cores.slice().sort().join("") + "|" + s.bosses.slice().sort().join(""); }

// Награды комнаты (предметы + босс-дропы)
export function roomRewards(room) {
  const out = [];
  for (const it of room.items || []) {
    if (it.t === "ability") out.push({ kind: "ability", id: it.id });
    if (it.t === "core") out.push({ kind: "core", id: it.id });
  }
  if (room.boss) {
    const BOSS_DROPS = {
      rain_hunter: [{ kind: "ability", id: "servo" }],
      overseer: [{ kind: "ability", id: "wall" }],
      press_777: [{ kind: "ability", id: "hack2" }, { kind: "core", id: "core_prom" }],
      brood_mother: [{ kind: "ability", id: "phase" }, { kind: "core", id: "core_stoki" }],
      sirokko: [{ kind: "core", id: "core_pusto" }],
      architect: [{ kind: "boss", id: "architect" }],
      glitch_mother: [{ kind: "boss", id: "glitch_mother" }],
    };
    out.push(...(BOSS_DROPS[room.boss.id] || []));
  }
  return out;
}
export function applyReward(set, rew) {
  if (rew.kind === "ability") set.abilities[rew.id] = true;
  else if (rew.kind === "core" && !set.cores.includes(rew.id)) set.cores.push(rew.id);
  else if (rew.kind === "boss" && !set.bosses.includes(rew.id)) set.bosses.push(rew.id);
}

// BFS по графу с прогрессией: возвращает {reach: Map(roomId -> setKey на момент первого входа), problems}
// lock-двери проходимы (lock открывается изнутри после прохода с обратной стороны — для BFS считаем
// lock-сторону закрытой ДО посещения комнаты за ней: моделируем как gate "visited:<room>").
export function bfsProgression() {
  const { edges, problems } = buildEdges();
  const reach = new Map();
  const set = emptySet();
  const visited = new Set([START_ROOM]);
  const order = [START_ROOM];
  reach.set(START_ROOM, setKey(set));
  let changed = true, guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    // 1) собрать награды посещённых комнат (фикс-точка: награды открывают новые награды/двери)
    for (const rid of [...visited]) {
      const room = ROOM_BY_ID[rid];
      let c2 = true;
      while (c2) {
        c2 = false;
        for (const rew of roomRewards(room)) {
          const k = setKey(set); applyReward(set, rew);
          if (setKey(set) !== k) { c2 = true; changed = true; }
        }
      }
    }
    // 2) расширить фронт по рёбрам
    for (const e of edges) {
      for (const [from, to, lockTo] of [[e.a, e.b, e.lockB], [e.b, e.a, e.lockA]]) {
        if (!visited.has(from)) continue;
        if (e.gate && !hasFlag(set, e.gate)) continue;
        if (lockTo && !visited.has(to)) continue; // замочная сторона откроется только после прохода с обратной стороны
        if (!visited.has(to)) { visited.add(to); order.push(to); reach.set(to, setKey(set)); changed = true; }
      }
    }
  }
  for (const r of ROOMS) if (!reach.has(r.id)) problems.push(`UNREACHABLE room ${r.id}`);
  for (const k of Object.keys(ABILITIES)) if (!set.abilities[k]) problems.push(`ability ${k} never obtained`);
  for (const c of CORES) if (!set.cores.includes(c)) problems.push(`core ${c} never obtained`);
  return { reach, problems, edges, finalSet: set, order };
}

// Тупики без наград (секретные комнаты считаются наградой сами)
export function deadEndAudit() {
  const { edges } = buildEdges();
  const bad = [];
  for (const r of ROOMS) {
    const deg = edges.filter(e => e.a === r.id || e.b === r.id).length;
    const hasReward = (r.items || []).some(i => ["chest", "ability", "core", "maxhp", "save", "shop"].includes(i.t)) || r.boss || r.secret || r.cracks?.length;
    if (deg <= 1 && !hasReward) bad.push(r.id);
  }
  return bad;
}

export function mapBounds() {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const r of ROOMS) { minX = Math.min(minX, r.map[0]); maxX = Math.max(maxX, r.map[0]); minY = Math.min(minY, r.map[1]); maxY = Math.max(maxY, r.map[1]); }
  return { minX, maxX, minY, maxY };
}
// Соседние map-клетки должны соответствовать дверям (NSEW-консистентность карты)
export function mapConsistency() {
  const problems = [];
  const at = new Map(ROOMS.map(r => [r.map.join(","), r.id]));
  for (const r of ROOMS) {
    for (const d of r.doors) {
      const o = ROOM_BY_ID[d.to]; if (!o) continue;
      const dx = o.map[0] - r.map[0], dy = o.map[1] - r.map[1];
      const want = d.s === "E" ? [1, 0] : d.s === "W" ? [-1, 0] : d.s === "N" ? [0, -1] : [0, 1];
      if (dx !== want[0] || dy !== want[1]) problems.push(`map adjacency ${r.id}.${d.s}->${d.to}: delta (${dx},${dy}) != ${want}`);
    }
  }
  // две комнаты не могут занимать одну клетку
  const seen = new Set();
  for (const r of ROOMS) { const k = r.map.join(","); if (seen.has(k)) problems.push(`map cell ${k} occupied twice (${r.id})`); seen.add(k); }
  return problems;
}
