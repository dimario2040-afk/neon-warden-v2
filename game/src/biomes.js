// biomes.js — визуальные паспорта 6 локаций: палитра, туман, свет, материалы, parallax-рецепт,
// UI-оттенок и звуковой муд. Данные → world.js/levelbuild.js; без игровой логики.
import * as THREE from "three";

function std(o) { return new THREE.MeshStandardMaterial(o); }
// body() — driver-independent silhouette: emissive = albedo*ei читается даже при мёртвом освещении
// (кейс v1: software-GL стеки роняли PBR-свет в чёрный). На здоровом GPU свет ложится сверху.
function body(o) { const m = new THREE.MeshStandardMaterial(o); m.emissive = new THREE.Color(o.color); m.emissiveIntensity = o.ei ?? 0.5; return m; }
function glowMat(hex, i = 3) { const m = std({ color: 0x0a0a12, emissive: hex, emissiveIntensity: i, roughness: .3, metalness: .5 }); m.toneMapped = false; return m; }

const neonTrim = (g, i, h, rnd, box) => { // голограммы-билборды и неон-вывески
  if (i % 21 === 0) { const b = box(g, i, h - 3, -7.1, 3.4, 2.2, 0.1, new THREE.MeshBasicMaterial({ color: 0xFF2D78, transparent: true, opacity: .28, toneMapped: false })); b.rotation.y = 0.0; }
  if (i % 14 === 0) { const s = box(g, i + 1, h - 1.4, -7.05, 1.6, 0.07, 0.07, glowMat(0x00F5FF, 2.6)); }
};
const promTrim = (g, i, h, rnd, box) => { // паровые трубы + искры-огни
  if (i % 14 === 0) { const p = box(g, i, h - 2.5, -7.1, 5.5, 0.7, 0.7, std({ color: 0x3A2A18, roughness: .6, metalness: .7 })); }
  if (i % 28 === 0) { const s = box(g, i, h - 0.6, -7.05, 0.5, 0.5, 0.5, glowMat(0xFF8C1A, 3.4)); }
};
const megaTrim = (g, i, h, rnd, box) => { // рекламные полотна мегабашни
  if (i % 21 === 0) { const b = box(g, i, h - 5, -7.1, 4.2, 5.5, 0.1, new THREE.MeshBasicMaterial({ color: 0x7A4CFF, transparent: true, opacity: .22, toneMapped: false })); }
  if (i % 7 === 0) { const w = box(g, i, h - 2, -7.05, 0.8, 0.5, 0.06, glowMat(0xFFD700, 2.2)); }
};
const stokiTrim = (g, i, h, rnd, box) => { // трубы стоков +_bio-люминесценция
  if (i % 14 === 0) { const p = box(g, i, h - 3, -7.1, 6.5, 1.0, 1.0, std({ color: 0x14241A, roughness: .5, metalness: .4 })); }
  if (i % 21 === 0) { const s = box(g, i, h - 1.2, -7.05, 0.9, 0.12, 0.12, glowMat(0x39FF14, 2.8)); }
};
const pustoTrim = (g, i, h, rnd, box) => { // солнечные панели и остовы машин
  if (i % 21 === 0) { const p = box(g, i, h - 2, -7.1, 4.5, 0.14, 2.2, std({ color: 0x1A2230, roughness: .25, metalness: .8 })); p.rotation.x = -0.5; }
  if (i % 35 === 0) { const c = box(g, i, 0.6, -7.2, 3.2, 1.1, 1.4, std({ color: 0x4A3A28, roughness: .9, metalness: .3 })); }
};
const setTrim = (g, i, h, rnd, box) => { // wireframe-сетки: тонкие светящиеся рейки
  if (i % 7 === 0) { const w = box(g, i, h - 2 - rnd() * 6, -7.1, 0.06, 6 + rnd() * 6, 0.06, glowMat(0xFF2D78, 2.0)); }
  if (i % 11 === 0) { const w = box(g, i, h - 4, -7.15, 5, 0.06, 0.06, glowMat(0x00F5FF, 2.0)); }
};

