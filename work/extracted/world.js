import * as THREE from "three";
import { platforms, LEGACY } from "./content.js?v=15";
import { laddersToWorld, pitsToWorld, baseLaddersToWorld, decorToWorld, waterToWorld, MARKET_ORIGIN_X, ZONE_W, zoneOrigin, arenaBounds, marketBounds } from "./market.js?v=15";
import { laddersToWorld as cryptLaddersToWorld, pitsToWorld as cryptPitsToWorld, decorToWorld as cryptDecorToWorld, waterToWorld as cryptWaterToWorld, cryptBounds, cryptArenaBounds, CRYPT_ORIGIN_X, cryptZoneOrigin } from "./crypt.js?v=15";
import { gridBounds, GRID_LADDERS, GRID_DECOR, GRID_WATER, GRID_PYRES, GRID_SHOPS, SCREENS, FINAL_GATE_X, SPAWN, GRID_COLS, GRID_STEP_X, GRID_OFFSET_X, screenOrigin, GRID_WALLS } from "./grid43.js?v=15";

export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp = (a,b,t)=>a+(b-a)*t;

export const scene = new THREE.Scene(); scene.background=new THREE.Color(0x0F1419); scene.fog=new THREE.Fog(0x0F1419,18,45);
export const camera = new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,300); camera.position.set(0,7,24);
export const renderer = new THREE.WebGLRenderer({antialias:false,powerPreference:"high-performance",stencil:false,desynchronized:true}); // COMPAT: AA on broken drivers can kill presentation; desynchronized may bypass DWM present stalls renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); // PERF PASS — was 2 renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1; document.body.prepend(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xFFE8C8,0x0F1419,0.9); scene.add(hemi); const key=new THREE.DirectionalLight(0xFFC68A,1.15); key.position.set(-8,18,10); scene.add(key);
const rim=new THREE.DirectionalLight(0x1FA8C9,0.35); rim.position.set(8,12,-10); scene.add(rim);
// ── PERF PASS — neon lights: 8 static PointLights → 2 dynamic "movers" assigned to the
// nearest definitions each 0.25s. Fixed light count = no shader recompiles, ~4× cheaper
// fragment shading (PBR standard material pays per-light BRDF on every lit pixel).
export const neonLights=[]; const neonDefs=[];
function light(c,i,p,d=35){ const def={c,i,p,d}; neonDefs.push(def); return def; }
const moverA=new THREE.PointLight(0xffffff,0,40,2); moverA.decay=2; scene.add(moverA);
const moverB=new THREE.PointLight(0xffffff,0,40,2); moverB.decay=2; scene.add(moverB);
neonLights.push(moverA,moverB);
let _ltA=null,_ltB=null,_lightTick=0;
function assignMover(m,def){ m.position.set(def.p[0],def.p[1],def.p[2]); m.color.setHex(def.c); m.distance=def.d; m.intensity=0.0001; m.userData.ti=def.i; }
export function updateLights(camX,dt){
  _lightTick-=dt;
  if(_lightTick<=0){
    _lightTick=0.25;
    // two nearest defs within 42u, distinct positions
    let bA=null,bB=null,dA=1e9,dB=1e9;
    for(const def of neonDefs){
      const dx=Math.abs(def.p[0]-camX);
      if(dx>42) continue;
      const d=dx;
      if(d<dA){ bB=bA; dB=dA; bA=def; dA=d; }
      else if(d<dB && def!==bA){ bB=def; dB=d; }
    }
    if(bA!==_ltA){ _ltA=bA; if(bA) assignMover(moverA,bA); else moverA.userData.ti=0; }
    if(bB!==_ltB){ _ltB=bB; if(bB) assignMover(moverB,bB); else moverB.userData.ti=0; }
  }
  const k=Math.min(1,dt*6);
  moverA.intensity+=((moverA.userData.ti||0)-moverA.intensity)*k;
  moverB.intensity+=((moverB.userData.ti||0)-moverB.intensity)*k;
}
light(0xFF8C1A,22,[-10,5.2,6],34);light(0xFF8C1A,16,[22,6.2,4],32);light(0x1FA8C9,20,[9,6.4,4.8],36);
light(0xFF2D78,18,[80,14.5,6],38);light(0x00F5FF,16,[38,6.5,4],36);light(0x7A4CFF,14,[86,14.8,6],34);
light(0xFF2D78,14,[130,14.0,5],34);light(0x00F5FF,13,[15,6.3,5],34);

