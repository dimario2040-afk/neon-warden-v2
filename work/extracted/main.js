try{ window.__NW_STAGE="eval"; }catch(e){}
import * as THREE from "three";
import { clamp, lerp, scene, camera, renderer, solids, mats, finalGate, ladders, pits, walls, updateParallax, waterData, waterMeshes, pyreData, shopData, pyreMeshes, shopMeshes, acidMotes, updateAmbient, updateLights, setAtmosphere } from "./world.js?v=15";
import { fx, burst, impactRing, slashArc, ghostTrail, focusSwirl, addShake, shakeOffset, updateShake, updateFx } from "./fx.js?v=15";
import { player, attack, dash, hack, getHackTarget, ATK_DUR, FOCUS_COST, FOCUS_HEAL, FOCUS_TIME, SOUL_PER_HIT, SOUL_PER_KILL, HACK_DMG } from "./player.js?v=15";
import { renderFrame, flash as postFlash, decayFlash, setEnabled as setBloomEnabled, resize as resizePostFx, overlay as postOverlay, hideOverlay as hidePostOverlay, diagnostics as postDiagnostics, isEnabled as postfxEnabled, drawSelfTest, probePixel } from "./postfx.js?v=15";
import { enemies, boss, spawnEnemy } from "./enemies.js?v=15";
import { checkpoints, USE_MARKET, USE_CRYPT, LEGACY } from "./content.js?v=15";
import { gateLinkBlocking as marketGateBlocking, marketBounds, roomNeighbor, DISTRICT_GRID, MARKET_ORIGIN_X, ROOM_STEP, T, BASE_Y, Y_SCALE, ARENA_ORIGIN_X, ARENA_CHEST_X, ARENA_SIGIL_X, arenaBounds, zoneOrigin, ZONE_W, MARKET_ROOMS } from "./market.js?v=15";
import { gateLinkBlocking as cryptGateBlocking, cryptBounds, cryptRoomNeighbor, CRYPT_ARENA_CHEST_X, CRYPT_ARENA_ORIGIN_X, CRYPT_ORIGIN_X, cryptArenaBounds, cryptZoneOrigin, CRYPT_ROOMS } from "./crypt.js?v=15";
import { gridBounds, SCREENS, SPAWN, GATE_PLAN, GRID_COLS, GRID_ROWS, GRID_STEP_X, GRID_OFFSET_X, GRID_W, GRID_H, tierBaseY, screenOrigin, getScreen, GRID_PLATFORMS, ARENA_CHEST_X as GRID_ARENA_CHEST_X, CRYPT_ARENA_CHEST_X as GRID_CRYPT_CHEST_X, ARENA_ORIGIN_X as GRID_ARENA_ORIGIN_X, CRYPT_ARENA_ORIGIN_X as GRID_CRYPT_ARENA_ORIGIN_X, FINAL_GATE_X, TINA_ARENA_ORIGIN_X, TINA_ARENA_CHEST_X, WINGS_CHEST_X, LEVELS, levelOfCol } from "./grid43.js?v=15";
import { setBiomeVisibility } from "./world.js?v=15";
import { audioStart, setDistrictMood, sfx, toggleMute } from "./audio.js?v=15";
import { menu, menuBlocked, discovery, discoverEnemy, discoverNpc, discoverDistrict, discoverWare, discoverSigil, loadDiscovery, showSplash, showTitle, showCreation, showPause, hidePause, showEnc, hideEnc, toPlay, renderTitle, renderCreation, LIFEPATHS, TITLE_ITEMS } from "./menu.js?v=15";

let shards=0;
let eddies=0;
let hitstopT=0;
let vignetteT=0;
let autostartPending=false;
let currentLevelIdx=0;
let openedChests=new Set();
let openedSigils=new Set();
let chests=[];
let lastTransitionSave={x:SPAWN.x,y:SPAWN.y};
let zone=1, zone2Started=false, exitOpen=false;
let levelComplete=false;
let checkpointX=SPAWN.x, checkpointY=SPAWN.y;
let currentRx = 0, currentRy = 2; // grid default spawn col0 r2
let currentDistrict = LEGACY?"market":"base";
let arenaTriggered = false;
let legsAvailable = false;
let legsCollected = false;
let legsMesh = null;
let arenaEnemies = [];
let cryptArenaTriggered = false;
let gripAvailable = false;
let gripCollected = false;
let gripMesh = null;
let cryptArenaEnemies = [];
let tinaTriggered = false;
let tinaAvailable = false;
let wingsAvailable = false;
let wingsCollected = false;
let wingsMesh = null;
let tinaEnemies = [];
let scannerPulseT = 0;
let shopOpen = false;
let currentShop = null;
let gameStartTime = performance.now();
let glitchPhase = 0;
let endingShown = false;
let roomTick = 0;
let minimapTick = 0;
let camLookY = null;
let camX = camera.position.x, camY = camera.position.y; // HK-FEEL PASS — smooth camera state (shake applied on top)
const _hud={hp:-1,ram:-1,shards:-1,boss:-1,low:false};
let _lastHint=""; // HK-FEEL PASS — smooth camera state (shake applied on top)
let hackLock=null;
function ensureHackLock(){
  if(hackLock) return hackLock;
  const geom=new THREE.OctahedronGeometry(0.26,0);
  const mat=new THREE.MeshBasicMaterial({color:0x9d6cff, transparent:true, opacity:0.95, wireframe:false});
  hackLock=new THREE.Mesh(geom, mat);
  hackLock.visible=false;
  hackLock.rotation.z=Math.PI/4;
  // outline thin wireframe
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({color:0xC9A8FF, transparent:true, opacity:0.9}));
  hackLock.add(edge);
  scene.add(hackLock);
  return hackLock;
}
function updateHackLock(){
  const m=ensureHackLock();
  const t=getHackTarget(enemies);
  if(t && player.ram>=(player.hackCost||FOCUS_COST)){
    m.visible=true;
    m.position.set(t.x, t.y+1.85, 0.6);
    m.rotation.y+=0.06;
    // pulse opacity with ram availability
    const pulse=0.85+0.15*Math.sin(performance.now()*0.012);
    m.material.opacity=pulse;
  } else {
    m.visible=false;
  }
}
function snapChestToPlatform(x, screen){
  let best=null, bestDx=1e9;
  for(const p of GRID_PLATFORMS){
    if(p[0] >= screen.originX -1 && p[0] < screen.originX + GRID_W +1){
      const dx=Math.abs(p[0]-x);
      if(dx<bestDx){ bestDx=dx; best=p; }
    }
  }
  if(best) return {x:best[0], y:best[1]};
  return {x: x, y: screen.baseY + 0.9};
}
function buildChestMesh(x,y){
  const g=new THREE.Group();
  const baseGeom=new THREE.BoxGeometry(0.85,0.52,0.52);
  const baseMat=new THREE.MeshStandardMaterial({color:0x1a2330, emissive:0x182838, emissiveIntensity:1.2, roughness:0.7, metalness:0.35});
  const m=new THREE.Mesh(baseGeom, baseMat);
  g.add(m);
  const trimMat=new THREE.MeshStandardMaterial({color:0x2a2200, emissive:0xFFD700, emissiveIntensity:3.4, roughness:0.3, metalness:0.6});
  trimMat.toneMapped=false;
  const topTrim=new THREE.Mesh(new THREE.BoxGeometry(0.92,0.08,0.58), trimMat);
  topTrim.position.y=0.22;
  g.add(topTrim);
  const frontGlow=new THREE.Mesh(new THREE.PlaneGeometry(0.7,0.32), new THREE.MeshBasicMaterial({color:0xFFD700, transparent:true, opacity:0.22, side:THREE.DoubleSide}));
  frontGlow.position.set(0,0.05,0.28);
  g.add(frontGlow);
  const light=new THREE.PointLight(0xFFD700, 4, 3.5, 2);
  light.position.set(0,0.4,0.2);
  g.add(light);
  g.position.set(x, y+0.26, -0.4);
  g.userData.baseY=y+0.26;
  return g;
}
function buildGridChests(){
  const out=[];
  const arenaScreens=new Set(["1_1","2_1","2_2"]);
  const screenHasChestCount={};
  for(const s of SCREENS) screenHasChestCount[s.key]=0;
  function addChest(screen, pixelX, kind, val, roomId){
    const tileX=(pixelX / T);
    let x=screen.originX + tileX;
    x=Math.max(screen.originX+1.5, Math.min(screen.originX+GRID_W-1.5, x));
    const snapped=snapChestToPlatform(x, screen);
    const y=snapped.y;
    const id=`chest_${screen.key}_${kind}_${pixelX}_${roomId}`;
    out.push({id, x: snapped.x, y, kind, val, screenKey: screen.key, col:screen.col, row:screen.row, roomId, pixelX});
    screenHasChestCount[screen.key]++;
  }
  // market mapping: ry -> row
  for(const room of MARKET_ROOMS){
    if(!room.chests) continue;
    const parts=room.id.split("_");
    const ry=parseInt(parts[2],10);
    const row=Math.max(0, Math.min(2, ry));
    const screen=SCREENS.find(s=> s.col===1 && s.row===row);
    if(!screen) continue;
    // skip arena sigil/cyber? keep them as lootable too but filter if arena screen and kind sigil/cyber? Keep as lootable chests per spec - they become collectible
    for(const ch of room.chests){
      const pixelX=ch[0], kind=ch[1], val=ch[2];
      // exclude arena legs/grip if already handled via arena pickups? But keep sigil as chest - still add. Market_2_0 arena will be placed on 1_1 arena screen, keep.
      addChest(screen, pixelX, kind, val, room.id);
    }
  }
  for(const room of CRYPT_ROOMS){
    if(!room.chests) continue;
    const parts=room.id.split("_");
    const ry=parseInt(parts[2],10);
    const row=Math.max(0, Math.min(2, ry));
    const screen=SCREENS.find(s=> s.col===2 && s.row===row);
    if(!screen) continue;
    for(const ch of room.chests){
      const pixelX=ch[0], kind=ch[1], val=ch[2];
      addChest(screen, pixelX, kind, val, room.id);
    }
  }
  // explicit sunken ТИНА sigil SN at 2_2 arena (if not already via market/crypt)
  {
    const s=SCREENS.find(sc=> sc.col===2 && sc.row===2);
    if(s){
      // place SN sigil at TINA arena chest
      const tileX=320/T; // 20
      let x=s.originX + tileX; x=Math.max(s.originX+1.5, Math.min(s.originX+GRID_W-1.5, x));
      const snapped=snapChestToPlatform(x, s);
      const id=`chest_${s.key}_sigil_SN_tina`;
      if(!out.some(o=>o.id===id)){
        out.push({id, x: snapped.x, y: snapped.y, kind:"sigil", val:"SN", screenKey:s.key, col:s.col, row:s.row, roomId:"tina_arena", pixelX:320});
        screenHasChestCount[s.key]++;
      }
    }
  }
  // WAVE 1 — ВЕНТИ: ЦЕП (wall-jump ware) as a cyber chest in the venti depths (col4 row2)
  {
    const vs=SCREENS.find(sc=>sc.col===4 && sc.row===2);
    if(vs) addChest(vs, 480, "cyber", "claw", "venti");
  }
  // synthetic 1 eddies per non-arena empty screen
  for(const s of SCREENS){
    if(arenaScreens.has(s.key)) continue;
    if(screenHasChestCount[s.key]===0){
      const plats=GRID_PLATFORMS.filter(p=> p[0]>=s.originX && p[0]<s.originX+GRID_W);
      let pick=null;
      if(plats.length>=3) pick=plats[2];
      else if(plats.length>0) pick=plats[Math.floor(plats.length/2)];
      const x=pick?pick[0]: s.originX+22;
      const y=pick?pick[1]: s.baseY+1.6;
      const id=`chest_${s.key}_eddies_synth`;
      out.push({id, x, y, kind:"eddies", val:35, screenKey:s.key, col:s.col, row:s.row, roomId:"synth", pixelX: (x-s.originX)*T});
      screenHasChestCount[s.key]++;
    }
  }
  return out;
}
function initChests(){
  chests=buildGridChests();
  for(const c of chests){
    if(openedChests.has(c.id)) continue;
    const mesh=buildChestMesh(c.x, c.y);
    mesh.userData.chestId=c.id;
    mesh.userData.kind=c.kind;
    c.mesh=mesh;
    scene.add(mesh);
  }
}
function removeChestMesh(ch){
  if(ch.mesh){
    scene.remove(ch.mesh);
    // dispose geometries
    ch.mesh.traverse(o=>{ if(o.isMesh){ if(o.geometry) o.geometry.dispose(); }});
    ch.mesh=null;
  }
}
function nearestChest(){
  let best=null, bestD=1e9;
  for(const c of chests){
    if(openedChests.has(c.id)) continue;
    const d=Math.hypot(player.x - c.x, player.y - c.y);
    if(d<bestD){ bestD=d; best=c; }
  }
  if(best && bestD<1.8) return best;
  return null;
}
function tryOpenChest(){
  const c=nearestChest();
  if(!c) return false;
  openedChests.add(c.id);
  removeChestMesh(c);
  sfx.chest();
  // reward
  if(c.kind==="eddies"){
    const v=typeof c.val==="number"? c.val : 35;
    eddies+=v;
    popup("+"+v+" EDDIES", true);
    burst(new THREE.Vector3(c.x, c.y+0.6, -0.2), 0xFFD700, 16, 0.07);
    message("EDDIES +" + v);
  } else if(c.kind==="shard"){
    player.hp=Math.min(100, player.hp+25);
    shards+=1;
    eddies+=5;
    popup("+25 HP // ОСКОЛОК", true);
    burst(new THREE.Vector3(c.x, c.y+0.6, -0.2), 0x00F5FF, 18, 0.07);
    message("ОСКОЛОК // +25 HP");
  } else if(c.kind==="sigil"){
    const sig=c.val||"MK";
    openedSigils.add(sig); discoverSigil(sig);
    popup("СИГИЛ "+sig, true);
    burst(new THREE.Vector3(c.x, c.y+0.6, -0.2), 0xFFD700, 22, 0.08);
    message("СИГИЛ "+sig+" ПОЛУЧЕН");
    // for legacy progression, also grant legs/grip if not yet? No, sigil separate
  } else if(c.kind==="cyber"){
    const v=c.val||"";
    if(v==="legs"||v==="grip"||v==="servo"){
      if(v==="legs"){ player.hasLegs=true; popup("ДЭШ-НОГИ", true); message("ДЭШ-НОГИ ПОЛУЧЕНЫ"); burst(new THREE.Vector3(c.x, c.y+0.6, -0.2), 0x62f6ff, 22, 0.07); legsCollected=true; discoverWare("legs"); }
      else { player.hasGrip=true; popup("ХВАТ", true); message("ХВАТ ПОЛУЧЕН"); burst(new THREE.Vector3(c.x, c.y+0.6, -0.2), 0x9d6cff, 22, 0.07); gripCollected=true; discoverWare("grip"); }
    } else if(v==="claw"){
      player.hasClaw=true; popup("ЦЕП", true); message("ЦЕП ПОЛУЧЕН // WALL-JUMP [SPACE у стены]"); burst(new THREE.Vector3(c.x, c.y+0.6, -0.2), 0x39FF14, 22, 0.07); discoverWare("claw");
    } else {
      eddies+=20; popup("+20 EDDIES", true); burst(new THREE.Vector3(c.x, c.y+0.6, -0.2), 0xFFD700, 12, 0.06);
    }
  }
  saveGame();
  updateRoomLabel();
  const elEdd=document.getElementById("eddies"); if(elEdd) elEdd.textContent=String(eddies);
  const elSh=document.getElementById("shards"); if(elSh) elSh.textContent=String(shards);
  return true;
}
function drawMinimap(){
  const cvs=document.getElementById("minimap");
  if(!cvs) return;
  if(typeof started!=="undefined" && !started){ const ctx0=cvs.getContext("2d"); if(ctx0){ ctx0.fillStyle="rgba(10,18,28,0.92)"; ctx0.fillRect(0,0,cvs.width,cvs.height); ctx0.fillStyle="#5A6A7A"; ctx0.font="8px monospace"; ctx0.textAlign="center"; ctx0.fillText("MINIMAP — PRESS ENTER",84,63);} return; }
  const ctx=cvs.getContext("2d");
  if(!ctx) return;
  const gb=gridBounds();
  const W=cvs.width, H=cvs.height;
  const worldW=gb.maxX-gb.minX, worldH=gb.maxY-gb.minY;
  const sx=W/worldW, sy=H/worldH;
  const mapX=(x)=> (x-gb.minX)*sx;
  const mapY=(y)=> H - (y-gb.minY)*sy;
  ctx.fillStyle="#0B141C";
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="rgba(58,74,90,0.35)";
  ctx.lineWidth=0.5;
  for(const s of SCREENS){ const rx=mapX(s.originX), ry=mapY(s.baseY+s.h|| s.baseY+GRID_H), rw=s.w*sx|| GRID_W*sx, rh=GRID_H*sy; ctx.strokeRect(rx, ry, rw, rh); }
  ctx.fillStyle="#3A4A5A";
  for(const p of solids){ const px=mapX(p.x - p.w/2), py=mapY(p.y+0.55); const pw=Math.max(1,p.w*sx), ph=Math.max(1.5,1.1*sy); ctx.fillRect(px, py-ph, pw, ph); }
  const pulseActive = scannerPulseT>0;
  const pulseScale = pulseActive ? 1.6 : 1;
  const chestPulse = pulseActive ? (1+0.4*Math.sin(performance.now()*0.01)) : 1;
  ctx.fillStyle = pulseActive ? "#FFE66D" : "#FFD700";
  for(const ch of chests){ if(openedChests.has(ch.id)) continue; const cx=mapX(ch.x), cy=mapY(ch.y+0.3);
    const r = pulseActive ? 3.8*chestPulse : 2.2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    if(pulseActive){ ctx.strokeStyle="rgba(255,230,109,0.55)"; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy, r+4*Math.abs(Math.sin(performance.now()*0.008)),0,Math.PI*2); ctx.stroke(); }
  }
  for(const e of enemies){ if(e.dead) continue; const ex=mapX(e.x), ey=mapY(e.y);
    if(e.isBoss){ ctx.fillStyle="#FFD700"; ctx.beginPath(); ctx.arc(ex,ey, pulseActive?5:3.2,0,Math.PI*2); ctx.fill();
      if(pulseActive){ // HP bar mini
        ctx.fillStyle="rgba(255,45,120,0.9)"; ctx.fillRect(ex-8, ey-6, 16*(e.hp/e.max), 2);
      }
    } else {
      ctx.fillStyle = (e.etype==="ghost"?"#8af2ff":e.etype==="guardian"?"#7a4cff":"#FF2D78");
      ctx.beginPath(); ctx.arc(ex,ey, pulseActive?3.2:2,0,Math.PI*2); ctx.fill();
      if(pulseActive){ ctx.strokeStyle="rgba(255,255,255,0.35)"; ctx.lineWidth=0.6; ctx.stroke(); }
    }
  }
  ctx.fillStyle="#00F5FF";
  ctx.shadowColor="#00F5FF"; ctx.shadowBlur=6;
  ctx.beginPath(); ctx.arc(mapX(player.x), mapY(player.y), 3, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  const vW=26*sx, vH=14*sy;
  const vx=mapX(camera.position.x)-vW/2, vy=mapY(camera.position.y+1.5)-vH/2;
  ctx.strokeStyle = pulseActive ? "rgba(0,245,255,0.95)" : "rgba(255,255,255,0.85)";
  ctx.lineWidth= pulseActive ? 1.4 : 1;
  ctx.strokeRect(vx, vy, vW, vH);
  ctx.fillStyle="rgba(255,255,255,0.5)";
  ctx.fillRect(vx+vW/2-0.5, vy+vH/2-0.5,1,1);
  if(pulseActive){
    ctx.fillStyle="rgba(0,245,255,0.08)";
    ctx.fillRect(vx, vy, vW, vH);
  }
}
const STORAGE_KEY = "cybervania2309";
  const LADDER_X_TOL = 0.9;
const LADDER_Y_PAD = 0.35;
const ROOM_TOP_Y = BASE_Y + 4.35;
const ROOM_BOTTOM_Y = BASE_Y - 0.35;

