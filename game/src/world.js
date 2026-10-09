// world.js v2 — сцена, рендер, свет, материалы, biome-mood, parallax-рецепты, API чанков.
// Уровень-данных здесь НЕТ: геометрию строит levelbuild.js через addRoomChunk()/setRoomVisible().
import * as THREE from "three";
import { BIOMES } from "./biomes.js";

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0F1419);
scene.fog = new THREE.Fog(0x0F1419, 20, 52);
export const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 10, 24);
export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false, desynchronized: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xFFE8C8, 0x1A2430, 1.25); scene.add(hemi);
const key = new THREE.DirectionalLight(0xFFC68A, 1.6); key.position.set(-8, 18, 10); scene.add(key);
const rim = new THREE.DirectionalLight(0x1FA8C9, 0.6); rim.position.set(8, 12, -10); scene.add(rim);
export const moodLights = { hemi, key, rim };

// ── 2 динамических неон-光源 (как в v1: фиксированное число источников = без рекомпиляций шейдеров) ──
export const neonLights = [];
const neonDefs = [];
function lightDef(c, i, p, d = 35) { const def = { c, i, p, d }; neonDefs.push(def); return def; }
const moverA = new THREE.PointLight(0xffffff, 0, 40, 2); moverA.decay = 2; scene.add(moverA);
const moverB = new THREE.PointLight(0xffffff, 0, 40, 2); moverB.decay = 2; scene.add(moverB);
neonLights.push(moverA, moverB);
let _ltA = null, _ltB = null, _lightTick = 0;
function assignMover(m, def) { m.position.set(def.p[0], def.p[1], def.p[2]); m.color.setHex(def.c); m.distance = def.d; m.intensity = 0.0001; m.userData.ti = def.i; }
export function updateLights(camX, camY, dt) {
  _lightTick -= dt;
  if (_lightTick <= 0) {
    _lightTick = 0.25;
    let bA = null, bB = null, dA = 1e9, dB = 1e9;
    for (const def of neonDefs) {
      const dx = Math.abs(def.p[0] - camX) + Math.abs(def.p[1] - camY) * 0.5;
      if (dx > 46) continue;
      if (dx < dA) { bB = bA; dB = dA; bA = def; dA = dx; }
      else if (dx < dB && def !== bA) { bB = def; dB = dx; }
    }
    if (bA !== _ltA) { _ltA = bA; if (bA) assignMover(moverA, bA); else moverA.userData.ti = 0; }
    if (bB !== _ltB) { _ltB = bB; if (bB) assignMover(moverB, bB); else moverB.userData.ti = 0; }
  }
  const k = Math.min(1, dt * 6);
  moverA.intensity += ((moverA.userData.ti || 0) - moverA.intensity) * k;
  moverB.intensity += ((moverB.userData.ti || 0) - moverB.intensity) * k;
}
export function registerNeonLight(c, i, x, y, d = 30) { lightDef(c, i, [x, y, 4], d); }
export function clearNeonDefs() { neonDefs.length = 0; }

// ── материалы (база + биомные наборы создаёт biomes.js через makeBiomeMaterials) ──
export const mats = {
  dark: new THREE.MeshStandardMaterial({ color: 0x0B141C, roughness: .92, metalness: .06 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x2A3A4A, roughness: .78, metalness: .07 }),
  hazard: new THREE.MeshStandardMaterial({ color: 0x300615, emissive: 0xFF164F, emissiveIntensity: 2.8, transparent: true, opacity: .82, roughness: .35 }),
};
export function box(parent, x, y, z, sx, sy, sz, m) { const q = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); q.position.set(x, y, z); parent.add(q); return q; }

