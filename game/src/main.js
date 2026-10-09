// main.js v2 — игровой цикл, AABB-физика комнат, переходы-двери, сейв-терминалы, бой, HUD.
// Feel-константы и глаголы унаследованы от v1 (HK-FEEL PASS). Уровень — из levelbuild/rooms.
import * as THREE from "three";
import { scene, camera, renderer, clamp, lerp, updateLights, updateParallax, setBiomeMood, setRoomVisible, mats, parallaxMid, parallaxFar, parallaxUltraFar, setLookQuality } from "./world.js";
import { buildAllRooms, RT, getRT, roomOrigin } from "./levelbuild.js";
import { ROOMS, ROOM_BY_ID, START_ROOM, START_POS, ABILITIES, CORES } from "./rooms.js";
import { bfsProgression, hasFlag, buildEdges, doorKey } from "./worldgraph.js";
import { ENEMY_TYPES, BOSSES, makeEnemyMesh, BOSS_DROPS_UI } from "./enemydefs.js";
import { player, attack, dash, hack, getHackTarget, ATK_DUR, ATK_CD, DASH_DUR, DASH_CD, DASH_IFRAME, FOCUS_COST, FOCUS_HEAL, FOCUS_TIME, SOUL_PER_HIT, SOUL_PER_KILL, HACK_DMG } from "./player.js";
import { burst, beam, impactRing, slashArc, ghostTrail, focusSwirl, addShake, shakeOffset, updateShake, updateFx, fx as fxList } from "./fx.js";
import { sfx, audioStart, toggleMute, setDistrictMood } from "./audio.js";
import { renderFrame, setEnabled as setBloomEnabled, isEnabled as postfxEnabled, flash as postFlash, decayFlash, resize as resizePostFx, overlay as postOverlay, hideOverlay as hidePostOverlay, setBloomStrength } from "./postfx.js";
import { menu, menuBlocked, showSplash, showTitle, showCreation, renderTitle, renderCreation, toPlay, showPause, hidePause, discoverEnemy, discoverDistrict, discoverWare, TITLE_ITEMS } from "./menu.js";
import { mapDiscover, mapuiDraw, mapuiInit, mapLoadVisited, openMap, closeMap, mapOpen } from "./mapui.js";
import { dbgInit, dbgUpdate, dbgLines, dbgSetPhysGetter } from "./debugx.js";

const STORAGE_KEY = "cybervania_v2";
export const PW = 0.34, PH = 1.9; // половина ширины и высота хитбокса вардена

// ── сохранение v2 ──
let save = { v: 2, abilities: {}, cores: [], bosses: [], visited: {}, unlocked: {}, chests: [], cracks: [], bench: null, eddies: 0, maxHp: 100, meleeBonus: 0, hackCost: 33, heroName: "WARDEN", lifepath: "street", time: 0 };
function saveGame() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (e) {} }
function loadGame() { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 2) save = Object.assign(save, d); } } catch (e) {} }
function saveSet() { return { abilities: save.abilities, cores: save.cores, bosses: save.bosses }; }
loadGame();

// ── мир ──
buildAllRooms();
let curRoom = null, curRT = null;
let started = false, endingShown = false, levelFade = 0, fadeDir = 0, pendingRoom = null, pendingSpawn = null;
let checkpointMsg = 0;
const enemies = [];      // враги ТЕКУЩЕЙ комнаты
const orbs = [];
let shards = 0;

// ── HUD helpers ──
const _hud = { hp: -1, ram: -1, edd: -1, cores: -1, boss: -1, low: false, ab: null };
export function message(t) { const m = document.getElementById("message"); if (!m) return; m.textContent = t; m.classList.remove("flash"); void m.offsetWidth; m.classList.add("flash"); }
function showZone(t) { const z = document.getElementById("zone"); if (!z) return; z.textContent = t; z.style.opacity = 1; clearTimeout(showZone.timer); showZone.timer = setTimeout(() => z.style.opacity = 0, 2200); }
function popup(text, good = false, x = player.x, y = player.y + 1) { const el = document.createElement("div"); el.className = "dmgpop" + (good ? " good" : ""); el.textContent = text; const v = new THREE.Vector3(x, y, 0); v.project(camera); el.style.left = ((v.x * .5 + .5) * innerWidth) + "px"; el.style.top = ((-v.y * .5 + .5) * innerHeight) + "px"; document.body.appendChild(el); setTimeout(() => el.remove(), 700); }

// ── враги: спавн/деспавн комнаты ──
function roomFloorY(rt) { // верх основной плиты пола комнаты (perimeter-пола больше нет — kinds: plat/floor)
  let f = rt.origin.y;
  for (const s of rt.solids) if (s.kind === "plat" || s.kind === "floor") f = Math.max(f, s.y1);
  return f;
}
function spawnRoomEnemies(rt) {
  for (const sp of rt.enemies) {
    const def = ENEMY_TYPES[sp.t]; if (!def) continue;
    const g = makeEnemyMesh(sp.t, rt.biome, sp.o.variant);
    g.position.set(sp.x, sp.y, 0); scene.add(g);
    enemies.push(mkEnemy(sp.t, def, g, sp.x, sp.y, rt, sp.o));
  }
  if (rt.boss && !save.bosses.includes(rt.boss.id)) {
    const def = BOSSES[rt.boss.id]; if (def) {
      const g = makeEnemyMesh(rt.boss.id, rt.biome, def.variant);
      g.position.set(rt.boss.x, rt.boss.y, 0); g.scale.setScalar(def.isFinal ? 1.5 : 1.25); scene.add(g);
      const e = mkEnemy(rt.boss.id, def, g, rt.boss.x, rt.boss.y, rt, {});
      e.isBoss = !!def.isBoss || !!def.isBossLite; e.isFinal = !!def.isFinal; e.bossName = def.name;
      enemies.push(e);
    }
  }
}
function mkEnemy(t, def, g, x, y, rt, o) {
  return { t, etype: t, def, g, o, baseScale: g.scale.x, x, y, vx: 0, vy: 0, ax: x, anchorY: y, hp: def.hp, max: def.hp, dmg: def.dmg, face: 1, hit: 0, dead: false, phase: Math.random() * 6, t2: Math.random() * 6, attack: 0, telegraphT: 0, telegraphDmg: 0, telegraphSrc: "", flashT: 0, baseEm: undefined, baseInt: 0, isBoss: false, grounded: false, roomFloor: roomFloorY(rt), roomX0: rt.origin.x + 1, roomX1: rt.origin.x + rt.w - 1, rt };
}
function despawnRoomEnemies() { for (const e of enemies) { scene.remove(e.g); for (const m of e.extras || []) scene.remove(m); } enemies.length = 0; }