function showZone(t){const z=document.getElementById("zone");z.textContent=t;z.style.opacity=1;clearTimeout(showZone.timer);showZone.timer=setTimeout(()=>z.style.opacity=0,1800)}
function currentScreen(){
  if(LEGACY) return null;
  // deterministic: col from x, row from y tier — no overlapping windows (row flip is exact at tier boundary)
  const col = clamp(Math.floor((player.x - GRID_OFFSET_X) / GRID_STEP_X), 0, GRID_COLS-1);
  const row = clamp(2 - Math.floor(player.y / GRID_H), 0, GRID_ROWS-1);
  const s = getScreen(col,row);
  if(s) return s;
  // fallback nearest
  let best=null, bestD=1e9;
  for(const s of SCREENS){
    const cx=s.originX+GRID_W/2;
    const d=Math.abs(player.x - cx) + Math.abs(player.y - (s.baseY+2))*0.5;
    if(d<bestD){bestD=d; best=s;}
  }
  return best;
}
function updateRoomLabel(){
  const el=document.getElementById("room");
  const sigEl=document.getElementById("sigils");
  if(sigEl) sigEl.textContent=`${openedSigils.size}/3`;
  if(!el) return;
  try{
    if(LEGACY){
      const b=marketBounds();
      const cb=cryptBounds();
      const inMarket=player.x >= b.minX - 5 && player.x <= b.maxX + 20;
      const inCrypt=player.x >= cb.minX - 5 && player.x <= cb.maxX + 20;
      if(inCrypt) el.textContent="ROOM crypt_" + currentRx + "_" + currentRy + (player.hasGrip ? " // ХВАТ" : (player.hasLegs ? " // ДЭШ" : ""));
      else if(inMarket) el.textContent="ROOM market_" + currentRx + "_" + currentRy + (player.hasLegs ? " // ДЭШ" : "");
      else el.textContent="ROOM BASE // x" + Math.round(player.x);
    } else {
      const s=currentScreen();
      let mods=""; if(player.hasLegs) mods+=" ДЭШ"; if(player.hasGrip) mods+=" ХВАТ"; if(player.hasWings) mods+=" КРЫЛЬЯ";
      if(s) el.textContent=`ROOM ${s.col}_${s.row} ${s.district} // ${s.dressing}` + (mods? " //"+mods:"") + ` // SIGILS ${openedSigils.size}/3`;
      else el.textContent=`ROOM ${currentRx}_${currentRy} GRID`;
    }
  }catch(e){ el.textContent="ROOM " + currentDistrict + "_" + currentRx + "_" + currentRy; }
}
function enterZone2(){return;}

export function snapToGround(x,y){
  let best=null;
  for(const p of solids){
    if(Math.abs(x - p.x) <= p.w/2 + 0.34 && p.y <= y + 0.5){
      if(best===null || p.y > best) best = p.y;
    }
  }
  return best;
}
function updateCheckpoint(){for(const c of checkpoints){if(!c.done && player.x>=c.x && Math.abs(player.y - c.y) < 4){const top=snapToGround(c.x,c.y);if(top===null) continue;c.done=true;checkpointX=c.x;checkpointY=top;showZone("CHECKPOINT // "+Math.round(c.x));message("CHECKPOINT SAVED");saveGame();}}}

function saveGame(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ hasLegs: !!player.hasLegs, hasGrip: !!player.hasGrip, hasWings: !!player.hasWings, hasWon: !!player.hasWon, maxHp: player.maxHp, meleeBonus: player.meleeBonus, hackCost: player.hackCost||25, speedBonus: player.speedBonus||0, currentLevel: currentLevelIdx, checkpointX, checkpointY, currentRx, currentRy, currentDistrict, arenaTriggered, legsCollected, cryptArenaTriggered, gripCollected, tinaTriggered, wingsCollected, eddies, shards, opened: Array.from(openedChests), sigils: Array.from(openedSigils), discovery:{ enemies:Array.from(discovery.enemies), npcs:Array.from(discovery.npcs), districts:Array.from(discovery.districts), wares:Array.from(discovery.wares), sigils:Array.from(discovery.sigils) }, heroName: menu.heroName, lifepath: menu.lifepath })); }catch(e){}
}
function loadGame(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(d.hasLegs) player.hasLegs = true;
    if(d.hasGrip) player.hasGrip = true;
    if(d.hasWings){ player.hasWings = true; wingsCollected=true; }
    if(d.hasWon) player.hasWon = true;
    if(typeof d.maxHp==="number" && d.maxHp>=100) player.maxHp=d.maxHp;
    if(typeof d.meleeBonus==="number") player.meleeBonus=d.meleeBonus;
    if(typeof d.checkpointX === "number" && typeof d.checkpointY === "number"){
      let useSpawn=false;
      let top=null;
      if(!LEGACY){
        const gb=gridBounds();
        const inside = d.checkpointX >= gb.minX -5 && d.checkpointX <= gb.maxX +5 && d.checkpointY >= gb.minY -1 && d.checkpointY <= gb.maxY +1;
        top=snapToGround(d.checkpointX,d.checkpointY);
        if(!inside || top===null){ useSpawn=true; }
        else { checkpointX = d.checkpointX; checkpointY = top; player.x = checkpointX; player.y = checkpointY; }
      } else {
        top=snapToGround(d.checkpointX,d.checkpointY);
        if(top!==null){ checkpointX = d.checkpointX; checkpointY = top; player.x = checkpointX; player.y = checkpointY; }
        else { checkpointX=-24; checkpointY=1.1; }
      }
      if(!LEGACY && useSpawn){
        checkpointX=SPAWN.x; checkpointY=SPAWN.y;
        const sTop=snapToGround(SPAWN.x, SPAWN.y);
        if(sTop!==null) checkpointY=sTop;
        player.x=checkpointX; player.y=checkpointY+0.1;
        // message will be shown after boot (need DOM)
        setTimeout(()=>{ try{ message("SAVE MIGRATED // SPAWN"); showZone("MIGRATED // SPAWN"); }catch(e){} }, 600);
      }
    }
    if(typeof d.currentRx === "number"){ currentRx = d.currentRx; currentRy = d.currentRy; }
    if(typeof d.currentDistrict === "string"){ currentDistrict = d.currentDistrict; }
    // clamp grid coords when migrated
    if(!LEGACY){
      if(currentRx<0||currentRx>=GRID_COLS||currentRy<0||currentRy>=GRID_ROWS){
        currentRx=SPAWN.c; currentRy=SPAWN.r; currentDistrict="base";
      }
    }
    if(d.arenaTriggered) arenaTriggered = d.arenaTriggered;
    if(d.legsCollected){ legsCollected = true; player.hasLegs = true; }
    if(d.cryptArenaTriggered) cryptArenaTriggered = d.cryptArenaTriggered;
    if(d.gripCollected){ gripCollected = true; player.hasGrip = true; }
    if(d.tinaTriggered) tinaTriggered = d.tinaTriggered;
    if(d.wingsCollected){ wingsCollected = true; player.hasWings = true; }
    if(typeof d.eddies==="number") eddies=d.eddies;
    if(typeof d.shards==="number") shards=d.shards;
    if(Array.isArray(d.opened)) openedChests=new Set(d.opened);
    if(Array.isArray(d.sigils)) openedSigils=new Set(d.sigils);
    if(typeof d.hackCost==="number") player.hackCost=d.hackCost;
    if(typeof d.speedBonus==="number") player.speedBonus=d.speedBonus;
    loadDiscovery(d);
    if(d.autostart) autostartPending=true;
    if(typeof d.currentLevel==="number" && d.currentLevel>=0 && d.currentLevel<LEVELS.length){ currentLevelIdx=d.currentLevel; }
  }catch(e){}
}
function createLegsPickup(){
  if(legsMesh) return;
  const geom = new THREE.BoxGeometry(0.9,0.9,0.9);
  const mat = new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x62f6ff, emissiveIntensity: 3, metalness: 0.6, roughness: 0.3 });
  legsMesh = new THREE.Mesh(geom, mat);
  if(LEGACY) legsMesh.position.set(ARENA_CHEST_X, BASE_Y + 0.9, 0.4);
  else {
    const sc=SCREENS.find(s=>s.col===1 && s.row===1);
    legsMesh.position.set(GRID_ARENA_CHEST_X, sc.baseY + 0.9, 0.4);
  }
  scene.add(legsMesh);
}
function removeLegsPickup(){ if(legsMesh){ scene.remove(legsMesh); legsMesh=null; } }
function tryPickupLegs(){
  if(!legsAvailable || legsCollected) return false;
  const cx = LEGACY? ARENA_CHEST_X : GRID_ARENA_CHEST_X;
  const cy = LEGACY? (BASE_Y + 0.9) : (SCREENS.find(s=>s.col===1&&s.row===1).baseY + 0.9);
  if(Math.abs(player.x - cx) < 1.6 && Math.abs(player.y - cy) < 1.6){
    legsCollected = true; legsAvailable = false; player.hasLegs = true; discoverWare("legs");
    removeLegsPickup();
    burst(new THREE.Vector3(player.x, player.y + 1, 0), 0x62f6ff, 28, 0.07);
    message("ДЭШ-НОГИ ПОЛУЧЕНЫ");
    showZone("МОДУЛЬ // ДЭШ-НОГИ");
    saveGame();
    updateRoomLabel();
    return true;
  }
  return false;
}
function createGripPickup(){
  if(gripMesh) return;
  const geom = new THREE.BoxGeometry(0.9,0.9,0.9);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a0a2a, emissive: 0x9d6cff, emissiveIntensity: 3.2, metalness: 0.6, roughness: 0.3 });
  gripMesh = new THREE.Mesh(geom, mat);
  if(LEGACY) gripMesh.position.set(CRYPT_ARENA_CHEST_X, BASE_Y + 0.9, 0.4);
  else {
    const sc=SCREENS.find(s=>s.col===2 && s.row===1);
    gripMesh.position.set(GRID_CRYPT_CHEST_X, sc.baseY + 0.9, 0.4);
  }
  scene.add(gripMesh);
}
function removeGripPickup(){ if(gripMesh){ scene.remove(gripMesh); gripMesh=null; } }
function tryPickupGrip(){
  if(!gripAvailable || gripCollected) return false;
  const cx = LEGACY? CRYPT_ARENA_CHEST_X : GRID_CRYPT_CHEST_X;
  const cy = LEGACY? (BASE_Y + 0.9) : (SCREENS.find(s=>s.col===2&&s.row===1).baseY + 0.9);
  if(Math.abs(player.x - cx) < 1.6 && Math.abs(player.y - cy) < 1.6){
    gripCollected = true; gripAvailable = false; player.hasGrip = true; discoverWare("grip");
    removeGripPickup();
    burst(new THREE.Vector3(player.x, player.y + 1, 0), 0x9d6cff, 28, 0.07);
    message("ХВАТ ПОЛУЧЕН");
    showZone("МОДУЛЬ // ХВАТ");
    saveGame();
    updateRoomLabel();
    return true;
  }
  return false;
}
function createWingsPickup(){
  if(wingsMesh) return;
  const geom = new THREE.BoxGeometry(0.9,0.9,0.9);
  const mat = new THREE.MeshStandardMaterial({ color: 0x071a2a, emissive: 0xFFE66D, emissiveIntensity: 3.4, metalness: 0.6, roughness: 0.3 });
  wingsMesh = new THREE.Mesh(geom, mat);
  const sc=SCREENS.find(s=>s.col===2 && s.row===2);
  wingsMesh.position.set(WINGS_CHEST_X, sc.baseY + 0.9, 0.4);
  scene.add(wingsMesh);
}
function removeWingsPickup(){ if(wingsMesh){ scene.remove(wingsMesh); wingsMesh=null; } }
function tryPickupWings(){
  if(!wingsAvailable || wingsCollected) return false;
  const cx = WINGS_CHEST_X;
  const sc=SCREENS.find(s=>s.col===2&&s.row===2);
  const cy = sc.baseY + 0.9;
  if(Math.abs(player.x - cx) < 1.6 && Math.abs(player.y - cy) < 1.6){
    wingsCollected = true; wingsAvailable = false; player.hasWings = true; discoverWare("wings");
    removeWingsPickup();
    burst(new THREE.Vector3(player.x, player.y + 1, 0), 0xFFE66D, 28, 0.07);
    message("КРЫЛЬЯ ПОЛУЧЕНЫ // DOUBLE-JUMP [SPACE в воздухе]");
    showZone("МОДУЛЬ // КРЫЛЬЯ");
    saveGame();
    updateRoomLabel();
    return true;
  }
  return false;
}
function triggerArena(){
  if(arenaTriggered) return;
  arenaTriggered = true;
  message("АРЕНА ГРОХОТ // СИГИЛ MK АКТИВЕН");
  showZone("ГРОХОТ // MK");
  const baseX = LEGACY? ARENA_ORIGIN_X : GRID_ARENA_ORIGIN_X;
  const y = LEGACY? (BASE_Y + 2 * Y_SCALE) : (SCREENS.find(s=>s.col===1&&s.row===1).baseY + 2.0);
  arenaEnemies = [];
  const s1 = spawnEnemy(baseX + 12, y, 0);
  const s2 = spawnEnemy(baseX + 18, y, 0);
  const s3 = spawnEnemy(baseX + 26, y, 0);
  const bLite = spawnEnemy(baseX + 20, y, 1, "guardian", "hammer");
  bLite.hp = 65; bLite.max = 65; bLite.isBossLite = true;
  arenaEnemies.push(s1, s2, s3, bLite);
  saveGame();
}
function checkArena(){
  if(!USE_MARKET) return;
  if(legsCollected) return;
  if(player.hasLegs){ legsCollected = true; return; }
  let b, inArena;
  if(LEGACY){ b = arenaBounds(); inArena = player.x >= b.minX && player.x <= b.maxX && player.y >= b.minY && player.y <= b.maxY; }
  else {
    const sc=SCREENS.find(s=>s.col===1&&s.row===1);
    b={minX:sc.originX, maxX:sc.originX+GRID_W, minY:sc.baseY-0.5, maxY:sc.baseY+5.5};
    inArena = player.x >= b.minX && player.x <= b.maxX && player.y >= b.minY && player.y <= b.maxY;
  }
  if(!arenaTriggered && inArena){ triggerArena(); }
  if(arenaTriggered && !legsAvailable && !legsCollected){
    const alive = arenaEnemies.filter(function(e){ return !e.dead; });
    if(alive.length === 0){
      legsAvailable = true;
      createLegsPickup();
      const cx = LEGACY? ARENA_CHEST_X : GRID_ARENA_CHEST_X;
      const cy = LEGACY? (BASE_Y + 1.2) : (SCREENS.find(s=>s.col===1&&s.row===1).baseY + 1.2);
      burst(new THREE.Vector3(cx, cy, 0), 0x62f6ff, 22, 0.07);
      message("АРЕНА ЗАЧИЩЕНА // ДЭШ-НОГИ ДОСТУПНЫ [E]");
      saveGame();
    }
  }
}
function triggerCryptArena(){
  if(cryptArenaTriggered) return;
  cryptArenaTriggered = true;
  message("АРЕНА МОЛЧУН // СИГИЛ CR АКТИВЕН");
  showZone("МОЛЧУН // CR");
  const baseX = LEGACY? CRYPT_ARENA_ORIGIN_X : GRID_CRYPT_ARENA_ORIGIN_X;
  const y = LEGACY? (BASE_Y + 2 * Y_SCALE) : (SCREENS.find(s=>s.col===2&&s.row===1).baseY + 2.0);
  cryptArenaEnemies = [];
  const s1 = spawnEnemy(baseX + 12, y, 0, "ghost");
  const s2 = spawnEnemy(baseX + 18, y, 0, "skeleton");
  const s3 = spawnEnemy(baseX + 26, y, 0, "ghost");
  const bLite = spawnEnemy(baseX + 20, y, 1, "ghost", "silent");
  bLite.hp = 65; bLite.max = 65; bLite.isBossLite = true;
  cryptArenaEnemies.push(s1, s2, s3, bLite);
  saveGame();
}
function checkCryptArena(){
  if(!USE_CRYPT) return;
  if(gripCollected) return;
  if(player.hasGrip){ gripCollected = true; return; }
  let b, inArena;
  if(LEGACY){ b = cryptArenaBounds(); inArena = player.x >= b.minX && player.x <= b.maxX && player.y >= b.minY && player.y <= b.maxY; }
  else {
    const sc=SCREENS.find(s=>s.col===2&&s.row===1);
    b={minX:sc.originX, maxX:sc.originX+GRID_W, minY:sc.baseY-0.5, maxY:sc.baseY+5.5};
    inArena = player.x >= b.minX && player.x <= b.maxX && player.y >= b.minY && player.y <= b.maxY;
  }
  if(!cryptArenaTriggered && inArena){ triggerCryptArena(); }
  if(cryptArenaTriggered && !gripAvailable && !gripCollected){
    const alive = cryptArenaEnemies.filter(function(e){ return !e.dead; });
    if(alive.length === 0){
      gripAvailable = true;
      createGripPickup();
      const cx = LEGACY? CRYPT_ARENA_CHEST_X : GRID_CRYPT_CHEST_X;
      const cy = LEGACY? (BASE_Y + 1.2) : (SCREENS.find(s=>s.col===2&&s.row===1).baseY + 1.2);
      burst(new THREE.Vector3(cx, cy, 0), 0x9d6cff, 22, 0.07);
      message("АРЕНА ЗАЧИЩЕНА // ХВАТ ДОСТУПЕН [E]");
      saveGame();
    }
  }
}
function triggerTinaArena(){
  if(tinaTriggered) return;
  tinaTriggered = true;
  message("АРЕНА ТИНА // СИГИЛ SN АКТИВЕН // ЗАТОПЛЕННЫЕ ГЛУБИНЫ");
  showZone("ТИНА // SN");
  const baseX = TINA_ARENA_ORIGIN_X;
  const sc=SCREENS.find(s=>s.col===2&&s.row===2);
  const y = sc.baseY + 2.0;
  tinaEnemies = [];
  const e1 = spawnEnemy(baseX + 10, y, 0, "ghost");
  const e2 = spawnEnemy(baseX + 18, y, 0, "guardian");
  const e3 = spawnEnemy(baseX + 26, y, 0, "ghost");
  const bLite = spawnEnemy(baseX + 20, y, 1, "guardian", "water");
  bLite.hp=85; bLite.max=85; bLite.isBossLite=true;
  tinaEnemies.push(e1,e2,e3,bLite);
  saveGame();
}
function checkTinaArena(){
  if(wingsCollected) return;
  if(player.hasWings){ wingsCollected=true; return; }
  const sc=SCREENS.find(s=>s.col===2&&s.row===2);
  const b={minX:sc.originX, maxX:sc.originX+GRID_W, minY:sc.baseY-0.5, maxY:sc.baseY+5.5};
  const inArena = player.x >= b.minX && player.x <= b.maxX && player.y >= b.minY && player.y <= b.maxY;
  if(!tinaTriggered && inArena){ triggerTinaArena(); }
  if(tinaTriggered && !wingsAvailable && !wingsCollected){
    const alive = tinaEnemies.filter(function(e){ return !e.dead; });
    if(alive.length===0){
      wingsAvailable = true;
      createWingsPickup();
      burst(new THREE.Vector3(WINGS_CHEST_X, sc.baseY+1.2, 0), 0xFFE66D, 22, 0.07);
      message("АРЕНА ЗАЧИЩЕНА // КРЫЛЬЯ ДОСТУПНЫ [E] // за ТИНОЙ");
      saveGame();
    }
  }
}

