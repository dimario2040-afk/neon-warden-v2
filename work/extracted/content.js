import { toPlatforms, toEnemySpawns, zoneOrigin, ARENA_CHEST_X, ARENA_ORIGIN_X } from "./market.js?v=15";
import { toCryptPlatforms, toCryptEnemies, cryptZoneOrigin, CRYPT_ARENA_CHEST_X, CRYPT_ARENA_ORIGIN_X, CRYPT_ORIGIN_X } from "./crypt.js?v=15";
import { GRID_PLATFORMS, GRID_CHECKPOINTS, GRID_ENEMIES, BOSS_SPAWN, GRID_EW, GRID_VERT, ARENA_CHEST_X as GRID_ARENA_CHEST_X, CRYPT_ARENA_CHEST_X as GRID_CRYPT_CHEST_X } from "./grid43.js?v=15";
export const USE_MARKET = true;
export const USE_CRYPT = true;
export const LEGACY = false; // old sprawl retired behind flag (default off); set true to re-enable 1480-unit sprawl
const _basePlatforms = [[-24,1.1,0,7],[-15,2.5,0,6],[-7,1.2,0,5],[1,3.0,0,6],[10,2.0,0,7],[19,3.8,0,6],[28,2.6,0,7],[37,1.4,0,7],[46,3.0,0,6],[55,2.0,0,7],[64,3.6,0,7],[73,2.2,0,6],[82,3.7,0,7],[91,2.5,0,8],[101,1.4,0,7],[110,3.1,0,7],[119,2.0,0,6],[128,3.7,0,7],[137,2.4,0,8],[147,4.0,0,7],[157,2.3,0,8],[167,3.6,0,7],[178,2.2,0,8]];
export const marketPlatforms = toPlatforms();
export const cryptPlatforms = toCryptPlatforms();
const _bridgePlatforms = [[184.5,2.2,0,9],[193.5,2.4,0,9]];
const _cryptBridge = (() => {
  const out = [];
  const startX = 365;
  const endX = cryptZoneOrigin(0, 0) + 5;
  const step = 14;
  let x = startX;
  let y = 2.4;
  let toggle = 0;
  while (x < endX - 7) {
    const yy = 2.4 + (toggle % 3 === 0 ? 0.15 : toggle % 3 === 1 ? -0.1 : 0.2);
    out.push([x, yy, 0, 8]);
    x += step;
    toggle++;
  }
  if (out.length > 0) {
    const last = out[out.length - 1];
    const firstCryptX = cryptZoneOrigin(0, 0) + 8;
    const gap = firstCryptX - (last[0] + 4) - 3;
    if (gap > 7) {
      out.push([firstCryptX - 7 - 4, 2.5, 0, 8]);
    }
  }
  return out;
})();
const _tierPlatforms = (()=>{ const s1 = zoneOrigin(1,1); const s2 = zoneOrigin(1,2);
  return [
    [s1+14, 1.55, 0, 6],
    [s1+21, 2.65, 0, 5.5],
    [s1+28, 3.6, 0, 5],
    [s1+16, 4.75, 0, 4.5],
    [s2+10, 1.45, 0, 6],
    [s2+18, 2.55, 0, 5.5],
    [s2+26, 3.65, 0, 5],
    [s2+20, 5.20, 0, 5.2],
  ];
})();
const _arenaFloor = [
  [ARENA_CHEST_X, 2.2, 0, 7],
  [ARENA_CHEST_X + 11.5, 1.65, 0, 6],
  [ARENA_CHEST_X + 22.5, 2.0, 0, 6],
];
const _ewConnectors = [
  [236.5, 2.65, 0, 9],
  [266, 2.65, 0, 8], [281, 2.65, 0, 8],
  [327.5, 2.2, 0, 8],
  [399.8, 2.65, 0, 7], [411.2, 2.65, 0, 7],
  [455, 2.65, 0, 8],
  [489.5, 2.65, 0, 7], [500.5, 2.65, 0, 7],
  [576.8, 2.65, 0, 7], [588.2, 2.65, 0, 7],
  [627.2, 2.65, 0, 7], [636.8, 2.65, 0, 7],
  [676.5, 2.65, 0, 7],
];
const _cryptArenaFloor = [
  [CRYPT_ARENA_CHEST_X, 2.2, 0, 7],
  [CRYPT_ARENA_CHEST_X + 11.5, 1.65, 0, 6],
  [CRYPT_ARENA_CHEST_X + 22.5, 2.0, 0, 6],
];
const _cryptEWConnectors = (() => {
  const out = [];
  const startX = CRYPT_ORIGIN_X + 18;
  const endX = CRYPT_ORIGIN_X + 16 * 44 + 6;
  for (let x = startX; x <= endX; x += 14) {
    const y = 2.65 + (x % 28 < 14 ? 0 : -0.1);
    out.push([x, y, 0, 8]);
  }
  return out;
})();
const _baseHelpers = [
  [-3, 2.1, 0, 6],
  [14.5, 2.9, 0, 6],
  [105.5, 2.25, 0, 6],
  [123.5, 2.85, 0, 6],
  [152, 3.15, 0, 6],
];
const _cryptPlatformsExtra = USE_CRYPT ? [...cryptPlatforms, ..._cryptArenaFloor, ..._cryptEWConnectors, ..._cryptBridge] : [];
const _legacyPlatforms = USE_MARKET
  ? [..._basePlatforms, ..._baseHelpers, ..._bridgePlatforms, ...marketPlatforms, ..._tierPlatforms, ..._arenaFloor, ..._ewConnectors, ..._cryptPlatformsExtra]
  : [..._basePlatforms, ..._bridgePlatforms, ..._cryptPlatformsExtra];
