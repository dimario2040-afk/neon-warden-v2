import * as THREE from "three";
import { scene, camera } from "./world.js?v=15";

export const fx=[]; // mesh-based effects only (beam/ring/slash/ghost) — low count, short-lived
// ── PERF PASS — particle pool is now ONE THREE.Points draw call (was 140–320 individual
// meshes; combat bursts alone could add 100+ draw calls on top of the world).
// Same visual grammar: additive glowing motes with gravity, drag and fade.
const MAX=380;
const aPos=new Float32Array(MAX*3), aCol=new Float32Array(MAX*3), aAlp=new Float32Array(MAX), aSiz=new Float32Array(MAX);
const pVel=new Float32Array(MAX*3), pGrv=new Float32Array(MAX), pLif=new Float32Array(MAX), pMlf=new Float32Array(MAX);
let head=0;
const pGeo=new THREE.BufferGeometry();
pGeo.setAttribute("position",new THREE.BufferAttribute(aPos,3));
pGeo.setAttribute("aColor",new THREE.BufferAttribute(aCol,3));
pGeo.setAttribute("aAlpha",new THREE.BufferAttribute(aAlp,1));
pGeo.setAttribute("aSize",new THREE.BufferAttribute(aSiz,1));
const pMat=new THREE.ShaderMaterial({
  uniforms:{ uScale:{value:600} },
  vertexShader:`
    attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
    uniform float uScale;
    varying vec3 vColor; varying float vAlpha;
    void main(){
      vColor=aColor; vAlpha=aAlpha;
      vec4 mv=modelViewMatrix*vec4(position,1.0);
      gl_PointSize=clamp(aSize*uScale/max(0.1,-mv.z),1.0,64.0);
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader:`
    varying vec3 vColor; varying float vAlpha;
    void main(){
      if(vAlpha<=0.004) discard;
      float r=length(gl_PointCoord-vec2(0.5));
      float a=smoothstep(0.5,0.10,r);
      gl_FragColor=vec4(vColor*a, vAlpha*a);
      #include <colorspace_fragment>
    }`,
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
});
export const particlePoints=new THREE.Points(pGeo,pMat);
particlePoints.frustumCulled=false;
particlePoints.renderOrder=2;
scene.add(particlePoints);

const _c=new THREE.Color();
function spawn(x,y,z,vx,vy,vz,r,g,b,size,life,gravity){
  const i=head; head=(head+1)%MAX; // ring buffer: full pool recycles oldest (old pool just dropped bursts)
  aPos[i*3]=x; aPos[i*3+1]=y; aPos[i*3+2]=z;
  pVel[i*3]=vx; pVel[i*3+1]=vy; pVel[i*3+2]=vz;
  aCol[i*3]=r; aCol[i*3+1]=g; aCol[i*3+2]=b;
  aSiz[i]=size; pLif[i]=life; pMlf[i]=life||1; pGrv[i]=gravity; aAlp[i]=1;
}
// burst(pos,color,count,scale,opts) — API-compatible with the old mesh pool.
// opts: {vx,vy,vz,spread,life,gravity,aim:{x,y},speed}
export function burst(pos,color=0x62f6ff,count=12,scale=.08,opts){
  const o=opts||{};
  _c.setHex(color);
  const spread=o.spread!==undefined?o.spread:1;
  const baseSize=(scale/.08)*0.16;
  let spawned=0;
  for(let k=0;k<count;k++){
    let vx,vy,vz;
    if(o.aim){
      const dx=o.aim.x-pos.x, dy=o.aim.y-pos.y, d=Math.max(0.001,Math.hypot(dx,dy));
      const sp=(o.speed||9);
      vx=dx/d*sp+(Math.random()-.5)*2.2; vy=dy/d*sp+(Math.random()-.5)*2.2; vz=(Math.random()-.5)*1.2;
    } else {
      vx=((Math.random()-.5)*.28+(o.vx||0))*spread*3.2;
      vy=(Math.random()*.35+.05+(o.vy||0))*spread*2.6;
      vz=((Math.random()-.5)*.16+(o.vz||0))*spread*3.2;
    }
    const life=(o.life!==undefined?o.life:(.5+Math.random()*.35))*(0.75+Math.random()*0.5);
    spawn(pos.x+(Math.random()-.5)*.08, pos.y+(Math.random()-.5)*.08, pos.z+(Math.random()-.5)*.05,
      vx,vy,vz,_c.r,_c.g,_c.b, baseSize*(0.7+Math.random()*0.6), life, o.gravity!==undefined?o.gravity:0.5);
    spawned++;
  }
  return spawned;
}
export function beam(a,b,color=0x9d6cff){let d=new THREE.Vector3().subVectors(b,a);const len=d.length();const ok=isFinite(len)&&len>=1e-8;const h=ok?len:1;if(!ok)d.set(0,1,0);let m=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,h,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95}));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());scene.add(m);fx.push(Object.assign(m,{userData:{life:.28,beam:true,maxLife:.28}}));}
// ART PASS — expanding impact ring on hits
export function impactRing(pos,color=0xffe66d){let m=new THREE.Mesh(new THREE.TorusGeometry(.28,.035,6,18),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95}));m.toneMapped=false;m.position.copy(pos);m.rotation.x=Math.PI/2;m.userData={life:.18,ringFx:true,maxLife:.18};scene.add(m);fx.push(m);return m;}
// ART PASS — crescent slash arc; dir: "side" | "up" | "down"
export function slashArc(pos,face=1,color=0xBFF6FF,dir="side"){
  const m=new THREE.Mesh(new THREE.TorusGeometry(1.05,.07,6,20,Math.PI*.8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85}));
  m.material=m.material.clone(); m.material.toneMapped=false; m.material.blending=THREE.AdditiveBlending; m.material.depthWrite=false;
  m.position.copy(pos);
  if(dir==="up") m.rotation.z=(face===1? Math.PI*.18 : Math.PI*.82);
  else if(dir==="down") m.rotation.z=(face===1? -Math.PI*.98 : Math.PI*.02);
  else m.rotation.z=face===1? -Math.PI*.4 : Math.PI*.6;
  m.userData={life:.18,slashFx:true,maxLife:.18};
  scene.add(m);fx.push(m);return m;
}
// ── HK-FEEL PASS — dash afterimages: shared warden-silhouette canvas texture, additive ghosts ──
let ghostTex=null;
function makeGhostTexture(){
  if(ghostTex) return ghostTex;
  const c=document.createElement("canvas"); c.width=64; c.height=96;
  const x=c.getContext("2d");
  x.clearRect(0,0,64,96);
  const grd=x.createLinearGradient(0,0,0,96);
  grd.addColorStop(0,"rgba(180,245,255,0.95)");
  grd.addColorStop(0.55,"rgba(90,220,255,0.55)");
  grd.addColorStop(1,"rgba(40,120,220,0)");
  x.fillStyle=grd;
  x.beginPath(); x.moveTo(32,4); x.lineTo(44,20); x.lineTo(40,26);
  x.lineTo(52,88); x.lineTo(12,88); x.lineTo(24,26); x.lineTo(20,20); x.closePath(); x.fill();
  x.fillRect(46,30,4,40);
  ghostTex=new THREE.CanvasTexture(c);
  return ghostTex;
}
export function ghostTrail(pos,face=1,color=0x62f6ff,scale=1.9){
  const mat=new THREE.SpriteMaterial({map:makeGhostTexture(),color,transparent:true,opacity:.5,depthWrite:false,blending:THREE.AdditiveBlending});
  const s=new THREE.Sprite(mat);
  s.position.set(pos.x,pos.y+0.85*(scale/1.9),pos.z-0.05);
  s.scale.set(scale*0.66*face,scale,1);
  s.userData={life:.24,ghostFx:true,maxLife:.24};
  scene.add(s); fx.push(s);
  return s;
}
// ── HK-FEEL PASS — focus/heal swirl: motes spiral INTO the player while channeling ──
export function focusSwirl(pos,color=0xEAFBFF){
  const ang=Math.random()*Math.PI*2, r=1.15+Math.random()*0.5;
  const from=new THREE.Vector3(pos.x+Math.cos(ang)*r, pos.y+0.9+Math.sin(ang)*r*0.7, pos.z+0.2);
  burst(from,color,1,.05,{aim:{x:pos.x,y:pos.y+0.9},speed:5.5,life:.42,gravity:0});
}
// ── HK-FEEL PASS — camera shake state ──
let shakeAmp=0, shakeT=0, shakeDur=1;
export function addShake(amp,dur=0.25){ if(amp>=shakeAmp||shakeT<=0){ shakeAmp=Math.max(shakeAmp*0.6,amp); shakeDur=dur; shakeT=dur; } }
export function shakeOffset(){
  if(shakeT<=0) return null;
  const k=shakeT/shakeDur;
  const a=shakeAmp*k*k;
  return { x:(Math.random()-0.5)*2*a, y:(Math.random()-0.5)*2*a };
}
export function updateShake(dt){ if(shakeT>0){ shakeT-=dt; if(shakeT<=0){ shakeT=0; shakeAmp=0; } } }

// ── PERF PASS — one update for ALL effects (particles + short-lived meshes).
// main.js calls updateFx(dt) instead of walking fx[] and 320 pool meshes itself.
export function updateFx(dt){
  // particles (CPU integration, single buffer upload)
  for(let i=0;i<MAX;i++){
    if(pLif[i]<=0){ if(aAlp[i]!==0) aAlp[i]=0; continue; }
    pLif[i]-=dt;
    pVel[i*3+1]-=pGrv[i]*dt;
    aPos[i*3]  +=pVel[i*3]*dt*4;
    aPos[i*3+1]+=pVel[i*3+1]*dt*4;
    aPos[i*3+2]+=pVel[i*3+2]*dt*4;
    aAlp[i]=pLif[i]>0? Math.max(0,pLif[i]/pMlf[i]) : 0;
  }
  pGeo.attributes.position.needsUpdate=true;
  pGeo.attributes.aAlpha.needsUpdate=true;
  pGeo.attributes.aColor.needsUpdate=true;
  pGeo.attributes.aSize.needsUpdate=true;
  pMat.uniforms.uScale.value=(typeof innerHeight!=="undefined"?innerHeight:720)*0.5/Math.tan((camera.fov*0.5)*Math.PI/180);
  // short-lived meshes
  for(let i=fx.length-1;i>=0;i--){
    const f=fx[i];
    f.userData.life-=dt;
    if(f.userData.beam){ f.material.opacity=clamp01(f.userData.life/f.userData.maxLife); }
    else if(f.userData.ringFx){ f.scale.multiplyScalar(1+9*dt); f.material.opacity=clamp01(f.userData.life/f.userData.maxLife); }
    else if(f.userData.slashFx){ f.scale.multiplyScalar(1+2.5*dt); f.material.opacity=clamp01(f.userData.life/f.userData.maxLife)*.85; }
    else if(f.userData.ghostFx){ f.material.opacity=clamp01(f.userData.life/f.userData.maxLife)*.5; f.scale.y*=(1-dt*0.8); }
    if(f.userData.life<=0){ scene.remove(f); if(f.material&&f.material.dispose) f.material.dispose(); if(f.geometry&&f.geometry!==undefined&&f.userData.beam) f.geometry.dispose(); fx.splice(i,1); }
  }
}
function clamp01(v){ return v<0?0:v>1?1:v; }