function popup(text,good=false){const el=document.createElement("div");el.className="dmgpop"+(good?" good":"");el.textContent=text;const v=player.g.position.clone();v.project(camera);el.style.left=((v.x*.5+.5)*innerWidth)+"px";el.style.top=((-v.y*.5+.5)*innerHeight)+"px";document.body.appendChild(el);setTimeout(()=>el.remove(),700)}
// HK-FEEL PASS — damage: knockback away from source, hitstop, camera shake, red screen flash,
// focus channel interrupted. srcX = world x of the damage source (enemy/orb); fallback = facing.
function damagePlayer(n,source="DAMAGE",srcX){if(player.inv>0)return;player.hp-=n;player.inv=.8;popup("-"+n+"  "+source);burst(player.g.position,0xff3ea5,18,.07);sfx.hurt();document.body.classList.remove("shake");void document.body.offsetWidth;document.body.classList.add("shake");
const kbDir=(srcX!==undefined&&isFinite(srcX))? (Math.sign(player.x-srcX)||-player.face) : -player.face;
player.vx=kbDir*9.5; player.vy=Math.max(player.vy,2.4); player.ground=false;
player.focusing=false; player.focusT=0;
hitstopT=Math.max(hitstopT,0.10); addShake(0.55,0.3); postFlash(0.32,0xff2244);
vignetteT=0.12; const vig=document.getElementById("vignette"); if(vig){ vig.style.transition="none"; vig.style.background="radial-gradient(120% 120% at 50% 50%, transparent 58%, rgba(255,20,60,.32) 88%, rgba(60,0,10,.85) 100%), linear-gradient(180deg, rgba(255,0,30,.22), transparent 22%, transparent 78%, rgba(255,0,30,.18))"; vig.style.opacity="1"; setTimeout(()=>{ vig.style.transition="opacity 120ms ease"; vig.style.opacity="1"; },10); } if(player.hp<=0)respawn()}
function completeLevel(){if(levelComplete)return;levelComplete=true;player.vx=0;player.vy=0;message("LEVEL COMPLETE // CORE ESCAPED");showZone("CYBERVANIA // SECTOR CLEARED");finalGate.material=mats.pink;}
export function respawn(){const mh=player.maxHp||100; player.hp=mh;player.ram=100;const top=snapToGround(checkpointX,checkpointY);if(top!==null){player.x=checkpointX;player.y=top+0.1;}else{ if(LEGACY){player.x=-24;player.y=1.1+0.1;checkpointX=-24;checkpointY=1.1;} else { player.x=SPAWN.x; player.y=SPAWN.y+0.1; checkpointX=SPAWN.x; const sTop=snapToGround(SPAWN.x,SPAWN.y); checkpointY=sTop!==null?sTop:SPAWN.y; } }player.vx=player.vy=0;player.inv=1.5;player.g.visible=true;player.focusing=false;player.focusT=0;
  syncLevelVisibility(); // v4.1.18 — respawn must not strand us with the wrong level's culling
  // HK-FEEL PASS — death resets the boss encounter: aggro off, state machine cleared, adds despawned,
  // projectiles gone. Re-entering the arena replays the intro roar (as it should).
  { const b=enemies.find(en=>en.isBoss&&!en.dead);
    if(b&&b.aggro){ b.aggro=false; b.bstate=undefined; b.bt=undefined; b.bphase=1; b.vx=0; b.spawnT=6; b.g.rotation.z=0; b.g.scale.setScalar(1.65); bossFlash(b,false); }
    for(const en of enemies){ if(en.bossAdd&&!en.dead){ en.dead=true; en.g.visible=false; } }
    clearOrbs(); }
  message("SYSTEM RESTORED // CHECKPOINT");}
export function message(t){const m=document.getElementById("message");m.textContent=t;m.classList.remove("flash");void m.offsetWidth;m.classList.add("flash")}
function isInWater(px,py){
  for(const w of waterData){
    if(px >= w.x -0.4 && px <= w.x + w.w +0.4 && py < w.y +2.2 && py > w.y -0.6) return true;
  }
  return false;
}
function nearestPyre(){
  let best=null, bd=1e9;
  for(const p of pyreData){
    const d=Math.hypot(player.x - p.x, player.y - p.y);
    if(d<bd){ bd=d; best=p; }
  }
  if(best && bd<1.9) return best;
  return null;
}
function nearestShop(){
  let best=null, bd=1e9;
  for(const s of shopData){
    const d=Math.hypot(player.x - s.x, player.y - s.y);
    if(d<bd){ bd=d; best=s; }
  }
  if(best && bd<1.9) return best;
  return null;
}
function doPyreRest(){
  const p=nearestPyre();
  if(!p) return false;
  const mh=player.maxHp||100;
  player.hp=mh;
  player.ram=100; // HK-FEEL PASS — привал полностью восстанавливает SOUL
  // respawn enemies: revive dead non-boss enemies of the CURRENT level only (level-loads)
  const lvSet=new Set(LEVELS[currentLevelIdx].cols);
  for(const e of enemies){
    if(e.dead && !e.isBoss && lvSet.has(e.col)){
      e.dead=false; e.g.visible=true; e.hp=e.max; e.hit=0; e.telegraphT=0;
    }
  }
  // tina/market/crypt lite bosses also respawn if cleared? Only if not yet collected modules? Keep simple: do not respawn arena lites if module collected
  checkpointX=p.x; checkpointY=p.y;
  // snap checkpoint to ground
  const top=snapToGround(checkpointX, checkpointY);
  if(top!==null) checkpointY=top;
  burst(new THREE.Vector3(p.x, p.y+0.8,0), 0xFF8C1A, 24, 0.07);
  sfx.pyre();
  message("ПРИВАЛ // ОТДЫХ — HP восстановлено, враги возродились");
  showZone("ПЫЛАЮЩИЙ ПИР // ОТДЫХ");
  saveGame();
  return true;
}
function openShopPanel(shop){
  if(!shop) return false;
  currentShop=shop; shopOpen=true; discoverNpc(shop.npc);
  const overlay=document.getElementById("shopOverlay");
  const titleEl=document.getElementById("shopTitle");
  if(titleEl) titleEl.textContent=`SHOP // ${shop.name} [${shop.id}]`;
  if(overlay) overlay.style.display="block";
  message(`МАГАЗИН ${shop.name} // [1] +25HP 120ED [2] +4DMG 80ED`);
  return true;
}
function closeShopPanel(){
  const overlay=document.getElementById("shopOverlay");
  if(overlay) overlay.style.display="none";
  shopOpen=false; currentShop=null;
}
function tryBuyHp(){
  if(eddies<120){ message("НЕДОСТАТОЧНО EDDIES // нужно 120"); return false; }
  eddies-=120; player.maxHp=(player.maxHp||100)+25; player.hp=Math.min(player.maxHp, player.hp+25);
  burst(new THREE.Vector3(player.x, player.y+1,0), 0xFFD700, 18, 0.07);
  message(`+25 MAX HP // теперь ${player.maxHp} HP`);
  saveGame(); const ed=document.getElementById("eddies"); if(ed) ed.textContent=String(eddies);
  document.getElementById("hp").style.width=Math.min(100, player.hp/player.maxHp*100)+"%";
  return true;
}
function tryBuyDmg(){
  if(eddies<80){ message("НЕДОСТАТОЧНО EDDIES // нужно 80"); return false; }
  eddies-=80; player.meleeBonus=(player.meleeBonus||0)+4;
  burst(new THREE.Vector3(player.x, player.y+1,0), 0xFF2D78, 18, 0.07);
  message(`+4 MELEE // бонус теперь ${player.meleeBonus}`);
  saveGame(); const ed=document.getElementById("eddies"); if(ed) ed.textContent=String(eddies);
  return true;
}
function triggerScanner(){
  if(scannerPulseT>0) return;
  scannerPulseT=5.0;
  message("СКАНЕР // импульс 5с — сундуки и враги подсвечены");
  burst(new THREE.Vector3(player.x, player.y+1,0), 0x00F5FF, 22, 0.07);
  // chest highlight rings: add temporary torus
  for(const ch of chests){ if(openedChests.has(ch.id)) continue;
    if(ch.ringMesh) continue;
    const ringGeo=new THREE.TorusGeometry(0.85,0.06,8,20);
    const ringMat=new THREE.MeshBasicMaterial({color:0xFFE66D, transparent:true, opacity:0.85});
    const ring=new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x=Math.PI/2; ring.position.set(ch.x, ch.y+0.12, 0.2);
    scene.add(ring); ch.ringMesh=ring;
  }
}
function updateScannerRings(dt){
  for(const ch of chests){
    if(!ch.ringMesh) continue;
    if(scannerPulseT<=0){ scene.remove(ch.ringMesh); ch.ringMesh=null; continue; }
    ch.ringMesh.rotation.z+=dt*2.2;
    const scale=1+0.18*Math.sin(performance.now()*0.006 + ch.x);
    ch.ringMesh.scale.setScalar(scale);
    ch.ringMesh.material.opacity=0.55+0.3*Math.sin(performance.now()*0.008);
  }
}
function showEnding(){
  if(endingShown) return;
  endingShown=true; player.hasWon=true;
  const el=document.getElementById("ending");
  const stats=document.getElementById("endingStats");
  const elapsed=Math.floor((performance.now()-gameStartTime)/1000);
  const mins=Math.floor(elapsed/60), secs=elapsed%60;
  if(stats) stats.innerHTML=`SIGILS ${openedSigils.size}/3 · EDDIES ${eddies} · HP ${player.hp}/${player.maxHp||100} · TIME ${mins}:${String(secs).padStart(2,'0')}<br><span style="color:#8BE9FF">Нажми ENTER — рестарт · F9 — сброс сохранения</span>`;
  if(el) el.style.display="flex";
  message("ГЛИТЧ-МАТЬ ПАЛА // NEON WARDEN ЗАВЕРШЁН");
  showZone("ПОБЕДА // ENDING");
  burst(new THREE.Vector3(player.x, player.y+2,0), 0xFFE66D, 40, 0.09);
  sfx.ending();
  saveGame();
}

function isOnLadder(x,y){
  for(const ld of ladders){
    if(Math.abs(x - ld.x) < LADDER_X_TOL && y >= ld.yBottom - LADDER_Y_PAD && y <= ld.yTop + LADDER_Y_PAD) return ld;
  }
  return null;
}
let _lastGateBlockKey=null;
let _lastScreenKey=null;
let _lastScreenRow=null;
let _lastMood="base";
function triggerFade(){
  // silent world: transitions do not flash; keep for legacy compat but do nothing
  return;
}
function maybeThrottledSave(){
  const dx=Math.hypot(player.x - lastTransitionSave.x, player.y - lastTransitionSave.y);
  if(dx>5){
    const top=snapToGround(player.x, player.y);
    const cy=top!==null? top : player.y;
    checkpointX=player.x; checkpointY=cy;
    lastTransitionSave={x:player.x, y:cy};
    saveGame();
  }
  updateRoomLabel();
}
function tryGridTransition(){
  const s=currentScreen();
  if(!s) return false;
  // one continuous world: row flips via currentScreen() — quiet label + throttled save
  if(s.key !== _lastScreenKey){ if(_lastScreenRow!==null && s.row!==_lastScreenRow) sfx.door(); _lastScreenRow=s.row; _lastScreenKey=s.key; maybeThrottledSave(); }
  // E/W per screen — seamless soft event: NO reposition, NO vx=0
  if(player.x < s.originX -0.6){
    const nb=SCREENS.find(sc=>sc.col===s.col-1 && sc.row===s.row);
    if(nb){
      // west always open — silent
      _lastGateBlockKey=null;
      currentRx=nb.col; currentRy=nb.row; currentDistrict=nb.district;
      syncLevelVisibility(); // v4.1.20 — cross-level west walk re-culls immediately, not in 1s
      // quiet label, checkpoint snap-validated, throttled save
      { const top=snapToGround(player.x, player.y); if(top!==null) checkpointY=top; else checkpointY=player.y; checkpointX=player.x; }
      maybeThrottledSave();
      return true;
    } else { player.x = s.originX -0.6; if(player.vx<0) player.vx=0; }
  } else if(player.x > s.originX + GRID_W +0.6){
    const nb=SCREENS.find(sc=>sc.col===s.col+1 && sc.row===s.row);
    if(nb){
      // WAVE 0 — east gates: biome entry gates by col (fires when ENTERING the gate's col)
      const gate=GATE_PLAN.find(g=>g.dir==="E" && g.col===s.col+1);
      if(gate){
        const has = gate.req==="claw" ? !!player.hasClaw : gate.req==="wings_sigil" ? (!!player.hasWings && openedSigils.size>=3) : gate.req==="sigils3" ? openedSigils.size>=3 : false;
        if(!has){
          const key="E_"+gate.shaft;
          if(_lastGateBlockKey!==key){ message(gate.msg); _lastGateBlockKey=key; }
          player.x = s.originX + GRID_W -0.8; if(player.vx>0) player.vx=0;
          return true;
        }
      }
      // LEVEL LOAD — entering a new level's col = portal transition (новая подгрузка)
      const lvlFrom=levelOfCol(s.col), lvlTo=levelOfCol(nb.col);
      if(lvlFrom!==lvlTo){ loadLevel(nb.col); return true; }
      _lastGateBlockKey=null;
      currentRx=nb.col; currentRy=nb.row; currentDistrict=nb.district;
      { const top=snapToGround(player.x, player.y); if(top!==null) checkpointY=top; else checkpointY=player.y; checkpointX=player.x; }
      maybeThrottledSave();
      return true;
    } else {
      // beyond grid east — FINAL GATE at the world edge (last col r2): wings + 3 sigils → ending
      if(s.col===GRID_COLS-1 && s.row===2){
        const hasWings=!!player.hasWings, hasSigils=openedSigils.size>=3;
        if(hasWings && hasSigils){
          if(!endingShown){ showEnding(); }
          player.x = s.originX + GRID_W +0.6; if(player.vx>0) player.vx=0;
        } else {
          let msg="FINAL GATE // НУЖЕН КРЫЛЬЯ (арена ТИНА, 2_2) + 3 СИГИЛА ("+openedSigils.size+"/3)";
          if(!hasWings) msg="FINAL GATE // НУЖЕН КРЫЛЬЯ — арена ТИНА, затопленка восток (2_2)";
          else if(!hasSigils) msg="FINAL GATE // НУЖЕН 3 СИГИЛА ("+openedSigils.size+"/3): ГРОХОТ(1_1) МОЛЧУН(2_1) ТИНА(2_2)";
          const key="E_FINAL";
          if(_lastGateBlockKey!==key){ message(msg); _lastGateBlockKey=key; }
          player.x = s.originX + GRID_W -0.8; if(player.vx>0) player.vx=0;
        }
      } else {
        player.x = s.originX + GRID_W +0.6; if(player.vx>0) player.vx=0;
      }
    }
  }
  // N/S tiers — ONE continuous world: no teleport, no y reset. Row flips via currentScreen().
  // Gates are physical bounce-walls at tier boundaries on gated shafts (ladder/jump chain only way through).
  for(const gate of GATE_PLAN){
    if(gate.dir!=="N" && gate.dir!=="S") continue;
    const shaftX = screenOrigin(gate.col,0).x + 22;
    if(Math.abs(player.x - shaftX) > 1.6) continue;
    const yFrom = tierBaseY(gate.from.r), yTo = tierBaseY(gate.to.r);
    const boundary = (yFrom + yTo)/2;
    const has = gate.req==="legs" ? !!player.hasLegs : gate.req==="grip" ? !!player.hasGrip : gate.req==="wings" ? !!player.hasWings : (!!player.hasWings && openedSigils.size>=3);
    if(has){ continue; }
    if(gate.dir==="N" && player.prevY < boundary && player.y >= boundary){
      let best=null;
      for(const p of solids){ if(Math.abs(player.x-p.x)<=p.w/2+0.34 && p.y < boundary-0.1){ if(best===null||p.y>best) best=p.y; } }
      player.y = best!==null? best : boundary-0.8; if(player.vy>0) player.vy=0;
      const key="GB_"+gate.shaft;
      if(_lastGateBlockKey!==key){ message(gate.msg); _lastGateBlockKey=key; }
    } else if(gate.dir==="S" && player.prevY > boundary && player.y <= boundary){
      let best=null;
      for(const p of solids){ if(Math.abs(player.x-p.x)<=p.w/2+0.34 && p.y > boundary+0.1){ if(best===null||p.y<best) best=p.y; } }
      player.y = best!==null? best : boundary+0.8; if(player.vy<0) player.vy=0;
      const key="GB_"+gate.shaft;
      if(_lastGateBlockKey!==key){ message(gate.msg); _lastGateBlockKey=key; }
    }
  }
  return false;
}
function tryRoomTransition(){
  if(LEGACY){
    if(!USE_MARKET && !USE_CRYPT) return false;
    const inCrypt = USE_CRYPT && player.x >= CRYPT_ORIGIN_X - 20;
    const useCrypt = inCrypt;
    const neighborFn = useCrypt ? cryptRoomNeighbor : roomNeighbor;
    const originFn = useCrypt ? cryptZoneOrigin : zoneOrigin;
    const prefix = useCrypt ? "crypt" : "market";
    if(player.y > ROOM_TOP_Y){
      const nb = neighborFn(currentRx, currentRy, "N");
      if(nb){
        const oldOrigin = originFn(currentRx, currentRy);
        const newOrigin = originFn(nb.rx, nb.ry);
        const rel = player.x - oldOrigin;
        const clampedRel = clamp(rel, 0, 40);
        currentRx = nb.rx; currentRy = nb.ry; currentDistrict = prefix;
        player.x = newOrigin + clampedRel;
         player.y = ROOM_BOTTOM_Y + 0.6;
         player.vy = 0;
         checkpointX = player.x; checkpointY = player.y;
         message("KOMNATA " + prefix + "_" + currentRx + "_" + currentRy);
         showZone("KOMNATA // " + prefix + "_" + currentRx + "_" + currentRy);
         saveGame();
         updateRoomLabel();
         return true;
       } else {
         player.y = ROOM_TOP_Y; player.vy = 0;
       }
     } else if(player.y < ROOM_BOTTOM_Y -0.25){
       const nb = neighborFn(currentRx, currentRy, "S");
       if(nb){
         const oldOrigin = originFn(currentRx, currentRy);
         const newOrigin = originFn(nb.rx, nb.ry);
         const rel = player.x - oldOrigin;
         const clampedRel = clamp(rel, 0, 40);
         currentRx = nb.rx; currentRy = nb.ry; currentDistrict = prefix;
         player.x = newOrigin + clampedRel;
         player.y = ROOM_TOP_Y - 0.8;
         player.vy = 0;
         checkpointX = player.x; checkpointY = player.y;
         message("KOMNATA " + prefix + "_" + currentRx + "_" + currentRy);
         showZone("KOMNATA // " + prefix + "_" + currentRx + "_" + currentRy);
         saveGame();
         updateRoomLabel();
         return true;
      }
    }
    return false;
  } else {
    return tryGridTransition();
  }
}
function checkPitFall(){
  if(pits.length===0) return false;
  if(player.y < 0.65){
    for(const pit of pits){
      if(player.x >= pit.x && player.x <= pit.x2){
        message("HAZARD // PIT FALL");
        respawn();
        return true;
      }
    }
  }
  return false;
}
function kill(e){
  e.dead=true;e.g.visible=false;burst(new THREE.Vector3(e.x,e.y,0),e.type?0xff3ea5:0x62f6ff,40,.07);shards+=e.type?20:5; sfx.kill(); discoverEnemy(e.isGlitchMother?"glitch":e.etype);
  // HK-FEEL PASS — soul on kill + hitstop/shake punctuation on boss-lite deaths
  player.ram=clamp(player.ram+SOUL_PER_KILL,0,100);
  burst(new THREE.Vector3(e.x,e.y+0.8,0),0xEAFBFF,6,.045,{aim:{x:player.x,y:player.y+1},speed:8,life:.5,gravity:0});
  if(e.isBoss){ hitstopT=Math.max(hitstopT,0.22); addShake(0.9,0.5); postFlash(0.4,0xffffff); }
  else { hitstopT=Math.max(hitstopT,0.05); addShake(0.18,0.12); }
  if(e.flashT!==undefined){ const core=e.g.userData.core; if(core && e.baseEmissive!==undefined){ matFlash(core.material,e.baseEmissive); matFlashIntensity(core.material,e.baseIntensity); } }
  if(e.isBoss && e.isGlitchMother){
    clearOrbs(); bossFlash(e,false);
    document.getElementById("boss").style.display="none";exitOpen=true;finalGate.material=mats.cyan;message("ГЛИТЧ-МАТЬ ПАЛА // ПУТЬ НА ВОСТОК ОТКРЫТ");showZone("ПУТЬ // ОТКРЫТ");
  } else if(e.isBoss){document.getElementById("boss").style.display="none";exitOpen=true;finalGate.material=mats.cyan;message("ARCHIVIST // CORE DECRYPTED");showZone("FINAL GATE // UNLOCKED");}
  if(e.isBossLite){ burst(new THREE.Vector3(e.x,e.y,0),0xff3ea5,14,0.06); }
}