// ── переходы между комнатами ──
function doorSpawnPoint(toRT, side, at) {
  const o = toRT.origin;
  if (side === "E") return { x: o.x + toRT.w - 1.8, y: o.y + at + 0.05, vy: 0 };
  if (side === "W") return { x: o.x + 1.8, y: o.y + at + 0.05, vy: 0 };
  if (side === "N") return { x: o.x + at, y: o.y + toRT.h - 1.4, vy: Math.min(player.vy, -2) }; // падаем сквозь люк потолка
  // вышли ВВЕРХ из дыры пола: holeFloorOf возвращает МИРОВУЙ y — offset комнаты не добавляем;
  // спавн на кромке пола рядом с люком (иначе попадаем обратно в дырку и в zone ping-pong)
  const F = holeFloorOf(toRT, at);
  // кромка: ищем ближайшую ОПОРНУЮ полку того же уровня вне хазардов; нет опоры = шахта (выброс вверх)
  const standAt = (lx) => toRT.solids.some(s2 => s2.kind !== "thin" && Math.abs(s2.y1 - F) < 0.05 && s2.x0 - 0.05 <= o.x + lx - 0.4 && s2.x1 + 0.05 >= o.x + lx + 0.4);
  const hazAt = (lx) => toRT.hazards.some(h => h.x0 - .5 < o.x + lx && o.x + lx < h.x1 + .5 && h.y1 > F + 0.1 && h.y0 < F + 6);
  // конвейер, тянущий к люку, = ловушка спавна
  const convAt = (lx) => toRT.conveyors.some(c => c.x0 - .3 < o.x + lx && o.x + lx < c.x1 + .3 && Math.abs(c.y - F) < .8 && ((c.dir < 0 && at < lx) || (c.dir > 0 && at > lx)));
  for (const c of [2.2, -2.2, 3.0, -3.0, 4.0, -4.0, 5.0, -5.0]) {
    if (standAt(at + c) && !hazAt(at + c) && !convAt(at + c)) return { x: o.x + at + c, y: F + 0.05, vy: 0 };
  }
  return { x: o.x + at, y: F + 0.1, vy: 8 }; // shaft-дверь: выброс вверх из люка
}
function holeFloorOf(rt, at) { // уровень пола у точки at: сначала плита, СОДЕРЖАЩАЯ точку; иначе соседняя с проёмом
  const atw = rt.origin.x + at;
  let f = null;
  for (const s of rt.solids) {
    if (s.kind === "thin" || (s.y1 - s.y0) < 1.5) continue;
    const topLocal = s.y1 - rt.origin.y; if (topLocal > 12.5) continue;
    if (s.x0 <= atw && s.x1 >= atw) f = Math.max(f ?? -1e9, s.y1);
  }
  if (f !== null) return f;
  f = rt.origin.y;
  for (const s of rt.solids) {
    if (s.kind === "thin" || (s.y1 - s.y0) < 1.5) continue;
    const topLocal = s.y1 - rt.origin.y; if (topLocal > 12.5) continue;
    if (Math.min(Math.abs(s.x0 - atw), Math.abs(s.x1 - atw)) < 5) f = Math.max(f, s.y1);
  }
  return f;
}
function pairKey(aId, side, bId) { return [aId, side, bId].join("|"); }
function tryDoorTransition() {
  if (player.knockT > 0) return false; // нокбэк от урона не должен закидывать в дверь
  for (const d of curRT.doors) {
    const z = d.zone;
    if (player.x < z.x0 || player.x > z.x1 || player.y + 0.9 < z.y0 || player.y > z.y1 + 0.6) continue;
    // velocity-guard: переход срабатывает только при ДВИЖЕНИИ в дверь (N — вверх, S — вниз, E/W — по горизонтали).
    // Защищает от ре-триггеров: стойка на кромке дырки, падение сквозь потолочный люк сверху, landing под люком.
    if (d.side === "N" && player.vy < 1) continue;
    if (d.side === "S" && player.vy > -1) continue;
    if (d.side === "E" && player.vx < 0.5) continue;
    if (d.side === "W" && player.vx > -0.5) continue;
    // гейт способности
    if (d.gate && !hasFlag(saveSet(), d.gate)) {
      if (!d._msgT || performance.now() - d._msgT > 2500) { d._msgT = performance.now(); message(gateMsg(d.gate)); sfx.denied?.(); }
      pushBackFromDoor(d); return false;
    }
    // shortcut-замок: закрыт с этой стороны, пока не пройдён с обратной
    const pk = pairKey(curRT.id, d.side, d.to);
    if (d.lock && !save.unlocked[pk]) {
      if (!d._msgT || performance.now() - d._msgT > 2500) { d._msgT = performance.now(); message("ЗАМОК // ОТКРОЙТЕ С ДРУГОЙ СТОРОНЫ"); }
      pushBackFromDoor(d); return false;
    }
    // проход через парную дверь разблокирует замок
    const backPk = pairKey(d.to, OPP[d.side], curRT.id);
    if (!save.unlocked[backPk]) { const other = getRT(d.to); const od = other?.doors.find(dd => dd.to === curRT.id && dd.side === OPP[d.side]); if (od?.lock) { save.unlocked[backPk] = true; message("SHORTCUT // ОТКРЫТ"); saveGame(); } }
    const toRT = getRT(d.to);
    const sp = doorSpawnPoint(toRT, OPP[d.side], atOf(otherDoor(toRT, curRT.id, OPP[d.side])));
    beginTransition(toRT, sp); return true;
  }
  return false;
}
const OPP = { E: "W", W: "E", N: "S", S: "N" };
function otherDoor(rt, fromId, side) { return rt.doors.find(d => d.to === fromId && d.side === side); }
function atOf(d) { return d ? d.at : 0; }
const GATE_SRC = { servo: ["ДОЖДЬ-ОХОТНИК", "n7"], wall: ["СМОТРИТЕЛЬ БАШНИ", "m3"], hack2: ["ПРЕСС-777", "p6"], phase: ["МАТКА СТОКОВ", "st4"] };
const CORE_SRC = { core_prom: ["ПРЕСС-777", "p6"], core_stoki: ["МАТКА СТОКОВ", "st4"], core_pusto: ["ЧЕРВЬ СИРОККО", "pu4"] };
function gateMsg(g) {
  if (g === "cores3") {
    const miss = CORES.filter(c => !save.cores.includes(c)).map(c => `${CORE_SRC[c][0]} (${c.slice(5).toUpperCase()}: ${CORE_SRC[c][1]})`);
    return `ЯДРО-ЗАМОК // КОРЫ ${save.cores.length}/3 · НЕ ХВАТАЕТ: ${miss.join(" · ") || "—"}`;
  }
  const a = ABILITIES[g], src = GATE_SRC[g];
  return a ? `НУЖЕН ${a.name} // ${a.desc} · ГДЕ ВЗЯТЬ: ${src ? src[0] + " (" + src[1] + ")" : "?"}` : `ЗАМОК: ${g}`;
}
export function progressionGoals() {
  const out = [];
  for (const k of Object.keys(ABILITIES)) if (!save.abilities[k]) out.push(`${ABILITIES[k].name} — ${GATE_SRC[k][0]} (${GATE_SRC[k][1]})`);
  for (const c of CORES) if (!save.cores.includes(c)) out.push(`КОР ${c.slice(5).toUpperCase()} — ${CORE_SRC[c][0]} (${CORE_SRC[c][1]})`);
  return out;
}
function pushBackFromDoor(d) {
  if (d.side === "E") { player.x = Math.min(player.x, d.zone.x0 - 0.1); if (player.vx > 0) player.vx = 0; }
  if (d.side === "W") { player.x = Math.max(player.x, d.zone.x1 + 0.1); if (player.vx < 0) player.vx = 0; }
  if (d.side === "N") { player.y = Math.min(player.y, d.zone.y0 - 0.05); if (player.vy > 0) player.vy = 0; }
  if (d.side === "S") { // выталкиваем на кромку пола рядом с дыркой, а не над дыркой (иначе батут)
    player.y = Math.max(player.y, d.zone.y1 + 0.05); if (player.vy < 0) player.vy = 0;
    const at = (d.zone.x0 + d.zone.x1) / 2;
    player.x = player.x < at ? at - 2.2 : at + 2.2;
  }
}
function beginTransition(toRT, sp) {
  pendingRoom = toRT; pendingSpawn = sp; fadeDir = 1; levelFade = 0.001;
  sfx.door?.();
}
function commitTransition() {
  const rt = pendingRoom; const sp = pendingSpawn;
  setRoomVisible(curRT.id, false);
  curRT = rt; curRoom = rt.id;
  setRoomVisible(rt.id, true);
  setBiomeMood(rt.biome); try { setDistrictMood(__BIOMES[rt.biome].mood); } catch (e) {}
  despawnRoomEnemies(); spawnRoomEnemies(rt);
  player.x = sp.x; player.y = sp.y; player.vx = 0; player.vy = sp.vy || 0; player.prevX = sp.x; player.prevY = sp.y;
  player.climbing = false; player.dropT = 0;
  player.inv = Math.max(player.inv, 1.0); // i-frames прибытия: без дешёвых нокбэков прямо из двери
  camX = player.x; camY = player.y + 2.2; camLookY = player.y + 1.5;
  if (!save.visited[rt.id]) { save.visited[rt.id] = 1; saveGame(); }
  mapDiscover(rt);
  showZone(`${BIOME_NAME(rt.biome)} // ${rt.name}`);
  updateRoomLabel();
  saveGame();
  pendingRoom = null; pendingSpawn = null;
}
function BIOME_NAME(b) { try { return __BIOMES[b].name; } catch (e) { return b; } }
import { BIOMES as __BIOMES } from "./biomes.js";
function updateRoomLabel() { const el = document.getElementById("room"); if (el) el.textContent = `ROOM ${curRoom} // ${curRT ? curRT.name : ""}`; }

// ── физика: AABB против rect'ов комнаты ──
function activeSolids() {
  const out = [];
  for (const s of curRT.solids) out.push(s);
  for (const m of curRT.movers) if (m.solidNow) out.push(m.rect);
  for (const sd of curRT.secdoors) if (!sd.open) out.push(sd);
  for (const b of curRT.barriers) if (!(player.ab.phase && player.dash > 0)) out.push(b);
  for (const c of curRT.cracks) if (!c.dead) out.push(c);
  return out;
}
function resolveX(dx) {
  const S = activeSolids();
  player.x += dx;
  for (const s of S) {
    if (s.kind === "mover" || (s.mover)) continue; // муверы не толкают сбоку (только посадка/перенос); полки цепей — сплошные
    if (player.y + PH <= s.y0 + 0.02 || player.y >= s.y1 - 0.02) continue;
    if (player.x + PW <= s.x0 || player.x - PW >= s.x1) continue;
    if (player.ground && s.y1 - player.y > 0 && s.y1 - player.y <= 0.35) { player.y = s.y1; continue; } // step-up assist: низкие кромки не сбивают бег
    // CORNER CORRECTION (Celeste-style): в воздухе касаемся бока полки, ноги у её верха (<=0.45) —
    // засасываем на площадку вместо бокового выталкивания: дрейф в прыжке прощает ранний вход
    if (!player.ground && s.y1 - player.y > 0 && s.y1 - player.y <= 0.55 && player.vy <= 0.5) {
      player.y = s.y1; player.vy = 0; player.ground = true; player.doubleJumpUsed = false;
      continue;
    }
    if (dx > 0) { player.x = s.x0 - PW - 0.001; } else if (dx < 0) { player.x = s.x1 + PW + 0.001; } else { player.x = (player.x < (s.x0 + s.x1) / 2) ? s.x0 - PW - 0.001 : s.x1 + PW + 0.001; }
    player.vx = 0; player.wallHit = true;
  }
}
function resolveY(dy) {
  const S = activeSolids();
  player.ground = false; player.groundMover = null;
  player.y += dy;
  for (const s of S) {
    if (player.x + PW <= s.x0 + 0.02 || player.x - PW >= s.x1 - 0.02) continue;
    if (dy <= 0 && !(s.kind === "thin" && player.dropT > 0) && player.prevY >= s.y1 - 0.06 && player.y <= s.y1 + 0.02) { player.y = s.y1; player.vy = 0; player.ground = true; if (s.mover) player.groundMover = s.mover; }
    else if (dy > 0 && player.prevY + PH <= s.y0 + 0.06 && player.y + PH >= s.y0 - 0.02) { player.y = s.y0 - PH - 0.001; player.vy = 0; } // bonk: весь мир сплошной (жёсткая грамматика v2.2)
  }
  if (player.dropT <= 0 && !player.climbing) {
    for (const o of curRT.oneways) {
      if (player.x + PW <= o.x0 || player.x - PW >= o.x1) continue;
      if (dy <= 0 && player.prevY >= o.y - 0.06 && player.y <= o.y + 0.02) { player.y = o.y; player.vy = 0; player.ground = true; }
    }
  }
}
function wallTouchDir() {
  if (player.ground) return 0;
  const S = activeSolids();
  for (const s of S) {
    if (s.kind === "thin" && s.y1 - s.y0 < 0.7) continue; // wall-slide только по настоящим стенам/плитам
    if (player.y + PH <= s.y0 + 0.1 || player.y >= s.y1 - 0.25) continue;
    if (Math.abs(player.x + PW - s.x0) < 0.09) return 1;
    if (Math.abs(player.x - PW - s.x1) < 0.09) return -1;
  }
  return 0;
}
function isOnLadder(x, y) { for (const l of curRT.ladders) if (Math.abs(x - l.x) < 0.9 && y >= l.y0 - 0.35 && y <= l.y1 + 0.35) return l; return null; }