// World: layered industrial city, 4x3 grid compact ~159x36 (12 screens 44x12)
export const world=new THREE.Group();scene.add(world);
export const mergedChunks=[]; // PERF PASS — merged static chunks (col-tagged for biome visibility)
const WORLD_END = (()=>{ 
  if(LEGACY){ try{ const mb=marketBounds(); const cb=cryptBounds(); return Math.max(mb.maxX, cb.maxX)+30; }catch(e){ return 1500; } }
  const gb=gridBounds();
  return gb.maxX + 30;
})();
export const worldEnd = WORLD_END;
export const mats={
  ground:new THREE.MeshStandardMaterial({color:0x1A242E,roughness:.82,metalness:.08}),
  wetGround:new THREE.MeshStandardMaterial({color:0x1B2430,roughness:.25,metalness:.4}),
  dark:new THREE.MeshStandardMaterial({color:0x0B141C,roughness:.92,metalness:.06}),
  concreteLight:new THREE.MeshStandardMaterial({color:0x2A3A4A,roughness:.78,metalness:.07}),
  cyan:new THREE.MeshStandardMaterial({color:0x0A1E26,emissive:0x1FA8C9,emissiveIntensity:2.6,roughness:.32,metalness:.55}),
  amber:new THREE.MeshStandardMaterial({color:0x1A1206,emissive:0xFF8C1A,emissiveIntensity:2.4,roughness:.38,metalness:.45}),
  pink:new THREE.MeshStandardMaterial({color:0x2A0A1A,emissive:0xFF2D78,emissiveIntensity:3.8,roughness:.28,metalness:.5}),
  magenta:new THREE.MeshStandardMaterial({color:0x2A0A1A,emissive:0xFF2D78,emissiveIntensity:4.2,roughness:.28,metalness:.5}),
  cyanHero:new THREE.MeshStandardMaterial({color:0x0A1F2A,emissive:0x00F5FF,emissiveIntensity:3.8,roughness:.28,metalness:.5}),
  violet:new THREE.MeshStandardMaterial({color:0x1A102E,emissive:0x7A4CFF,emissiveIntensity:2.0,roughness:.35,metalness:.5}),
  gold:new THREE.MeshStandardMaterial({color:0x2A2200,emissive:0xFFD700,emissiveIntensity:3.0,roughness:.3,metalness:.6}),
  hazardClip:new THREE.MeshStandardMaterial({color:0x300615,emissive:0xFF164F,emissiveIntensity:2.8,transparent:true,opacity:.82,roughness:.35,metalness:.15}),
  slabMat:new THREE.MeshStandardMaterial({color:0x232833,roughness:.6,metalness:.3}),
  chitinMat:new THREE.MeshStandardMaterial({color:0x2A1220,roughness:.5,metalness:.2}),
  // WAVE 0 — biome materials for new columns
  ventiMat:new THREE.MeshStandardMaterial({color:0x2A3440,roughness:.35,metalness:.75}),
  stokiMat:new THREE.MeshStandardMaterial({color:0x1A2A14,roughness:.55,metalness:.15}),
  kristalMat:new THREE.MeshStandardMaterial({color:0x1A2438,emissive:0x1FA8C9,emissiveIntensity:1.2,roughness:.22,metalness:.5}),
  stanciyaMat:new THREE.MeshStandardMaterial({color:0x2A1A0A,roughness:.45,metalness:.75}),
  sadyMat:new THREE.MeshStandardMaterial({color:0x14220E,roughness:.65,metalness:.1}),
  setMat:new THREE.MeshStandardMaterial({color:0x1A0A24,emissive:0xFF2D78,emissiveIntensity:0.9,roughness:.35,metalness:.45})
};
mats.cyan.toneMapped=false; mats.amber.toneMapped=false; mats.pink.toneMapped=false; mats.magenta.toneMapped=false; mats.cyanHero.toneMapped=false; mats.violet.toneMapped=false; mats.gold.toneMapped=false;
export function box(x,y,z,sx,sy,sz,m=mats.dark){let q=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);q.position.set(x,y,z);world.add(q);return q}
function lightStrip(x,y,z,h,w=0.08,d=0.06,mat=mats.amber){ let s=box(x,y,z,w,h,d,mat); s.material=s.material.clone(); s.material.emissiveIntensity=3.2; s.material.toneMapped=false; return s; }
// ground — dynamic to cover grid
(() => {
  const gb=LEGACY? {minX:-34, maxX:WORLD_END}: gridBounds();
  const cx=(gb.minX+gb.maxX)/2;
  const w=gb.maxX-gb.minX+40;
  box(cx,-1.35,0,w,1.5,20,mats.ground);
})();
// wet asphalt strip for grid col1 market zone
(function(){
  if(LEGACY){
    const wetGeo=new THREE.PlaneGeometry(760,18); const wetMat=new THREE.MeshStandardMaterial({color:0x151F2B,roughness:.25,metalness:.4,transparent:true,opacity:.92});
    const wet=new THREE.Mesh(wetGeo,wetMat); wet.rotation.x=-Math.PI/2; wet.position.set(265,-1.34,1.2); world.add(wet);
  } else {
    const col1x = GRID_OFFSET_X + 1*GRID_STEP_X + 22;
    const wetGeo=new THREE.PlaneGeometry(44,6); const wetMat=new THREE.MeshStandardMaterial({color:0x151F2B,roughness:.25,metalness:.4,transparent:true,opacity:.92});
    const wet=new THREE.Mesh(wetGeo,wetMat); wet.rotation.x=-Math.PI/2; wet.position.set(col1x,-1.34,1.2); world.add(wet);
  }
})();
// ── Parallax layers: ultra-far z=-20 (0.15), far z=-14 (0.3), mid z=-8 (0.6) ──
export const parallaxUltraFar=new THREE.Group(); scene.add(parallaxUltraFar);
export const parallaxFar=new THREE.Group(); scene.add(parallaxFar);
export const parallaxMid=new THREE.Group(); scene.add(parallaxMid);
(function(){
  // ultra-far giant silhouettes z=-20 factor 0.15 every 14u full WORLD_END span, h 26-42 to fill horizon
  for(let i=-33;i<=WORLD_END;i+=14){
    let h=THREE.MathUtils.randFloat(26,38);
    if(i%28===0) h+=4; // occasional mega tower
    let x=i+THREE.MathUtils.randFloat(-1.2,1.2);
    let g=new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(5.5,10.5),h,2.2), mats.violet);
    g.position.set(x, h/2-1.2, -20);
    g.material=g.material.clone(); g.material.emissiveIntensity=0.28; g.material.opacity=0.88; g.material.transparent=false;
    parallaxUltraFar.add(g);
    // faint top glow band
    if(i%28===0){
      let glow=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.09,0.09), mats.amber);
      glow.position.set(x, h*0.58-1.2, -19.05);
      glow.material=glow.material.clone(); glow.material.toneMapped=false; glow.material.emissiveIntensity=0.95;
      parallaxUltraFar.add(glow);
    }
    // distant window sprites emissive glow
    if(i%14===0){
      const cv=document.createElement('canvas'); cv.width=32; cv.height=32; const ctx=cv.getContext('2d');
      const grd=ctx.createRadialGradient(16,16,2,16,16,16); grd.addColorStop(0,'rgba(255,180,80,0.55)'); grd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grd; ctx.fillRect(0,0,32,32);
      const tex=new THREE.CanvasTexture(cv); tex.needsUpdate=true;
      const smat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0.28,depthWrite:false,blending:THREE.AdditiveBlending});
      const spr=new THREE.Sprite(smat); spr.position.set(x+THREE.MathUtils.randFloat(-1,1), h*0.35-1.2, -19.2); spr.scale.set(3.2,3.2,1); parallaxUltraFar.add(spr);
    }
  }
  for(let i=-34;i<=WORLD_END;i+=9){
    let h=THREE.MathUtils.randFloat(14,28);
    if(i%27===0) h+=10;
    if(i%36===0) h=Math.max(h, 32+THREE.MathUtils.randFloat(0,6));
    let x=i+THREE.MathUtils.randFloat(-1.5,1.5);
    let fg=new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(3.5,7.5),h,1.8), mats.violet);
    fg.position.set(x, h/2-1.2, -14);
    fg.material=fg.material.clone(); fg.material.emissiveIntensity=0.45; fg.material.opacity=0.95; fg.material.transparent=false;
    parallaxFar.add(fg);
    if(i%18===0){
      let w=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.08,0.08), mats.amber);
      w.position.set(x, h*0.52-1.2, -13.05);
      w.material=w.material.clone(); w.material.toneMapped=false; w.material.emissiveIntensity=1.2;
      parallaxFar.add(w);
    }
    // tall antenna on some far silhouettes
    if(i%27===0){
      let antM=new THREE.Mesh(new THREE.BoxGeometry(0.06,4.4,0.06), mats.dark); antM.position.set(x, h-1.2+2.2, -13.8); parallaxFar.add(antM);
      let tip=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.14), mats.amber); tip.position.set(x, h-1.2+4.5, -13.8); tip.material=tip.material.clone(); tip.material.toneMapped=false; tip.material.emissiveIntensity=2.4; parallaxFar.add(tip);
    }
  }
  for(let i=-34;i<=WORLD_END;i+=7){
    let h=THREE.MathUtils.randFloat(10,24);
    if(i%21===0) h+=8;
    if(i%28===0) h=Math.max(h, 28+THREE.MathUtils.randFloat(0,5));
    let isMarket=false;
    if(LEGACY) isMarket = i >= 195;
    else {
      // grid: col1 market magenta, col2 crypt violet, col3 maw magenta
      const col = Math.floor((i - GRID_OFFSET_X)/GRID_STEP_X);
      isMarket = col===1 || col===3;
      // WAVE 2 — ВЕНТИ bg: vent ducts (horizontal panels + grates) instead of towers — свой фон уровня
      if(col===4){
        for(let dy=2; dy<26; dy+=3.2){
          const duct=new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(5,9),1.1,2.0), mats.ventiMat);
          duct.position.set(i+THREE.MathUtils.randFloat(-1,1), dy, -8);
          duct.material=duct.material.clone(); duct.material.emissiveIntensity=0.5;
          parallaxMid.add(duct);
          if(Math.floor(dy/3.2)%2===0){
            const grate=new THREE.Mesh(new THREE.BoxGeometry(4.5,0.06,0.06), mats.gold);
            grate.position.set(i, dy+0.62, -7.05); grate.material=grate.material.clone(); grate.material.toneMapped=false; grate.material.emissiveIntensity=1.4;
            parallaxMid.add(grate);
          }
        }
        continue;
      }
    }
    let mat = isMarket ? (i%14===0? mats.magenta : mats.violet) : mats.dark;
    if(!isMarket && i%9===0) mat = mats.concreteLight;
    let mg=new THREE.Mesh(new THREE.BoxGeometry(THREE.MathUtils.randFloat(2.2,4.8),h,2.0), mat);
    mg.position.set(i+THREE.MathUtils.randFloat(-1,1), h/2-1.2, -8);
    mg.material=mg.material.clone(); if(mat===mats.magenta) mg.material.emissiveIntensity=1.8; else if(mat===mats.violet) mg.material.emissiveIntensity=0.9; else mg.material.emissiveIntensity=0.3;
    parallaxMid.add(mg);
    if(i%7===0){
      let wMat = isMarket ? (i%14===0? mats.magenta : mats.cyanHero) : mats.amber;
      let w=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.07,0.06), wMat);
      w.position.set(i, h*0.5-1.2, -7.05);
      w.material=w.material.clone(); w.material.toneMapped=false; w.material.emissiveIntensity=isMarket?2.2:1.0;
      parallaxMid.add(w);
    }
    // ART WAVE 2 — balconies on tall towers (ledge + neon rail)
    if(h>16 && i%14===0){
      const by=h*0.62-1.2;
      const ledge=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.08,0.5), mats.concreteLight);
      ledge.position.set(i+0.8, by, -7.2); parallaxMid.add(ledge);
      const rail=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.05,0.05), isMarket? mats.magenta : mats.amber);
      rail.position.set(i+0.8, by+0.14, -7.0); rail.material=rail.material.clone(); rail.material.toneMapped=false; rail.material.emissiveIntensity=1.6;
      parallaxMid.add(rail);
    }
  }
})();
export function updateParallax(camX){
  parallaxUltraFar.position.x = camX*0.15;
  parallaxFar.position.x = camX*0.3;
  parallaxMid.position.x = camX*0.6;
}
for(let i=-34;i<=WORLD_END;i+=4){
  let h=THREE.MathUtils.randFloat(8,28);
  if(i%28===0) h+=10; if(i%16===7) h=Math.max(5,h*0.62);
  if(i%36===0) h=Math.max(h, 30+THREE.MathUtils.randFloat(2,10));
  if(i%48===4) h=Math.max(h, 24+THREE.MathUtils.randFloat(1,8));
  if(i%32===4) h=Math.max(h, 34+THREE.MathUtils.randFloat(0,6));
  h=Math.min(h, 42);
  let z=THREE.MathUtils.randFloat(-9.2,-4.2);
  let isMarket=false;
  if(LEGACY) isMarket = i >= 195;
  else {
    const col = Math.floor((i - GRID_OFFSET_X)/GRID_STEP_X);
    isMarket = col===1 || col===3;
  }
  let mat = mats.dark;
  if(!isMarket){
    if(i%8===0) mat = (i%24===0? mats.cyan : mats.amber);
    else if(i%5===0) mat = mats.concreteLight;
  } else {
    if(i%16===0) mat = (i%32===0? mats.magenta : mats.cyanHero);
    else if(i%12===0) mat = mats.violet;
    else if(i%7===0) mat = mats.gold;
  }
  // WAVE 2 — ВЕНТИ bg: vent ducts instead of towers (свой фон уровня, статичный слой)
  if(!LEGACY && Math.floor((i - GRID_OFFSET_X)/GRID_STEP_X)===4){
    const ductMat = i%8===0? mats.cyan : mats.ventiMat;
    const duct=box(i, h/2-1.2, z, THREE.MathUtils.randFloat(3.2,6.5), 1.3, 2.6, ductMat);
    duct.material=duct.material.clone(); duct.material.emissiveIntensity = i%8===0? 2.2 : 0.55;
    if(i%8===0){ // grate line on the duct
      const grate=box(i, h/2-1.2+0.75, z+1.4, 3.0, .07, .06, mats.gold);
      grate.material=grate.material.clone(); grate.material.toneMapped=false; grate.material.emissiveIntensity=1.6;
    }
    continue;
  }
  let b=box(i,h/2-1.2,z,THREE.MathUtils.randFloat(2.0,5.2),h,3.2,mat);
  if(i%8===0){
    let wMat = isMarket ? (i%16===0? mats.magenta : mats.cyanHero) : (i%24===0? mats.cyan : mats.amber);
    let w=box(i,h*.52-1.2,z+1.75,THREE.MathUtils.randFloat(1.2,2.6),.09,.06,wMat);
    w.material=w.material.clone(); w.material.toneMapped=false; w.material.emissiveIntensity=isMarket?4.2:2.6;
  }
  if(i%18===0){
    let stripMat = isMarket ? (i%36===0? mats.magenta : mats.cyanHero) : mats.amber;
    lightStrip(i+1.1, Math.max(1,h*.55)-1.2, z+1.72, Math.max(2,h*0.55), 0.07,0.05, stripMat);
  }
  if(i%20===0){
    let cap=box(i,h-1.2+0.6,z,0.45,1.2,0.45,mats.dark); cap.scale.x=1;
  }
  // antenna filler on tall towers
  if(h>28 && i%12===0){
    let antH=THREE.MathUtils.randFloat(2.5,5.5);
    let ax=box(i+THREE.MathUtils.randFloat(-0.6,0.6), h-1.2+antH/2, z+0.2, 0.05, antH, 0.05, mats.dark);
    let tipMat = isMarket ? mats.magenta : mats.amber;
    let tip=box(i+THREE.MathUtils.randFloat(-0.6,0.6), h-1.2+antH+0.18, z+0.2, 0.12,0.12,0.12,tipMat); tip.material=tip.material.clone(); tip.material.toneMapped=false; tip.material.emissiveIntensity=2.8;
  }
  // cable sag between towers every 16u
  if(i%16===0){
    let cable=box(i+2, h*0.78-1.2, z+1.6, 4.2, 0.04, 0.04, mats.dark);
    cable.material=cable.material.clone(); cable.material.opacity=0.85; cable.material.transparent=false;
  }
}
for(let x=-30;x<=WORLD_END;x+=10){
  let isMarket=false;
  if(LEGACY) isMarket = x >= 195;
  else {
    const col = Math.floor((x - GRID_OFFSET_X)/GRID_STEP_X);
    isMarket = col>=1;
  }
  if(x%20===0 || isMarket){
    // low sign y 6..12
    let y=THREE.MathUtils.randFloat(6.2,12.0);
    let z=THREE.MathUtils.randFloat(-2.8,-1.2);
    let sm = isMarket ? (x%30===0? mats.magenta : mats.cyanHero) : mats.amber;
    let sg=box(x,y,z,THREE.MathUtils.randFloat(1.4,2.8),0.55,0.12,sm);
    sg.material=sg.material.clone(); sg.material.toneMapped=false; sg.material.emissiveIntensity=isMarket?3.6:2.0;
    box(x, y+0.6, z, 0.02, 1.2, 0.02, mats.dark);
    if(isMarket && x%30===0){
      let tr=box(x, y-0.32, z+0.08, 1.6,0.06,0.06,mats.gold); tr.material=tr.material.clone(); tr.material.toneMapped=false; tr.material.emissiveIntensity=3.0;
    }
    // high hanging sign y 14..38 every second column to fill upper void
    if(x%20===0){
      let y2=THREE.MathUtils.randFloat(16,38);
      let z2=THREE.MathUtils.randFloat(-3.2,-1.6);
      let sm2 = isMarket ? (x%40===0? mats.magenta : mats.violet) : mats.cyan;
      let sg2=box(x+THREE.MathUtils.randFloat(-1,1),y2,z2,THREE.MathUtils.randFloat(1.2,2.2),0.48,0.12,sm2);
      sg2.material=sg2.material.clone(); sg2.material.toneMapped=false; sg2.material.emissiveIntensity=isMarket?3.2:1.9;
      // cable from ceiling
      box(x+THREE.MathUtils.randFloat(-1,1), y2+0.9, z2, 0.02, 1.8, 0.02, mats.dark);
      // distant glow sprite at high sign
      const cv=document.createElement('canvas'); cv.width=32; cv.height=32; const g=cv.getContext('2d');
      const grd=g.createRadialGradient(16,16,2,16,16,12); const colHex = isMarket? '#FF2D78':'#00F5FF'; const col=new THREE.Color(colHex);
      grd.addColorStop(0,'rgba('+Math.round(col.r*255)+','+Math.round(col.g*255)+','+Math.round(col.b*255)+',0.45)'); grd.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=grd; g.fillRect(0,0,32,32); const tex=new THREE.CanvasTexture(cv);
      const smat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0.32,depthWrite:false,blending:THREE.AdditiveBlending}); const spr=new THREE.Sprite(smat); spr.position.set(x, y2, z2+0.18); spr.scale.set(2.4,2.4,1); world.add(spr);
    }
  }
}
// extra mid-high signs every 14u to guarantee 12u window coverage in upper bands
for(let x=-26;x<=WORLD_END;x+=14){
  let y=THREE.MathUtils.randFloat(20,34);
  let z=THREE.MathUtils.randFloat(-3.5,-2.0);
  let isMarket=false; if(!LEGACY){ const col=Math.floor((x-GRID_OFFSET_X)/GRID_STEP_X); isMarket=col>=1; } else isMarket=x>=195;
  let sm = isMarket? mats.violet : mats.amber;
  let sg=box(x,y,z,THREE.MathUtils.randFloat(1.0,1.8),0.42,0.10,sm);
  sg.material=sg.material.clone(); sg.material.toneMapped=false; sg.material.emissiveIntensity=isMarket?2.6:1.8;
  box(x, y+0.5, z, 0.02, 1.0, 0.02, mats.dark);
}
for(let x=-30;x<=(LEGACY?180: WORLD_END);x+=14){
  box(x+7,8.2,-0.6,13,.18,.18,mats.concreteLight);
  if(x%28===0){ box(x,5.2,-0.6,0.16,6.2,0.16,mats.dark); box(x+12,5.2,-0.6,0.16,6.2,0.16,mats.dark); }
  if(x%28===0){ let b=box(x+6,8.45,-0.6,0.18,0.18,0.18,mats.amber); b.material=b.material.clone(); b.material.emissiveIntensity=3.6; b.material.toneMapped=false; }
}
// high gantries y 18, 28, 36 to fill upper void every 14u
for(let x=-30;x<=WORLD_END;x+=14){
  for(const gy of [18.4, 28.2, 36.0]){
    if(gy===36.0 && x%28!==0) continue;
    box(x+7,gy,-0.75,13,.14,.14,mats.dark);
    if(x%28===0){ box(x+THREE.MathUtils.randFloat(5,9),gy+0.25,-0.75,0.16,0.16,0.16,mats.cyan); }
  }
}
if(LEGACY){
  for(let x=210;x<=WORLD_END;x+=28){
    box(x+7,8.0,-0.6,9,.14,.14,mats.dark);
    if(x%56===0){ let b=box(x+6,8.25,-0.6,0.16,0.16,0.16,mats.magenta); b.material=b.material.clone(); b.material.emissiveIntensity=3.2; b.material.toneMapped=false; }
  }
} else {
  for(let x=-34;x<=WORLD_END;x+=28){
    if(x<30) continue;
    box(x+7,8.0,-0.6,9,.14,.14,mats.dark);
    if(x%56===0){ let b=box(x+6,8.25,-0.6,0.16,0.16,0.16,mats.magenta); b.material=b.material.clone(); b.material.emissiveIntensity=3.2; b.material.toneMapped=false; }
  }
}
for(let x=-26;x<=WORLD_END;x+=12){ box(x,6.6,-.9,6.2,.09,.09,mats.dark); if(x%24===0) box(x,6.75,-.9,0.7,.07,.07,mats.cyan); }
// mid cables y 14 and 22
for(let x=-26;x<=WORLD_END;x+=16){ box(x+8,14.2,-0.85,15,.06,.06,mats.dark); if(x%32===0) box(x+4,22.6,-0.85,15,.06,.06,mats.dark); }
(function(){
  const fogMat=new THREE.MeshStandardMaterial({color:0x1A242E,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide,roughness:1,metalness:0});
  const steamMat=new THREE.MeshStandardMaterial({color:0xDDEAF2,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide,roughness:1,metalness:0});
  for(let i=-28;i<=WORLD_END;i+=22){
    let y=THREE.MathUtils.randFloat(0.2,3.2); let z=THREE.MathUtils.randFloat(-1.2,2.2);
    let w=THREE.MathUtils.randFloat(4,9), h=THREE.MathUtils.randFloat(2.2,4.2);
    let p=new THREE.Mesh(new THREE.PlaneGeometry(w,h), fogMat.clone()); p.position.set(i+THREE.MathUtils.randFloat(-2,2),y,z); p.rotation.y=THREE.MathUtils.randFloat(-.5,.5); p.rotation.z=THREE.MathUtils.randFloat(-.15,.15); world.add(p);
    if(i%44===0){
      let s=new THREE.Mesh(new THREE.PlaneGeometry(2.2,5), steamMat.clone()); s.position.set(i,2.1,1.8); s.rotation.y=Math.PI*0.05; world.add(s);
    }
  }
  for(let i=-20;i<=WORLD_END;i+=18){
    let g=new THREE.Mesh(new THREE.PlaneGeometry(14,1.6), fogMat.clone()); g.material.opacity=.09; g.position.set(i,0.05,2.4); world.add(g);
  }
  // high fog cards y 10..36 every 24u to dress mid-air void
  for(let i=-26;i<=WORLD_END;i+=24){
    for(const hy of [12,20,30]){
      let w=THREE.MathUtils.randFloat(6,12), h=THREE.MathUtils.randFloat(3.5,6.5);
      let fm=fogMat.clone(); fm.opacity=0.07; fm.color.setHex(0x1A242E);
      let p=new THREE.Mesh(new THREE.PlaneGeometry(w,h), fm); p.position.set(i+THREE.MathUtils.randFloat(-3,3), hy+THREE.MathUtils.randFloat(-1.2,1.2), THREE.MathUtils.randFloat(-2.5,1.5)); p.rotation.y=THREE.MathUtils.randFloat(-.35,.35); world.add(p);
    }
  }
})();
for(let x=-30;x<=WORLD_END;x+=6){let m = x >= (LEGACY?195:15) ? (x % 24 === 0 ? mats.violet : mats.magenta) : (x%18===0? mats.cyan : mats.amber); let rr=box(x,4.2,-.6,4.6,.16,.12,m); rr.material=rr.material.clone(); rr.material.toneMapped=false; rr.material.emissiveIntensity= x>=(LEGACY?195:15)?3.4:2.2;}
export const grid=new THREE.GridHelper(800,160,0x1E3446,0x0F1D2A);grid.rotation.x=0;grid.position.y=-1.29;grid.position.z=3;grid.material.opacity=.22;grid.material.transparent=true;scene.add(grid);
// ART WAVE 2 — canvas text signs (Cyrillic market banners)
function makeTextSign(text,colorHex){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=32;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='rgba(8,14,24,0.92)'; ctx.fillRect(0,0,128,32);
  ctx.fillStyle=colorHex; ctx.font='bold 15px monospace'; ctx.textAlign='center'; ctx.fillText(text,64,22);
  const tex=new THREE.CanvasTexture(cv);
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.92});
  const spr=new THREE.Sprite(mat); spr.scale.set(2.1,0.55,1);
  return spr;
}
function sign(x,y,z,textMat){let p=box(x,y,z,.18,3,.12,textMat);p.material=p.material.clone();p.material.toneMapped=false;return p}
const SIGN_TEXTS=["ЕДА","ЧИПЫ","МЕДЬ","СВЯЗЬ","РАЦИЯ","СЕТЬ","БАР","ХИРУРГ"];
let signIdx=0;
for(let x=-26;x<=WORLD_END;x+=8){
  const inMarket = x >= (LEGACY?195:15);
  if(inMarket && signIdx%3===0){
    const spr=makeTextSign(SIGN_TEXTS[Math.floor(signIdx/3)%SIGN_TEXTS.length], (signIdx%2?"#00F5FF":"#FF2D78"));
    spr.position.set(x, 5.6, -0.9);
    world.add(spr);
  } else {
    let sm = inMarket ? mats.violet : mats.cyan;
    let s=sign(x,4,-1,sm); s.material.emissiveIntensity= inMarket?2.4:2.2;
  }
  signIdx++;
}

 if(LEGACY){
  (function(){
    const cryptX = WORLD_END - 18;
    for(let i=0;i<5;i++){
      let cx = cryptX + i*3.2;
      let h=THREE.MathUtils.randFloat(4,9);
      let c=box(cx, h/2-1.0, -6.2, 1.6, h, 1.2, mats.violet);
      c.material=c.material.clone(); c.material.emissiveIntensity=0.85; c.material.opacity=0.92;
    }
  })();
 }