loadGame();
// snap checkpoints at boot — fix known-bad entries to nearest platform top
function snapOrNearest(x,y){
  const top=snapToGround(x,y);
  if(top!==null) return {x, y:top};
  let best=null, bestDx=1e9;
  for(const p of solids){ const dx=Math.abs(x-p.x); const dy=Math.abs(p.y - y); if(dy<=3 && dx<bestDx){ bestDx=dx; best=p; } }
  if(best) return {x:best.x, y:best.y};
  return null;
}
for(const c of checkpoints){ const s=snapOrNearest(c.x,c.y); if(s){ c.x=s.x; c.y=s.y; } }
// also validate current checkpoint (from loadGame or default spawn) — fallback to spawn if void
{ const top=snapToGround(checkpointX,checkpointY); if(top!==null) checkpointY=top; else { const s=snapOrNearest(checkpointX,checkpointY); if(s){ checkpointX=s.x; checkpointY=s.y; } else { if(LEGACY){checkpointX=-24; checkpointY=1.1;} else { checkpointX=SPAWN.x; const s2=snapToGround(SPAWN.x,SPAWN.y); checkpointY=s2!==null?s2:SPAWN.y; } } } }
// also validate player position after load (may be stale void)
{ const top=snapToGround(player.x,player.y); if(top===null && (player.x!==SPAWN.x || player.y!==SPAWN.y)){ const fb=snapToGround(checkpointX,checkpointY); if(fb!==null){ player.x=checkpointX; player.y=fb+0.1; } else { const s=snapOrNearest(checkpointX,checkpointY); if(s){ player.x=s.x; player.y=s.y+0.1; } else { player.x=SPAWN.x; player.y=SPAWN.y+0.1; } } } }
if(legsCollected) player.hasLegs = true;
if(gripCollected) player.hasGrip = true;
if(wingsCollected) player.hasWings = true;
if(arenaTriggered && !legsCollected && !player.hasLegs && arenaEnemies.length===0){
  arenaTriggered = false;
}
if(cryptArenaTriggered && !gripCollected && !player.hasGrip && cryptArenaEnemies.length===0){
  cryptArenaTriggered = false;
}
if(tinaTriggered && !wingsCollected && !player.hasWings && tinaEnemies.length===0){
  tinaTriggered = false;
}
if(player.hasWon) endingShown=true;
updateRoomLabel();
initChests();
// WAVE 0 — level loads: показываем только текущий уровень (Level 1 = cols 0-3)
{
  const lvl=LEVELS[currentLevelIdx]||LEVELS[0];
  setBiomeVisibility(lvl.cols);
  const lvSet=new Set(lvl.cols);
  for(const e of enemies){ e.g.visible = !e.dead && lvSet.has(e.col); }
}
if(wingsCollected) { /* keep wings mesh removed */ }
try{ const ed=document.getElementById("eddies"); if(ed) ed.textContent=String(eddies); const sh=document.getElementById("shards"); if(sh) sh.textContent=String(shards);}catch(e){}
if(player.hasWon){ setTimeout(()=>{ try{ showEnding(); }catch(e){} }, 600); }

const keys={};addEventListener("keydown",e=>{
  if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
  keys[e.code]=true;
  if(endingShown && e.code==="Enter"){ // restart from ending
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({hasWon:false})); }catch(_e){} location.reload(); return;
  }
  audioStart();
  // MENU FLOW — intercept while in menus (splash → title → creation → play) + pause + encyclopedia
  if(menu.state==="splash"){ e.preventDefault(); showTitle(); return; }
  if(menu.state==="creation"){
    if(e.code==="Enter"){ e.preventDefault(); confirmCreation(); return; }
    if(e.code==="Escape"){ showTitle(); return; }
    if(e.code==="Digit1"||e.code==="Digit2"||e.code==="Digit3"){ setLifepathByKey(e.code); return; }
    return; // typing goes to the DOM input
  }
  if(menu.state==="title"){
    if(e.code==="KeyW"||e.code==="ArrowUp"){ if(!e.repeat){ menu.titleIdx=(menu.titleIdx+TITLE_ITEMS.length-1)%TITLE_ITEMS.length; renderTitle(); } return; }
    if(e.code==="KeyS"||e.code==="ArrowDown"){ if(!e.repeat){ menu.titleIdx=(menu.titleIdx+1)%TITLE_ITEMS.length; renderTitle(); } return; }
    if(e.code==="Enter"||e.code==="Space"){ e.preventDefault(); selectTitle(); return; }
    return;
  }
  if(menu.encOpen){ if(e.code==="Tab"||e.code==="Escape"){ e.preventDefault(); hideEnc(); } return; }
  if(menu.paused){
    if(e.code==="Escape"||e.code==="Enter"){ e.preventDefault(); hidePause(); }
    else if(e.code==="KeyX"){ hidePause(); showTitle(); }
    return;
  }
  if(!started) return;
  if(e.code==="Tab" && !e.repeat){ showEnc(); return; }
  if(e.code==="Escape"){ if(shopOpen){ closeShopPanel(); } else { showPause(); } return; }
  if(started&&(e.code==="Space"||e.code==="ArrowUp"))player.jbuf=.12;
  // HK-FEEL PASS — directional nail: S+J = down-slash (POGO), W+J = up-slash (anti-air), J = sweep
  if(started&&e.code==="KeyJ"){
    let dir="side";
    if(keys.KeyS||keys.ArrowDown) dir="down";
    else if((keys.KeyW||keys.ArrowUp) && !player.climbing && !player.onLadder) dir="up";
    attack(dir);
  }
  if(started&&e.code==="KeyK")dash();
  if(started&&e.code==="KeyL")hack(enemies,kill,message);
  if(started&&e.code==="ShiftLeft" && !e.repeat){ triggerScanner(); }
  if(started&&e.code==="KeyE"){
    if(shopOpen){ closeShopPanel(); return; }
    let opened=false;
    opened=tryOpenChest()||opened;
    opened=tryPickupLegs()||opened;
    opened=tryPickupGrip()||opened;
    opened=tryPickupWings()||opened;
    opened=doPyreRest()||opened;
    if(!opened){
      const shop=nearestShop();
      if(shop){ opened=openShopPanel(shop)||opened; }
    }
    if(!opened){
      const nc=nearestChest();
      const np=nearestPyre();
      const ns=nearestShop();
      if(nc) message("CHEST // "+Math.round(Math.hypot(player.x-nc.x, player.y-nc.y)*10)/10+"m");
      else if(np) message("PYRE // ПРИВАЛ [E]");
      else if(ns) message("SHOP // "+ns.name+" [E]");
    }
  }
  if(started&&e.code==="Digit1" && shopOpen){ tryBuyHp(); }
  if(started&&e.code==="Digit2" && shopOpen){ tryBuyDmg(); }
});addEventListener("keyup",e=>keys[e.code]=false);let started=false;
// MENU FLOW boot — autostart (fresh save from creation) or splash → title
try{ window.__NW_STAGE="boot"; }catch(e){}
if(autostartPending){ started=true; try{ const raw=localStorage.getItem(STORAGE_KEY); if(raw){ const d=JSON.parse(raw); localStorage.setItem(STORAGE_KEY, JSON.stringify({...d, autostart:false})); } }catch(e){} }
try{ menu.saveExists=!!localStorage.getItem(STORAGE_KEY); }catch(e){ menu.saveExists=false; } // sandboxed contexts (file://, iframes) may throw on localStorage
// COMPAT v4.1.11 — menu UI is nice-to-have, gameplay is the product: if the menu flow throws
// on a hostile environment, fall straight into play instead of a grey void
try{
  if(!started){ showSplash(); setTimeout(()=>{ if(menu.state==="splash") showTitle(); },1600); } else { toPlay(); }
}catch(e){
  try{ window.__NW_ERR="boot-menu: "+(e&&e.message||e); }catch(e2){}
  started=true;
  try{ toPlay(); }catch(e3){}
}
let debug=false;
addEventListener("keydown",e=>{if(e.code==="F3"){debug=!debug;document.getElementById("message").textContent=debug?"DEBUG // stats 0.5s":" ";}});
// PERF PASS — F3 live stats (FPS / draw calls / triangles / quality), refreshed 2×/sec only in debug
// menu state reporter for the stage line
setInterval(()=>{ try{ window.__NW_MENU=(started?"":"nostart ")+menu.state+(menu.paused?"+pause":"")+(menu.encOpen?"+enc":""); }catch(e){} },1000);
// heartbeat status line: independent of keys and of the loop — always tells the truth
setInterval(()=>{ try{
  const hb=document.getElementById("hbLine");
  if(hb){
    const alive=_hb!==_hbLast;
    hb.textContent=`loop:${alive?"ok":"HANG"} fps:${Math.round(_fps)} stage:${_stage} present:${blitOn?"blit":"direct"} eco:${ecoMode?1:0} perf:${perfMode}`;
    hb.style.opacity=(started&&!menuBlocked())?"0.85":"0.3";
  }
}catch(e){} },1000);
setInterval(()=>{ try{
  const el=document.getElementById("message");
  if(!el) return;
  if(!debug){ el.style.opacity=""; return; } // #message is opacity:0 by default — stats were invisible!
  const info=renderer.info.render;
  el.style.opacity="1";
  el.textContent=`FPS ${Math.round(_fps)} · CALLS ${info.calls} · TRIS ${(info.triangles/1000).toFixed(0)}k · ${perfMode?(ecoMode?"PERF+ECO":"PERF"):"QUALITY"} · present:${blitOn?"blit":"direct"} (P/B)`;
}catch(e){} },500);
addEventListener("keydown",e=>{if(e.code==="KeyM"&&!e.repeat){ toggleMute(); }});
addEventListener("keydown",e=>{if(e.code==="F9"){try{localStorage.removeItem(STORAGE_KEY);}catch(_e){} location.reload();}});

// WAVE 0 — LEVEL LOAD: новая подгрузка уровня (портал на краю биома → фейд → новые меши/фон/враги)
function triggerFadeWhite(){
  try{ const f=document.getElementById("screenFade"); if(f){ f.style.transition="none"; f.style.opacity="0.9"; setTimeout(()=>{ f.style.transition="opacity .5s ease"; f.style.opacity="0"; }, 90); } }catch(e){}
}
function loadLevel(entryCol){
  clearOrbs(); // HK-FEEL PASS — never carry boss projectiles across a level load
  const lvl=levelOfCol(entryCol);
  currentLevelIdx=LEVELS.indexOf(lvl);
  setBiomeVisibility(lvl.cols);
  // enemies: показываем только уровень (dead остаются скрыты)
  const set=new Set(lvl.cols);
  for(const e of enemies){ e.g.visible = !e.dead && set.has(e.col); }
  // player at the level's entry (entry col floor)
  const s=getScreen(entryCol,2);
  player.x=s.originX+8; player.y=s.baseY+1.8; player.vx=0; player.vy=0;
  const top=snapToGround(player.x,player.y); if(top!==null) player.y=top+0.1;
  checkpointX=player.x; checkpointY=player.y;
  triggerFadeWhite();
  sfx.door();
  message(lvl.name);
  showZone(lvl.name);
  saveGame(); updateRoomLabel();
}

// MENU FLOW — title/creation handlers (edge-triggered from keydown)
function selectTitle(){
  const it=TITLE_ITEMS[menu.titleIdx];
  if(!it) return;
  if(it.id==="new"){ showCreation(); }
  else if(it.id==="continue"){ toPlay(); started=true; audioStart(); message("С ВОЗВРАЩЕНИЕМ, "+menu.heroName); }
  else if(it.id==="enc"){ showEnc(); }
}
function setLifepathByKey(code){
  const i=code==="Digit1"?0:code==="Digit2"?1:2;
  menu.lifepath=LIFEPATHS[i]?LIFEPATHS[i].id:"street";
  renderCreation();
}
function confirmCreation(){
  try{ const inp=document.getElementById("crName"); if(inp && inp.value.trim()) menu.heroName=inp.value.trim().slice(0,12).toUpperCase(); }catch(e){}
  const st = menu.lifepath==="street"? {meleeBonus:4,maxHp:100,hackCost:33,speedBonus:0} : menu.lifepath==="netrunner"? {meleeBonus:0,maxHp:100,hackCost:18,speedBonus:0} : {meleeBonus:0,maxHp:125,hackCost:33,speedBonus:0.8}; // v4: базовая цена хака = FOCUS_COST (33), нетраннер-путь = 18
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    let d={}; if(raw){ try{ d=JSON.parse(raw); }catch(e){} }
    const disc=d.discovery||{};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hasLegs:false, hasGrip:false, hasWings:false, hasWon:false, maxHp:st.maxHp, meleeBonus:st.meleeBonus, hackCost:st.hackCost, speedBonus:st.speedBonus, checkpointX:-24, checkpointY:1.1, currentRx:0, currentRy:2, currentDistrict:"base", arenaTriggered:false, legsCollected:false, cryptArenaTriggered:false, gripCollected:false, tinaTriggered:false, wingsCollected:false, eddies:0, shards:0, opened:[], sigils:[], discovery:disc, heroName:menu.heroName, lifepath:menu.lifepath, autostart:true }));
  }catch(e){}
  // COMPAT v4.1.13 — NO reload: on file:// Chrome treats each load as a unique origin, so the
  // autostart save could vanish on reload → infinite title→creation→reload→title loop.
  // Apply the new warden in-memory and jump straight into play.
  player.meleeBonus=st.meleeBonus; player.maxHp=st.maxHp; player.hp=st.maxHp;
  player.hackCost=st.hackCost; player.speedBonus=st.speedBonus;
  openedChests=new Set(); openedSigils=new Set(); shards=0; eddies=0;
  levelComplete=false; exitOpen=false;
  checkpointX=SPAWN.x; checkpointY=SPAWN.y;
  const _top=snapToGround(SPAWN.x,SPAWN.y); if(_top!==null) checkpointY=_top;
  player.x=SPAWN.x; player.y=checkpointY+0.1; player.vx=0; player.vy=0; player.inv=1.2;
  started=true; toPlay(); audioStart(); saveGame();
  message("ВАРДЕН СОЗДАН // "+menu.heroName); showZone("НЕОН-ГОРОД // ТЕРРИТОРИЯ 1");
}

export function moveAxis(){return (keys.KeyA||keys.ArrowLeft?-1:0)+(keys.KeyD||keys.ArrowRight?1:0)}
export function resolvePlatforms(dt=0){
  // drop-through one-way: skip snap while dropT>0 (decrement by dt)
  if(player.dropT>0){
    if(dt>0) player.dropT=Math.max(0, player.dropT - dt);
    // skip platform snap while dropT>0 — one-way fall-through window
    player.ground=false;
    return;
  }
  // climbing: skip snap so ladder descent passes through chain platforms (release = fall & land)
  if(player.climbing){
    player.ground=false;
    return;
  }
  const falling=player.vy<=0;
  player.ground=false;
  const footHalf=.34;
  for(const p of solids){
    const left=p.x-p.w/2-footHalf, right=p.x+p.w/2+footHalf;
    const topY=p.y, botY=p.y-1.1;
    // land from above (falling) — one-way top surface
    const crossedDown=player.prevY>=topY-.02 && player.y<=topY+.02;
    if(falling && player.x>=left && player.x<=right && crossedDown){
      player.y=topY; player.vy=0; player.ground=true;
    }
    // ART PASS strict physics — bonk from below: rising into a slab underside is blocked
    else if(!falling && player.x>=left && player.x<=right && player.prevY<=botY+.02 && player.y>botY+.02){
      player.y=botY-.02; player.vy=0;
    }
  }
  // ART PASS strict physics — side push-out: body inside a slab is pushed to the nearest edge
  for(const p of solids){
    const topY=p.y, botY=p.y-1.1;
    if(player.y>botY+.08 && player.y<topY-.08){
      const left=p.x-p.w/2-footHalf, right=p.x+p.w/2+footHalf;
      if(player.x>=left && player.x<=right){
        player.x = (player.x-p.x>0)? right+.02 : left-.02;
        if((player.x-p.x>0 && player.vx<0)||(player.x-p.x<=0 && player.vx>0)) player.vx=0;
      }
    }
  }
}
// HK-FEEL PASS — SOUL economy: nail hits are the ONLY way to refill RAM (no passive regen).
// Every landed hit feeds the soul vessel, which funds both FOCUS healing and quickhack.
function gainSoul(n){
  const before=player.ram;
  player.ram=clamp(player.ram+n,0,100);
  if(player.ram>before) player.soulFlash=0.35;
}
// directional hitboxes: side (HK nail sweep), up (anti-air / ceiling crawlers), down (POGO)
function attackHitbox(e){
  const dx=e.x-player.x, dy=(e.y+1)-(player.y+1);
  const dir=player.attackDir||"side";
  if(dir==="down"){
    // POGO: strike BELOW the warden — the signature HK bounce lever
    if(dy>0.25) return false;
    return Math.abs(dx)<(e.isBoss?2.4:1.5) && Math.abs(dy)<(e.isBoss?3.0:2.3);
  }
  if(dir==="up"){
    if(dy<-0.25) return false;
    return Math.abs(dx)<(e.isBoss?2.4:1.5) && Math.abs(dy)<(e.isBoss?3.0:2.4);
  }
  return Math.abs(dx)<(e.isBoss?2.6:1.75) && Math.abs(dy)<(e.isBoss?2.2:1.65) && dx*player.face>-.35;
}
// v4.1.16 — material-agnostic hit/telegraph flash: ECO bakes materials to unlit
// MeshBasicMaterial (no .emissive); flashing .color there gives the same readable pop.
function matFlash(mat,hex){ if(!mat) return; if(mat.emissive) mat.emissive.setHex(hex); else if(mat.color) mat.color.setHex(hex); }
function matFlashBase(mat){ if(!mat) return 0; return mat.emissive? mat.emissive.getHex() : (mat.color? mat.color.getHex() : 0); }
function matFlashIntensity(mat,v){ if(mat&&mat.emissive) mat.emissiveIntensity=v; }
// COMPAT v4.1.18 — level-visibility sync: respawn/any cross-level teleport used to leave
// setBiomeVisibility at the OLD level's cols → whole columns of platform chunks stayed hidden
// while physics (solids) kept working = "walking on air" (user case: died in col4, respawned col1).
export function syncLevelVisibility(){
  const scr=currentScreen();
  if(!scr) return;
  const lvl=levelOfCol(scr.col);
  const li=LEVELS.indexOf(lvl);
  if(li===currentLevelIdx) return;
  currentLevelIdx=li;
  setBiomeVisibility(lvl.cols);
  const set=new Set(lvl.cols);
  for(const e of enemies){ e.g.visible=!e.dead&&set.has(e.col); }
  try{ saveGame(); }catch(e){}
}
function hurtEnemies(){
  if(player.attack<=0) return;
  const dmgBase = 24 + (player.meleeBonus||0);
  const dmgBoss = 20 + Math.floor((player.meleeBonus||0)/2); // WAVE 0 fix: boss killable (was 12 → 29 hits)
  const dir=player.attackDir||"side";
  let landedAny=false;
  for(const e of enemies){if(e.dead||e.g.visible===false||e.lastHitId===player.attackId)continue;
    if(!attackHitbox(e)) continue;
    const dmg = e.isBoss? dmgBoss : dmgBase;
    e.hp-=dmg;e.hit=.12;e.vx=(dir==="down"?player.face*3:player.face*7);e.lastHitId=player.attackId;
    if(dir!=="down"&&e.etype!=="dog"&&e.etype!=="netrunner") e.vy=3.2;
    hitstopT=Math.max(hitstopT,0.07); impactRing(new THREE.Vector3(e.x,e.y+1,0),0xffe66d); sfx.hit();
    if(e.baseEmissive===undefined||e.baseEmissive===null){ const core=e.g.userData.core; if(core && core.material){ e.baseEmissive=matFlashBase(core.material); e.baseIntensity=core.material.emissive?core.material.emissiveIntensity:1; } }
    if(e.g.userData.core && e.g.userData.core.material){ matFlash(e.g.userData.core.material,0xffffff); matFlashIntensity(e.g.userData.core.material,6); }
    e.flashT=0.08;
    burst(new THREE.Vector3(e.x,e.y+1,0),0xffe66d,10,.05); popup("-"+dmg, false);
    gainSoul(e.isBoss?6:11);
    landedAny=true;
    // POGO — down-slash on a target while airborne bounces the warden up and refreshes the swing,
    // which is what makes HK's "hop-hop-hop over hazards" rhythm possible.
    if(dir==="down" && !player.ground){
      player.vy=12.4; player.attack=Math.max(player.attack,0.10); player.attackCd=Math.min(player.attackCd,0.16);
      burst(new THREE.Vector3(e.x,e.y+1.2,0),0xBFF6FF,12,.055);
      impactRing(new THREE.Vector3(player.x,player.y+0.2,0),0xBFF6FF);
      addShake(0.22,0.14); sfx.pogo();
    }
    if(e.hp<=0)kill(e)}
  if(!landedAny && dir!=="side" && player.attackFx<=0){
    // whiffed up/down swing still reads: small arc, no hitstop
    slashArc(new THREE.Vector3(player.x+player.face*.4,player.y+(dir==="up"?2.0:0.2),.2),player.face,0x7FD8E8,dir);
    player.attackFx=.3;
  }}