// ── ввод ──
const keys = {};
addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  audioStart();
  if (menu.state === "splash") { e.preventDefault(); showTitle(); return; }
  if (menu.state === "creation") {
    const inp = document.getElementById("crName");
    const inName = document.activeElement === inp;
    if (e.code === "Tab") { e.preventDefault(); if (inName) inp.blur(); else inp.focus(); setCrHint(inName ? "path" : "name"); return; }
    if (e.code === "Enter") { e.preventDefault(); confirmCreation(); return; }
    if (e.code === "Escape") { if (inName) { inp.blur(); setCrHint("path"); } else showTitle(); return; }
    if (!inName) {
      if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") { setLifepathByKey(e.code); return; }
      if (e.code === "KeyW" || e.code === "ArrowUp" || e.code === "KeyS" || e.code === "ArrowDown") { cycleLifepath(e.code === "KeyW" || e.code === "ArrowUp" ? -1 : 1); return; }
    }
    return; // inName: печать идёт в input, цифры в имя не ломают выбор пути
  }
  if (menu.state === "title") {
    if (e.code === "KeyW" || e.code === "ArrowUp") { if (!e.repeat) { menu.titleIdx = (menu.titleIdx + TITLE_ITEMS.length - 1) % TITLE_ITEMS.length; renderTitle(); } return; }
    if (e.code === "KeyS" || e.code === "ArrowDown") { if (!e.repeat) { menu.titleIdx = (menu.titleIdx + 1) % TITLE_ITEMS.length; renderTitle(); } return; }
    if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); selectTitle(); return; }
    return;
  }
  if (mapOpen()) { if (e.code === "Tab" || e.code === "Escape") { e.preventDefault(); closeMap(); } return; }
  if (menu.paused) {
    if (e.code === "Escape" || e.code === "Enter") { e.preventDefault(); hidePause(); }
    else if (e.code === "KeyX") { hidePause(); showTitle(); }
    return;
  }
  if (!started) return;
  if (e.code === "Tab" && !e.repeat) { openMap(); return; }
  if (e.code === "Escape") { if (shopOpen) closeShopPanel(); else showPause(); return; }
  if (e.code === "Space" || e.code === "ArrowUp") player.jbuf = .12;
  if (e.code === "KeyJ") {
    let dir = "side";
    if (keys.KeyS || keys.ArrowDown) dir = "down";
    else if ((keys.KeyW || keys.ArrowUp) && !player.climbing && !player.onLadder) dir = "up";
    attack(dir);
  }
  if (e.code === "KeyK" && player.jamT <= 0) dash();
  if (e.code === "KeyL" && player.jamT <= 0) hack(enemies, killEnemy, message);
  if (e.code === "ShiftLeft" && !e.repeat) triggerScanner();
  if (e.code === "KeyE") interact();
});
addEventListener("keyup", e => keys[e.code] = false);
function selectTitle() { const it = TITLE_ITEMS[menu.titleIdx]; if (!it) return; if (it.id === "new") showCreation(); else if (it.id === "continue") { enterGame(!!menu.saveExists); } else { enterGame(!!menu.saveExists); openMap(); } }
function setLifepathByKey(code) { const i = code === "Digit1" ? 0 : code === "Digit2" ? 1 : 2; menu.lifepath = ["street", "netrunner", "stalker"][i] || "street"; renderCreation(); }
function cycleLifepath(d) { const ids = ["street", "netrunner", "stalker"]; let i = ids.indexOf(menu.lifepath); i = (i + d + 3) % 3; menu.lifepath = ids[i]; renderCreation(); }
function setCrHint(mode) {
  const el = document.getElementById("crHint"); if (!el) return;
  el.textContent = mode === "name"
    ? "РЕЖИМ ИМЕНИ: печать в поле · TAB — назад к выбору пути · ENTER — старт"
    : "РЕЖИМ ПУТИ: 1/2/3 или W/S — путь · TAB — ввод имени · ENTER — старт · ESC — назад";
}
try {
  const pathsBox = document.getElementById("crPaths");
  if (pathsBox) pathsBox.addEventListener("click", (ev) => {
    const row = ev.target.closest(".crPath"); if (!row) return;
    const i = +row.dataset.i; menu.lifepath = ["street", "netrunner", "stalker"][i] || "street"; renderCreation();
  });
  const inpCr = document.getElementById("crName");
  if (inpCr) inpCr.addEventListener("focus", () => setCrHint("name"));
  if (inpCr) inpCr.addEventListener("blur", () => setCrHint("path"));
} catch (e) {}
function confirmCreation() {
  try { const inp = document.getElementById("crName"); if (inp && inp.value.trim()) menu.heroName = inp.value.trim().slice(0, 12).toUpperCase(); } catch (e) {}
  const st = menu.lifepath === "street" ? { meleeBonus: 4, maxHp: 100, hackCost: 33 } : menu.lifepath === "netrunner" ? { meleeBonus: 0, maxHp: 100, hackCost: 18 } : { meleeBonus: 0, maxHp: 125, hackCost: 33 };
  save = { v: 2, abilities: {}, cores: [], bosses: [], visited: {}, unlocked: {}, chests: [], cracks: [], bench: null, eddies: 0, maxHp: st.maxHp, meleeBonus: st.meleeBonus, hackCost: st.hackCost, heroName: menu.heroName, lifepath: menu.lifepath, time: 0 };
  saveGame();
  enterGame(true);
  message("ВАРДЕН СОЗДАН // " + save.heroName);
}
setCrHint("path");
function enterGame(fresh) {
  started = true; toPlay(); audioStart();
  syncAbilities();
  player.maxHp = save.maxHp; player.hp = save.maxHp; player.meleeBonus = save.meleeBonus; player.hackCost = save.hackCost;
  const bench = save.bench && getRT(save.bench.room) ? save.bench : null;
  let rt, sp;
  if (bench) { rt = getRT(bench.room); sp = { x: bench.x, y: bench.y + 0.1, vy: 0 }; }
  else { rt = getRT(START_ROOM); sp = { x: rt.origin.x + START_POS.x, y: rt.origin.y + START_POS.y + 0.1, vy: 0 }; }
  setRoomVisible(rt.id, true); curRT = rt; curRoom = rt.id; setBiomeMood(rt.biome);
  try { setDistrictMood(__BIOMES[rt.biome].mood); } catch (e) {}
  if (!save.visited[rt.id]) save.visited[rt.id] = 1;
  mapDiscover(rt);
  despawnRoomEnemies(); spawnRoomEnemies(rt);
  player.x = sp.x; player.y = sp.y; player.vx = 0; player.vy = 0; player.prevX = sp.x; player.prevY = sp.y;
  camX = player.x; camY = player.y + 2.2; camLookY = player.y + 1.5;
  updateRoomLabel(); showZone(`${BIOME_NAME(rt.biome)} // ${rt.name}`);
  saveGame();
}
function syncAbilities() { player.ab.servo = !!save.abilities.servo; player.ab.wall = !!save.abilities.wall; player.ab.phase = !!save.abilities.phase; player.ab.hack2 = !!save.abilities.hack2; }

// ── интеракции: сундуки, терминалы, магазин, лифты ──
let shopOpen = false;
function nearestItem(kind, r = 2.2) { let best = null, bd = r; for (const it of curRT.items) if (it.t === kind && !it.taken) { const d = Math.hypot(player.x - it.x, player.y - it.y); if (d < bd) { bd = d; best = it; } } return best; }
function interact() {
  const sv = nearestItem("save"); if (sv) { save.bench = { room: curRoom, x: sv.x, y: sv.y }; player.hp = player.maxHp; saveGame(); message("ТЕРМИНАЛ // СОХРАНЕНО И ВОССТАНОВЛЕНО"); sfx.heal?.(); burst(new THREE.Vector3(sv.x, sv.y + 1, 0), 0xEAFBFF, 16, .06); return; }
  const ch = nearestItem("chest"); if (ch) { ch.taken = true; if (ch.mesh) ch.mesh.visible = false; save.chests.push(ch.id); if (ch.kind === "maxhp") { save.maxHp += 15; player.maxHp = save.maxHp; player.hp = Math.min(player.maxHp, player.hp + 15); popup("+15 MAX HP", true, ch.x, ch.y + 1); } else { save.eddies += 40; popup("+40 EDDIES", true, ch.x, ch.y + 1); } sfx.chest?.(); saveGame(); return; }
  const sh = nearestItem("shop", 2.6); if (sh) { openShopPanel(); return; }
  for (const lf of curRT.lifts) {
    const z = lf.zone;
    if (player.x > z.x0 && player.x < z.x1 && player.y > z.y0 - 0.5 && player.y < z.y1 + 1) {
      if (lf.lock && !lockOpen(lf.lock)) { message("ЛИФТ // НЕТ ПИТАНИЯ (после СМОТРИТЕЛЯ)"); return; }
      const toRT = getRT(lf.to); beginTransition(toRT, { x: toRT.origin.x + lf.tx, y: toRT.origin.y + lf.ty + 0.1, vy: 0 }); return;
    }
  }
  const nc = nearestItem("chest", 4); if (nc) { message("СУНДУК // " + (Math.hypot(player.x - nc.x, player.y - nc.y)).toFixed(1) + "m"); return; }
  const ns = nearestItem("save", 4); if (ns) { message("ТЕРМИНАЛ // [E]"); return; }
}
function lockOpen(lock) { if (lock.startsWith("boss:")) return save.bosses.includes(lock.slice(5)); return false; }
function openShopPanel() { shopOpen = true; const o = document.getElementById("shopOverlay"); if (o) o.style.display = "block"; }
function closeShopPanel() { shopOpen = false; const o = document.getElementById("shopOverlay"); if (o) o.style.display = "none"; }
function tryBuyHp() { if (save.eddies < 120) { message("МАЛО EDDIES"); return; } save.eddies -= 120; save.maxHp += 25; player.maxHp = save.maxHp; player.hp = Math.min(player.maxHp, player.hp + 25); saveGame(); message("+25 MAX HP"); }
function tryBuyDmg() { if (save.eddies < 80) { message("МАЛО EDDIES"); return; } save.eddies -= 80; save.meleeBonus += 4; player.meleeBonus = save.meleeBonus; saveGame(); message("+4 MELEE DMG"); }
try { document.getElementById("shopBuyHp")?.addEventListener("click", tryBuyHp); document.getElementById("shopBuyDmg")?.addEventListener("click", tryBuyDmg); } catch (e) {}