export const BIOMES = {
  neon: {
    name: "НЕОН-СИТИ", role: "стартовая зона: учит базе, даёт СЕРВО-ПРЫЖОК",
    fog: 0x050810, fogNear: 18, fogFar: 46, hemiSky: 0x9FC8FF, hemiI: 0.75, keyColor: 0xBFD8FF, keyI: 0.8, rimColor: 0xFF2D78, rimI: 0.5,
    uiAccent: "#00F5FF", mood: "base",
    platMat: () => body({ color: 0x46586C, roughness: .35, metalness: .25, emissive: 0x0A1420, emissiveIntensity: .5 }), // мокрый асфальт
    edgeMats: () => [glowMat(0x00F5FF, 3.2), glowMat(0xFF2D78, 3.0)],
    wallMat: () => body({ color: 0x2C3A48, roughness: .8, metalness: .1 }),
    parallax: { ufMat: std({ color: 0x1A1030, emissive: 0x2A1A4A, emissiveIntensity: .5 }), fMat: std({ color: 0x141A2E, emissive: 0x1A2440, emissiveIntensity: .65 }), mMat: std({ color: 0x0E1622, roughness: .6, metalness: .3 }), trimMat: glowMat(0xFF8C1A, 1.6), midExtra: neonTrim },
    rain: true,
  },
  prom: {
    name: "ПРОМЗОНА «ЦЕХ 7»", role: "конвейеры и прессы: даёт ВОЕННЫЙ ВЗЛОМ + КОР-1",
    fog: 0x140C06, fogNear: 16, fogFar: 42, hemiSky: 0xFFD9A0, hemiI: 0.85, keyColor: 0xFF8C1A, keyI: 1.25, rimColor: 0xFF3A1A, rimI: 0.4,
    uiAccent: "#FF8C1A", mood: "stanciya",
    platMat: () => body({ color: 0x6A4A2E, roughness: .68, metalness: .35, emissive: 0x1A0E04, emissiveIntensity: .5 }), // ржавчина
    edgeMats: () => [glowMat(0xFF8C1A, 3.0), glowMat(0xFFD700, 2.6)],
    wallMat: () => body({ color: 0x4A3626, roughness: .8, metalness: .25 }),
    parallax: { ufMat: std({ color: 0x2A1A10, emissive: 0x3A2410, emissiveIntensity: .45 }), fMat: std({ color: 0x241810, emissive: 0x302010, emissiveIntensity: .6 }), mMat: std({ color: 0x1E1410, roughness: .7, metalness: .5 }), trimMat: glowMat(0xFF8C1A, 1.8), midExtra: promTrim },
    steam: true,
  },
  mega: {
    name: "МЕГАБАШНЯ «АРКОЛОГИЯ»", role: "вертикальный неф и лифты: даёт МАГНИТ-ЦЕП",
    fog: 0x0A0818, fogNear: 20, fogFar: 55, hemiSky: 0xE8D8FF, hemiI: 0.8, keyColor: 0xC8B8FF, keyI: 0.9, rimColor: 0x7A4CFF, rimI: 0.55,
    uiAccent: "#7A4CFF", mood: "kristall",
    platMat: () => body({ color: 0x505A74, roughness: .3, metalness: .35, emissive: 0x101428, emissiveIntensity: .5 }), // стекло/сталь
    edgeMats: () => [glowMat(0x7A4CFF, 3.0), glowMat(0xFFD700, 2.8)],
    wallMat: () => body({ color: 0x343A50, roughness: .5, metalness: .35 }),
    parallax: { ufMat: std({ color: 0x201436, emissive: 0x2A1A4A, emissiveIntensity: .55 }), fMat: std({ color: 0x1A1430, emissive: 0x241A40, emissiveIntensity: .7 }), mMat: std({ color: 0x141226, roughness: .4, metalness: .6 }), trimMat: glowMat(0xFFD700, 1.8), midExtra: megaTrim },
  },
  stoki: {
    name: "СТОКИ", role: "подземный сектор с токсичной водой: даёт ФАЗОВЫЙ РЫВОК + КОР-2",
    fog: 0x041008, fogNear: 14, fogFar: 38, hemiSky: 0x9FFFC8, hemiI: 0.6, keyColor: 0x66FF99, keyI: 0.7, rimColor: 0x39FF14, rimI: 0.5,
    uiAccent: "#39FF14", mood: "stoki",
    platMat: () => body({ color: 0x3E6A4A, roughness: .55, metalness: .15, emissive: 0x0A2010, emissiveIntensity: .6 }), // биомасса
    edgeMats: () => [glowMat(0x39FF14, 2.8), glowMat(0x00F5FF, 2.4)],
    wallMat: () => body({ color: 0x2A4434, roughness: .85, metalness: .1 }),
    parallax: { ufMat: std({ color: 0x0A2016, emissive: 0x0E2A1A, emissiveIntensity: .5 }), fMat: std({ color: 0x0C2418, emissive: 0x10301E, emissiveIntensity: .65 }), mMat: std({ color: 0x0A1E14, roughness: .7, metalness: .2 }), trimMat: glowMat(0x39FF14, 1.6), midExtra: stokiTrim },
    drips: true,
  },
  pusto: {
    name: "ПУСТОШЬ «БЭДЛЕНДС»", role: "ветер и разломы: даёт КОР-3",
    fog: 0x241A10, fogNear: 22, fogFar: 60, hemiSky: 0xFFE0B0, hemiI: 1.1, keyColor: 0xFFC060, keyI: 1.5, rimColor: 0xFF6A2A, rimI: 0.45,
    uiAccent: "#FFB040", mood: "venti",
    platMat: () => body({ color: 0x8A7448, roughness: .95, metalness: .05, emissive: 0x1A1408, emissiveIntensity: .4 }), // песок/бетон
    edgeMats: () => [glowMat(0xFFB040, 2.6), glowMat(0xFF6A2A, 2.4)],
    wallMat: () => body({ color: 0x5A4C32, roughness: .95, metalness: .05 }),
    parallax: { ufMat: std({ color: 0x4A3820, emissive: 0x5A4426, emissiveIntensity: .5 }), fMat: std({ color: 0x3E301C, emissive: 0x4A3A22, emissiveIntensity: .6 }), mMat: std({ color: 0x332A1A, roughness: .95, metalness: .05 }), trimMat: glowMat(0xFFB040, 1.5), midExtra: pustoTrim },
    dust: true,
  },
  set: {
    name: "КИБЕРПРОСТРАНСТВО «СЕТЬ»", role: "wireframe и фазовые платформы: финал",
    fog: 0x0A0414, fogNear: 16, fogFar: 44, hemiSky: 0xFF9FE8, hemiI: 0.55, keyColor: 0xFF2D78, keyI: 0.6, rimColor: 0x00F5FF, rimI: 0.6,
    uiAccent: "#FF2D78", mood: "set",
    platMat: () => body({ color: 0x4A2A6E, emissive: 0x2A1040, emissiveIntensity: 1.1, roughness: .35, metalness: .25 }),
    edgeMats: () => [glowMat(0xFF2D78, 3.4), glowMat(0x00F5FF, 3.0)],
    wallMat: () => body({ color: 0x30184A, emissive: 0x180C2A, emissiveIntensity: .8, roughness: .4, metalness: .2 }),
    parallax: { ufMat: std({ color: 0x1A0A2E, emissive: 0x2A1040, emissiveIntensity: .7, wireframe: true }), fMat: std({ color: 0x160A28, emissive: 0x241038, emissiveIntensity: .8, wireframe: true }), mMat: std({ color: 0x120822, emissive: 0x1E0C30, emissiveIntensity: .7, wireframe: true }), trimMat: glowMat(0x00F5FF, 2.2), midExtra: setTrim },
    glitch: true,
  },
};
export const BIOME_IDS = Object.keys(BIOMES);