// ── HK-FEEL PASS — boss projectile system: fair, dodgeable, telegraphed (no more instant hitscan beams) ──
const orbs=[];
let orbGeo=null, orbGlowTex=null;
const orbMats={};
function getOrbMat(color){
  if(!orbMats[color]){
    const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.98});
    m.toneMapped=false;
    orbMats[color]=m;
  }
  return orbMats[color];
}
function makeOrbGlow(){
  if(orbGlowTex) return orbGlowTex;
  const c=document.createElement("canvas"); c.width=64; c.height=64;
  const x=c.getContext("2d");
  const g=x.createRadialGradient(32,32,2,32,32,30);
  g.addColorStop(0,"rgba(255,255,255,0.85)"); g.addColorStop(0.35,"rgba(255,255,255,0.28)"); g.addColorStop(1,"rgba(0,0,0,0)");
  x.fillStyle=g; x.fillRect(0,0,64,64);
  orbGlowTex=new THREE.CanvasTexture(c);
  return orbGlowTex;
}
// spawnOrb(x,y,vx,vy,opts{speed handled by caller}, color, dmg, label)
function spawnOrb(x,y,vx,vy,color=0x7A4CFF,dmg=12,label="БОСС",scale=1){
  if(!orbGeo) orbGeo=new THREE.SphereGeometry(0.17,10,8);
  const g=new THREE.Group();
  const core=new THREE.Mesh(orbGeo,getOrbMat(color)); core.toneMapped=false; g.add(core);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:makeOrbGlow(),color,transparent:true,opacity:0.8,depthWrite:false,blending:THREE.AdditiveBlending}));
  glow.scale.setScalar(1.15*scale); g.add(glow);
  g.position.set(x,y,0.15); g.scale.setScalar(scale);
  scene.add(g);
  orbs.push({g,x,y,vx,vy,life:4.2,dmg,label,color,trailT:0});
}
function killOrb(o,splat=true){
  if(splat){ burst(new THREE.Vector3(o.x,o.y,0),o.color,8,.05,{life:.3}); }
  scene.remove(o.g);
  const i=orbs.indexOf(o); if(i>=0) orbs.splice(i,1);
}
function updateOrbs(dt){
  for(let i=orbs.length-1;i>=0;i--){
    const o=orbs[i];
    o.life-=dt;
    o.x+=o.vx*dt; o.y+=o.vy*dt;
    o.g.position.set(o.x,o.y,0.15);
    o.g.rotation.z+=dt*6;
    // trail motes
    o.trailT-=dt;
    if(o.trailT<=0){ o.trailT=0.05; burst(new THREE.Vector3(o.x,o.y,0),o.color,1,.04,{life:.22,gravity:0,spread:.2}); }
    // player collision
    if(player.inv<=0 && Math.abs(o.x-player.x)<0.75 && o.y>player.y-0.2 && o.y<player.y+1.9){
      damagePlayer(o.dmg,o.label,o.x);
      killOrb(o); continue;
    }
    // platform collision (only while moving downward-ish or slow) — splat on slab tops
    let splat=false;
    for(const p of solids){
      if(Math.abs(o.x-p.x)<=p.w/2+0.15 && o.y<=p.y+0.12 && o.y>=p.y-1.0){ splat=true; break; }
    }
    if(splat || o.life<=0 || o.y<-2){ killOrb(o,splat||o.life<=0); continue; }
  }
}
function clearOrbs(){ for(let i=orbs.length-1;i>=0;i--){ scene.remove(orbs[i].g); orbs.splice(i,1); } }
export function orbCount(){ return orbs.length; } // test/observability hook
// aimed orb helper: from (x,y) toward (tx,ty) at speed
function fireAimedOrb(x,y,tx,ty,speed,color,dmg,label,scale=1,jitter=0){
  let dx=tx-x, dy=ty-y; const d=Math.max(0.001,Math.hypot(dx,dy));
  if(jitter){ const a=Math.atan2(dy,dx)+(Math.random()-0.5)*jitter; dx=Math.cos(a); dy=Math.sin(a); }
  else { dx/=d; dy/=d; }
  spawnOrb(x+dx*0.5,y+dy*0.5,dx*speed,dy*speed,color,dmg,label,scale);
  sfx.orb();
}