// ── сканер: подсветка трещин и сундуков ──
let scannerT = 0;
function triggerScanner() { scannerT = 1.2; sfx.scan?.(); for (const c of curRT.cracks) if (!c.dead) burst(new THREE.Vector3((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, 0), 0xFFE66D, 8, .05); message("СКАНЕР // ТРЕЩИНЫ И ЦЕЛИ ПОДСВЕЧЕНЫ"); }

// ── бой: телеграфы, урон, орбы, убийства, дропы боссов ──
function damagePlayer(n, source = "DAMAGE", srcX) {
  if (player.inv > 0 || !started || menuBlocked()) return;
  player.hp -= n; player.inv = .8; player.knockT = .35;
  popup("-" + n + "  " + source);
  burst(player.g.position, 0xff3ea5, 18, .07); sfx.hurt?.();
  if (srcX !== undefined) player.vx = Math.sign(player.x - srcX || 1) * 6;
  player.vy = Math.max(player.vy, 4);
  document.body.classList.remove("shake"); void document.body.offsetWidth; document.body.classList.add("shake");
  if (player.hp <= 0) { player.hp = 0; respawn(); }
}
function respawn(cause = "hp") {
  try { window.__LASTDEATH = { cause, room: curRoom, x: +player.x.toFixed(1), y: +player.y.toFixed(1), t: performance.now() }; } catch (e) {}
  player.hp = player.maxHp; player.ram = 100; player.jamT = 0;
  const bench = save.bench && getRT(save.bench.room) ? save.bench : null;
  const rt = bench ? getRT(bench.room) : getRT(START_ROOM);
  if (rt !== curRT) { setRoomVisible(curRT.id, false); curRT = rt; curRoom = rt.id; setRoomVisible(rt.id, true); setBiomeMood(rt.biome); updateRoomLabel(); }
  despawnRoomEnemies(); spawnRoomEnemies(rt);
  player.x = bench ? bench.x : rt.origin.x + START_POS.x; player.y = (bench ? bench.y : rt.origin.y + START_POS.y) + 0.1;
  player.vx = 0; player.vy = 0; player.inv = 1.5; player.climbing = false;
  camX = player.x; camY = player.y + 2.2;
  message("РЕСПАВН // ПОСЛЕДНИЙ ТЕРМИНАЛ");
  orbs.length = 0; for (const o of orbs) scene.remove(o.g);
  saveGame();
}
const debris = [];
function spawnDebris(e) {
  const n = e.isBoss ? 9 : 5;
  const col = e.g.userData.core && e.g.userData.core.material ? e.g.userData.core.material.emissive.getHex() : 0x62f6ff;
  for (let i = 0; i < n; i++) {
    const sz = .14 + Math.random() * .22;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 }));
    m.material.toneMapped = false;
    m.position.set(e.x + (Math.random() - .5) * .8, e.y + .4 + Math.random() * (e.def.h || 1), .1);
    scene.add(m);
    debris.push({ m, vx: (Math.random() - .5) * 7, vy: 3 + Math.random() * 5, rz: (Math.random() - .5) * 12, life: .8 + Math.random() * .3 });
  }
}
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt;
    d.vy -= 20 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.rotation.z += d.rz * dt; d.m.rotation.x += d.rz * .7 * dt;
    d.m.material.opacity = Math.max(0, d.life);
    if (d.life <= 0) { scene.remove(d.m); d.m.material.dispose(); d.m.geometry.dispose(); debris.splice(i, 1); }
  }
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; scene.remove(e.g); for (const m of e.extras || []) scene.remove(m); spawnDebris(e);
  burst(new THREE.Vector3(e.x, e.y + .8, 0), e.isBoss ? 0xffd700 : 0x62f6ff, e.isBoss ? 40 : 16, .07);
  save.eddies += e.isBoss ? 120 : e.def.invuln ? 0 : 8;
  sfx.kill?.(); discoverEnemy(e.t);
  player.ram = clamp(player.ram + SOUL_PER_KILL, 0, 100);
  if (e.isBoss) { addShake(.9, .5); postFlash(.4, 0xffffff); onBossDead(e); }
  else { addShake(.18, .12); }
}
function onBossDead(e) {
  const id = e.t;
  if (!save.bosses.includes(id)) save.bosses.push(id);
  const drop = BOSS_DROPS_UI[id];
  if (drop && !save.abilities[drop]) { save.abilities[drop] = true; syncAbilities(); const a = ABILITIES[drop]; message(`СПОСОБНОСТЬ // ${a.name}: ${a.desc}`); showZone(`НОВАЯ СПОСОБНОСТЬ // ${a.name}`); }
  const coreMap = { press_777: "core_prom", brood_mother: "core_stoki", sirokko: "core_pusto" };
  if (coreMap[id] && !save.cores.includes(coreMap[id])) { save.cores.push(coreMap[id]); message(`КОР-МОДУЛЬ // ${save.cores.length}/3`); }
  if (e.isFinal) { endingShown = true; showEnding(); }
  else { message(`${e.bossName || id} // ПОВЕРЖЕН`); showZone("БОСС ПОВЕРЖДЁН"); }
  saveGame();
}
function attackHitbox(e) {
  const dir = player.attackDir || "side";
  const reach = dir === "side" ? 2.1 : 1.5;
  const hx = dir === "side" ? player.x + player.face * 1.1 : player.x;
  const hy = dir === "up" ? player.y + PH + .7 : dir === "down" ? player.y - .5 : player.y + .95;
  const w = e.def.w || .9, h = e.def.h || 1;
  return Math.abs(hx - e.x) < reach + w / 2 && Math.abs(hy - (e.y + h / 2)) < (dir === "side" ? 1.3 : 1.6) + h / 2;
}
function hurtEnemies() {
  if (player.attack <= 0) return;
  const dmgBase = 24 + (player.meleeBonus || 0);
  const dmgBoss = 20 + Math.floor((player.meleeBonus || 0) / 2);
  const dir = player.attackDir || "side";
  let landed = false;
  for (const e of enemies) {
    if (e.dead || e.lastHitId === player.attackId || e.untouchable) continue;
    if (!attackHitbox(e)) continue;
    e.lastHitId = player.attackId;
    if (e.def.invuln) { burst(new THREE.Vector3(e.x, e.y + .8, 0), 0xffe66d, 6, .04); sfx.denied?.(); continue; }
    // щит: фронтальный удар отбивает (погo сверху и удар сзади — проходят)
    if (e.def.shielded && dir === "side" && Math.sign(e.x - player.x) === e.face) {
      burst(new THREE.Vector3(e.x - e.face * .6, e.y + .9, 0), 0xffe66d, 8, .05); sfx.denied?.();
      player.vx = -player.face * 5; landed = true; continue;
    }
    const dmg = e.isBoss ? dmgBoss : dmgBase;
    const vulnMul = e.def.armored && !(e.vulnT > 0) ? 0.2 : (e.def.kind === "turret" && e.t === "summoner" && e.channel) ? 0.2 : 1;
    e.hp -= dmg * vulnMul; e.hit = .12; e.lastHitId = player.attackId;
    e.vx = (dir === "down" ? player.face * 3 : player.face * 6);
    if (dir !== "down" && !e.def.fly) e.vy = 3.2;
    impactRing(new THREE.Vector3(e.x, e.y + .9, 0), 0xffe66d); sfx.hit?.();
    burst(new THREE.Vector3(e.x, e.y + .9, 0), 0xffe66d, 10, .05); popup("-" + Math.round(dmg * vulnMul), false, e.x, e.y + 1.4);
    player.ram = clamp(player.ram + (e.isBoss ? 6 : SOUL_PER_HIT), 0, 100);
    landed = true;
    if (dir === "down" && !player.ground) { // POGO
      player.vy = 12.4; player.attack = Math.max(player.attack, 0.10); player.attackCd = Math.min(player.attackCd, 0.16);
      burst(new THREE.Vector3(e.x, e.y + 1.2, 0), 0xBFF6FF, 12, .055); addShake(.22, .14); sfx.pogo?.();
    }
    if (e.hp <= 0) killEnemy(e);
  }
  if (!landed && dir !== "side" && player.attackFx <= 0) { slashArc(new THREE.Vector3(player.x + player.face * .4, player.y + (dir === "up" ? 2.0 : 0.2), .2), player.face, 0x7FD8E8, dir); player.attackFx = .3; }
  // трещины ломаются ударом
  if (player.attack > 0) for (const c of curRT.cracks) if (!c.dead && Math.abs(player.x + player.face * 1.2 - (c.x0 + c.x1) / 2) < 1.6 && player.y + 1 > c.y0 && player.y < c.y1) {
    c.dead = true; if (c.mesh) c.mesh.visible = false; burst(new THREE.Vector3((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, 0), 0x8a97a8, 16, .06); sfx.slam?.();
    if (c.item && !save.chests.includes(c.item)) { curRT.items.push({ t: "chest", id: c.item, kind: "eddies", x: (c.x0 + c.x1) / 2, y: c.y0, taken: false, mesh: null }); message("СЕКРЕТ // СУНДУК"); }
    save.cracks.push(curRoom + ":" + c.x0.toFixed(0)); saveGame();
  }
}
// орбы боссов/врагов
let orbGeo = null;
function getOrbMat(color) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .98 }); }
function spawnOrb(x, y, vx, vy, color, dmg, label) {
  if (!orbGeo) orbGeo = new THREE.SphereGeometry(0.17, 10, 8);
  const g = new THREE.Group();
  const core = new THREE.Mesh(orbGeo, getOrbMat(color)); core.toneMapped = false; g.add(core);
  g.position.set(x, y, 0.15); scene.add(g);
  orbs.push({ g, x, y, vx, vy, life: 4.2, dmg, label, color });
}
function fireOrb(x, y, vx, vy, color, dmg, label) { spawnOrb(x, y, vx, vy, color, dmg, label); sfx.orb?.(); }
function fireOrbAimed(x, y, speed, color, dmg, label, jitter = 0) {
  let dx = player.x - x, dy = player.y + 1 - y; const d = Math.max(.001, Math.hypot(dx, dy));
  if (jitter) { const a = Math.atan2(dy, dx) + (Math.random() - .5) * jitter; dx = Math.cos(a); dy = Math.sin(a); } else { dx /= d; dy /= d; }
  spawnOrb(x + dx * .5, y + dy * .5, dx * speed, dy * speed, color, dmg, label); sfx.orb?.();
}
function updateOrbs(dt) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]; o.life -= dt; o.x += o.vx * dt; o.y += o.vy * dt; o.g.position.set(o.x, o.y, .15);
    if (player.inv <= 0 && Math.abs(o.x - player.x) < .75 && o.y > player.y - .2 && o.y < player.y + PH) { damagePlayer(o.dmg, o.label, o.x); scene.remove(o.g); orbs.splice(i, 1); continue; }
    let splat = false;
    for (const s of curRT.solids) if (o.x > s.x0 - .1 && o.x < s.x1 + .1 && o.y < s.y1 + .12 && o.y > s.y0 - .4) { splat = true; break; }
    if (splat || o.life <= 0 || o.y < curRT.origin.y - 3) { burst(new THREE.Vector3(o.x, o.y, 0), o.color, 6, .04); scene.remove(o.g); orbs.splice(i, 1); }
  }
}
function geyser(x, dur) {
  // кислотный столб: телеграф уже показан кольцом; урон-зона на dur секунд
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 1.4), new THREE.MeshStandardMaterial({ color: 0x0a2a14, emissive: 0x39FF14, emissiveIntensity: 2.4, transparent: true, opacity: .55 }));
  m.position.set(x, curRT.origin.y + 3.5, 0); scene.add(m);
  const rec = { x0: x - .7, y0: curRT.origin.y, x1: x + .7, y1: curRT.origin.y + 7, dmg: 14, t: dur, mesh: m, tmp: true };
  curRT.hazards.push(rec);
  setTimeout(() => { scene.remove(m); const i = curRT.hazards.indexOf(rec); if (i >= 0) curRT.hazards.splice(i, 1); }, dur * 1000);
}
function beamCross(x, y, len) {
  // wireframe-крест архитектора: телеграф-линии уже мигнули, теперь урон по кресту
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(dx ? len * 2 : .35, dx ? .35 : len * 2, .35), new THREE.MeshBasicMaterial({ color: 0xFF2D78, transparent: true, opacity: .85 }));
    m.position.set(x, y, .1); scene.add(m);
    setTimeout(() => scene.remove(m), 350);
    const rec = { x0: x - (dx ? len : .3), y0: y - (dx ? .3 : len), x1: x + (dx ? len : .3), y1: y + (dx ? .3 : len), dmg: 14, t: .35, mesh: m, tmp: true };
    curRT.hazards.push(rec);
    setTimeout(() => { const i = curRT.hazards.indexOf(rec); if (i >= 0) curRT.hazards.splice(i, 1); }, 350);
  }
  sfx.beam?.();
}
// контекст ИИ врагов
function aiCtx(e) {
  const en = e;
  return {
    player,
    telegraph(en, t, dmg, src) { if (en.telegraphT > 0) return; en.telegraphT = t; en.telegraphDmg = dmg; en.telegraphSrc = src; },
    fireOrb, fireOrbAimed,
    spawnAdd(x, y) {
      let n = 0; for (const q of enemies) if (!q.dead && q.add) n++;
      if (n >= 4) return;
      const def = ENEMY_TYPES.grid_mite; const g = makeEnemyMesh("grid_mite", curRT.biome);
      g.position.set(x, y, 0); scene.add(g);
      const add = mkEnemy("grid_mite", def, g, x, y, curRT, {}); add.add = true; enemies.push(add);
      burst(new THREE.Vector3(x, y + .5, 0), 0x39FF14, 8, .05);
    },
    jam(t) { player.jamT = Math.max(player.jamT, t); message("ГЛУШЕНИЕ // DASH И HACK ОТКЛЮЧЕНЫ"); },
    extra(m) { scene.add(m); (en.extras = en.extras || []).push(m); return m; },
    announce(t) { message(t); showZone(t); },
    floorRing(x, color) { impactRing(new THREE.Vector3(x, en.roomFloor + .12, 0), color); },
    clampRoom(x) { return clamp(x, curRT.origin.x + 2, curRT.origin.x + curRT.w - 2); },
    damagePlayer, geyser, beamCross,
    wallAhead(en, dir) {
      for (const s of curRT.solids) {
        if (en.y + 1 <= s.y0 || en.y >= s.y1) continue;
        const fx = en.x + dir * .8;
        if (dir > 0 ? (fx + .4 > s.x0 && en.x + .4 <= s.x0 + .01) : (fx - .4 < s.x1 && en.x - .4 >= s.x1 - .01)) return true;
      }
      return false;
    },
  };
}
function pushOutFlyer(e) {
  const cx = e.x, cy = e.y + 0.45;
  for (const s of curRT.solids) {
    if (s.kind === "mover" || s.mover) continue;
    if (cx > s.x0 - .25 && cx < s.x1 + .25 && cy > s.y0 - .25 && cy < s.y1 + .25) {
      const dl = cx - (s.x0 - .25), dr = (s.x1 + .25) - cx, db = cy - (s.y0 - .25), dtp = (s.y1 + .25) - cy;
      const m = Math.min(dl, dr, db, dtp);
      if (m === dl) e.x = s.x0 - .25; else if (m === dr) e.x = s.x1 + .25; else if (m === db) e.y = s.y0 - .7; else e.y = s.y1 + .25;
      return;
    }
  }
}
function groundAhead(e, dir) {
  const px = e.x + dir * 0.7;
  for (const s of curRT.solids) {
    if (px < s.x0 - .2 || px > s.x1 + .2) continue;
    const top = s.y1;
    if (top <= e.y + 0.3 && top >= e.y - 1.0) return true;
  }
  return false;
}
function enemyAI(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.hit = Math.max(0, e.hit - dt);
    const def = e.def;
    // телеграф-разрешение (честное окно уклонения)
    if (e.telegraphT > 0) {
      e.telegraphT = Math.max(0, e.telegraphT - dt);
      const r = e.g.userData;
      if (r.eye) r.eye.scale.setScalar(1 + (1 - e.telegraphT / .35) * 1.2);
      if (r.core && Math.floor(performance.now() * .02) % 2 === 0) { r.core.material.emissive.setHex(0xff2d78); }
      if (e.telegraphT <= 0) {
        const reach = e.isBoss ? 2.8 : 1.9;
        if (Math.abs(player.x - e.x) < reach && Math.abs(player.y + 1 - (e.y + 1)) < 2.2) damagePlayer(e.telegraphDmg, e.telegraphSrc, e.x);
        else burst(new THREE.Vector3(e.x + Math.sign(player.x - e.x) * .9, e.y + 1, 0), 0x556677, 4, .04);
        if (r.eye) r.eye.scale.setScalar(1);
        if (r.core && e.baseEm !== undefined) { r.core.material.emissive.setHex(e.baseEm); r.core.material.emissiveIntensity = e.baseInt; }
      }
    }
    const ctx = aiCtx(e);
    def.ai(e, dt, ctx);
    if (def.fly && !e.isBoss) pushOutFlyer(e); // летающие не проваливаются в геометрию
    // гравитация и позиция для не-летающих
    if (!def.fly && e.bstate === undefined || (!def.fly && !["air", "fall", "leap", "slam", "intro", "track", "aim", "overheat", "rise"].includes(e.bstate))) {
      if (e.st !== "air" && !e.noGrav) { e.vy = (e.vy || 0) - 24 * dt; e.y += e.vy * dt; let landed = false; for (const s of curRT.solids) { if (e.vy <= 0 && e.x > s.x0 - .3 && e.x < s.x1 + .3 && e.y <= s.y1 + .05 && e.y >= s.y1 - .5) { e.y = s.y1; e.vy = 0; landed = true; break; } } if (!landed && e.y < e.roomFloor) { e.y = e.roomFloor; e.vy = 0; } e.grounded = landed || e.y <= e.roomFloor + .01; }
    }
    // Metroid-практика: патрульные не сваливаются с полок — разворот на кромке
    if (!def.fly && e.grounded && (e.t === "patrol_bot" || (e.t === "chaser_dog" && !e.aggro))) {
      const dir = Math.sign(e.vx || e.dir || 1);
      if (!groundAhead(e, dir)) { e.dir = -dir; e.vx = 0; }
    }
    if (def.fly && e.bstate === undefined) { /* позиция ставится в ai */ }
    e.x += (e.vx || 0) * dt;
    e.x = clamp(e.x, e.roomX0, e.roomX1);
    if (e.bstate === undefined || def.fly) e.g.position.x = e.x;
    if (e.bstate === undefined) e.g.position.y = e.y + (def.fly ? 0 : 0);
    else e.g.position.x = e.x;
    // контактный урон
    if (def.contact !== false && player.inv <= 0) {
      const w = (def.w || .9) * .85, h = (def.h || 1) * .9;   // хитбокс контакта чуть меньше силуэта — честно к игроку
      if (Math.abs(player.x - e.x) < w / 2 + PW && player.y < e.y + h && player.y + PH > e.y + (def.h || 1) * .05) damagePlayer(e.dmg, (def.name || e.t).toUpperCase(), e.x);
    }
    // анимация-минимум: ring/core вращение, hp-бар
    const r = e.g.userData;
    // боссы: визуал не покидает арену (рамки локации) по обеим осям
    if (e.isBoss) {
      e.g.position.x = clamp(e.g.position.x, e.roomX0, e.roomX1);
      e.g.position.y = clamp(e.g.position.y, e.roomFloor - 1.6, e.roomFloor + curRT.h - 3);
    }
    if (r.ring) r.ring.rotation.z += dt * 2.4;
    // ── процедурная анимация частей (rig в userData.parts) ──
    {
      const P = r.parts || {};
      e.animT = (e.animT || 0) + dt * (2 + Math.abs(e.vx || 0) * 1.8);
      const mv = Math.abs(e.vx || 0) > .3;
      if (P.legL) { const c = Math.sin(e.animT * 2) * (mv ? .55 : .06); P.legL.rotation.z = c; P.legR.rotation.z = -c; }
      if (P.wingL) { const f = Math.sin(performance.now() * .02 + e.phase) * .45; P.wingL.rotation.z = .5 + f; P.wingR.rotation.z = -.5 - f; }
      if (P.head) P.head.rotation.z = e.beamAng || 0;
      if (P.shield) P.shield.rotation.z = (e.telegraphT > 0) ? -.5 : -.12;
      if (P.jaw) P.jaw.rotation.z = (e.telegraphT > 0) ? .6 : .12;
      if (P.cannon) P.cannon.position.x = .38 + (e.wind > 0 ? -.14 : 0);
      if (P.dish) P.dish.rotation.y += dt * 5;
      if (P.spring) { const sq = (e.st === "idle" && e.bt < .3) ? .55 : (e.st === "air" ? 1.3 : 1); for (const sp of P.spring) sp.scale.y = sq; }
      if (P.clawL) { const sw = Math.sin(e.animT * 1.5) * .18; P.clawL.rotation.z = .3 + sw; P.clawR.rotation.z = -.3 - sw; }
      if (P.bits) { const a = e.animT * 1.3; P.bits[0].position.set(Math.cos(a) * .8, .8, Math.sin(a) * .4); P.bits[1].position.set(-Math.cos(a) * .8, .8, -Math.sin(a) * .4); }
      if (e.def.kind === "cloak" && r.core) r.core.rotation.z = Math.sin(e.animT) * .07;
      if (!e.isBoss) { const bs = e.baseScale || 1, sq = e.squash || 0, st = e.stretch || 0; e.g.scale.set(bs * (1 + .16 * sq - .10 * st), bs * (1 - .22 * sq + .18 * st), bs * (1 + .16 * sq - .10 * st)); }
    }
    if (r.core && e.hit > 0) { r.core.material.emissive.setHex(0xffffff); }
    else if (r.core && e.baseEm !== undefined && e.telegraphT <= 0) { r.core.material.emissive.setHex(e.baseEm); r.core.material.emissiveIntensity = e.baseInt; }
    if (e.hit > 0 && e.baseEm === undefined && r.core) { e.baseEm = r.core.material.emissive.getHex(); e.baseInt = r.core.material.emissiveIntensity; }
    if (r.fill) r.fill.scale.x = Math.max(0, e.hp / e.max);
  }
}