// Platforms / traversal path — with pit gaps (skip platform where pit overlaps)
export const pitRanges = LEGACY ? [...pitsToWorld(), ...cryptPitsToWorld()] : [];
export const solids=[];
for(const [x,y,z,w] of platforms){
  const isFloor = Math.abs(y - 1.0) < 0.12;
  if(LEGACY && isFloor){
    let overlapsPit = false;
    for(const pit of pitRanges){
      const platL = x - w/2, platR = x + w/2;
      if(platR > pit.x && platL < pit.x2){ overlapsPit = true; break; }
    }
    if(overlapsPit) continue;
  }
  let mat, edgeMat, edgeGlow;
  let col = 0;
  if(LEGACY){
    const isMarketPlat = x >= 195;
    mat = isMarketPlat ? mats.wetGround : mats.ground;
    if(!isMarketPlat && Math.floor(x)%4===0){ mat = mats.concreteLight; }
    edgeMat = (Math.floor(x)%3===0 ? (isMarketPlat? mats.cyanHero : mats.amber) : (isMarketPlat? mats.gold : mats.cyan));
    edgeGlow = isMarketPlat?3.2:2.0;
  } else {
    // ART PASS — biome platform materials by grid col: 0 base rust, 1 market wet, 2 crypt slab, 3 maw chitin, 4..9 new biomes
    col = clamp(Math.floor((x + 33) / 48), 0, GRID_COLS-1);
    const colMats=[mats.ground, mats.wetGround, mats.slabMat, mats.chitinMat, mats.ventiMat, mats.stokiMat, mats.kristalMat, mats.stanciyaMat, mats.sadyMat, mats.setMat];
    mat = colMats[col]||mats.ground;
    if(col===0 && Math.floor(x)%4===0){ mat = mats.concreteLight; }
    const edgeA=[mats.amber,mats.cyanHero,mats.violet,mats.pink,mats.cyan,mats.cyan,mats.cyanHero,mats.amber,mats.cyan,mats.magenta];
    const edgeB=[mats.cyan,mats.gold,mats.cyanHero,mats.magenta,mats.gold,mats.violet,mats.cyan,mats.gold,mats.violet,mats.cyanHero];
    edgeMat = Math.floor(x)%3===0 ? (edgeA[col]||mats.amber) : (edgeB[col]||mats.cyan);
    edgeGlow = (col===1||col===2||col===6)?3.2:2.2;
  }
  let p=box(x,y-.55,z,w,1.1,3,mat);p.userData.col=col;solids.push({x,y,w,d:3,mesh:p,col}); let e=box(x,y+.03,z-1.54,w,.06,.06,edgeMat); e.material=e.material.clone(); e.material.toneMapped=false; e.material.emissiveIntensity=edgeGlow; e.userData.col=col;
}