// ── HK-FEEL PASS — ГЛИТЧ-МАТЬ: full pattern boss (3 phases, telegraphs, punish windows) ──
// HK boss grammar: every attack has a windup (readable flash), a fast execution, and a recovery
// window where the boss is vulnerable. Charge → wall slam → stun is the classic punish beat.
function bossArenaBounds(e){
  const sc=SCREENS.find(s=>s.col===3&&s.row===2);
  return { minX: sc.originX+3, maxX: sc.originX+GRID_W-3, baseY: sc.baseY };
}
function bossSetState(e,st,t){ e.bstate=st; e.bt=t; }
function bossFlash(e,on){
  const r=e.g.userData;
  if(on){ if(r.core&&r.core.material){ if(e.baseEmissive===null||e.baseEmissive===undefined){ e.baseEmissive=matFlashBase(r.core.material); e.baseIntensity=r.core.material.emissive?r.core.material.emissiveIntensity:1; } matFlash(r.core.material,0xff2d78); matFlashIntensity(r.core.material,5.5); } }
  else if(r.core&&r.core.material&&e.baseEmissive!==null&&e.baseEmissive!==undefined){ matFlash(r.core.material,e.baseEmissive); matFlashIntensity(r.core.material,e.baseIntensity); }
  if(r.eye) r.eye.scale.setScalar(on? 1.8 : 1);
}
function countAdds(){ let n=0; for(const e of enemies){ if(!e.dead&&e.bossAdd) n++; } return n; }
function glitchMotherAI(e,dt){
  e.phase+=dt;
  const ab=bossArenaBounds(e);
  const hpFrac=e.hp/e.max;
  // aggro gate: sleeps until the fight is actually on (proximity alone re-triggered the intro
  // roar/message every frame the warden stood nearby — classic state-machine leak)
  if(!e.aggro){
    e.vx=lerp(e.vx,0,dt*3);
    e.g.position.y=e.y+Math.sin(e.phase*1.4)*0.25;
    if(e.g.visible && Math.abs(player.x-e.x)<20 && Math.abs(player.y-e.y)<14){
      e.aggro=true; bossSetState(e,"intro",1.3);
      sfx.roar(); addShake(0.5,0.7); postFlash(0.25,0x7A4CFF);
      message("ГЛИТЧ-МАТЬ ПРОБУДИЛАСЬ"); showZone("ГЛИТЧ-МАТЬ // МАТЬ ВСЕХ ПОМЕХ");
      burst(new THREE.Vector3(e.x,e.y+1,0),0x7A4CFF,26,.08);
    }
    return;
  }
  // phase transitions at 66% / 33%
  if(e.bphase===undefined) e.bphase=1;
  if(e.bphase===1 && hpFrac<=0.66){ e.bphase=2; bossSetState(e,"roar",1.0); sfx.phase(); addShake(0.55,0.6); message("ФАЗА 2 // ПОМЕХИ УСИЛИВАЮТСЯ"); burst(new THREE.Vector3(e.x,e.y+1,0),0xFF2D78,24,.08); }
  else if(e.bphase===2 && hpFrac<=0.33){ e.bphase=3; bossSetState(e,"roar",1.0); sfx.roar(); addShake(0.7,0.8); postFlash(0.3,0xFF2D78); message("ФАЗА 3 // ЯДРО НЕОН-ГОРОДА ТРЕЩИТ"); burst(new THREE.Vector3(e.x,e.y+1,0),0x39FF14,28,.09); }
  if(e.bt===undefined){ bossSetState(e,"idle",0.8); }
  e.bt-=dt;
  const P=e.bphase;
  const hover=e.y+Math.sin(e.phase*(P===3?3.1:2.0))*0.35;
  switch(e.bstate){
    case "intro": case "roar": {
      e.vx*=0.86; bossFlash(e,Math.floor(e.phase*10)%2===0);
      e.g.scale.setScalar(1.65*(1+Math.sin(e.phase*18)*0.04));
      if(e.bt<=0){ bossFlash(e,false); e.g.scale.setScalar(1.65); bossSetState(e,"idle",P===3?0.35:P===2?0.5:0.7); }
      break;
    }
    case "idle": {
      // drift toward player, pick next pattern
      e.vx=lerp(e.vx,clamp((player.x-e.x)*0.9,-3.2,3.2),dt*3);
      if(Math.abs(player.x-e.x)>1.2) e.face=Math.sign(player.x-e.x);
      if(e.bt<=0){
        const r=Math.random();
        if(P===1){ bossSetState(e, r<0.62? "wind_beam" : "wind_charge", 0.55); }
        else if(P===2){ bossSetState(e, r<0.4? "wind_beam" : r<0.72? "wind_charge" : "tele_wind", r<0.4?0.5:0.5); }
        else { bossSetState(e, r<0.3? "wind_burst" : r<0.58? "wind_charge" : r<0.8? "wind_beam" : "tele_wind", 0.42); }
        if(e.bstate==="wind_charge"){ e.chargeDir=Math.sign(player.x-e.x)||1; sfx.charge(); }
        if(e.bstate==="wind_beam"||e.bstate==="wind_burst") bossFlash(e,true);
      }
      break;
    }
    case "wind_beam": {
      e.vx*=0.8;
      bossFlash(e,Math.floor(e.phase*14)%2===0);
      if(e.bt<=0){
        bossFlash(e,false);
        const n=P>=3?3:P>=2?2:1;
        for(let i=0;i<n;i++) fireAimedOrb(e.x,e.y+1.1,player.x,player.y+1,9.5+i*0.6,0x7A4CFF,13,"ГЛИТЧ-СНАРЯД",1.15,n>1?0.5:0);
        burst(new THREE.Vector3(e.x,e.y+1.1,0),0x7A4CFF,10,.05);
        bossSetState(e,"idle",P===3?0.75:P===2?0.95:1.15);
      }
      break;
    }
    case "wind_charge": {
      // crouch + blink: direction locked at windup start (fair dodge)
      e.vx*=0.7;
      e.g.scale.setScalar(1.65*(1-0.12*Math.min(1,(0.5-e.bt)*2)));
      if(Math.floor(e.phase*16)%2===0) bossFlash(e,true);
      if(e.bt<=0){
        bossFlash(e,false); e.g.scale.setScalar(1.65);
        e.vx=e.chargeDir*(P===3?17:14.5);
        bossSetState(e,"charge",1.6); sfx.dash();
      }
      break;
    }
    case "charge": {
      // scream across the arena; body-check does 16; wall impact → stun (punish window)
      const hitWall=(e.x<=ab.minX&&e.vx<0)||(e.x>=ab.maxX&&e.vx>0);
      if(hitWall||e.bt<=0){
        e.x=clamp(e.x,ab.minX,ab.maxX); e.vx=0;
        addShake(0.85,0.4); sfx.slam(); postFlash(0.18,0xFF2D78);
        burst(new THREE.Vector3(e.x,e.y+0.6,0),0xFF8C1A,26,.09);
        impactRing(new THREE.Vector3(e.x,e.y+0.8,0),0xFFD700);
        bossSetState(e,"stun",P===3?0.85:P===2?1.0:1.25);
      } else if(player.inv<=0 && Math.abs(player.x-e.x)<1.5 && Math.abs(player.y-e.y)<2.2){
        damagePlayer(16,"ТАРАН ГЛИТЧ-МАТЕРИ",e.x);
      }
      break;
    }
    case "stun": {
      // vulnerable: sparks + wobble — HK "stab the downed boss" beat
      e.vx*=0.85;
      e.g.rotation.z=Math.sin(e.phase*22)*0.06;
      if(Math.random()<0.25) burst(new THREE.Vector3(e.x+(Math.random()-0.5)*2,e.y+1.6,0),0xFFE66D,2,.04,{life:.3});
      if(e.bt<=0){ e.g.rotation.z=0; bossSetState(e,"idle",0.45); }
      break;
    }
    case "wind_burst": {
      e.vx*=0.8;
      bossFlash(e,Math.floor(e.phase*18)%2===0);
      e.g.scale.setScalar(1.65*(1+0.1*Math.min(1,(0.42-e.bt)*2.4)));
      if(e.bt<=0){
        bossFlash(e,false); e.g.scale.setScalar(1.65);
        const n=6;
        for(let i=0;i<n;i++){ const a=(i/n)*Math.PI*2+e.phase; spawnOrb(e.x+Math.cos(a)*0.6,e.y+1.1+Math.sin(a)*0.6,Math.cos(a)*6.5,Math.sin(a)*6.5,0xFF2D78,12,"ГЛИТЧ-ВЕЕР"); }
        sfx.orb(); addShake(0.3,0.2);
        bossSetState(e,"idle",1.0);
      }
      break;
    }
    case "tele_wind": {
      e.vx*=0.8;
      // glitch flicker via scale (NOT .visible — enemyAI skips invisible entities, which would freeze bt)
      e.g.scale.setScalar(1.65*(0.55+0.45*Math.abs(Math.sin(e.phase*26))));
      if(Math.random()<0.3) burst(new THREE.Vector3(e.x+(Math.random()-0.5)*1.5,e.y+1+Math.random()*1.5,0),0x39FF14,1,.04,{life:.2});
      if(e.bt<=0){
        e.g.scale.setScalar(1.65);
        const side=player.x>e.x?-1:1; // appear on the opposite side of the player
        burst(new THREE.Vector3(e.x,e.y+1,0),0x7A4CFF,16,.07);
        e.x=clamp(player.x+side*(6+Math.random()*4),ab.minX,ab.maxX);
        e.g.position.x=e.x;
        burst(new THREE.Vector3(e.x,e.y+1,0),0x7A4CFF,18,.07);
        sfx.teleport();
        bossSetState(e,Math.random()<0.55?"wind_beam":"wind_charge",0.45);
        if(e.bstate==="wind_charge"){ e.chargeDir=Math.sign(player.x-e.x)||1; sfx.charge(); }
        else bossFlash(e,true);
      }
      break;
    }
  }
  // adds: P2 every ~10s, P3 every ~7s (max 3 alive)
  if(e.spawnT===undefined) e.spawnT=6;
  e.spawnT-=dt;
  if(P>=2 && e.spawnT<=0){
    e.spawnT=P===3?7:10;
    if(countAdds()<3){
      const spawnX=clamp(e.x+(Math.random()<0.5?-6:6),ab.minX,ab.maxX);
      const d=spawnEnemy(spawnX,e.y,0,Math.random()<0.5?"ghost":"drone");
      d.hp=22; d.max=22; d.bossAdd=true; d.anchorY=e.y;
      burst(new THREE.Vector3(spawnX,e.y+1,0),0x39FF14,12,.06);
      sfx.boss();
    }
  }
  // keep inside the arena
  e.x=clamp(e.x,ab.minX,ab.maxX);
  e.g.position.x=e.x;
  e.g.position.y=hover+(e.hit>0?Math.sin(e.hit*70)*.08:0);
}
// ── ARCHIVIST (legacy boss): same fairness rules — aimed orbs instead of hitscan ──
function archivistAI(e,dt){
  e.phase+=dt; e.shot-=dt;
  e.vx=lerp(e.vx,Math.sign(player.x-e.x)*2.2,dt*2);
  if(Math.sin(e.phase*2)<-.96){ e.vx*=.2; }
  if(e.shot<=0){
    e.shot=e.hp<e.max*0.5?1.35:1.8;
    const n=e.hp<e.max*0.5?3:1;
    for(let i=0;i<n;i++) fireAimedOrb(e.x,e.y+1.2,player.x,player.y+1,8.5,0xff3ea5,12,"ARCHIVIST ORB",1,n>1?0.55:0);
    burst(new THREE.Vector3(e.x,e.y+1.2,0),0xff3ea5,8,.05);
  }
}
// ── ГРОХОТ (hammer arena boss): mini HK pattern — hover → windup (amber blink) → charge → slam → stun ──
function hammerAI(e,dt,dx){
  if(e.hstate===undefined){ e.hstate="hover"; e.ht=1.4+Math.random(); e.hx0=e.x; }
  if(e.baseEmissive===null||e.baseEmissive===undefined){ const core=e.g.userData.core; if(core&&core.material){ e.baseEmissive=core.material.emissive.getHex(); e.baseIntensity=core.material.emissiveIntensity; } }
  e.ht-=dt;
  const lo=e.hx0-13, hi=e.hx0+13;
  const r=e.g.userData;
  switch(e.hstate){
    case "hover":
      e.vx=lerp(e.vx,clamp(dx*1.3,-2.8,2.8),dt*2);
      if(Math.abs(dx)<1.6&&Math.abs(player.y-e.y)<1.9){ if(e.telegraphT===undefined||e.telegraphT<=0){ e.attack-=dt; if(e.attack<=0){ e.attack=1.1; e.telegraphT=0.35; e.telegraphDmg=16; e.telegraphSrc="ГРОХОТ"; } } }
      if(Math.abs(dx)<11 && e.ht<=0 && (e.telegraphT===undefined||e.telegraphT<=0)){ e.hstate="wind"; e.ht=0.5; e.hdir=Math.sign(dx)||1; sfx.charge(); }
      break;
    case "wind":
      e.vx*=0.7;
      if(Math.floor(e.phase*16)%2===0){ if(r.core&&r.core.material) matFlash(r.core.material,0xff8c1a); }
      if(e.ht<=0){
        if(r.core&&r.core.material&&e.baseEmissive!==null&&e.baseEmissive!==undefined) matFlash(r.core.material,e.baseEmissive);
        e.hstate="dash"; e.ht=0.9; e.vx=e.hdir*12; sfx.dash();
      }
      break;
    case "dash":
      e.x=clamp(e.x,lo,hi);
      if((e.x<=lo&&e.vx<0)||(e.x>=hi&&e.vx>0)||e.ht<=0){
        e.vx=0; e.hstate="stun"; e.ht=1.05;
        sfx.slam(); addShake(0.45,0.28);
        burst(new THREE.Vector3(e.x,e.y+0.8,0),0xFF8C1A,18,.07);
        impactRing(new THREE.Vector3(e.x,e.y+0.6,0),0xFFD700);
      } else if(player.inv<=0&&Math.abs(player.x-e.x)<1.3&&Math.abs(player.y-e.y)<2.0){
        damagePlayer(14,"ТАРАН ГРОХОТА",e.x);
      }
      break;
    case "stun":
      e.vx*=0.85;
      e.g.rotation.z=Math.sin(e.phase*20)*0.05;
      if(Math.random()<0.2) burst(new THREE.Vector3(e.x+(Math.random()-0.5)*1.6,e.y+1.4,0),0xFFE66D,1,.04,{life:.28});
      if(e.ht<=0){ e.g.rotation.z=0; e.hstate="hover"; e.ht=1.1+Math.random(); }
      break;
  }
}
function enemyAI(dt){for(const e of enemies){if(e.dead||e.g.visible===false)continue;
  // PERF PASS — sleep far-off enemies: >2 screens away they are invisible and cannot interact
  if(!e.isBoss&&Math.abs(e.x-camX)>60){ e.g.position.x=e.x; continue; }
  // PERF PASS — projectiles are distance-gated too, otherwise a netrunner two screens away
  // keeps firing orbs at a player it can't see (and they splat on geometry nobody renders)
  if(e.wind>0&&Math.abs(e.x-camX)>45){ e.wind=0; e.shot=Math.max(e.shot,0.6); }
  e.hit=Math.max(0,e.hit-dt);
// ART PASS — hit stagger + grounded gravity: knockback wins over AI while recovering;
// flyers pop up and fall back to anchor; walkers (dog/netrunner) obey gravity, land on platforms, fall when knocked off
const isFlyE = (e.etype==="drone"||e.etype==="ghost"||e.etype==="guardian"||e.etype==="skeleton");
if(e.hit>0){
  // HK-FEEL PASS fix: flyers ease back to their anchor (old code let each hit's vy=3.2 ratchet them upward forever)
  if(isFlyE){ e.vy=0; const ay=(e.anchorY!==undefined?e.anchorY:e.y); e.y+=(ay-e.y)*Math.min(1,dt*7); }
  else {
    e.vy=(e.vy||0)-22*dt;
    e.y+=e.vy*dt;
    if(e.y<=(e.anchorY!==undefined?e.anchorY:e.y)){ e.y=(e.anchorY!==undefined?e.anchorY:e.y); e.vy=0; }
  }
} else if(!isFlyE){
  const ePrev=e.y;
  e.vy=(e.vy||0)-24*dt;
  e.y+=e.vy*dt;
  let landed=false;
  for(const p of solids){
    const left=p.x-p.w/2-.34, right=p.x+p.w/2+.34;
    if(e.vy<=0 && e.x>=left && e.x<=right && ePrev>=p.y-.05 && e.y<=p.y+.05){ e.y=p.y; e.vy=0; landed=true; break; }
  }
  if(!landed && e.y<=(e.anchorY!==undefined?e.anchorY:e.y)){ e.y=(e.anchorY!==undefined?e.anchorY:e.y); e.vy=0; }
} else { e.vy=0; }
if(e.flashT!==undefined){ e.flashT=Math.max(0,e.flashT-dt); if(e.flashT<=0 && e.baseEmissive!==undefined){ const core=e.g.userData.core; if(core && core.material){ matFlash(core.material,e.baseEmissive); matFlashIntensity(core.material,e.baseIntensity); } } }
// telegraph state handling
if(e.telegraphT!==undefined && e.telegraphT>0){
  e.telegraphT=Math.max(0,e.telegraphT-dt);
  // eye scale up + magenta blink during windup
  const r=e.g.userData; if(r.eye){ const prog=1 - e.telegraphT/0.3; r.eye.scale.setScalar(1+prog*1.2); if(Math.floor(performance.now()*0.02)%2===0){ if(r.core) matFlash(r.core.material,0xff2d78); } }
  if(e.telegraphT<=0){
    // HK-FEEL PASS — fairness: the windup is a real dodge window. Execution only lands
    // if the warden is STILL in melee range; escaping the telegraph now actually works.
    const dmg=e.telegraphDmg||8; const src=e.telegraphSrc||"ENEMY";
    const reach=e.isBoss?2.8:1.75;
    if(Math.abs(player.x-e.x)<reach && Math.abs((player.y+1)-(e.y+1))<2.1){
      burst(new THREE.Vector3(e.x,e.y+1,0),0xff3ea5,7,.04);
      damagePlayer(dmg, src, e.x);
    } else {
      burst(new THREE.Vector3(e.x+Math.sign(player.x-e.x)*0.9,e.y+1,0),0x556677,4,.04,{life:.25}); // whiff puff
    }
    e.telegraphT=undefined; e.telegraphDmg=undefined; e.telegraphSrc=undefined;
    if(e.g.userData.eye) e.g.userData.eye.scale.setScalar(1);
  }
  // while telegraphing, skip other attack logic but still move
}
if(e.isBoss && e.isGlitchMother){ glitchMotherAI(e,dt); }
else if(e.isBoss){ archivistAI(e,dt); }
else if(e.etype==="ghost"){
  // ghost: fast sine flyer, passes through (no platform friction), phase-ignores collision (already fly)
  let dx=player.x-e.x; e.vx=lerp(e.vx, Math.sign(dx||1)*6.2, dt*3.5);
  if(Math.abs(dx)<1.4 && Math.abs(player.y-e.y)<1.9){ if(e.telegraphT===undefined||e.telegraphT<=0){ e.attack-=dt; if(e.attack<=0){ e.attack=.75; e.telegraphT=0.28; e.telegraphDmg=10; e.telegraphSrc="GHOST"; } } }
  e.phase+=dt*2.6; e.g.position.y=e.y + Math.sin(e.phase*2.8)*0.65;
} else if(e.etype==="guardian"){
  // guardian: tanky flyer hp65 contact 16, slower but heavy
  let dx=player.x-e.x;
  e.phase+=dt*1.2;
  // HK-FEEL PASS — ГРОХОТ (hammer arena boss): telegraphed charge → wall slam → stun punish window
  if(e.variant==="hammer" && e.isBossLite){ hammerAI(e,dt,dx); }
  else {
    e.vx=lerp(e.vx, Math.sign(dx||1)*2.6, dt*1.8);
    if(Math.abs(dx)<1.5 && Math.abs(player.y-e.y)<1.9){ if(e.telegraphT===undefined||e.telegraphT<=0){ e.attack-=dt; if(e.attack<=0){ e.attack=1.1; e.telegraphT=0.35; e.telegraphDmg=16; e.telegraphSrc="GUARDIAN"; } } }
  }
} else if(e.etype==="netrunner"){
  // HK-FEEL PASS — caster fairness: visible windup (antenna glow) → dodgeable aimed orb, no hitscan
  let dx=player.x-e.x; e.vx=lerp(e.vx,0,dt*5); e.shot-=dt;
  if(e.wind===undefined) e.wind=0;
  if(e.wind>0){
    e.wind-=dt;
    const r=e.g.userData; if(r.eye) r.eye.scale.setScalar(1+Math.sin(e.phase*24)*0.5);
    if(Math.random()<0.3) burst(new THREE.Vector3(e.x,e.y+2.1,0),0xff3ea5,1,.035,{life:.2,gravity:0});
    if(e.wind<=0){
      if(r.eye) r.eye.scale.setScalar(1);
      fireAimedOrb(e.x,e.y+1.4,player.x,player.y+1,7.5,0xff3ea5,10,"NETRUNNER",0.85);
      burst(new THREE.Vector3(e.x,e.y+1.4,0),0xff3ea5,6,.04);
    }
  } else if(e.shot<=0 && Math.abs(dx)<11 && Math.abs(player.y-e.y)<2.5){ e.shot=2.2; e.wind=0.5; }
} else if(e.etype==="dog"){
let dx=player.x-e.x; if(Math.abs(dx)<9) e.vx=lerp(e.vx,Math.sign(dx)*5,dt*4); else e.vx*=0.92; if(Math.abs(dx)<1.4&&Math.abs(player.y-e.y)<1.8){ if(e.telegraphT===undefined||e.telegraphT<=0){ e.attack-=dt; if(e.attack<=0){ e.attack=.65; // telegraph 0.3s
e.telegraphT=0.3; e.telegraphDmg=10; e.telegraphSrc="DOG"; }} } } else if(e.etype==="crawler"){
// ВЕНТИ: ползун — быстрый наземный паук, телеграф 0.28с
let dx=player.x-e.x; if(Math.abs(dx)<7) e.vx=lerp(e.vx,Math.sign(dx)*3.5,dt*3.5); else e.vx*=0.94; if(Math.abs(dx)<1.3&&Math.abs(player.y-e.y)<1.6){ if(e.telegraphT===undefined||e.telegraphT<=0){ e.attack-=dt; if(e.attack<=0){ e.attack=.8; e.telegraphT=0.28; e.telegraphDmg=10; e.telegraphSrc="ПОЛЗУН"; } } } } else {
let dx=player.x-e.x;if(Math.abs(dx)<7)e.vx=lerp(e.vx,Math.sign(dx)*3,dt*3);else e.vx*=.95;if(Math.abs(dx)<1.4&&Math.abs(player.y-e.y)<1.8){ if(e.telegraphT===undefined||e.telegraphT<=0){ e.attack-=dt;if(e.attack<=0){e.attack=.9; e.telegraphT=0.3; e.telegraphDmg=e.type?16:8; e.telegraphSrc=e.type?"HEAVY DRONE":"DRONE"; } } }}e.x+=e.vx*dt;e.g.position.x=e.x;let isFly = (e.etype==="drone"||e.etype==="ghost"||e.etype==="guardian"||e.etype==="skeleton"); if(isFly){ e.g.position.y=e.y+Math.sin(e.phase*2.2)*0.45+(e.hit>0?Math.sin(e.hit*70)*.08:0); } else { e.g.position.y=e.y+(e.hit>0?Math.sin(e.hit*70)*.08:0); }}}
export function update(dt){if(!started||menuBlocked())return;
  try{ if(window.__NW_STAGE!=="play") window.__NW_STAGE="play"; }catch(e){}
  pumpDegrade(); // COMPAT v4.1.10: spread Lambert shader compiles across frames (≤4ms/update)
  // hitstop scaling
  if(hitstopT>0){ hitstopT=Math.max(0, hitstopT - dt); dt*=0.06; if(hitstopT<=0) hitstopT=0; }
  // vignette flash decay
  if(vignetteT>0){ vignetteT=Math.max(0, vignetteT - dt); const vig=document.getElementById("vignette"); if(vig){ if(vignetteT<=0){ vig.style.transition="opacity 160ms ease"; vig.style.opacity="1"; vig.style.background="radial-gradient(120% 120% at 50% 50%, transparent 58%, rgba(0,0,0,.42) 88%, rgba(0,0,0,.72) 100%), linear-gradient(180deg, rgba(0,0,0,.18), transparent 22%, transparent 78%, rgba(0,0,0,.28))"; } else { vig.style.opacity="1"; } } }
  // chest/pyre/shop proximity hint + bob + scanner rings + pyre flame bob
  {
    const nc=nearestChest();
    const np=nearestPyre();
    const ns=nearestShop();
    // hint: compute text, write DOM only on change (HK-FEEL PASS perf)
    {
      let hTxt,hBor="rgba(255,255,255,.14)",hCol="#C9D7DF";
      if(player.focusing){ hTxt="ФОКУС // КАНАЛ SOUL→HP…"; hBor="rgba(234,251,255,0.85)"; hCol="#EAFBFF"; }
      else if(shopOpen){ hTxt="МАГАЗИН // [1] HP [2] DMG [ESC] закрыть"; hBor="rgba(0,245,255,0.85)"; hCol="#8AF2FF"; }
      else if(nc){ hTxt="E — ОТКРЫТЬ СУНДУК ("+nc.kind.toUpperCase()+")"; hBor="rgba(255,215,0,0.85)"; hCol="#FFEAA0"; }
      else if(np && !legsAvailable && !gripAvailable && !wingsAvailable){ hTxt="E — ОТДЫХ У ПИРА (привал)"; hBor="rgba(255,140,26,0.85)"; hCol="#FFD7A0"; }
      else if(ns){ hTxt=`E — МАГАЗИН ${ns.name}`; hBor="rgba(0,245,255,0.85)"; hCol="#8AF2FF"; }
      else if(isInWater(player.x,player.y)){ hTxt="ВОДА // wading vx*0.55 [Shift — сканер]"; hBor="rgba(0,245,255,0.55)"; hCol="#8AF2FF"; }
      else { hTxt="WASD — движение · SPACE — прыжок · J — удар (S+J пого · W+J вверх) · K — dash · F — ФОКУС (33 RAM → HP) · L — хак · E — взять"; }
      if(hTxt!==_lastHint){
        _lastHint=hTxt;
        const hintEl=document.getElementById("hint");
        if(hintEl){ hintEl.textContent=hTxt; hintEl.style.borderColor=hBor; hintEl.style.color=hCol; if(nc) hintEl.style.opacity="1"; }
      }
    }
    for(const ch of chests){ if(!ch.mesh) continue; const base=ch.mesh.userData.baseY||ch.y+0.26; ch.mesh.position.y=base + Math.sin(performance.now()*0.003 + ch.x*0.2)*0.08; ch.mesh.rotation.y+=dt*0.6; }
    if(scannerPulseT>0){ scannerPulseT=Math.max(0, scannerPulseT - dt); updateScannerRings(dt); }
    // pyre flame bob handled via world pyreMeshes sprite scale
    for(const pm of pyreMeshes){ pm.rotation.y+=dt*0.4; const s=pm.children[1]; if(s){ s.material.opacity=0.85+0.15*Math.sin(performance.now()*0.007 + pm.position.x); } }
    // shop idle bob
    for(const sm of shopMeshes){ sm.position.y = sm.userData.y + Math.sin(performance.now()*0.002 + sm.userData.x*0.1)*0.05; }
    // ART PASS — acid motes rise from the virus pool at world bottom
    for(const am of acidMotes){ am.position.y+=am.userData.vy*dt; am.position.x+=Math.sin(am.userData.ph+performance.now()*0.001)*0.02; if(am.position.y>3.2){ am.position.y=-0.5; } }
    // ART WAVE 2 — water surface wobble (layered planes, no shaders)
    for(const wm of waterMeshes){ const u=wm.userData; if(u && u.baseY!==undefined){ wm.position.y=u.baseY+Math.sin(performance.now()*0.0016+u.ph)*0.045; if(wm.material.transparent) wm.material.opacity=(u.baseOp||0.42)+Math.sin(performance.now()*0.0021+u.ph)*0.06; } }
  }
  try{ updateHackLock(); }catch(e){}
  let ax=moveAxis();player.face=ax||player.face;
  // ladder early for drop-vs-climb decision (Space+Down must drop even on ladder)
  const ladder = isOnLadder(player.x, player.y);
  player.onLadder = !!ladder;
  const wantUp = !!(keys.KeyW || keys.ArrowUp);
  const wantDown = !!(keys.KeyS || keys.ArrowDown);
  // drop-through one-way: Space edge (jbuf) while grounded + Down held -> short fall-through window
  let _didDrop=false;
  if(player.jbuf>0 && player.ground && wantDown && !!keys.Space && (player.dropT||0)<=0.001){
    player.dropT=0.28; player.vy=-2; player.ground=false; player.jbuf=0; player.coyote=0; _didDrop=true;
  }
  player.jbuf=Math.max(0,player.jbuf-dt);player.coyote=player.ground?0.12:Math.max(0,player.coyote-dt);
  if(_didDrop){
    // consume drop: suppress jump / climbing this frame, keep falling
    player.climbing=false;
  } else {
    if(player.jbuf>0&&player.coyote>0){player.vy=11.8;player.jbuf=0;player.coyote=0;player.doubleJumpUsed=false;burst(new THREE.Vector3(player.x,player.y,0),0x62f6ff,6,.045); sfx.jump();}
    else if(player.jbuf>0 && player.hasWings && !player.ground && !player.doubleJumpUsed && !player.climbing){
      player.vy=10.5; player.jbuf=0; player.doubleJumpUsed=true; burst(new THREE.Vector3(player.x,player.y,0),0xFFE66D,10,.05,{vy:-0.15,life:.4}); sfx.dbljump();
    }
  }
  // reset double-jump on ground
  if(player.ground) player.doubleJumpUsed=false;
  // scanner & water handled before climb to allow wading drag
  const inWater = isInWater(player.x, player.y);
  if(inWater){
    if(Math.random()<0.08) burst(new THREE.Vector3(player.x, 0.15, 0), 0x62f6ff, 3, 0.05);
  }
  // climbing: onLadder + W/S hold, but NOT when we just triggered drop (Space+Down -> drop even on ladder)
  const wantClimb = !_didDrop && player.onLadder && (wantUp || wantDown);
  player.climbing = wantClimb;
  // ── HK-FEEL PASS — FOCUS: hold F to channel SOUL(RAM) → HP. Vulnerable, interruptible, 33 RAM per 28 HP.
  // This is Hollow Knight's core risk/reward: soul comes only from nail hits, healing competes with quickhack.
  {
    const canFocus = player.ground && !player.climbing && player.attack<=0 && player.dash<=0 && player.hack<=0
      && !shopOpen && !levelComplete && player.hp<player.maxHp && player.ram>=FOCUS_COST && ax===0 && player.jbuf<=0;
    const wantFocus = !!keys.KeyF && canFocus;
    if(wantFocus){
      if(!player.focusing){ player.focusing=true; player.focusT=0; player.focusStep=0; player.focusTickT=0; sfx.focusTick(0); }
      player.focusT+=dt;
      player.focusTickT=(player.focusTickT||0)-dt;
      if(player.focusTickT<=0){ player.focusTickT=0.11; player.focusStep=Math.min(7,(player.focusStep||0)+1); sfx.focusTick(player.focusStep); }
      player.focusSwirlT=(player.focusSwirlT||0)-dt;
      if(player.focusSwirlT<=0){ player.focusSwirlT=0.05; focusSwirl(player.g.position,0xEAFBFF); }
      player.vx=lerp(player.vx,0,dt*18);
      if(player.focusT>=FOCUS_TIME){
        player.focusT-=FOCUS_TIME;
        const healed=Math.round(Math.min(FOCUS_HEAL,player.maxHp-player.hp));
        player.hp+=healed; player.ram=clamp(player.ram-FOCUS_COST,0,100);
        popup("+"+healed+" HP",true);
        burst(new THREE.Vector3(player.x,player.y+1,0),0xEAFBFF,18,.06,{vy:0.35,life:.5,gravity:0.1});
        impactRing(new THREE.Vector3(player.x,player.y+0.9,0),0xEAFBFF);
        sfx.heal(); postFlash(0.08,0xEAFBFF);
        if(player.ram<FOCUS_COST||player.hp>=player.maxHp){ player.focusing=false; player.focusT=0; }
      }
    } else if(player.focusing){
      player.focusing=false; player.focusT=0;
    } else if(!!keys.KeyF && player.ground && player.ram<FOCUS_COST && player.hp<player.maxHp && (player.deniedT||0)<=0){
      player.deniedT=0.9; sfx.denied(); // dry click: not enough SOUL — HK never spams this
    }
    if(player.deniedT>0) player.deniedT-=dt;
    if(player.focusing) ax=0; // channeling roots the warden
  }
  // WAVE 1 — wall touch detection (ВЕНТИ walls): -1 wall on left, +1 wall on right
  let wallTouch=0;
  for(const w of walls){
    if(player.y > w.yTop+0.6 || player.y < w.yBottom-1.6) continue;
    if(Math.abs(player.x - w.x) < 0.6){ wallTouch = (player.x < w.x)? -1 : 1; break; }
  }
  player.wallSliding = false;
  // WAVE 1 — wall-jump: jump off a wall while airborne (needs ЦЕП); push AWAY from the wall
  if(player.jbuf>0 && !player.ground && wallTouch!==0 && player.hasClaw && !player.climbing && !inWater){
    player.vy=11.5; player.vx=wallTouch*9; player.face=wallTouch; player.jbuf=0; player.coyote=0; player.doubleJumpUsed=false;
    burst(new THREE.Vector3(player.x-wallTouch*0.4, player.y+0.8, 0), 0x39FF14, 10, 0.05); sfx.dbljump();
  }
  if(player.dash>0){player.dash-=dt}else if(player.climbing){
    player.vx = lerp(player.vx, ax*2.2, dt*10);
    const dir = wantUp ? 1 : -1;
    player.vy = dir * player.climbSpeed;
    if(ladder) player.vx += (ladder.x - player.x) * 6 * dt;
  }else{
    let targetVx = ax*(8.2+(player.speedBonus||0));
    if(inWater) targetVx *= 0.55;
    // Ori/HK feel: tight ground control, floatier air drift
    player.vx=lerp(player.vx,targetVx,player.ground?dt*14:dt*9);
    if(inWater) player.vx*=0.98; // extra drag
    // apex hang (lighter gravity near apex) + fast-fall (S in air) + fall cap
    const nearApex = player.vy>0 && player.vy<3.2;
    const fastFall = (keys.KeyS||keys.ArrowDown) && player.vy<0;
    let grav=24; if(inWater) grav=14; if(nearApex) grav*=0.5; if(fastFall&&!inWater) grav*=1.7;
    player.vy-=grav*dt;
    // WAVE 1 — wall-slide: slow fall while hugging a wall (needs ЦЕП)
    if(!player.ground && wallTouch!==0 && player.hasClaw && player.vy<0 && !inWater){
      player.vy=Math.max(player.vy,-2.6); player.wallSliding=true;
      if(Math.random()<0.12) burst(new THREE.Vector3(player.x+wallTouch*0.3, player.y+0.6, 0), 0x39FF14, 2, 0.03);
    }
    if(inWater) player.vy*=0.92;
    if(!(keys.Space||keys.ArrowUp)&&player.vy>2)player.vy-=12*dt;
    if(player.vy<-26)player.vy=-26;
  }
 player.attack=Math.max(0,player.attack-dt);
 if(player.attack>0 && player.attack<.19 && player.attackFx<=0){
   const dir=player.attackDir||"side";
   const arcY=dir==="up"? player.y+2.05 : dir==="down"? player.y+0.15 : player.y+1.1;
   const bY=dir==="up"? player.y+2.2 : dir==="down"? player.y-0.05 : player.y+1.05;
   burst(new THREE.Vector3(player.x+player.face*(dir==="side"?1.35:0.5),bY,.15),0x62f6ff,16,.075);
   slashArc(new THREE.Vector3(player.x+player.face*(dir==="side"?.9:.35),arcY,.2),player.face,0xBFF6FF,dir);
   player.attackFx=.28;
 }
 if(player.attack<=0)player.attackFx=0;
 // HK-FEEL PASS — dash afterimages (ghost silhouettes trailing the blink)
 if(player.dash>0){ player.trailT=(player.trailT||0)-dt; if(player.trailT<=0){ player.trailT=0.04; ghostTrail(new THREE.Vector3(player.x,player.y,0.12),player.face,0x62f6ff,1.9); } }
 // HK-FEEL PASS — SOUL economy: NO passive RAM regen (was +10/s). RAM comes only from nail hits (+11)
 // and kills (+6) via gainSoul(); it funds FOCUS healing and quickhack. (Also fixed: attackCd was ticked twice.)
 player.attackCd=Math.max(0,player.attackCd-dt);player.dashCd=Math.max(0,player.dashCd-dt);player.hack=Math.max(0,player.hack-dt);player.inv=Math.max(0,player.inv-dt);player.ram=clamp(player.ram,0,100);
 if(player.soulFlash>0) player.soulFlash=Math.max(0,player.soulFlash-dt);
   const wasGround=player.ground; const fallV=player.vy;
   player.prevY=player.y;player.x+=player.vx*dt;player.y+=player.vy*dt;resolvePlatforms(dt);
   if(player.climbing) player.ground = false;
   // WAVE 1 — wall push-out: strict horizontal wall collision (ВЕНТИ), climbing/ladders bypass.
   // LEVEL-DESIGN FIX v4.1.19: without ЦЕП (hasClaw) walls are pure obstruction — the venti
   // screens became a trap (enter at row0, can't leave at row2). Walls collide ONLY when the
   // ware that uses them is collected; until then they are visual/wall-jump-less dressing.
   if(!player.climbing && player.hasClaw){
     for(const w of walls){
       if(player.y > w.yTop+0.2 || player.y < w.yBottom-1.2) continue;
       const halfW=0.28, pad=0.3;
       const wl=w.x-halfW-pad, wr=w.x+halfW+pad;
       if(player.x>=wl && player.x<=wr){
         player.x = (player.x-w.x>0)? wr : wl;
         if((player.x-w.x>0 && player.vx<0)||(player.x-w.x<=0 && player.vx>0)) player.vx=0;
       }
     }
   }
   // ART PASS — landing dust puff after a hard fall
   if(!wasGround && player.ground && fallV<-4){ burst(new THREE.Vector3(player.x,player.y+.05,0),0x8a97a8,6,.05); sfx.land(); }
   // footstep micro-puffs while running
   player.stepT=(player.stepT||0)-dt;
   if(player.ground && Math.abs(player.vx)>.25 && player.stepT<=0){ player.stepT=.18; burst(new THREE.Vector3(player.x,player.y+.03,0),0x5A6A7A,2,.035); }
   if(player.y<-.55){message("HAZARD // FALL ZONE");respawn();}
   else if(checkPitFall()){}
   else if(USE_MARKET || !LEGACY) tryRoomTransition();
   // AUDIO — crossfade music layers by district (base/market/crypt/sunken/maw)
   { const scr=currentScreen(); const md=scr? (scr.district||"base") : "base"; if(md!==_lastMood){ _lastMood=md; setDistrictMood(md); discoverDistrict(md); } }
   {
     if(LEGACY){
       const bounds = marketBounds();
       const inMarket = player.x >= bounds.minX && player.x <= bounds.maxX + 20;
       const nearEast = inMarket && player.x >= bounds.maxX - 3;
       const nearSouth = inMarket && player.y < 0.3 + 3;
       let side = null;
       if (nearEast && player.vx > 0.05) side = "E";
       else if (nearSouth && player.vy < -0.05) side = "S";
       if (side) {
         const block = marketGateBlocking("market", side, !!player.hasLegs);
         if (block) {
           message(block);
           if (side === "E") { player.x = bounds.maxX - 3; player.vx = 0; }
           else { player.y = 0.5; player.vy = 0; }
         }
       }
     } else {
       // grid gate: legs-shaft up col1, grip-shaft down col2 handled in tryGridTransition
       // still check east final wings stub when attempting to exit grid east edge
       const gb=gridBounds();
       if(player.x >= gb.maxX -3 && player.vx>0.05){
         const gate=GATE_PLAN.find(g=>g.dir==="E");
         if(gate){ message(gate.msg); player.x=gb.maxX-3; player.vx=0; }
       }
     }
   }
   {
     if(LEGACY){
       const cb = cryptBounds();
       const inCrypt = USE_CRYPT && player.x >= cb.minX - 5 && player.x <= cb.maxX + 20;
       const nearEast = inCrypt && player.x >= cb.maxX - 3;
       if (nearEast && player.vx > 0.05) {
         const block = cryptGateBlocking("crypt", "E", !!player.hasGrip);
         if (block) {
           message(block);
           player.x = cb.maxX - 3; player.vx = 0;
         }
       }
     }
   }
    checkArena();
    if(USE_CRYPT) checkCryptArena();
    checkTinaArena();
   {
     let worldMax;
     if(LEGACY){
       const _mb = marketBounds(); const _cb = USE_CRYPT ? cryptBounds() : _mb;
       worldMax = (USE_MARKET || USE_CRYPT) ? Math.max(360, Math.max(_mb.maxX, _cb.maxX) + 20) : 190;
       player.x=clamp(player.x,-33,worldMax);
     } else {
       const gb=gridBounds();
       worldMax = gb.maxX + 10;
       player.x=clamp(player.x, gb.minX -2, worldMax);
     }
   }
   updateCheckpoint();
    {
      const topY = LEGACY? (BASE_Y + 0.9) : (SCREENS.find(s=>s.col===1&&s.row===1).baseY + 0.9);
      if(legsMesh){
        legsMesh.rotation.y += dt * 1.6;
        legsMesh.position.y = topY + Math.sin(performance.now()*0.003)*0.12;
      }
      const gTop = LEGACY? (BASE_Y + 0.9) : (SCREENS.find(s=>s.col===2&&s.row===1).baseY + 0.9);
      if(gripMesh){
        gripMesh.rotation.y += dt * 1.6;
        gripMesh.position.y = gTop + Math.sin(performance.now()*0.003 + 1.2)*0.12;
      }
      const wTop = SCREENS.find(s=>s.col===2&&s.row===2).baseY + 0.9;
      if(wingsMesh){
        wingsMesh.rotation.y += dt * 1.7;
        wingsMesh.position.y = wTop + Math.sin(performance.now()*0.003 + 2.4)*0.12;
      }
    }
   roomTick += dt; if(roomTick > 0.5){ roomTick = 0; updateRoomLabel(); }
 if(exitOpen && !levelComplete){
   const gateX = LEGACY? 183.0 : FINAL_GATE_X;
   if(player.x>gateX -1) completeLevel();
 }
 if(levelComplete) player.x=Math.min(player.x, LEGACY?187:FINAL_GATE_X+4);
 hurtEnemies();enemyAI(dt);updateOrbs(dt);
 player.g.position.set(player.x,player.y,0);player.g.rotation.y=player.face<0?Math.PI:0;player.g.visible=player.inv<=0||Math.floor(player.inv*20)%2===0;player.g.scale.x=0.7*(1+(player.dash>0?.35:0));
  const rig=player.g.userData; rig.animTime+=dt;
  // blade rest pose (attack branch overrides; returns needle to rest after swing)
  rig.blade.rotation.z=-.3; rig.blade.rotation.y=0;
  rig.head.rotation.x=player.focusing? .38 : rig.head.rotation.x*(1-Math.min(1,dt*8));
  const speed=Math.abs(player.vx); const moving=player.ground&&speed>.25; const cycle=rig.animTime*(moving?10:2.2);
 if(moving){const s=Math.sin(cycle);rig.legL.rotation.z=s*.45;rig.legR.rotation.z=-s*.45;rig.armL.rotation.z=-.25-s*.28;rig.armR.rotation.z=.25+s*.28;rig.torso.rotation.z=s*.035;}
 else {rig.legL.rotation.z=0;rig.legR.rotation.z=0;rig.armL.rotation.z=-.25;rig.armR.rotation.z=.25;rig.torso.rotation.z=Math.sin(rig.animTime*2.4)*.018;}
  if(player.climbing){ const cs=Math.sin(rig.animTime*7); rig.legL.rotation.z=cs*.52; rig.legR.rotation.z=-cs*.52; rig.armL.rotation.z=-.35-cs*.32; rig.armR.rotation.z=.35+cs*.32; rig.torso.rotation.z=cs*.04; }
  else if(!player.ground){rig.legL.rotation.z=-.18;rig.legR.rotation.z=.18;rig.armL.rotation.z=-.55;rig.armR.rotation.z=.55;}
   if(player.attack>0){
    // HK-FEEL PASS — directional needle sweeps: side / overhead-up / stab-down, same ease-out snap grammar
    const dir=player.attackDir||"side";
    const k=1-player.attack/ATK_DUR;
    const out=Math.min(1,k/0.45);
    const ease=1-Math.pow(1-out,2);
    const back=Math.max(0,(k-0.55)/0.45);
    if(dir==="up"){
      rig.blade.rotation.z=-.3-2.5*ease+2.0*back;
      rig.blade.rotation.y=-.22*ease+.1*back;
      rig.armR.rotation.z=.25-2.2*ease+1.7*back;
      rig.armL.rotation.z=-.25+.35*ease-.2*back;
      rig.torso.rotation.y=.3*(1-ease)-.2*ease;
      rig.torso.rotation.z=-.14*ease+.09*back;
      rig.cloak.rotation.z=-.28*ease;
    } else if(dir==="down"){
      rig.blade.rotation.z=-.3+2.0*ease-1.4*back;
      rig.blade.rotation.y=.28*ease-.1*back;
      rig.armR.rotation.z=.25+1.7*ease-1.2*back;
      rig.armL.rotation.z=-.25-.35*ease+.2*back;
      rig.torso.rotation.y=-.3*(1-ease)+.25*ease;
      rig.torso.rotation.z=.16*ease-.1*back;
      rig.cloak.rotation.z=.34*ease;
      if(!player.ground){ rig.legL.rotation.z=-.55*ease; rig.legR.rotation.z=.4*ease; }
    } else {
      rig.blade.rotation.z=-.3-1.3*ease+.5*back;
      rig.blade.rotation.y=.15*ease-.2*back;
      rig.armR.rotation.z=.25-.55*ease+.3*back;
      rig.armL.rotation.z=-.25+.25*ease-.15*back;
      rig.torso.rotation.y=.42*(1-ease)-.5*ease+.35*back;
      rig.torso.rotation.z=-.12*ease+.08*back;
      rig.cloak.rotation.z=.2*ease;
    }
  }
  else if(player.focusing){
    // HK focus pose: needle lowered, arms in, head bowed, quick breath — readable "channeling heal"
    const br=Math.sin(rig.animTime*9)*.05;
    rig.armR.rotation.z=.55+br; rig.armL.rotation.z=-.55-br;
    rig.blade.rotation.z=.9; rig.blade.rotation.y=.3;
    rig.torso.rotation.z=.10+br*.4; rig.torso.rotation.y=0;
    rig.cloak.rotation.z=-.05;
  }
 if(player.dash>0){rig.torso.rotation.z=-.14;rig.cloak.rotation.z=.18;} else {rig.cloak.rotation.z=Math.sin(rig.animTime*3)*.025;}
 const bob=moving?Math.abs(Math.sin(cycle))*.035:Math.sin(rig.animTime*2.2)*.018; player.g.position.y=player.y+bob; const squash=player.ground?(1+Math.abs(Math.sin(cycle))*.035):(1+(player.vy>0?.045:-.025)); player.g.scale.y=0.7*squash; player.g.scale.z=0.7/squash; rig.blade.rotation.x=Math.sin(rig.animTime*5)*.04;
   // ── HK-FEEL PASS — camera: slower float (τ≈0.35s), facing+velocity lookahead, screenshake offset ──
   {
     const gb=gridBounds();
     const look=player.face*1.7+clamp(player.vx*0.16,-2.2,2.2);
     const lookAhead=clamp(player.vy*0.35,-3,3);
     const camTargetX=player.x+look;
     const camTargetY=clamp(player.y+2.5+lookAhead, gb.minY+4, gb.maxY-4);
     camX=lerp(camX,camTargetX,1-Math.pow(0.05,dt));
     camY=lerp(camY,camTargetY,1-Math.pow(0.02,dt));
     if(camLookY===null) camLookY=player.y+1.5;
     camLookY=lerp(camLookY,player.y+1.5+lookAhead,1-Math.pow(0.02,dt));
     const so=shakeOffset();
     camera.position.set(camX+(so?so.x:0), camY+(so?so.y:0), camera.position.z);
     camera.lookAt(camX,camLookY,0);
     updateShake(dt);
     updateLights(camX,dt); // PERF PASS — 2 dynamic neon movers instead of 8 static PointLights
     // HK-FEEL PASS — speed FOV kick: dash widens, focus narrows (juice, ~free)
     const tgtFov=55+(player.dash>0?2.6:0)+(Math.abs(player.vx)>13?1.2:0)+(player.focusing?-1.6:0);
     if(Math.abs(camera.fov-tgtFov)>0.02){ camera.fov=lerp(camera.fov,tgtFov,1-Math.pow(0.001,dt)); camera.updateProjectionMatrix(); }
     try{ updateParallax(camX); }catch(e){}
   }
  for(const e of enemies)if(!e.dead&&e.g.visible){const r=e.g.userData;r.animTime+=dt;e.phase+=dt*(e.type?1.3:2.0);r.ring.rotation.z+=dt*(e.type?-1.8:2.8);r.ring.rotation.x=Math.PI/2+Math.sin(r.animTime*2.4)*.12;r.core.rotation.x+=dt*(e.type?-.9:1.4);r.core.rotation.y+=dt*(e.type?1.1:-1.7);r.eye.scale.x=1+Math.sin(r.animTime*7)*.22;const isFlyAnim = (e.etype==="drone"||e.etype==="ghost"||e.etype==="guardian"||e.etype==="skeleton"); const selfAnim = !!(e.isGlitchMother && e.aggro); // boss drives its own pose while awake
 if(!selfAnim){ if(isFlyAnim){ e.g.rotation.z+=dt*.45; } else if(e.etype==="dog"){ e.g.rotation.z=Math.sin(r.animTime*6)*.05; } else { e.g.rotation.z=Math.sin(r.animTime*2.2)*.04; } }
 if(!selfAnim){ if(isFlyAnim) e.g.position.y=e.y+Math.sin(e.phase*(e.type?1.5:2.0))*.45; else e.g.position.y=e.y+(e.hit>0?Math.sin(e.hit*70)*.08:0); }
 if(!(e.isGlitchMother)) e.g.scale.setScalar(((e.isBoss?1.65:(e.type?1.0:.86))+(e.hit>0?.08:0))*(e.isBoss?1.0:0.7)); if(r.fill)r.fill.scale.x=Math.max(0,e.hp/e.max);}
  updateFx(dt); // PERF PASS — particles live in one Points cloud now; mesh fx handled inside
  minimapTick+=dt; if(minimapTick>=0.2){ minimapTick=0; try{ drawMinimap(); }catch(e){ try{ window.__NW_MMERR=String(e&&e.message||e); }catch(e2){} } }
   // ── HK-FEEL PASS — HUD: write DOM only on change (fixed 120Hz physics made per-frame writes wasteful) ──
   {
     const maxH=player.maxHp||100;
     const hpPct=Math.round(clamp(player.hp/maxH*100,0,100));
     if(hpPct!==_hud.hp){ _hud.hp=hpPct; const el=document.getElementById("hp"); if(el) el.style.width=hpPct+"%"; }
     const ramI=Math.floor(player.ram);
     if(ramI!==_hud.ram){
       _hud.ram=ramI;
       const el=document.getElementById("ram"); if(el) el.textContent=ramI;
       const pill=el&&el.parentElement; if(pill&&pill.classList) pill.classList.toggle("full", player.ram>=FOCUS_COST);
     }
     if(shards!==_hud.shards){ _hud.shards=shards; const el=document.getElementById("shards"); if(el) el.textContent=shards; }
     let b=enemies.find(e=>e.isBoss&&!e.dead);
     const nearBoss=!!(b&&Math.abs(player.x-b.x)<25);
     const bw=nearBoss? Math.round(clamp(b.hp/b.max*100,0,100)) : -1;
     if(bw!==_hud.boss){
       _hud.boss=bw;
       const bb=document.getElementById("boss"); if(bb) bb.style.display=nearBoss?"block":"none";
       if(b){ const bf=document.getElementById("bossfill"); if(bf) bf.style.width=bw+"%"; }
     }
     // low-HP danger vignette (class toggle — no per-frame writes)
     const lowHp=player.hp>0 && player.hp<=maxH*0.25;
     if(lowHp!==_hud.low){ _hud.low=lowHp; const v=document.getElementById("vignette"); if(v&&v.classList) v.classList.toggle("lowhp",lowHp); }
     // focus channel bar
     const fb=document.getElementById("focusBar");
     if(fb){
       if(player.focusing){
         if(fb.style.display!=="block") fb.style.display="block";
         const ff=document.getElementById("focusFill");
         if(ff) ff.style.width=Math.round(clamp(player.focusT/FOCUS_TIME*100,0,100))+"%";
       } else if(fb.style.display!=="none"){ fb.style.display="none"; }
     }
   }
}
// ── HK-FEEL PASS — fixed-timestep physics so game feel is identical on 60/120/144Hz displays.
// PERF PASS — 60Hz steps (max 4/frame): 120Hz doubled CPU cost for no feel gain on 60Hz screens.
let last=performance.now(), _acc=0; const FIXED=1/60;
// ── PERF PASS — adaptive quality: sustained FPS < 40 → drop bloom/atmosphere, pixelRatio 1.
// P toggles manually (auto-degrade only ever fires ONCE; manual choice always wins).
let perfMode=1, _fpsAcc=0, _fpsN=0, _fps=60, _lowStreak=0, _autoDone=false; // SAFE DEFAULT: bloom off until proven fast; P = quality
export function setPerfMode(m,silent){
  perfMode=m?1:0;
  setBloomEnabled(perfMode===0);
  try{ setAtmosphere(perfMode===0); }catch(e){}
  applyRenderSize();
  if(!silent) message(perfMode? "PERF // bloom+пыль off (P — качество)" : "QUALITY // bloom+пыль on (P — perf)");
}
let _menuSkip=false, _blank=0, _blankWarned=false, _sizeTick=0, _clearStreak=0, _healTick=0; // v4.1.14: _healTick was used-but-undeclared → loop died 1800 times on user machine
// v4.1.15 — SINGLE-FLIGHT scheduler: skip-ветки раньше делали rAF+return, а finally добавлял
// ВТОРОЙ rAF → каждая skip-ветка удваивала цепи кадров (экспонента в меню → 1 FPS в игре,
// кейс пользователя: diag fps 668 при видимых 0.2-1). Теперь планировщик ровно один.
let _rafPending=false;
function scheduleLoop(){
  if(_rafPending) return;
  _rafPending=true;
  requestAnimationFrame(function(t){ _rafPending=false; loop(t); });
}
let _loopErrs=0, _diagUntil=15, _diagTick=0, _diagOverlay=false; // DIAG PASS — first 15s of play: live diagnostics
function loop(now){
 try{
  let dt=Math.min(.1,(now-last)/1000); last=now;
  // COMPAT v4.1.13 — UNCONDITIONAL 1Hz heal, runs even in menus: on the user's machine the
  // canvas was found DETACHED at title (conn:false) and menu overlays invisible, while the
  // game simulated at 60fps behind it. Old self-heal lived inside the gameplay gate → never
  // ran at title → permanent grey. Dumb robust fix: re-attach + inline styles + menu visibility.
  _healTick+=dt;
  if(_healTick>1){
    _healTick=0;
    try{
      const cv=renderer.domElement;
      if(cv){
        if(cv.isConnected===false){ try{ document.body.prepend(cv); }catch(e){} }
        if(cv.style.position!=="fixed"){ cv.style.position="fixed"; cv.style.inset="0"; cv.style.left="0"; cv.style.top="0"; cv.style.display="block"; cv.style.zIndex="0"; }
        if((cv.clientWidth<2||cv.clientHeight<2) && innerWidth>2 && !blitOn){
          renderer.setSize(innerWidth,innerHeight); resizePostFx(); _healFails++;
          if(_healFails>=2&&!blitOn){ setBlitMode(true); _healFails=0; }
        } else _healFails=0;
      }
      if(started) syncLevelVisibility(); // 1Hz net: any teleport bypassing loadLevel self-corrects
      if(!started){
        const st=menu.state;
        const sp=document.getElementById("splash"), ti=document.getElementById("title"), cr=document.getElementById("creation");
        if(st==="splash"){ if(sp){ sp.style.display="flex"; sp.style.opacity="1"; } }
        else if(st==="title"){ if(sp) sp.style.display="none"; if(ti){ ti.style.display="block"; ti.style.opacity="1"; } }
        else if(st==="creation"){ if(sp) sp.style.display="none"; if(ti) ti.style.display="none"; if(cr){ cr.style.display="flex"; cr.style.opacity="1"; } }
      }
    }catch(e){}
  }
  // COMPAT/PERF PASS — меню рендерится на 30 Гц: сцена за тайтлом не требует 60,
  // а на слабых GPU это вдвое снижает нагрузку в меню
  if(menuBlocked()){ _menuSkip=!_menuSkip; if(_menuSkip){ return; } } // finally→scheduleLoop: ровно одна цепь
  // ECO PASS — software GL: present at 30Hz (physics keeps 60Hz through the accumulator),
  // halving raster+compositor cost on WARP-class rasterizers
  if(ecoMode && started){ _ecoSkip=!_ecoSkip; if(_ecoSkip){ return; } }
  _acc+=dt; let n=0;
  while(_acc>=FIXED && n<4){ update(FIXED); _acc-=FIXED; n++; }
  if(_acc>FIXED*4) _acc=0; // avoid spiral of death after tab-switch
  decayFlash(dt);
  try{ if(perfMode===0) updateAmbient(dt,camera.position.x,camera.position.y); }catch(e){}
  renderFrame(scene,camera,dt);
  if(blitOn && blitCtx && blitCanvas){ try{ blitCtx.drawImage(renderer.domElement,0,0,blitCanvas.width,blitCanvas.height); }catch(e){} }
  // COMPAT v4.1.10 — blit efficacy probe: на части стеков копия WebGL→2D даёт пустоту
  // (v4.1.8 grey). Один getImageData через 1.2с после включения — и откат с локом.
  if(_blitProbeAt && performance.now()>_blitProbeAt){
    _blitProbeAt=0;
    try{
      const d=blitCtx.getImageData(Math.max(1,Math.floor(blitCanvas.width*0.05)),Math.max(1,Math.floor(blitCanvas.height*0.95)),1,1).data;
      const magenta=d[0]>150&&d[2]>150&&d[1]<120;
      if(!magenta){ setBlitMode(false,true); _presentLocked=true; postOverlay("BLIT BROKEN // копия WebGL→2D пуста на этом драйвере.\nВозврат: direct + ECO. Лечится драйвером/--use-angle=d3d12."); }
    }catch(e){}
  }
  // fps monitor (только в игре: меню искусственно ограничено 30 Гц)
  // v4.1.13: fps-метр, watchdog и diag работают НЕЗАВИСИМО от меню — телеметрия видна и на тайтле
  _fpsAcc+=dt; _fpsN++;
  if(_fpsAcc>=1){
    _fps=_fpsN/_fpsAcc; _fpsAcc=0; _fpsN=0;
    if(started && !menuBlocked()){
      if(!_autoDone && perfMode===0 && _fps<40){ _lowStreak++; if(_lowStreak>=2){ _autoDone=true; setPerfMode(1); showZone("PERF MODE // АВТО (P — вернуть качество)"); } }
      else if(_fps>=45) _lowStreak=0;
      // PRESENTATION LADDER — descent only, manual B locks it (direct → ECO → 35% → blit)
      if(_playT>4 && !_presentLocked){
        if(_stage===0 && _fps<20 && !ecoMode){ _stage=1; setEco(true,true); message("AUTO-ECO // Lambert + 50% + 30Hz (direct present)"); }
        else if(_stage===1 && _fps<16 && _ecoScale>0.36){ _stage=2; _ecoScale=0.35; applyRenderSize(); message("AUTO-SCALE // 35% рендера"); }
        else if(_stage===2 && _fps<12 && !blitOn){ _stage=3; setBlitMode(true,true); message("AUTO-PRESENT // blit (последнее средство)"); }
      }
    }
  }
  if(started && !menuBlocked()){ _playT+=dt; }
  // COMPAT PASS — watchdog пустого кадра: 0 треугольников = рендер не доехал до GPU
  const tris=renderer.info.render.triangles;
  if(tris===0){ _blank++; } else { _blank=0; }
  if(_blank===30 && postfxEnabled()){ setBloomEnabled(false); resizePostFx(); }
  _sizeTick+=dt;
  if(_sizeTick>1){
    _sizeTick=0;
    // pixel readback: 5 точек; если все = цвет очистки 3 раза подряд — экран пуст на деле
    try{
      const gl=renderer.getContext();
      const w=gl.drawingBufferWidth||2, h=gl.drawingBufferHeight||2;
      const px=new Uint8Array(4); let sameClear=0;
      const pts=[[w>>1,h>>1],[w>>2,h>>1],[w*3>>2,h>>1],[w>>1,h>>2],[w>>1,h*3>>2]];
      for(const [x,y] of pts){
        gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
        if(Math.abs(px[0]-15)<3&&Math.abs(px[1]-20)<3&&Math.abs(px[2]-25)<3) sameClear++;
        }
      if(sameClear===5) _clearStreak++; else _clearStreak=0;
    }catch(e){ _clearStreak=0; }
  }
  if((_blank>=90 || _clearStreak>=3) && !_blankWarned){
    _blankWarned=true;
    const d=postDiagnostics();
    const cv=renderer.domElement;
    const r=cv?cv.getBoundingClientRect():null;
    postOverlay("RENDER WATCHDOG // кадр не доходит до экрана\n"
      +"GL: "+d.glInfo+"\nRT: "+d.rtType+" · bloom: "+(postfxEnabled()?"on":"off")+"\n"
      +"calls: "+renderer.info.render.calls+" · tris: "+renderer.info.render.triangles+"\n"
      +"canvas: "+(cv?cv.clientWidth+"x"+cv.clientHeight:"none")+" rect: "+(r?Math.round(r.width)+"x"+Math.round(r.height):"?")+"\n"
      +"clear-probes: "+_clearStreak+"/3 · blank: "+_blank+"\n"
      +"Клавиши: P — качество/perf · B — blit · F3 — статистика · F9 — сброс\n"
      +"Пришлите скрин этого окна: по нему видно причину.");
  }
  // ── DIAG PASS — magenta self-test triangle + live overlay (первые 15с, F3, или при подозрении)
  if(_diagUntil>0) _diagUntil-=dt;
  const diagOn = debug || _diagUntil>0 || _blankWarned;
  if(diagOn){
    drawSelfTest();
    let probe="n/a", cls="PROBE?";
    try{
      const px=probePixel(0.06,0.06);
      probe=px.join(",");
      cls=(px[0]>180&&px[2]>180&&px[1]<120)? "BACKBUFFER OK (GL рисует; если экран сер — проблема композитинга канваса)" : "BACKBUFFER BROKEN (GL-команды не достигают буфера)";
    }catch(e){ probe="throw"; cls="READPIXELS UNSUPPORTED: "+e.message; }
    _diagTick+=dt;
    if(_diagTick>0.5){
      _diagTick=0;
      const cv=renderer.domElement; const r=cv?cv.getBoundingClientRect():null;
      let cs=null; try{ cs=getComputedStyle(cv); }catch(e){}
      const gl=renderer.getContext();
      postOverlay("DIAG v4.1.13 · F3 — скрыть/показать\n"
        +cls+"\n"
        +"GL: "+postDiagnostics().glInfo+"\n"
        +"fps: "+Math.round(_fps)+" · calls/tris: "+renderer.info.render.calls+"/"+renderer.info.render.triangles+" · blank:"+_blank+"\n"
        +"canvas: "+(cv?cv.clientWidth+"x"+cv.clientHeight:"none")+" buf: "+gl.drawingBufferWidth+"x"+gl.drawingBufferHeight+" conn:"+(cv?cv.isConnected:"?")+"\n"
        +"rect: "+(r?Math.round(r.left)+","+Math.round(r.top)+" "+Math.round(r.width)+"x"+Math.round(r.height):"?")+"\n"
        +"css: "+(cs?cs.position+" z"+cs.zIndex+" "+cs.display+" "+cs.visibility+" op"+cs.opacity:"?")+"\n"
        +"selftest px: "+probe+" · perf:"+perfMode+" bloom:"+(postfxEnabled()?"on":"off")+" present:"+(blitOn?"blit":"direct")+" eco:"+ecoMode+" stage:"+_stage+"\n"
        +"ВИДЕН magenta-треугольник слева внизу? ДА/НЕТ — скажи при баге.");
      _diagOverlay=true;
    }
  } else if(_diagOverlay && !_blankWarned){ hidePostOverlay(); _diagOverlay=false; }
  if(_blankWarned && _blank===0 && _clearStreak===0 && !_diagOverlay){ hidePostOverlay(); _blankWarned=false; }
 _hb++;
 }catch(err){
  // DIAG PASS — loop must NEVER die silently: audio survives rAF death, which looks like
  // "grey screen + sounds playing". Report the exception instead of freezing.
  _loopErrs++;
  if(_loopErrs<=3 || _loopErrs%120===0){
    try{ postOverlay("LOOP ERROR #"+_loopErrs+"\n"+(err&&err.stack?err.stack.split("\n").slice(0,4).join("\n"):String(err))); }catch(e){}
  }
 }finally{
  scheduleLoop();
 }
}
scheduleLoop();
try{ window.__NW_STAGE="loop"; }catch(e){}
// P — quality toggle; F3 stats are wired into the existing debug flag below
addEventListener("keydown",e=>{
  if(e.code==="KeyP"&&!e.repeat&&started&&!menuBlocked()){ _autoDone=true; setPerfMode(perfMode?0:1); if(perfMode===0) setEco(false); else if(softwareGL) setEco(true); }
  if(e.code==="KeyB"&&!e.repeat&&started&&!menuBlocked()){ _presentLocked=true; setBlitMode(!blitOn); }
});
// ── COMPAT v4.1.5 — BLIT PRESENTATION ────────────────────────────────────────────
// Кейс пользователя (chrome://gpu): GTX 1050 в машине есть, но Chrome держит WebGL на
// WARP/SwANGLE (software), а композитор не может предъявить WebGL-канвас
// (SharedImageManager: ProduceMemory from non-existent mailbox) — буфер живой, экрана нет.
// При этом 2D-канвас предъявляется нормально (миникарта видна). Значит: в broken-средах
// предъявляем кадр через 2D-канвас: drawImage(glCanvas) в том же таске после рендера.
let blitOn=false, blitCanvas=null, blitCtx=null, softwareGL=false, _healFails=0;
let ecoMode=false, _ecoSkip=false, _matDegraded=false;
// COMPAT v4.1.8 — PRESENTATION LADDER: на битых композиторах (broken DWM/ANGLE) узкое место —
// не GPU (125 calls/31k tris — копейки), а stall на подаче кадра: QUALITY≈PERF по FPS это
// доказал. Ступени само-настройки по замеру FPS: direct → blit → ECO → 35% scale.
let _stage=0, _playT=0, _presentLocked=false, _ecoScale=0.5, _blitProbeAt=0;
// COMPAT v4.1.9 — HANG WATCHDOG: interval lives independently of the rAF loop, so a driver
// hang inside a GL call (blit copy on broken ANGLE) is detected and escaped automatically.
let _hb=0, _hbLast=0, _hangs=0;
setInterval(()=>{
  try{
    if(!started || menuBlocked()) { _hbLast=_hb; return; }
    if(_hb===_hbLast){ _hangs++; } else { _hangs=0; }
    _hbLast=_hb;
    if(_hangs>=3){
      _hangs=0;
      if(blitOn){ setBlitMode(false,true); setEco(true,true); _ecoScale=0.5; _presentLocked=true; applyRenderSize();
        postOverlay("BLIT HANG // драйвер повис на копии WebGL→2D.\nВернулся direct + ECO. Дальше: B/P вручную."); }
      else if(!ecoMode){ setEco(true,true); }
      else if(_ecoScale>0.36){ _ecoScale=0.35; applyRenderSize(); }
    }
  }catch(e){}
},1000);
// ECO PASS — software-GL machines are fill-rate bound: MeshStandard (PBR) fragment shader
// is the heaviest thing per pixel. One-way swap to MeshLambert (emissive/neon identity
// survives) when the GL renderer is software. Unique materials only — cheap.
let _degradeQueue=null;
function degradeMaterials(){
  if(_matDegraded) return;
  _matDegraded=true;
  _degradeQueue=[];
  const cache=new Map();
  scene.traverse(o=>{
    if(!o.isMesh||!o.material||Array.isArray(o.material)) return;
    const m=o.material;
    if(m.type!=="MeshStandardMaterial") return;
    let lm=cache.get(m.uuid);
    if(!lm){
      // v4.1.16 — UNLIT BAKE instead of Lambert: on the user's ANGLE/D3D11 stack Lambert
      // rendered unlit-looking geometry near-BLACK ("platforms disappeared"). Basic with
      // color+emissive baked in is driver-independent, always visible, and the cheapest
      // shader there is (no light uniforms at all) — perfect for ECO/software GL.
      const base=m.color? m.color.clone(): new THREE.Color(0xffffff);
      const em=m.emissive? m.emissive.clone(): new THREE.Color(0x000000);
      const ei=m.emissiveIntensity!==undefined? m.emissiveIntensity:1;
      // v4.1.17: ×0.55 bake made slab bodies (#1A242E→linear ~0.006,0.009,0.016) EXACTLY the
      // scene-background luminance (#0F1419) → platforms camouflaged, user "walked on air".
      // ×1.9 lifts silhouettes ~3-5× above background (approximates PBR lit faces).
      const baked=base.multiplyScalar(1.9).add(em.multiplyScalar(Math.min(1,ei*0.45)));
      baked.setRGB(Math.min(1,baked.r),Math.min(1,baked.g),Math.min(1,baked.b));
      lm=new THREE.MeshBasicMaterial({
        color:baked,
        transparent:m.transparent, opacity:m.opacity, side:m.side,
        blending:m.blending, depthWrite:m.depthWrite, depthTest:m.depthTest,
      });
      if(m.map) lm.map=m.map;
      lm.toneMapped=m.toneMapped;
      cache.set(m.uuid,lm);
    }
    _degradeQueue.push({o,lm});
  });
  // ВАЖНО: НЕ меняем всё сразу — каждая замена = компиляция программы шейдера,
  // а на ANGLE/fxc синхронная компиляция десятков программ = минутный freeze (кейс v4.1.9).
}
// budget-limited swap: ≤4ms of shader compiles per frame → hitch вместо freeze
function pumpDegrade(){
  if(!_degradeQueue||!_degradeQueue.length) return;
  const t0=performance.now();
  while(_degradeQueue.length && performance.now()-t0<4){
    const it=_degradeQueue.pop();
    it.o.material=it.lm;
  }
  if(!_degradeQueue.length) _degradeQueue=null;
}
export function setEco(on,silent){
  on=!!on;
  if(on===ecoMode) return;
  ecoMode=on;
  try{ document.body.classList.toggle("eco",on); }catch(e){}
  if(on) degradeMaterials();
  applyRenderSize();
  if(!silent) message(on? "ECO // Lambert+50%+30Hz (software GL)" : "FULL // bloom доступен (материалы остаются eco)");
}
try{ softwareGL=/Basic Render Driver|SwiftShader|SwANGLE|llvmpipe|Software/i.test(postDiagnostics().glInfo||""); }catch(e){}
function renderScale(){
  if(perfMode===0) return Math.min(devicePixelRatio||1,1.5);
  if(ecoMode) return _ecoScale;
  return softwareGL?0.66:1;
}
function applyRenderSize(){
  const E=renderScale();
  if(blitOn){
    renderer.setPixelRatio(1);
    renderer.setSize(Math.max(2,Math.floor(innerWidth*E)),Math.max(2,Math.floor(innerHeight*E)),false);
    if(blitCanvas){ blitCanvas.width=Math.max(2,innerWidth|0); blitCanvas.height=Math.max(2,innerHeight|0); }
  } else {
    renderer.setPixelRatio(E);
    renderer.setSize(innerWidth,innerHeight,true);
  }
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  resizePostFx();
}
export function blitActive(){ return blitOn; }
export function loopErrors(){ return _loopErrs; } // test/observability: loop-guard must stay silent
export function setBlitMode(on,silent){
  on=!!on;
  if(on && !blitCanvas){
    try{
      blitCanvas=document.createElement("canvas");
      blitCanvas.id="blitPresent";
      blitCanvas.style.cssText="position:fixed;left:0;top:0;width:100%;height:100%;display:block;z-index:0";
      document.body.prepend(blitCanvas);
      blitCtx=blitCanvas.getContext("2d",{alpha:false});
    }catch(e){ return; }
  }
  if(on===blitOn) return;
  blitOn=on;
  _blitProbeAt=on? (performance.now()+1200) : 0;
  if(blitCanvas) blitCanvas.style.display=on?"block":"none";
  try{ renderer.domElement.style.display=on?"none":"block"; }catch(e){}
  applyRenderSize();
  if(!silent) message(on? "BLIT PRESENT // кадр через 2D-канвас (B — обратно)" : "DIRECT PRESENT // WebGL-канвас (B — blit)");
}
// COMPAT PASS — apply the safe default before the first frame is ever presented
try{ setPerfMode(1,true); }catch(e){}
try{ if(softwareGL){ setBlitMode(true,true); setEco(true,true); } }catch(e){}
setTimeout(()=>{ try{ if(softwareGL) message("SOFTWARE GL // ECO: blit+Lambert+50%+30Hz (P — качество, B — blit)"); else message("HARDWARE GL // P — bloom и полное качество · F3 — FPS"); }catch(e){} },1500);
addEventListener("resize",()=>{ applyRenderSize(); });
// shop buttons
try{
  document.getElementById("shopBuyHp")?.addEventListener("click", ()=>{ tryBuyHp(); });
  document.getElementById("shopBuyDmg")?.addEventListener("click", ()=>{ tryBuyDmg(); });
}catch(e){}

// boot exports for verification
export { scene, camera, renderer, solids, player, enemies, boss, fx, shards };
export { ladders, pits, currentRx, currentRy, isOnLadder, tryRoomTransition, checkPitFall, tryGridTransition };
if(typeof window!=="undefined"){ window.__GAME__={ player, enemies, boss, solids, fx, snapToGround, isOnLadder }; }
export const boot = { platforms: solids.length, ladders: ladders.length, pits: pits.length, playerReady: !!player.g, enemiesReady: enemies.length, bossReady: !!boss, useMarket: USE_MARKET, legacy: LEGACY };