// ── муверы/фаза/конвейеры/анимации комнаты ──
function updateRoomAnimated(dt) {
  const now = performance.now() * 0.001;
  const o = curRT.origin;
  for (const a of curRT.animated) {
    if (a.kind === "mover") {
      const m = a.rec; m.tT += dt;
      const per = m.period || 4;
      if (m.t === "phase") {
        const on = (m.tT % per) < per * 0.62;
        m.solidNow = on; m.mesh.visible = on;
        const [px, py] = m.path[0];
        m.dx = 0; m.dy = 0;
        m.rect = { x0: o.x + px, y0: o.y + py - 0.3, x1: o.x + px + m.w, y1: o.y + py, kind: "mover", mover: m };
        m.mesh.position.set(o.x + px + m.w / 2, o.y + py - 0.15, 0);
      } else {
        const k = (m.tT % per) / per;
        const tri = k < .5 ? k * 2 : (1 - k) * 2;
        const [ax, ay] = m.path[0], [bx, by] = m.path[1];
        const nx = lerp(ax, bx, tri), ny = lerp(ay, by, tri);
        m.dx = nx - (m.cx ?? nx); m.dy = ny - (m.cy ?? ny);
        m.cx = nx; m.cy = ny;
        m.rect = { x0: o.x + nx, y0: o.y + ny - 0.3, x1: o.x + nx + m.w, y1: o.y + ny, kind: "mover", mover: m };
        m.mesh.position.set(o.x + nx + m.w / 2, o.y + ny - 0.15, 0);
      }
    }
    else if (a.kind === "acid") { a.mesh.position.y = a.y0 + Math.sin(now * 1.6 + a.ph) * .05; }
    else if (a.kind === "crusher") {
      const hz = a.rec; const per = hz.period || 3; const t = (now + (hz.phase || 0)) % per;
      const down = t < (hz.on || 1);
      const targetY = down ? o.y + hz.y - hz.h * 1.6 : o.y + hz.y + hz.h / 2;
      hz.crush = down;
      a.mesh.position.y += (targetY - a.mesh.position.y) * Math.min(1, dt * 14);
      hz.y0 = a.mesh.position.y - hz.h / 2; hz.y1 = a.mesh.position.y + hz.h / 2;
      hz.x0 = o.x + hz.x; hz.x1 = o.x + hz.x + hz.w;
    }
    else if (a.kind === "chest") { a.mesh.position.y = a.y0 + .26 + Math.sin(now * 3 + a.ph) * .08; a.mesh.rotation.y += dt * .6; }
    else if (a.kind === "holo") { a.mesh.material.opacity = .6 + Math.sin(now * 6 + a.ph) * .25; }
    else if (a.kind === "barrier") { a.mesh.material.opacity = .45 + Math.sin(now * 4 + a.ph) * .2; }
    else if (a.kind === "liftpad") { if (a.mesh.material.emissiveIntensity !== undefined) a.mesh.material.emissiveIntensity = 2 + Math.sin(now * 3 + a.ph); }
  }
}