// ── parallax: 3 слоя-группы; контент слоёв строится под биом (buildParallax(biomeId)) ──
export const parallaxUltraFar = new THREE.Group(); scene.add(parallaxUltraFar);
export const parallaxFar = new THREE.Group(); scene.add(parallaxFar);
export const parallaxMid = new THREE.Group(); scene.add(parallaxMid);
export function updateParallax(camX, camY = 0) {
  parallaxUltraFar.position.x = camX * 0.15;
  parallaxFar.position.x = camX * 0.3;
  parallaxMid.position.x = camX * 0.6;
  // вертикаль: слои почти следуют за камерой (k≈1 = «далеко»), лёгкий сдвиг даёт глубину;
  // без этого skyline жил только в верхних рядах карты (абсолютные y контента)
  parallaxUltraFar.position.y = camY * 0.98;
  parallaxFar.position.y = camY * 0.96;
  parallaxMid.position.y = camY * 0.93;
}
const parallaxCache = new Map();
export function buildParallax(biomeId) {
  if (parallaxCache.has(biomeId)) return parallaxCache.get(biomeId);
  const B = BIOMES[biomeId];
  const g = { uf: new THREE.Group(), f: new THREE.Group(), m: new THREE.Group() };
  const rnd = mulberry(biomeId.length * 7919 + biomeId.charCodeAt(0) * 131);
  const span = 560, x0 = -140, Y0 = -14; // базовая линия силуэтов = низ комнаты (камера ±12)
  const bx = (parent, x, y, z, sx, sy, sz, m) => box(parent, x, y + Y0, z, sx, sy, sz, m); // обёртка с offset для декора биомов
  for (let i = x0; i < span; i += 14) {
    const h = 26 + rnd() * 14 + (i % 28 === 0 ? 5 : 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(5.5 + rnd() * 5, h, 2.2), B.parallax.ufMat);
    m.position.set(i + rnd() * 2 - 1, Y0 + h / 2, -20); g.uf.add(m);
  }
  for (let i = x0; i < span; i += 9) {
    const h = 14 + rnd() * 14 + (i % 27 === 0 ? 9 : 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(3.5 + rnd() * 4, h, 1.8), B.parallax.fMat);
    m.position.set(i + rnd() * 3 - 1.5, Y0 + h / 2, -14); g.f.add(m);
    if (i % 18 === 0) { const w = box(g.f, i, Y0 + h * 0.52, -13.05, 1.2, 0.08, 0.08, B.parallax.trimMat); w.material.toneMapped = false; }
  }
  // mid-слой: сил-элементы биома (трубы/панели/деревья/колонны…)
  for (let i = x0; i < span; i += 7) {
    const h = 10 + rnd() * 12;
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.5 + rnd() * 4, h, 1.6), B.parallax.mMat);
    m.position.set(i + rnd() * 2 - 1, Y0 + h / 2, -8); g.m.add(m);
    if (B.parallax.midExtra) B.parallax.midExtra(g.m, i, h, rnd, bx);
  }
  for (const grp of [g.uf, g.f, g.m]) grp.traverse(o => { if (o.material) o.material.fog = false; });
  parallaxCache.set(biomeId, g);
  return g;
}
let curParallax = null;
export function setParallax(biomeId) {
  const g = buildParallax(biomeId);
  if (curParallax === g) return;
  if (curParallax) { parallaxUltraFar.remove(curParallax.uf); parallaxFar.remove(curParallax.f); parallaxMid.remove(curParallax.m); }
  curParallax = g;
  // контент биома живёт ВНУТРИ слоёв-носителей: updateParallax (x-факторы + y-follow) и eco-видимость применяются к нему
  parallaxUltraFar.add(g.uf); parallaxFar.add(g.f); parallaxMid.add(g.m);
}
function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ── biome mood: fog/background/light tint при входе в комнату биома ──
let curBiome = null;
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
export function setBiomeMood(biomeId) {
  if (curBiome === biomeId) return;
  curBiome = biomeId;
  const B = BIOMES[biomeId];
  _c1.setHex(B.fog); scene.fog.color.copy(_c1); scene.background.copy(_c1);
  scene.fog.near = B.fogNear ?? 20; scene.fog.far = B.fogFar ?? 52;
  hemi.color.setHex(B.hemiSky); hemi.intensity = B.hemiI ?? 0.9;
  key.color.setHex(B.keyColor); key.intensity = B.keyI ?? 1.1;
  rim.color.setHex(B.rimColor); rim.intensity = B.rimI ?? 0.35;
  setParallax(biomeId);
  document.documentElement.style.setProperty("--ui-accent", B.uiAccent);
}
export function currentBiome() { return curBiome; }
// LOOK PASS: в quality(bloom) поднимаем экспозицию и заполняющий свет — читается вся сцена, а не только неон
export function setLookQuality(q) {
  renderer.toneMappingExposure = q ? 1.34 : 1.1;
  hemi.intensity = q ? 1.75 : 1.25;
  key.intensity = q ? 2.1 : 1.6;
  rim.intensity = q ? 0.9 : 0.6;
}

// ── room chunks: levelbuild регистрирует группы; видимостью управляет main ──
export const roomChunks = new Map(); // roomId -> {group, animated:[]}
export function registerRoomChunk(roomId, group, animated) { roomChunks.set(roomId, { group, animated }); scene.add(group); group.visible = false; }
export function setRoomVisible(roomId, on) { const c = roomChunks.get(roomId); if (c) c.group.visible = !!on; }