// Ladder visuals
export const ladderData = LEGACY ? [...baseLaddersToWorld(), ...laddersToWorld(), ...cryptLaddersToWorld()] : GRID_LADDERS;
export const ladderMeshes = [];
export function buildLadders(){
  for(const ld of ladderData){
    const { x, yBottom, yTop, h } = ld;
    const yMid = (yBottom + yTop)/2;
    const isMarketLadder = LEGACY ? x >= 195 : (x >= 15);
    const railMat = isMarketLadder ? mats.gold : mats.cyan;
    const railL = box(x-0.16, yMid, 0.15, 0.05, h, 0.05, railMat); railL.material=railL.material.clone(); railL.material.toneMapped=false; railL.material.emissiveIntensity=isMarketLadder?2.8:2.4; railL.userData.col=ld.c;
    const railR = box(x+0.16, yMid, 0.15, 0.05, h, 0.05, railMat); railR.material=railR.material.clone(); railR.material.toneMapped=false; railR.material.emissiveIntensity=isMarketLadder?2.8:2.4; railR.userData.col=ld.c;
    ladderMeshes.push(railL, railR);
    const rungCount = Math.floor(h/0.45);
    for(let i=0;i<=rungCount;i++){
      const ry = yBottom + 0.22 + i*0.45;
      if(ry > yTop -0.18) break;
      const rung = box(x, ry, 0.15, 0.38, 0.04, 0.04, railMat); rung.material=rung.material.clone(); rung.material.toneMapped=false; rung.material.emissiveIntensity=isMarketLadder?2.8:2.4; rung.userData.col=ld.c;
      ladderMeshes.push(rung);
    }
  }
  for(const pit of pitRanges){
    const pitMid = pit.cx;
    const pitW = pit.w;
    const hole = box(pitMid, -0.25, 1.2, pitW, 0.12, 2.2, mats.dark);
    hole.material = hole.material.clone();
    hole.material.color.setHex(0x0a0a12);
    hole.material.emissive.setHex(0x11051a);
    hole.material.emissiveIntensity = 0.6;
  }
}
buildLadders();

// ── Vertical carcass: shafts + door frames ──
export const shaftMeshes=[];
function buildShaft(x, yBottom, yTop, label){
  const yMid=(yBottom+yTop)/2, h=yTop-yBottom;
  const leftWall=box(x-0.62, yMid, -1.2, 0.14, h+0.8, 0.4, mats.dark);
  const rightWall=box(x+0.62, yMid, -1.2, 0.14, h+0.8, 0.4, mats.dark);
  shaftMeshes.push(leftWall,rightWall);
  const back=box(x, yMid, -1.35, 1.1, h, 0.08, mats.concreteLight);
  back.material=back.material.clone(); back.material.opacity=0.75; back.material.transparent=true;
  shaftMeshes.push(back);
  function doorFrame(y, isTop){
    const fy = isTop ? y+0.35 : y-0.25;
    const frame=box(x, fy, -1.2, 1.45, 0.42, 0.14, mats.dark);
    shaftMeshes.push(frame);
    const trim=box(x, fy+(isTop?0.2:-0.18), -1.2, 1.55, 0.06, 0.06, mats.gold);
    trim.material=trim.material.clone(); trim.material.toneMapped=false; trim.material.emissiveIntensity=3.4;
    shaftMeshes.push(trim);
    const lp=box(x-0.65, fy, -1.2, 0.08, 0.58, 0.08, mats.gold); lp.material=lp.material.clone(); lp.material.toneMapped=false; lp.material.emissiveIntensity=2.8; shaftMeshes.push(lp);
    const rp=box(x+0.65, fy, -1.2, 0.08, 0.58, 0.08, mats.gold); rp.material=rp.material.clone(); rp.material.toneMapped=false; rp.material.emissiveIntensity=2.8; shaftMeshes.push(rp);
    const glowMat=new THREE.MeshStandardMaterial({color:0x1A102E, emissive:0xFFD700, emissiveIntensity:1.8, transparent:true, opacity:0.55, side:THREE.DoubleSide});
    const glow=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.32), glowMat);
    glow.position.set(x, fy, -1.15); world.add(glow); shaftMeshes.push(glow);
  }
  doorFrame(yTop, true);
  doorFrame(yBottom, false);
  const innerL=box(x-0.16, yMid, -1.2, 0.03, h, 0.03, mats.gold); innerL.material=innerL.material.clone(); innerL.material.toneMapped=false; innerL.material.emissiveIntensity=1.6; shaftMeshes.push(innerL);
  const innerR=box(x+0.16, yMid, -1.2, 0.03, h, 0.03, mats.gold); innerR.material=innerR.material.clone(); innerR.material.toneMapped=false; innerR.material.emissiveIntensity=1.6; shaftMeshes.push(innerR);
  if(label==="sunken"){
    const wMat=new THREE.MeshStandardMaterial({color:0x0a1f2a, emissive:0x00F5FF, emissiveIntensity:1.2, transparent:true, opacity:0.32, side:THREE.DoubleSide});
    const wp=new THREE.Mesh(new THREE.PlaneGeometry(1.8,0.9), wMat);
    wp.rotation.x=-Math.PI/2; wp.position.set(x, yBottom-0.35, -1.15); world.add(wp); shaftMeshes.push(wp);
  }
}
function buildShafts(){
  if(LEGACY){
    const s1x = zoneOrigin(1,1)+24;
    const s2x = zoneOrigin(1,2)+30;
    const yB = 0.45, yT = 5.05;
    buildShaft(s1x, yB, yT, "market-down");
    buildShaft(s2x, yB, yT, "sunken");
    const mawX = WORLD_END - 42;
    buildShaft(mawX, 0.25, 4.6, "maw");
  } else {
    for(const ld of GRID_LADDERS){
      const label = ld.c===1 && ld.rFrom===1 ? "sunken" : (ld.c===3? "maw" : "grid");
      buildShaft(ld.x, ld.yBottom, ld.yTop, label);
    }
  }
}
buildShafts();
// WAVE 1 — ВЕНТИ walls (visual: vent duct panels + gold edges; collision in main.js wall system)
export const wallMeshes=[];
export const walls = GRID_WALLS;
(function buildWalls(){
  if(LEGACY) return;
  for(const w of GRID_WALLS){
    const h=w.yTop-w.yBottom;
    const panel=box(w.x, (w.yBottom+w.yTop)/2, -0.5, 0.5, h, 1.2, mats.ventiMat); panel.userData.col=w.col;
    const edgeL=box(w.x-0.25, (w.yBottom+w.yTop)/2, 0.15, 0.06, h, 0.06, mats.gold);
    edgeL.material=edgeL.material.clone(); edgeL.material.toneMapped=false; edgeL.material.emissiveIntensity=1.6; edgeL.userData.col=w.col;
    const edgeR=box(w.x+0.25, (w.yBottom+w.yTop)/2, 0.15, 0.06, h, 0.06, mats.gold);
    edgeR.material=edgeR.material.clone(); edgeR.material.toneMapped=false; edgeR.material.emissiveIntensity=1.6; edgeR.userData.col=w.col;
    wallMeshes.push(panel, edgeL, edgeR);
  }
})();
// ART PASS — per-screen props: crates, barrels, wall pipes, lamps, debris (visual only, behind lane z<=-0.85)
export const propMeshes=[];
(function buildProps(){
  if(LEGACY) return;
  const chrome=new THREE.MeshStandardMaterial({color:0x7A8A99,metalness:.85,roughness:.22});
  for(const s of SCREENS){
    const count = 4 + ((s.col*2 + s.row) % 3);
    for(let i=0;i<count;i++){
      const px = s.originX + THREE.MathUtils.randFloat(2, 42);
      const pyGuess = s.baseY + THREE.MathUtils.randFloat(0.5, 5);
      const kind = (i + s.col*2 + s.row*3) % 5;
      if(kind===2){ // wall pipe (background, no snap)
        const py = s.baseY + THREE.MathUtils.randFloat(2, 7);
        const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,THREE.MathUtils.randFloat(2,4),8),chrome);
        pipe.rotation.z=Math.PI/2; pipe.position.set(px, py, -1.35); pipe.userData.col=s.col; world.add(pipe); propMeshes.push(pipe);
        continue;
      }
      // snap to highest platform top at px
      let top=null;
      for(const p of solids){ if(Math.abs(px-p.x)<=p.w/2+.34 && p.y<=pyGuess+.5){ if(top===null||p.y>top) top=p.y; } }
      if(top===null) continue;
      const z=THREE.MathUtils.randFloat(-2.6,-0.9);
      if(kind===0){ // crate + glowing edge
        const crateMat = s.col===1? mats.gold : s.col===2? mats.slabMat : s.col===3? mats.chitinMat : mats.concreteLight;
        const crate=box(px, top+.28, z, .56,.56,.56, crateMat); crate.userData.col=s.col;
        const edge=box(px, top+.56, z, .6,.05,.6, s.col===1? mats.cyanHero : mats.amber);
        edge.material=edge.material.clone(); edge.material.toneMapped=false; edge.material.emissiveIntensity=2.0; edge.userData.col=s.col;
        propMeshes.push(crate,edge);
      } else if(kind===1){ // barrel
        const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.62,10), s.col===1? mats.magenta : mats.dark);
        barrel.position.set(px, top+.31, z); barrel.userData.col=s.col; world.add(barrel); propMeshes.push(barrel);
      } else if(kind===3){ // standing lamp
        const pole=box(px, top+.55, z, .06,1.1,.06, chrome); pole.userData.col=s.col;
        const lampHead=box(px, top+1.15, z, .22,.12,.22, s.col===1? mats.magenta : mats.amber);
        lampHead.material=lampHead.material.clone(); lampHead.material.toneMapped=false; lampHead.material.emissiveIntensity=3.0; lampHead.userData.col=s.col;
        propMeshes.push(pole,lampHead);
      } else { // debris pile
        for(let d=0;d<3;d++){
          const deb=box(px+THREE.MathUtils.randFloat(-.4,.4), top+.08+d*.12, z+THREE.MathUtils.randFloat(-.2,.2), THREE.MathUtils.randFloat(.14,.3),.12,THREE.MathUtils.randFloat(.14,.3), mats.dark);
          deb.userData.col=s.col;
          propMeshes.push(deb);
        }
      }
    }
  }
})();
function buildTierDoors(){
  if(LEGACY){
    const doors = [
      {x: zoneOrigin(1,1)+22, y: 5.05, z:-1.2},
      {x: zoneOrigin(1,1)+22, y: 0.18, z:-1.2},
      {x: zoneOrigin(1,2)+28, y: 5.05, z:-1.2},
      {x: zoneOrigin(1,2)+28, y: 0.18, z:-1.2},
    ];
    for(const d of doors){
      const f=box(d.x, d.y, d.z, 1.2, 0.52, 0.12, mats.dark);
      f.userData.walkLane=false;
      const gl=box(d.x, d.y, -1.2, 1.0, 0.38, 0.04, mats.gold);
      gl.material=gl.material.clone(); gl.material.toneMapped=false; gl.material.emissiveIntensity=4.2;
      const haloMat=new THREE.MeshStandardMaterial({color:0xFFD700, emissive:0xFFD700, emissiveIntensity:2.2, transparent:true, opacity:0.22, side:THREE.DoubleSide});
      const halo=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.7), haloMat);
      halo.position.set(d.x, d.y, -1.15); world.add(halo);
    }
  } else {
    // door markers per vertical shaft ends (already have door frames, add extra gold halo)
    for(const ld of GRID_LADDERS){
      for(const y of [ld.yTop, ld.yBottom]){
        const haloMat=new THREE.MeshStandardMaterial({color:0xFFD700, emissive:0xFFD700, emissiveIntensity:2.2, transparent:true, opacity:0.22, side:THREE.DoubleSide});
        const halo=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.7), haloMat);
        halo.position.set(ld.x, y, -1.15); world.add(halo);
      }
    }
  }
}
buildTierDoors();