// ── главный update: физика игрока, камера, HUD ──
let camX = 0, camY = 6, camLookY = 6;
export function update(dt) {
  if (!started || menuBlocked()) return;
  save.time += dt;
  player.jamT = Math.max(0, player.jamT - dt);
  updateRoomAnimated(dt);
  for (const sd of curRT.secdoors) if (!sd.open && player.ab.hack2) { sd.open = true; if (sd.mesh) sd.mesh.visible = false; sfx.hack?.(); message("SEC-ДВЕРЬ // ВЗЛОМАНА"); }
  // ── ввод движения ──
  let ax = (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0);
  player.face = ax || player.face;
  const ladder = isOnLadder(player.x, player.y);
  player.onLadder = !!ladder;
  const wantUp = !!(keys.KeyW || keys.ArrowUp), wantDown = !!(keys.KeyS || keys.ArrowDown);
  let didDrop = false;
  if (player.jbuf > 0 && player.ground && wantDown && keys.Space && player.dropT <= 0.001) { player.dropT = .28; player.vy = -2; player.ground = false; player.jbuf = 0; player.coyote = 0; didDrop = true; }
  player.jbuf = Math.max(0, player.jbuf - dt);
  player.coyote = player.ground ? .12 : Math.max(0, player.coyote - dt);
  if (!didDrop) {
    if (player.jbuf > 0 && player.coyote > 0) { player.vy = 11.8; player.jbuf = 0; player.coyote = 0; player.doubleJumpUsed = false; burst(new THREE.Vector3(player.x, player.y, 0), 0x62f6ff, 6, .045); sfx.jump?.(); }
    else if (player.jbuf > 0 && player.ab.servo && !player.ground && !player.doubleJumpUsed && !player.climbing) { player.vy = 10.5; player.jbuf = 0; player.doubleJumpUsed = true; burst(new THREE.Vector3(player.x, player.y, 0), 0xFFE66D, 10, .05); sfx.dbljump?.(); }
    else if (player.jbuf > 0 && !player.ground && player.ab.wall && !player.climbing) {
      const wd = wallTouchDir();
      if (wd !== 0) { player.vy = 11.5; player.vx = wd * 9; player.face = wd; player.jbuf = 0; player.coyote = 0; player.doubleJumpUsed = false; burst(new THREE.Vector3(player.x - wd * .4, player.y + .8, 0), 0x39FF14, 10, .05); sfx.dbljump?.(); }
    }
  }
  if (player.ground) player.doubleJumpUsed = false;
  player.climbing = !didDrop && player.onLadder && (wantUp || wantDown);
  // ── FOCUS (SOUL→HP) ──
  {
    const canFocus = player.ground && !player.climbing && player.attack <= 0 && player.dash <= 0 && player.hack <= 0 && !shopOpen && player.hp < player.maxHp && player.ram >= FOCUS_COST && ax === 0 && player.jbuf <= 0;
    const wantFocus = !!keys.KeyF && canFocus;
    if (wantFocus) {
      if (!player.focusing) { player.focusing = true; player.focusT = 0; player.focusStep = 0; }
      player.focusT += dt;
      player.vx = lerp(player.vx, 0, dt * 18);
      if (player.focusT >= FOCUS_TIME) {
        player.focusT -= FOCUS_TIME;
        const healed = Math.round(Math.min(FOCUS_HEAL, player.maxHp - player.hp));
        player.hp += healed; player.ram = clamp(player.ram - FOCUS_COST, 0, 100);
        popup("+" + healed + " HP", true); burst(new THREE.Vector3(player.x, player.y + 1, 0), 0xEAFBFF, 18, .06); sfx.heal?.(); postFlash(.08, 0xEAFBFF);
        if (player.ram < FOCUS_COST || player.hp >= player.maxHp) { player.focusing = false; player.focusT = 0; }
      }
    } else if (player.focusing) { player.focusing = false; player.focusT = 0; }
    if (player.focusing) ax = 0;
  }
  // ── dash / движение / гравитация ──
  if (player.dash > 0) player.dash -= dt;
  else if (player.climbing) {
    player.vx = lerp(player.vx, ax * 2.2, dt * 10);
    player.vy = (wantUp ? 1 : -1) * player.climbSpeed;
    if (ladder) player.vx += (ladder.x - player.x) * 6 * dt;
  } else {
    let targetVx = ax * 8.2;
    // конвейеры и ветер
    for (const c of curRT.conveyors) if (player.ground && player.x > c.x0 && player.x < c.x1 && Math.abs(player.y - c.y) < .6) targetVx += c.dir * c.power;
    for (const w of curRT.winds) if (player.x > w.x0 && player.x < w.x1 && player.y > w.y0 && player.y < w.y1) { player.vx += w.dx * dt * 2.2; player.vy += (w.dy || 0) * dt * 2.2; }
    player.vx = lerp(player.vx, targetVx, player.ground ? dt * 14 : dt * 9);
    const nearApex = player.vy > 0 && player.vy < 3.2;
    const fastFall = wantDown && player.vy < 0;
    let grav = 24; if (nearApex) grav *= .5; if (fastFall) grav *= 1.7;
    player.vy -= grav * dt;
    const wd = wallTouchDir();
    player.wallSliding = false;
    if (!player.ground && wd !== 0 && player.ab.wall && player.vy < 0) { player.vy = Math.max(player.vy, -2.6); player.wallSliding = true; }
    if (!(keys.Space || keys.ArrowUp) && player.vy > 2) player.vy -= 12 * dt;
    if (player.vy < -26) player.vy = -26;
  }
  player.attackCd = Math.max(0, player.attackCd - dt); player.dashCd = Math.max(0, player.dashCd - dt);
  player.attack = Math.max(0, player.attack - dt); player.hack = Math.max(0, player.hack - dt); player.inv = Math.max(0, player.inv - dt);
  player.dropT = Math.max(0, player.dropT - dt);
  player.knockT = Math.max(0, player.knockT - dt);
  if (player.dash > 0) { player.trailT = (player.trailT || 0) - dt; if (player.trailT <= 0) { player.trailT = .04; ghostTrail(new THREE.Vector3(player.x, player.y, .12), player.face, 0x62f6ff, 1.9); } }
  // ── интегрирование + коллизии + перенос мувером ──
  player.prevX = player.x; player.prevY = player.y;
  if (player.groundMover) { player.x += player.groundMover.dx || 0; player.y += player.groundMover.dy || 0; }
  player.wallHit = false;
  resolveX(player.vx * dt);
  resolveY(player.vy * dt);
  if (player.climbing) player.ground = false;
  // ── хазарды ──
  player.hazardT = Math.max(0, player.hazardT - dt);
  for (const hz of curRT.hazards) {
    if (hz.t === "crusher" && !hz.crush) continue;
    if (player.x + PW > hz.x0 && player.x - PW < hz.x1 && player.y + PH > hz.y0 && player.y < hz.y1) {
      if (player.hazardT <= 0) { player.hazardT = .7; damagePlayer(hz.dmg || 10, hz.t === "acid" ? "ТОКСИН" : hz.t === "spikes" ? "ШИПЫ" : "ПРЕСС", (hz.x0 + hz.x1) / 2); }
      if (hz.t === "acid") player.vx *= .9;
    }
  }
  // барьеры: упираешься без ФАЗЫ — объясни, где взять (throttled)
  for (const b of curRT.barriers) {
    if (player.ab.phase) continue;
    if (player.x + PW >= b.x0 - 0.1 && player.x - PW <= b.x1 + 0.1 && player.y + PH > b.y0 && player.y < b.y1) {
      if (!b._msgT || performance.now() - b._msgT > 2500) { b._msgT = performance.now(); message(gateMsg("phase")); sfx.denied?.(); }
    }
  }
  // пого-пины: отскок сверху
  for (const p of curRT.pins) {
    if (player.vy < 0 && Math.abs(player.x - p.x) < .8 && player.prevY >= p.y + .4 && player.y <= p.y + .5) {
      player.y = p.y + .5; player.vy = 12.4; player.ground = false; burst(new THREE.Vector3(p.x, p.y + .5, 0), 0xBFF6FF, 10, .05); sfx.pogo?.(); addShake(.15, .1);
    } else if (player.inv <= 0 && Math.abs(player.x - p.x) < .7 && player.y < p.y + .3 && player.y + PH > p.y - .5) { if (player.hazardT <= 0) { player.hazardT = .7; damagePlayer(10, "ПИН", p.x); } }
  }
  // kill-plane комнаты
  if (player.y < curRT.origin.y - 4.5) { message("ОБРЫВ // РЕСПАВН"); respawn("void"); return; }
  // ── двери и лифты-зоны ──
  if (fadeDir === 0) tryDoorTransition();
  // ── бой ──
  hurtEnemies(); enemyAI(dt); updateOrbs(dt); updateFx(dt); updateDebris(dt); // v2.1: эффекты живут и умирают (раньше следы запекались)
  // ── меш игрока и простая анимация рига ──
  player.g.position.set(player.x, player.y, 0);
  player.g.rotation.y = player.face < 0 ? Math.PI : 0;
  player.g.visible = player.inv <= 0 || Math.floor(player.inv * 20) % 2 === 0;
  const rig = player.g.userData; rig.animTime += dt;
  {
    const speed = Math.abs(player.vx); const moving = player.ground && speed > .25; const cycle = rig.animTime * (moving ? 10 : 2.2);
    if (player.attack > 0) {
      const dir = player.attackDir || "side"; const k = 1 - player.attack / ATK_DUR; const ease = 1 - Math.pow(1 - Math.min(1, k / .45), 2);
      rig.blade.rotation.z = dir === "up" ? -.3 - 2.5 * ease : dir === "down" ? -.3 + 2.0 * ease : -.3 - 1.3 * ease;
      rig.armR.rotation.z = .25 - (dir === "up" ? 2.2 : dir === "down" ? -1.7 : .55) * ease;
    } else {
      rig.blade.rotation.z = -.3;
      if (moving) { const s = Math.sin(cycle); rig.legL.rotation.z = s * .45; rig.legR.rotation.z = -s * .45; rig.armL.rotation.z = -.25 - s * .28; rig.armR.rotation.z = .25 + s * .28; }
      else if (player.climbing) { const cs = Math.sin(rig.animTime * 7); rig.legL.rotation.z = cs * .52; rig.legR.rotation.z = -cs * .52; rig.armL.rotation.z = -.35 - cs * .32; rig.armR.rotation.z = .35 + cs * .32; }
      else if (!player.ground) { rig.legL.rotation.z = -.18; rig.legR.rotation.z = .18; rig.armL.rotation.z = -.55; rig.armR.rotation.z = .55; }
      else { rig.legL.rotation.z = 0; rig.legR.rotation.z = 0; rig.armL.rotation.z = -.25; rig.armR.rotation.z = .25; }
    }
    if (player.focusing) { rig.armR.rotation.z = .55; rig.armL.rotation.z = -.55; rig.blade.rotation.z = .9; }
    if (player.dash > 0) rig.torso.rotation.z = -.14; else rig.torso.rotation.z = moving ? Math.sin(cycle) * .035 : 0;
  }
  // ── камера: clamp к комнате (NES-грамматика) + lookahead ──
  {
    const o = curRT.origin;
    const look = player.face * 1.7 + clamp(player.vx * .16, -2.2, 2.2);
    const lookY = clamp(player.vy * .3, -2.6, 2.6);
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 24;
    const vw = vh * camera.aspect;
    let tx = player.x + look, ty = player.y + 2.4 + lookY;
    tx = o.x + curRT.w / 2 + clamp(tx - (o.x + curRT.w / 2), -Math.max(0, curRT.w / 2 - vw / 2), Math.max(0, curRT.w / 2 - vw / 2));
    ty = o.y + curRT.h / 2 + clamp(ty - (o.y + curRT.h / 2), -Math.max(0, curRT.h / 2 - vh / 2), Math.max(0, curRT.h / 2 - vh / 2));
    camX = lerp(camX, tx, 1 - Math.pow(.05, dt)); camY = lerp(camY, ty, 1 - Math.pow(.02, dt));
    camLookY = lerp(camLookY, player.y + 1.5 + lookY, 1 - Math.pow(.02, dt));
    const so = shakeOffset();
    camera.position.set(camX + (so ? so.x : 0), camY + (so ? so.y : 0), 24);
    camera.lookAt(camX, camLookY, 0);
    updateShake(dt); updateLights(camX, camY, dt); updateParallax(camX, camY);
    const tgtFov = 55 + (player.dash > 0 ? 2.6 : 0) + (player.focusing ? -1.6 : 0);
    if (Math.abs(camera.fov - tgtFov) > .02) { camera.fov = lerp(camera.fov, tgtFov, 1 - Math.pow(.001, dt)); camera.updateProjectionMatrix(); }
  }
  // ── HUD ─
  {
    const hpPct = Math.round(clamp(player.hp / player.maxHp * 100, 0, 100));
    if (hpPct !== _hud.hp) { _hud.hp = hpPct; const el = document.getElementById("hp"); if (el) el.style.width = hpPct + "%"; }
    const ramI = Math.floor(player.ram);
    if (ramI !== _hud.ram) { _hud.ram = ramI; const el = document.getElementById("ram"); if (el) el.textContent = ramI; const pill = el && el.parentElement; if (pill && pill.classList) pill.classList.toggle("full", player.ram >= FOCUS_COST); }
    if (save.eddies !== _hud.edd) { _hud.edd = save.eddies; const el = document.getElementById("shards"); if (el) el.textContent = save.eddies; }
    if (save.cores.length !== _hud.cores) { _hud.cores = save.cores.length; const el = document.getElementById("eddies"); if (el) el.textContent = save.cores.length + "/3"; }
    const abKey = ["servo","wall","hack2","phase"].filter(k => save.abilities[k]).join("");
    if (abKey !== _hud.ab) { _hud.ab = abKey; const el = document.getElementById("abs"); if (el) el.innerHTML = ["servo","wall","hack2","phase"].filter(k => save.abilities[k]).map(k => `<span class="pill" style="border-color:${k==="phase"?"#7A4CFF":k==="wall"?"#39FF14":k==="hack2"?"#FF164F":"#FFE66D"}">${{servo:"СЕРВО",wall:"ЦЕП",hack2:"ВЗЛОМ",phase:"ФАЗА"}[k]}</span>`).join(""); }
    let b = enemies.find(e => e.isBoss && !e.dead);
    const nearBoss = !!b;
    const bw = nearBoss ? Math.round(clamp(b.hp / b.max * 100, 0, 100)) : -1;
    if (bw !== _hud.boss) { _hud.boss = bw; const bb = document.getElementById("boss"); if (bb) { bb.style.display = nearBoss ? "block" : "none"; if (b) { bb.querySelector(".bossname").textContent = (b.bossName || b.t).toUpperCase(); } } const bf = document.getElementById("bossfill"); if (bf) bf.style.width = Math.max(0, bw) + "%"; }
    const lowHp = player.hp > 0 && player.hp <= player.maxHp * .25;
    if (lowHp !== _hud.low) { _hud.low = lowHp; const v = document.getElementById("vignette"); if (v && v.classList) v.classList.toggle("lowhp", lowHp); }
    const fb = document.getElementById("focusBar");
    if (fb) { if (player.focusing) { fb.style.display = "block"; const ff = document.getElementById("focusFill"); if (ff) ff.style.width = Math.round(clamp(player.focusT / FOCUS_TIME * 100, 0, 100)) + "%"; } else fb.style.display = "none"; }
    document.body.classList.toggle("jammed", player.jamT > 0);
  }
  // hint
  {
    let h = "WASD — движение · SPACE — прыжок · J — удар (S+J пого · W+J вверх) · K — dash · F — ФОКУС · L — хак · E — взять · TAB — карта";
    const sv = nearestItem("save", 2.2); const ch = nearestItem("chest", 2.2); const sh = nearestItem("shop", 2.6);
    if (sv) h = "E — ТЕРМИНАЛ: сохранить и восстановиться";
    else if (ch) h = "E — ОТКРЫТЬ СУНДУК";
    else if (sh) h = "E — МАГАЗИН [1] HP [2] DMG [ESC] закрыть";
    const el = document.getElementById("hint"); if (el && el.textContent !== h) el.textContent = h;
  }
  mapuiDraw();
  dbgUpdate(dt);
}