export const platforms = LEGACY ? _legacyPlatforms : GRID_PLATFORMS;
export const arenaFloor = LEGACY ? _arenaFloor : [[GRID_ARENA_CHEST_X, 14.2, 0, 7],[GRID_ARENA_CHEST_X+11.5,13.65,0,6],[GRID_ARENA_CHEST_X+22.5,14.0,0,6]];
export const cryptArenaFloor = LEGACY ? _cryptArenaFloor : [[GRID_CRYPT_CHEST_X,14.2,0,7],[GRID_CRYPT_CHEST_X+11.5,13.65,0,6],[GRID_CRYPT_CHEST_X+22.5,14.0,0,6]];
export const ewConnectors = LEGACY ? _ewConnectors : GRID_EW;
export const cryptEWConnectors = LEGACY ? _cryptEWConnectors : [];
export const cryptBridge = LEGACY ? _cryptBridge : [];
export const baseHelpers = LEGACY ? _baseHelpers : [];
export const vertConnectors = LEGACY ? [] : GRID_VERT;
const _baseEnemySpawns = [[-19,4.2,0],[-9,2.1,0],[7,5.0,0],[16,3.0,0],[28,5.2,1],[46,4.6,0],[64,5.0,1],[82,5.1,0],[101,4.4,0],[119,5.2,1],[137,4.7,0],[157,5.0,1]];
const _cryptEnemySpawns = toCryptEnemies();
const _legacyEnemies = USE_MARKET
  ? (USE_CRYPT ? [..._baseEnemySpawns, ...toEnemySpawns(), ..._cryptEnemySpawns] : [..._baseEnemySpawns, ...toEnemySpawns()])
  : (USE_CRYPT ? [..._baseEnemySpawns, ..._cryptEnemySpawns] : _baseEnemySpawns);
export const enemySpawns = LEGACY ? _legacyEnemies : GRID_ENEMIES;
export const bossSpawn = LEGACY ? [178,4.6,1] : BOSS_SPAWN;
export const checkpoints = LEGACY ? [
  {x:55,y:2.0,done:false},{x:101,y:1.4,done:false},{x:147,y:4.0,done:false},{x:195,y:2.4,done:false},{x:289,y:2.6,done:false},{x:355,y:2.0,done:false},
  {x: cryptZoneOrigin(0,0)+12,y:2.2,done:false},{x: cryptZoneOrigin(1,2)+12,y:2.2,done:false},{x: cryptZoneOrigin(3,3)+12,y:2.0,done:false}
] : GRID_CHECKPOINTS.map(c=>({x:c.x,y:c.y,done:false,col:c.col,row:c.row,district:c.district,key:c.key}));