// ── Inter-row shaft interiors: one dressed column per GRID_COL aligned with ladder shafts, spanning row gaps
// Each column has dark walls + faint vertical light strip at z behind lane (-1.4) so vertical travel reads as interior structure not void
export const interRowShafts=[];
export const shaftDressing=interRowShafts;
(function buildInterRowShaftDressing(){
  if(LEGACY) return;
  for(let c=0;c<GRID_COLS;c++){
    const shaftX=screenOrigin(c,0).x+22;
    const yBottom=0.45;
    const yTop=40.45;
    const yMid=(yBottom+yTop)/2;
    const h=yTop-yBottom;
    // interior dark shaft spine behind lane up to y 40
    const spine=box(shaftX, yMid, -1.45, 1.16, h, 0.28, mats.dark);
    spine.material=spine.material.clone(); spine.material.opacity=0.96; spine.material.transparent=false;
    interRowShafts.push(spine);
    // faint vertical light strip down center full height
    const strip=box(shaftX, yMid, -1.44, 0.08, h-0.6, 0.04, mats.gold);
    strip.material=strip.material.clone(); strip.material.toneMapped=false; strip.material.emissiveIntensity=2.2; strip.material.opacity=0.7; strip.material.transparent=true;
    interRowShafts.push(strip);
    // side walls for interior depth cue
    const leftWall=box(shaftX-0.58, yMid, -1.43, 0.06, h, 0.06, mats.dark);
    const rightWall=box(shaftX+0.58, yMid, -1.43, 0.06, h, 0.06, mats.dark);
    interRowShafts.push(leftWall,rightWall);
    // horizontal cross-braces every 8u to guarantee Y-band coverage
    for(let by=8; by<=36; by+=8){
      let brace=box(shaftX, by, -1.44, 1.1, 0.07, 0.06, mats.dark);
      let glow=box(shaftX, by+0.12, -1.43, 0.72, 0.05, 0.05, mats.gold); glow.material=glow.material.clone(); glow.material.toneMapped=false; glow.material.emissiveIntensity=1.0; glow.material.opacity=0.65; glow.material.transparent=true;
      interRowShafts.push(brace, glow);
    }
  }
})();
// filler dressing audit: ensure every 12u X window and every 8u Y band has dressing mesh (antennae/cables/glow sprites)
(function ensureDressingCoverage(){
  if(LEGACY) return;
  const gb=gridBounds();
  const minX=gb.minX, maxX=gb.maxX;
  // sample grid: X windows 12u, Y bands 8u 0..40 => for each missing window+band pair, add filler
  // We already added most via towers/signs/pipes; this filler guarantees coverage via thin cables + glow sprites
  // Thin cables spanning full width at each Y band
  for(let yB=4; yB<=38; yB+=8){
    for(let x=minX; x<=maxX; x+=12){
      // add thin horizontal cable at yB with slight jitter so not uniform
      let cy=yB+THREE.MathUtils.randFloat(-0.6,0.6);
      let cab=box(x+6, cy, -2.2, 11, 0.04, 0.04, mats.dark);
      cab.material=cab.material.clone(); cab.material.opacity=0.9;
      // small glow sprite every 24u at band
      if(x%24===0){
        const cv=document.createElement('canvas'); cv.width=32; cv.height=32; const g=cv.getContext('2d');
        const grd=g.createRadialGradient(16,16,2,16,16,12); grd.addColorStop(0,'rgba(255,215,0,0.38)'); grd.addColorStop(1,'rgba(0,0,0,0)');
        g.fillStyle=grd; g.fillRect(0,0,32,32); const tex=new THREE.CanvasTexture(cv);
        const smat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0.24,depthWrite:false,blending:THREE.AdditiveBlending}); const spr=new THREE.Sprite(smat); spr.position.set(x+6, cy+0.4, -2.0); spr.scale.set(2.2,2.2,1); world.add(spr);
      }
    }
  }
  // vertical antennae every 12u at varied heights to guarantee Y coverage
  for(let x=minX+6; x<=maxX; x+=12){
    if(x%24===6) continue; // skip half to keep density reasonable — already covered by cables
    let ah=THREE.MathUtils.randFloat(3.5,7.5);
    let ay=THREE.MathUtils.randFloat(12,36);
    let ant=new THREE.Mesh(new THREE.BoxGeometry(0.05,ah,0.05), mats.dark); ant.position.set(x, ay+ah/2-1.0, -3.2); world.add(ant);
    // tip glow
    let tip=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12), mats.amber); tip.position.set(x, ay+ah-1.0+0.12, -3.2); tip.material=tip.material.clone(); tip.material.toneMapped=false; tip.material.emissiveIntensity=2.2; world.add(tip);
  }
})();