// ── переход-фейд ──
function updateFade(dt) {
  if (fadeDir === 1) { levelFade += dt * 7; if (levelFade >= 1) { levelFade = 1; commitTransition(); fadeDir = -1; } }
  else if (fadeDir === -1) { levelFade -= dt * 5; if (levelFade <= 0) { levelFade = 0; fadeDir = 0; } }
  const f = document.getElementById("screenFade");
  if (f) f.style.opacity = String(levelFade * .9);
}

// ── ending ──
function showEnding() {
  const el = document.getElementById("ending"); if (!el) return;
  el.style.display = "flex";
  const st = document.getElementById("endingStats");
  if (st) st.innerHTML = `КОРЫ ${save.cores.length}/3 · EDDIES ${save.eddies} · ВРЕМЯ ${Math.round(save.time)}с · КОМНАТ ${Object.keys(save.visited).length}/${ROOMS.length}<br><span style="color:#8BE9FF">ENTER — рестарт · F9 — сброс</span>`;
  saveGame();
}

// ── цикл ──
let last = performance.now(), _acc = 0; const FIXED = 1 / 60;
let perfMode = 1, _fpsAcc = 0, _fpsN = 0, _fps = 60;
export function setPerfMode(m, silent) {
  perfMode = m ? 1 : 0;
  setBloomEnabled(perfMode === 0);
  setLookQuality(perfMode === 0); // читаемая картинка в bloom: экспозиция/свет выше, bloom мягче
  try { setBloomStrength(perfMode === 0 ? 0.65 : 1.0); } catch (e) {}
  if (!silent) message(perfMode ? "PERF // bloom off (P — качество)" : "QUALITY // bloom on, мягкий свет");
}
let _rafPending = false;
function scheduleLoop() { if (_rafPending) return; _rafPending = true; requestAnimationFrame(t => { _rafPending = false; loop(t); }); }
let _loopErrs = 0;
function loop(now) {
  try {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (menuBlocked() && menu.state !== "play") { /* меню рендерится на 30Гц */ loopSkip = !loopSkip; if (!loopSkip) { renderFrame(scene, camera, dt); } }
    else if (ecoPresent && started) { _ecoSkip = !_ecoSkip; if (!_ecoSkip) { _acc += dt; let n = 0; while (_acc >= FIXED && n < 4) { update(FIXED); _acc -= FIXED; n++; } if (_acc > FIXED * 4) _acc = 0; updateFade(dt); decayFlash(dt); renderFrame(scene, camera, dt); } else { _acc += dt; let n = 0; while (_acc >= FIXED && n < 4) { update(FIXED); _acc -= FIXED; n++; } if (_acc > FIXED * 4) _acc = 0; } }
    else {
      _acc += dt; let n = 0;
      while (_acc >= FIXED && n < 4) { update(FIXED); _acc -= FIXED; n++; }
      if (_acc > FIXED * 4) _acc = 0;
      updateFade(dt);
      decayFlash(dt);
      renderFrame(scene, camera, dt);
    }
    _fpsAcc += dt; _fpsN++;
    if (_fpsAcc >= 1) { _fps = _fpsN / _fpsAcc; _fpsAcc = 0; _fpsN = 0; if (started && !menuBlocked()) { if (_fps < 40 && perfMode === 0 && !_autoPerf) { _autoPerf = true; setPerfMode(1, true); showZone("PERF MODE // АВТО"); } } }
  } catch (err) {
    _loopErrs++;
    if (_loopErrs <= 3) postOverlay("LOOP ERROR #" + _loopErrs + "\n" + (err && err.stack ? err.stack.split("\n").slice(0, 4).join("\n") : String(err)));
  } finally { scheduleLoop(); }
}
let loopSkip = false, _autoPerf = false;
setPerfMode(softwareGLProbe() ? 1 : 0, true); // software-GL: perf; hardware: сразу quality с мягким светом
// COMPAT (наследие v1): software-GL стеки упираются в fillrate → eco-present: scale 0.6 + 30Hz
function softwareGLProbe() { try { const gl = renderer.getContext(); const dbg = gl.getExtension("WEBGL_debug_renderer_info"); return /SwiftShader|SwANGLE|llvmpipe|Basic Render|Software|WARP/i.test(String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))); } catch (e) { return true; } }
const glInfo = (() => { try { const gl = renderer.getContext(); const dbg = gl.getExtension("WEBGL_debug_renderer_info"); return String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { return ""; } })();
const softwareGL = /SwiftShader|SwANGLE|llvmpipe|Basic Render|Software|WARP/i.test(glInfo);
// eco: прячем средний parallax-слой (draw-calls) — дальние слоны остаются для силуэта
if (softwareGL) { try { parallaxMid.visible = false; parallaxFar.visible = false; parallaxUltraFar.visible = false; } catch (e) {} }
let ecoPresent = softwareGL, _ecoSkip = false;
if (ecoPresent) {
  try { renderer.setPixelRatio(0.45); resizePostFx(); } catch (e) {}
  // ECO BAKE (наследие v1): software-GL не тянет PBR-фрагмент с 5 источниками света на каждый пиксель.
  // MeshStandard → MeshBasic с запечённым цветом (albedo*0.45 + emissive*min(1.2, ei*0.6)):
  // неоновая идентичность биомов выживает, фрагмент становится копеечным.
  try {
    const cache = new Map();
    scene.traverse(o => {
      if (!o.isMesh || !o.material || o.material.type !== "MeshStandardMaterial") return;
      const m = o.material;
      let bm = cache.get(m.uuid);
      if (!bm) {
        const c = m.color.clone().multiplyScalar(0.45);
        const e = m.emissive.clone().multiplyScalar(Math.min(1.2, (m.emissiveIntensity || 1) * 0.6));
        const baked = new THREE.Color(Math.min(1, c.r + e.r), Math.min(1, c.g + e.g), Math.min(1, c.b + e.b));
        bm = new THREE.MeshBasicMaterial({ color: baked, transparent: m.transparent, opacity: m.opacity, side: m.side, blending: m.blending, depthWrite: m.depthWrite, wireframe: m.wireframe });
        bm.toneMapped = m.toneMapped;
        cache.set(m.uuid, bm);
      }
      o.material = bm;
    });
  } catch (e) {}
}
scheduleLoop();

// ── клавиши сервиса ──
addEventListener("keydown", e => {
  if (e.code === "F3") { dbgStats = !dbgStats; }
  if (e.code === "KeyP" && !e.repeat && started) setPerfMode(perfMode ? 0 : 1);
  if (e.code === "KeyM" && !e.repeat) toggleMute();
  if (e.code === "F9") { try { localStorage.removeItem(STORAGE_KEY); } catch (e2) {} location.reload(); }
  if (endingShown && e.code === "Enter") { try { localStorage.removeItem(STORAGE_KEY); } catch (e2) {} location.reload(); }
});
let dbgStats = false;
setInterval(() => {
  const el = document.getElementById("message"); if (!el || !dbgStats) return;
  const info = renderer.info.render;
  el.style.opacity = "1";
  el.textContent = `FPS ${Math.round(_fps)} · CALLS ${info.calls} · TRIS ${(info.triangles / 1000).toFixed(0)}k · ROOM ${curRoom} · ${dbgLines()}`;
}, 500);
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); resizePostFx(); });