// Re-export for climbing checks (read-only)
export const ladders = ladderData;
export const pits = pitRanges;
// WAVE 0 — level visibility: строим все меши сразу, показываем только колонки текущего уровня
export function setBiomeVisibility(cols){
  const set=new Set(cols);
  const apply=(m)=>{ if(m && m.userData && m.userData.col!==undefined) m.visible=set.has(m.userData.col); };
  for(const p of solids){ apply(p.mesh); }
  for(const m of ladderMeshes){ apply(m); }
  for(const m of wallMeshes){ apply(m); }
  for(const m of propMeshes){ apply(m); }
  for(const m of waterMeshes){ apply(m); }
  for(const g of pyreMeshes){ apply(g); }
  for(const g of shopMeshes){ apply(g); }
  for(const m of mergedChunks){ apply(m); } // PERF PASS — merged chunks carry userData.col too
}
export const killCells=[];
// ART PASS — bottom zone = acid/virus space: dark green kill strip + glowing acid pool + rising motes
export const hazardMat=new THREE.MeshStandardMaterial({color:0x0A1F0A,emissive:0x39FF14,emissiveIntensity:1.1,transparent:true,opacity:.34,roughness:.35,metalness:.08});
for(let x=-34;x<=WORLD_END;x+=2){
  const cell=box(x,-.08,1.8,1.72,.035,2.7,hazardMat);
  killCells.push(cell);
}
// acid pool surface below the walk lane (visual of the kill zone)
export const acidMotes=[];
(function buildAcidZone(){
  const gb=gridBounds();
  const w=LEGACY? 235 : (gb.maxX-gb.minX+10);
  const cx=LEGACY? 78 : (gb.minX+gb.maxX)/2;
  const acidMat=new THREE.MeshStandardMaterial({color:0x0A1F0A,emissive:0x39FF14,emissiveIntensity:1.5,transparent:true,opacity:.72,roughness:.3,metalness:.1});
  box(cx,-.32,1.2,w,.16,4,acidMat);
  for(let i=0;i<26;i++){
    const mote=new THREE.Mesh(new THREE.IcosahedronGeometry(THREE.MathUtils.randFloat(.04,.09),0),new THREE.MeshBasicMaterial({color:0x39FF14,transparent:true,opacity:.55}));
    mote.toneMapped=false;
    mote.position.set(cx+THREE.MathUtils.randFloat(-w/2,w/2), THREE.MathUtils.randFloat(-.5,2.5), THREE.MathUtils.randFloat(.8,2.2));
    mote.userData={vy:THREE.MathUtils.randFloat(.25,.7),ph:Math.random()*6};
    world.add(mote); acidMotes.push(mote);
  }
})();
for(let x=-33;x<=WORLD_END;x+=4){
  const beam=box(x,.62,1.75,.07,1.35,.07,mats.pink);
  beam.material=beam.material.clone(); beam.material.emissiveIntensity=0.9; beam.material.toneMapped=false; beam.material.opacity=0.28; beam.material.transparent=true;
}
export const killLabel=box(66,.02,1.86,26,.035,.035,mats.pink); killLabel.material=killLabel.material.clone(); killLabel.material.toneMapped=false; killLabel.material.emissiveIntensity=0.9; killLabel.material.opacity=0.28; killLabel.material.transparent=true;
// BOTTOM markers — honest bottom row signage (no fake lava)
(function(){
  try{
    for(const s of SCREENS){ if(s.row!==2) continue;
      const bx=s.originX+22, by=s.baseY+0.55;
      const floorSign=box(bx,by,1.92,8,0.06,0.06,mats.gold); floorSign.material=floorSign.material.clone(); floorSign.material.toneMapped=false; floorSign.material.emissiveIntensity=3.2;
      const labelMat=new THREE.MeshStandardMaterial({color:0x0a1f2a,emissive:0xFFD700,emissiveIntensity:2.6,transparent:true,opacity:0.92}); labelMat.toneMapped=false;
      const bottomPlat=box(bx,by-0.35,1.9,6,0.28,0.28,labelMat);
      // cyan rim to distinguish safe floor
      const rim=box(bx,by-0.18,1.93,6.2,0.04,0.04,mats.cyan); rim.material=rim.material.clone(); rim.material.toneMapped=false; rim.material.emissiveIntensity=1.8; rim.material.opacity=0.85; rim.material.transparent=true;
      // halo sprite for BOTTOM
      try{ const cv=document.createElement('canvas');cv.width=256;cv.height=64;const g=cv.getContext('2d');g.fillStyle='rgba(255,215,0,0.95)';g.font='bold 22px monospace';g.textAlign='center';g.fillText('▼ BOTTOM ▼',128,38);g.shadowColor='#FFD700';g.shadowBlur=12;const tex=new THREE.CanvasTexture(cv);const smat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0.92,depthWrite:false});const spr=new THREE.Sprite(smat);spr.position.set(bx,by+0.85,1.95);spr.scale.set(7,1.6,1);world.add(spr);}catch(e){}
    }
  }catch(e){}
})();
export const finalGate=box(LEGACY?184:FINAL_GATE_X, LEGACY?4.0:2.5,0,.6,7,3,mats.pink); finalGate.material=finalGate.material.clone(); finalGate.material.toneMapped=false;

// ── Decor renderer ──
export const decorMeshes = [];
export const decorData = LEGACY ? [...decorToWorld(), ...cryptDecorToWorld()] : GRID_DECOR;
function buildArenaDressing(){
  try{
    if(LEGACY){
      const b=arenaBounds(); const cx=(b.minX+b.maxX)/2; const w=b.maxX-b.minX;
      let edge=box(cx,0.02,1.78,w,0.08,0.12,mats.gold); edge.material=edge.material.clone(); edge.material.toneMapped=false; edge.material.emissiveIntensity=4.2;
      box(b.minX+0.5,1.2,-1.2,0.22,2.4,0.22,mats.dark); box(b.maxX-0.5,1.2,-1.2,0.22,2.4,0.22,mats.dark);
      let ring=box(cx,3.35,-1.2,w-1,0.14,0.14,mats.gold); ring.material=ring.material.clone(); ring.material.toneMapped=false; ring.material.emissiveIntensity=4.0;
      let gro=box(cx,3.05,-1.2,4.2,0.9,0.16,mats.magenta); gro.material=gro.material.clone(); gro.material.toneMapped=false; gro.material.emissiveIntensity=5.2;
    } else {
      // grid arenas col1 r1 and col2 r1
      for(const col of [1,2]){
        const sc=SCREENS.find(s=>s.col===col && s.row===1);
        const cx=sc.originX + 22; const w=GRID_W;
        let edge=box(cx, sc.baseY+0.02,1.78,w,0.08,0.12,mats.gold); edge.material=edge.material.clone(); edge.material.toneMapped=false; edge.material.emissiveIntensity=4.2;
        box(sc.originX+0.5, sc.baseY+1.2,-1.2,0.22,2.4,0.22,mats.dark); box(sc.originX+GRID_W-0.5, sc.baseY+1.2,-1.2,0.22,2.4,0.22,mats.dark);
        let ring=box(cx, sc.baseY+3.35,-1.2,w-1,0.14,0.14,mats.gold); ring.material=ring.material.clone(); ring.material.toneMapped=false; ring.material.emissiveIntensity=4.0;
        let gro=box(cx, sc.baseY+3.05,-1.2,4.2,0.9,0.16, col===1? mats.magenta : mats.violet); gro.material=gro.material.clone(); gro.material.toneMapped=false; gro.material.emissiveIntensity=5.2;
      }
    }
  }catch(e){}
}
export function buildDecor(){
  for(const d of decorData){
    let mat = mats.cyan;
    let sx=1.2, sy=1.0, sz=0.6;
    if(d.type==="storefront"){ mat=mats.cyanHero; sx=3.6; sy=2.0; sz=0.45; }
    else if(d.type==="billboard"){ mat=mats.magenta; sx=2.8; sy=1.6; sz=0.16; }
    else if(d.type==="sign"){ mat=mats.violet; sx=1.0; sy=0.78; sz=0.14; }
    else if(d.type==="awning"){ mat=mats.gold; sx=2.6; sy=0.55; sz=1.0; }
    else if(d.type==="trash"){ mat=mats.dark; sx=0.7; sy=0.6; sz=0.7; }
    else if(d.type==="lamp"){ mat=mats.amber; sx=0.16; sy=1.7; sz=0.16; }
    else if(d.type==="server"){ mat=mats.violet; sx=1.4; sy=1.2; sz=0.8; }
    else { mat = d.x >= (LEGACY?195:15) ? mats.violet : mats.cyan; }
    const m = box(d.x, d.y, -1.2, sx, sy, sz, mat); m.material=m.material.clone(); m.material.toneMapped=false;
    if(d.type==="billboard"){ m.material.emissiveIntensity=5.4; }
    else if(d.type==="sign"){ m.material.emissiveIntensity=3.2; }
    else if(d.type==="storefront"){ m.material.emissiveIntensity=3.6; }
    else { m.material.emissiveIntensity = d.x >= (LEGACY?195:15) ? 2.8 : 2.2; }
    if(d.type==="awning"){ let trim=box(d.x, d.y-0.28, -0.95, sx,0.06,0.06,mats.gold); trim.material=trim.material.clone(); trim.material.toneMapped=false; trim.material.emissiveIntensity=3.0; decorMeshes.push(trim); }
    if(d.type==="billboard" || d.type==="storefront"){
      if(Math.random()<0.7){ let lamp=box(d.x, d.y-1.1, -0.7, 0.18,0.22,0.18,mats.amber); lamp.material=lamp.material.clone(); lamp.material.toneMapped=false; lamp.material.emissiveIntensity=2.8; decorMeshes.push(lamp); }
    }
    decorMeshes.push(m);
  }
  if(LEGACY){
    for(let i=0;i<10;i++){ let rx = 195 + Math.floor(Math.random()*12)*ZONE_W/1; }
    const extraCrates=[[240,0.35,-1.2],[300,0.35,-1.2],[355,0.35,-1.2],[420,0.35,-1.2],[510,0.35,-1.2]];
    for(const [x,y,z] of extraCrates){ let c=box(x,y,z,0.8,0.7,0.8,mats.dark); let t=box(x,y+0.45,-1.2,0.9,0.06,0.06,mats.gold); t.material=t.material.clone(); t.material.toneMapped=false; t.material.emissiveIntensity=3.0; decorMeshes.push(c); decorMeshes.push(t); }
    const lanternXs=[225,265,315,360,410,505,620,680];
    for(const x of lanternXs){ let lan=box(x,2.0,-1.2,0.24,0.5,0.24,mats.amber); lan.material=lan.material.clone(); lan.material.toneMapped=false; lan.material.emissiveIntensity=3.4; decorMeshes.push(lan); }
    for(const zo of [195+22, 283, 327, 415, 591, 679]){ let n1=box(zo,1.4,-1.2,1.2,0.9,0.04,mats.magenta); n1.material=n1.material.clone(); n1.material.toneMapped=false; n1.material.emissiveIntensity=2.2; decorMeshes.push(n1); }
  } else {
    const extraCrates=SCREENS.filter(s=>s.row===2).map(s=>[s.originX+12, s.baseY+0.35, -1.2]);
    for(const [x,y,z] of extraCrates){ let c=box(x,y,z,0.8,0.7,0.8,mats.dark); let t=box(x,y+0.45,-1.2,0.9,0.06,0.06,mats.gold); t.material=t.material.clone(); t.material.toneMapped=false; t.material.emissiveIntensity=3.0; decorMeshes.push(c); decorMeshes.push(t); }
    for(const s of SCREENS){ let lan=box(s.originX+18, s.baseY+2.0,-1.2,0.24,0.5,0.24,mats.amber); lan.material=lan.material.clone(); lan.material.toneMapped=false; lan.material.emissiveIntensity=3.4; decorMeshes.push(lan); }
  }
}
buildDecor();
buildArenaDressing();
function buildCryptArenaDressing(){
  try{
    if(LEGACY){
      const b=cryptArenaBounds(); const cx=(b.minX+b.maxX)/2; const w=b.maxX-b.minX;
      let edge=box(cx,0.02,1.78,w,0.08,0.12,mats.violet); edge.material=edge.material.clone(); edge.material.toneMapped=false; edge.material.emissiveIntensity=3.8;
      box(b.minX+0.5,1.2,-1.2,0.22,2.4,0.22,mats.dark); box(b.maxX-0.5,1.2,-1.2,0.22,2.4,0.22,mats.dark);
      let ring=box(cx,3.35,-1.2,w-1,0.14,0.14,mats.violet); ring.material=ring.material.clone(); ring.material.toneMapped=false; ring.material.emissiveIntensity=3.6;
      let mol=box(cx,3.05,-1.2,4.2,0.9,0.16,mats.violet); mol.material=mol.material.clone(); mol.material.toneMapped=false; mol.material.emissiveIntensity=4.8;
    }
  }catch(e){}
}
buildCryptArenaDressing();