// ── boot ──
try { menu.saveExists = !!localStorage.getItem(STORAGE_KEY); } catch (e) { menu.saveExists = false; }
try { if (!started) { showSplash(); setTimeout(() => { if (menu.state === "splash") showTitle(); }, 1400); } } catch (e) { started = true; enterGame(false); }
dbgSetPhysGetter(() => `pos ${player.x.toFixed(1)},${player.y.toFixed(1)}\nvel ${player.vx.toFixed(1)},${player.vy.toFixed(1)}\nground ${player.ground} coyote ${player.coyote.toFixed(2)}\nwall ${player.wallSliding ? "SLIDE" : "-"} jam ${player.jamT.toFixed(1)}\nroom ${curRoom} enemies ${enemies.filter(e => !e.dead).length}`);
mapuiInit({ room: () => curRoom, playerPos: () => ({ x: player.x, y: player.y, ox: curRT.origin.x, oy: curRT.origin.y }), save: () => save, goals: () => progressionGoals() });
mapLoadVisitedShim();
function mapLoadVisitedShim() { try { mapLoadVisited(Object.keys(save.visited)); } catch (e) {} }
dbgInit({ getRT: () => curRT, getRoom: () => curRoom, tp: (id) => { const rt = getRT(id); if (!rt) return; setRoomVisible(curRT.id, false); curRT = rt; curRoom = id; setRoomVisible(rt.id, true); setBiomeMood(rt.biome); despawnRoomEnemies(); spawnRoomEnemies(rt); player.x = rt.enter.x; player.y = rt.enter.y + .1; player.vx = 0; player.vy = 0; camX = player.x; camY = player.y + 2.2; if (!save.visited[id]) save.visited[id] = 1; mapDiscover(rt); updateRoomLabel(); }, give: (ab) => { save.abilities[ab] = true; syncAbilities(); saveGame(); message("DEBUG // " + ab), showZone("СПОСОБНОСТЬ // " + ab); }, killall: () => { for (const e of enemies) if (!e.dead && !e.isBoss) killEnemy(e); }, killboss: () => { for (const e of enemies) if (e.isBoss && !e.dead) killEnemy(e); }, clearLocks: () => { save.unlocked = {}; saveGame(); }, showParallax: () => { parallaxUltraFar.visible = true; parallaxFar.visible = true; parallaxMid.visible = true; }, cancelFade: () => { fadeDir = 0; levelFade = 0; pendingRoom = null; pendingSpawn = null; try { const f = document.getElementById("screenFade"); if (f) f.style.opacity = "0"; } catch (e) {} }, bfs: () => bfsProgression(), edges: () => buildEdges(), save: () => save, fps: () => _fps });
export { enemies, orbs, save };
export const boot = { rooms: ROOMS.length, ok: true };
try { window.__KEYS = keys; window.__GAME__ = { player, enemies, get save() { return save; }, get room() { return curRoom; }, get orbs() { return orbs; }, get fxCount() { return fxList.length; }, gapAhead: () => { const px = player.x + Math.sign(player.face || 1) * 1.1; for (const s2 of activeSolids()) { if (px < s2.x0 - .2 || px > s2.x1 + .2) continue; const top = s2.y1; if (top <= player.y + 0.35 && top >= player.y - 0.9) return false; } return true; }, get sceneChildren() { return scene.children.length; }, tp: (id) => window.__DBG?.tp(id), roomInfo: (id) => { const rt = getRT(id); return { ox: rt.origin.x, oy: rt.origin.y, F: holeFloorOf(rt, 20), w: rt.w, h: rt.h, ladders: rt.ladders.map(l => ({ x: l.x - rt.origin.x, y0: l.y0 - rt.origin.y, y1: l.y1 - rt.origin.y })) }; } }; } catch (e) {}
// diag hook for headless tests
try {
  window.__GAME__ = window.__GAME__ || {};
  window.__GAME__.diag = () => {
    const lights = [];
    scene.traverse(o => { if (o.isLight) lights.push({ t: o.type, i: +o.intensity.toFixed(2), c: o.color?.getHexString() }); });
    const rt = curRT;
    const sample = rt.solids[0];
    return {
      lights, biome: rt.biome, room: curRoom,
      mat: sample.mesh.material.type, color: sample.mesh.material.color.getHexString(), emissive: sample.mesh.material.emissive?.getHexString(),
      camPos: [ +camera.position.x.toFixed(1), +camera.position.y.toFixed(1), +camera.position.z.toFixed(1) ],
      fog: scene.fog.color.getHexString() + " " + scene.fog.near + ".." + scene.fog.far,
      vis: rt.group.visible, children: rt.group.children.length,
      exposure: renderer.toneMappingExposure, toneMapping: renderer.toneMapping,
      bloom: postfxEnabled(),
    };
  };
} catch (e) {}