function makeHaloTexture(hex){
  const c=document.createElement('canvas'); c.width=128; c.height=128; const g=c.getContext('2d');
  const grd=g.createRadialGradient(64,64,8,64,64,64); const col=new THREE.Color(hex);
  grd.addColorStop(0,'rgba('+Math.round(col.r*255)+','+Math.round(col.g*255)+','+Math.round(col.b*255)+',0.85)');
  grd.addColorStop(0.45,'rgba('+Math.round(col.r*255)+','+Math.round(col.g*255)+','+Math.round(col.b*255)+',0.28)');
  grd.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grd; g.fillRect(0,0,128,128);
  const tex=new THREE.CanvasTexture(c); tex.needsUpdate=true; return tex;
}
const haloTexMagenta=makeHaloTexture(0xFF2D78), haloTexCyan=makeHaloTexture(0x00F5FF), haloTexGold=makeHaloTexture(0xFFD700);
function addHalo(x,y,z,tex,scale=2.8,op=.55){
  const mat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending}); const s=new THREE.Sprite(mat); s.position.set(x,y,z); s.scale.set(scale,scale,1); world.add(s); return s;
}
let haloCount=0;
for(const d of decorData){
  if((d.type==="billboard"||d.type==="storefront") && haloCount<8){
    let tex = (d.x%3===0)? haloTexMagenta : (d.x%3===1? haloTexCyan : haloTexGold);
    addHalo(d.x, d.y, -0.95, tex, 3.2, 0.42); haloCount++;
  }
}
if(haloCount<8){
  try{
    if(LEGACY){
      const b=arenaBounds(); const cx=(b.minX+b.maxX)/2; addHalo(cx,3.15,-0.85,haloTexMagenta,4.5,0.5); haloCount++; addHalo(cx+2,2.2,-0.7,haloTexCyan,3.0,0.38); haloCount++;
    } else {
      for(const col of [1,2]){
        const sc=SCREENS.find(s=>s.col===col && s.row===1);
        addHalo(sc.originX+22, sc.baseY+3.15,-0.85,haloTexMagenta,4.5,0.5); haloCount++;
      }
    }
  }catch(e){}
}
if(LEGACY){
  for(let x=420;x<=WORLD_END;x+=38){
    let tex = x%76===0? haloTexMagenta : haloTexCyan;
    addHalo(x, THREE.MathUtils.randFloat(2.2,3.8), -0.9, tex, THREE.MathUtils.randFloat(2.6,3.8), 0.38);
  }
} else {
  for(const s of SCREENS){ addHalo(s.originX+22, s.baseY+3.2, -0.9, s.district==="market"?haloTexMagenta:haloTexCyan, 2.8, 0.38); }
}

export const waterMeshes = [];
export const waterData = LEGACY ? [...waterToWorld(), ...cryptWaterToWorld()] : GRID_WATER;
export const waterMat = new THREE.MeshStandardMaterial({ color: 0x0a1f2a, emissive: 0x00F5FF, emissiveIntensity: 1.4, transparent: true, opacity: 0.42, roughness: 0.18, metalness: 0.55 });
export function buildWater(){
  for(const w of waterData){
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w.w, 0.22), waterMat);
    plane.rotation.x = -Math.PI/2;
    plane.position.set(w.x + w.w/2, w.y, 0.8);
    plane.userData={baseY:w.y, ph:Math.random()*6, baseOp:0.42, col:w.col};
    world.add(plane);
    waterMeshes.push(plane);
    // ripple highlight ring (emissive plane, no light)
    const ripple = new THREE.Mesh(new THREE.PlaneGeometry(w.w*0.6, 0.08), new THREE.MeshBasicMaterial({color:0x62f6ff, transparent:true, opacity:0.18, side:THREE.DoubleSide}));
    ripple.rotation.x=-Math.PI/2; ripple.position.set(w.x + w.w/2, w.y+0.01, 0.81);
    ripple.userData={baseY:w.y+0.01, ph:Math.random()*6, baseOp:0.18, col:w.col};
    world.add(ripple); waterMeshes.push(ripple);
  }
  if(LEGACY){
    const previewX = zoneOrigin(1,2)+24;
    const pv=new THREE.Mesh(new THREE.PlaneGeometry(3.2,0.9), new THREE.MeshStandardMaterial({color:0x0a1f2a, emissive:0x00F5FF, emissiveIntensity:1.6, transparent:true, opacity:0.28, side:THREE.DoubleSide}));
    pv.rotation.x=-Math.PI/2; pv.position.set(previewX+1.6, -0.02, 0.95); world.add(pv); waterMeshes.push(pv);
  } else {
    // preview pulses at sunken-west center already covered as water volume; add small pool marker
    const s=SCREENS.find(sc=>sc.col===1 && sc.row===2);
    if(s){
      const pv=new THREE.Mesh(new THREE.PlaneGeometry(3.2,0.9), new THREE.MeshStandardMaterial({color:0x0a1f2a, emissive:0x00F5FF, emissiveIntensity:1.6, transparent:true, opacity:0.28, side:THREE.DoubleSide}));
      pv.rotation.x=-Math.PI/2; pv.position.set(s.originX+22, s.baseY+0.02, 0.95); world.add(pv); waterMeshes.push(pv);
    }
  }
}
buildWater();
// ── Pyres & Shops (emissive only, NO PointLight) ──
export const pyreMeshes=[], pyreData= LEGACY ? [] : GRID_PYRES;
export const shopMeshes=[], shopData= LEGACY ? [] : GRID_SHOPS;
// ART PASS strict physics — snap interactive props onto the highest platform top (no clipping into slabs)
function snapTopAt(x,yGuess){
  let best=null;
  for(const p of solids){ if(Math.abs(x-p.x)<=p.w/2+.34 && p.y<=yGuess+0.5){ if(best===null||p.y>best) best=p.y; } }
  return best;
}
export function buildPyres(){
  for(const p of pyreData){
    const g=new THREE.Group();
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.45,0.6,6), new THREE.MeshStandardMaterial({color:0x1a1a22, emissive:0x2a1a0a, emissiveIntensity:0.6, roughness:0.7}));
    base.position.y=0.3; g.add(base);
    // flame sprite via canvas texture (no light)
    const cv=document.createElement('canvas'); cv.width=64; cv.height=64; const ctx=cv.getContext('2d');
    const grd=ctx.createRadialGradient(32,38,4,32,32,28); grd.addColorStop(0,'rgba(255,180,40,0.95)'); grd.addColorStop(0.5,'rgba(255,100,20,0.45)'); grd.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=grd; ctx.fillRect(0,0,64,64);
    const tex=new THREE.CanvasTexture(cv); const mat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:0.92, depthWrite:false, blending:THREE.AdditiveBlending});
    const spr=new THREE.Sprite(mat); spr.position.set(0,0.95,0); spr.scale.set(1.4,1.4,1); g.add(spr);
    // emissive core glow plane
    const glowMat=new THREE.MeshStandardMaterial({color:0x1a0e06, emissive:0xFF8C1A, emissiveIntensity:2.2, transparent:true, opacity:0.55});
    glowMat.toneMapped=false; const glow=new THREE.Mesh(new THREE.CircleGeometry(0.55,12), glowMat); glow.rotation.x=-Math.PI/2; glow.position.set(0,0.02,0); g.add(glow);
    const top=snapTopAt(p.x, p.y+1.2);
    g.position.set(p.x, top!==null? top : p.y, -0.25);
    g.userData={pyreId:p.id, x:p.x, y:top!==null?top:p.y, col:p.col, row:p.row};
    world.add(g); pyreMeshes.push(g);
  }
}
export function buildShops(){
  for(const sh of shopData){
    const g=new THREE.Group();
    // NPC capsule
    const matCol = sh.npc==="scalpel"?0x0099aa:0xaa3355;
    const emiss = sh.npc==="scalpel"?0x00F5FF:0xFF2D78;
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.8,4,10), new THREE.MeshStandardMaterial({color:matCol, emissive:emiss, emissiveIntensity:1.6, roughness:0.5, metalness:0.3}));
    body.position.y=0.85; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.26,10,8), new THREE.MeshStandardMaterial({color:0xEAF6FF, emissive:0x1A2A4A, emissiveIntensity:0.9}));
    head.position.y=1.55; g.add(head);
    // sign canvas
    const cv=document.createElement('canvas'); cv.width=128; cv.height=32; const ctx=cv.getContext('2d');
    ctx.fillStyle='rgba(10,18,28,0.95)'; ctx.fillRect(0,0,128,32); ctx.fillStyle='#00F5FF'; ctx.font='bold 13px monospace'; ctx.textAlign='center'; ctx.fillText(sh.name,64,20);
    const tex=new THREE.CanvasTexture(cv); const sprMat=new THREE.SpriteMaterial({map:tex, transparent:true, opacity:0.92});
    const spr=new THREE.Sprite(sprMat); spr.position.set(0,2.15,0.2); spr.scale.set(2.2,0.55,1); g.add(spr);
    // base platform glow
    const platMat=new THREE.MeshStandardMaterial({color:0x0a1a22, emissive:emiss, emissiveIntensity:1.2, transparent:true, opacity:0.82});
    platMat.toneMapped=false; const plat=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.08,0.6), platMat); plat.position.set(0,0.04,0); g.add(plat);
    const top=snapTopAt(sh.x, sh.y+1.2);
    g.position.set(sh.x, top!==null? top : sh.y, -0.2);
    g.userData={shopId:sh.id, name:sh.name, x:sh.x, y:top!==null?top:sh.y, col:sh.col, row:sh.row};
    world.add(g); shopMeshes.push(g);
  }
}
buildPyres(); buildShops();
(function declutterWalkLane(){
  const solidSet=new Set(solids.map(function(s){return s.mesh;}));
  const candidates=[...shaftMeshes, ...decorMeshes];
  for(const obj of world.children){ if(obj.isMesh && !solidSet.has(obj) && !candidates.includes(obj)) candidates.push(obj); }
  for(const m of candidates){
    if(!m || !m.position) continue;
    if(solidSet.has(m)) continue;
    if(Math.abs(m.position.z) >= 0.6) continue;
    let overlaps=false;
    for(const p of solids){
      if(Math.abs(m.position.x - p.x) <= p.w/2 + 0.5 && Math.abs(m.position.y - p.y) <= 2.5){ overlaps=true; break; }
    }
    if(overlaps) m.position.z=-1.2;
  }
})();

// ── HK-FEEL PASS — atmosphere: camera-following dust motes + drifting fog veils ──
// Hollow Knight reads "alive" because of slow floating particles in the foreground/midground.
// One THREE.Points cloud (single draw call) wraps around the camera; fog veils are 3 additive
// gradient planes parallaxed between mid and far layers. Nothing here allocates per frame.
export const dustCount = 340;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(dustCount * 3);
const dustSeed = new Float32Array(dustCount * 3); // drift params (vx, vy, phase)
for (let i = 0; i < dustCount; i++) {
  dustPos[i*3]   = (Math.random() - 0.5) * 46;
  dustPos[i*3+1] = (Math.random() - 0.5) * 26;
  dustPos[i*3+2] = 2 + Math.random() * 9;
  dustSeed[i*3]  = (Math.random() - 0.5) * 0.35;
  dustSeed[i*3+1] = 0.08 + Math.random() * 0.3;
  dustSeed[i*3+2] = Math.random() * Math.PI * 2;
}
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
function makeDustTexture(){
  const c = document.createElement("canvas"); c.width = 32; c.height = 32;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(210,245,255,0.9)");
  g.addColorStop(0.4, "rgba(140,220,255,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
const dustMat = new THREE.PointsMaterial({
  size: 0.085, map: makeDustTexture(), transparent: true, opacity: 0.5,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: 0x9adcff,
});
export const dust = new THREE.Points(dustGeo, dustMat);
dust.frustumCulled = false;
scene.add(dust);

function makeFogTexture(a, b){
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.5, a);
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 64);
  const g2 = x.createLinearGradient(0, 0, 0, 64);
  g2.addColorStop(0, "rgba(0,0,0,1)");
  g2.addColorStop(0.5, "rgba(0,0,0,0)");
  g2.addColorStop(1, "rgba(0,0,0,1)");
  x.globalCompositeOperation = "destination-out";
  x.fillStyle = g2; x.fillRect(0, 0, 256, 64);
  return new THREE.CanvasTexture(c);
}
const fogVeils = [];
{
  const specs = [
    { z: -6.5, w: 60, h: 9,  op: 0.10, col: 0x1b2c3c, sp: 0.35, y: 2 },
    { z: -4.5, w: 46, h: 7,  op: 0.09, col: 0x22384a, sp: -0.55, y: 6 },
    { z: -9.5, w: 80, h: 12, op: 0.08, col: 0x16222e, sp: 0.22, y: 10 },
  ];
  for (const s of specs) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.h),
      new THREE.MeshBasicMaterial({ map: makeFogTexture("rgba(255,255,255,0.8)", ""), color: s.col, transparent: true, opacity: s.op, depthWrite: false })
    );
    m.position.set(0, s.y, s.z);
    m.userData = { sp: s.sp, x0: 0 };
    scene.add(m);
    fogVeils.push(m);
  }
}
let _ambT = 0;
export function updateAmbient(dt, camX, camY){
  _ambT += dt;
  // dust: wrap 46x26 box around camera + slow drift (no allocation)
  const pos = dustGeo.attributes.position.array;
  for (let i = 0; i < dustCount; i++) {
    let x = pos[i*3], y = pos[i*3+1];
    x += dustSeed[i*3] * dt + Math.sin(_ambT * 0.6 + dustSeed[i*3+2]) * 0.004;
    y += dustSeed[i*3+1] * dt;
    const dx = x - camX, dy = y - (camY + 1);
    if (dx > 23) x -= 46; else if (dx < -23) x += 46;
    if (dy > 13) y -= 26; else if (dy < -13) y += 26;
    pos[i*3] = x; pos[i*3+1] = y;
  }
  dustGeo.attributes.position.needsUpdate = true;
  // fog veils: drift and wrap across the visible span
  for (const v of fogVeils) {
    v.position.x += v.userData.sp * dt;
    if (v.position.x - camX > 50) v.position.x -= 100;
    else if (v.position.x - camX < -50) v.position.x += 100;
    v.position.y += Math.sin(_ambT * 0.25 + v.userData.sp * 9) * 0.0025;
  }
}

// ── PERF PASS — static geometry merge ────────────────────────────────────────────
// The world was ~3.8k individual meshes with ~2.5k cloned materials: every visible mesh
// was its own draw call and the whole scene graph was walked each frame. We merge all
// STATIC opaque/same-material geometry into per-(material-signature, biome-col) chunks:
//   • draw calls: thousands → ~300 (only 1–3 chunks visible at a time thanks to culling)
//   • scene traversal cost drops ~8×
//   • source geometries are disposed after merge (memory)
// Animated meshes (water, acid motes, pyres/shops groups, finalGate) are excluded.
// Chunks keep userData.col → setBiomeVisibility()/level streaming works unchanged.
export function setAtmosphere(on){
  dust.visible=on;
  for(const v of fogVeils) v.visible=on;
}
// shared helpers (also used by enemies.js to fold static hull parts per enemy)
function sigOf(mat){
  const c=mat.color?mat.color.getHex():0;
  const e=mat.emissive?mat.emissive.getHex():0;
  return [mat.type,c,e,mat.emissiveIntensity||0,mat.toneMapped?1:0,mat.transparent?1:0,mat.opacity,
    mat.metalness!==undefined?mat.metalness:"",mat.roughness!==undefined?mat.roughness:"",
    mat.side,mat.blending,mat.depthWrite?1:0,mat.depthTest?1:0,
    mat.map?mat.map.uuid:"",mat.vertexColors?1:0,mat.flatShading?1:0].join("|");
}
const _mv3=new THREE.Vector3(), _mnm=new THREE.Matrix3();
function mergeGeos(items){
  let vCount=0,iCount=0;
  for(const it of items){ const g=it.geo; vCount+=g.attributes.position.count; iCount+= g.index? g.index.count : g.attributes.position.count; }
  const pos=new Float32Array(vCount*3), nor=new Float32Array(vCount*3), uv=new Float32Array(vCount*2);
  const idx=vCount>65535?new Uint32Array(iCount):new Uint16Array(iCount);
  let vo=0,io=0;
  for(const it of items){
    const g=it.geo;
    _mnm.getNormalMatrix(it.matrix);
    const p=g.attributes.position, n=g.attributes.normal, u=g.attributes.uv;
    for(let i=0;i<p.count;i++){
      _mv3.fromBufferAttribute(p,i).applyMatrix4(it.matrix);
      pos[(vo+i)*3]=_mv3.x; pos[(vo+i)*3+1]=_mv3.y; pos[(vo+i)*3+2]=_mv3.z;
      if(n){ _mv3.fromBufferAttribute(n,i).applyMatrix3(_mnm).normalize(); nor[(vo+i)*3]=_mv3.x; nor[(vo+i)*3+1]=_mv3.y; nor[(vo+i)*3+2]=_mv3.z; }
      if(u){ uv[(vo+i)*2]=u.getX(i); uv[(vo+i)*2+1]=u.getY(i); }
    }
    if(g.index){ const gi=g.index; for(let i=0;i<gi.count;i++) idx[io+i]=gi.getX(i)+vo; io+=gi.count; }
    else { for(let i=0;i<p.count;i++) idx[io+i]=vo+i; io+=p.count; }
    vo+=p.count;
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute("position",new THREE.BufferAttribute(pos,3));
  out.setAttribute("normal",new THREE.BufferAttribute(nor,3));
  out.setAttribute("uv",new THREE.BufferAttribute(uv,2));
  out.setIndex(new THREE.BufferAttribute(idx,1));
  out.computeBoundingSphere();
  return out;
}
// mergePartsByMaterial(meshes) — meshes must share the same intended parent; uses LOCAL matrices.
// Returns [{mesh, sources:[...]}]; caller removes sources / adds meshes.
export function mergePartsByMaterial(meshes){
  const groups=new Map();
  for(const m of meshes){
    if(!m.isMesh||!m.geometry||!m.geometry.attributes.position||!m.material||Array.isArray(m.material)) continue;
    m.updateMatrix();
    const key=sigOf(m.material);
    let g=groups.get(key);
    if(!g){ g={mat:m.material,items:[]}; groups.set(key,g); }
    g.items.push({geo:m.geometry,matrix:m.matrix.clone(),mesh:m});
  }
  const out=[];
  for(const g of groups.values()){
    if(g.items.length<2) continue;
    out.push({ mesh:new THREE.Mesh(mergeGeos(g.items),g.mat), sources:g.items.map(i=>i.mesh) });
  }
  return out;
}
(function mergeStatics(){
  const exclude=new Set();
  for(const m of waterMeshes) exclude.add(m);
  for(const m of acidMotes) exclude.add(m);
  exclude.add(finalGate); // material swaps on level completion
  const skipRoots=new Set();
  for(const g of pyreMeshes) skipRoots.add(g);
  for(const g of shopMeshes) skipRoots.add(g);

  function processRoot(root,useCol){
    root.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups=new Map();
    (function rec(node){
      for(const child of node.children.slice()){
        if(skipRoots.has(child)) continue;
        const mergeable = child.isMesh && !child.isSprite && !exclude.has(child)
          && child.children.length===0 && child.geometry && child.geometry.attributes.position
          && child.material && !Array.isArray(child.material);
        if(mergeable){
          const rel=new THREE.Matrix4().multiplyMatrices(inv,child.matrixWorld);
          const col=useCol? (child.userData&&child.userData.col!==undefined? child.userData.col : "any") : "any";
          const key=sigOf(child.material)+"#"+col;
          let g=groups.get(key);
          if(!g){ g={mat:child.material,items:[],col}; groups.set(key,g); }
          g.items.push({geo:child.geometry,matrix:rel,mesh:child});
        } else if(child.children && child.children.length){
          rec(child);
        }
      }
    })(root);
    let merged=0, sources=0;
    for(const g of groups.values()){
      if(g.items.length<2) continue; // single mesh — not worth re-wrapping
      const mesh=new THREE.Mesh(mergeGeos(g.items), g.mat);
      if(g.col!=="any") mesh.userData.col=g.col;
      mesh.userData.mergedCount=g.items.length;
      root.add(mesh);
      if(root===world) mergedChunks.push(mesh);
      merged++; sources+=g.items.length;
      for(const it of g.items){
        if(it.mesh.parent) it.mesh.parent.remove(it.mesh);
        it.geo.dispose();
      }
    }
    return {merged,sources};
  }
  const stats={merged:0,sources:0};
  for(const r of [world,parallaxUltraFar,parallaxFar,parallaxMid]){
    const t=processRoot(r,r===world);
    stats.merged+=t.merged; stats.sources+=t.sources;
  }
  if(typeof console!=="undefined") console.log(`[perf] static merge: ${stats.sources} meshes → ${stats.merged} chunks`);
})();
