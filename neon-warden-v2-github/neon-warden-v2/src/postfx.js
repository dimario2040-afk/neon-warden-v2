// postfx.js — HK-FEEL PASS: hand-rolled bloom (bright-pass → separable gaussian → additive composite)
// using ONLY three.js core (no examples/jsm addons in the vendor bundle).
// Half-res bloom chain; graceful fallback to direct render if render targets are unavailable.
import * as THREE from "three";
import { renderer } from "./world.js?v=15";

const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quadGeo = new THREE.PlaneGeometry(2, 2);
const quad = new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial());
quad.frustumCulled = false;
quadScene.add(quad);

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float s = smoothstep(uThreshold, uThreshold + uKnee, l);
  gl_FragColor = vec4(c * s, 1.0);
}
`;
const BLUR_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uDir; // texel-scaled direction
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
  c += (texture2D(tSrc, vUv + uDir * 1.3846).rgb + texture2D(tSrc, vUv - uDir * 1.3846).rgb) * 0.316216;
  c += (texture2D(tSrc, vUv + uDir * 3.2308).rgb + texture2D(tSrc, vUv - uDir * 3.2308).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}
`;
const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom; uniform float uTime; uniform float uFlash; uniform vec3 uFlashCol;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 b = texture2D(tBloom, vUv).rgb;
  c += b * uBloom;
  // damage/hit flash tint (subtle, driven from main.js)
  c = mix(c, uFlashCol, uFlash);
  // filmic-ish grain to kill banding in dark fog (HK's hand-drawn grain feel)
  float g = fract(sin(dot(vUv * (1.0 + uTime * 0.001), vec2(12.9898, 78.233))) * 43758.5453);
  c += (g - 0.5) * 0.022;
  gl_FragColor = vec4(c, 1.0);
}
`;

function makeRT(w, h, half){
  return new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: true, stencilBuffer: false,
  });
}

let ready = false, failed = false;
let rtScene = null, rtA = null, rtB = null;
let matBright = null, matBlur = null, matComp = null;
let W = 2, H = 2;

// ── DIAG PASS — on-screen self-test: a raw magenta triangle straight into the default
// framebuffer, bypassing scene/camera/lights. If the user SEEES it, GL presentation works and
// the problem is scene-side; if not, the canvas/compositor never shows GL output at all.
let stScene=null, stCam=null;
function ensureSelfTest(){
  if(stScene) return;
  stScene=new THREE.Scene();
  stCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const g=new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1,-1,0, -0.6,-1,0, -1,-0.6,0]),3));
  const tri=new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:0xff00ff, depthTest:false, depthWrite:false, toneMapped:false}));
  tri.frustumCulled=false;
  stScene.add(tri);
}
export function drawSelfTest(){
  try{
    ensureSelfTest();
    const prev=renderer.autoClear;
    renderer.autoClear=false;
    renderer.setRenderTarget(null);
    renderer.render(stScene,stCam);
    renderer.autoClear=prev;
  }catch(e){}
}
export function probePixel(nx,ny){ // nx,ny in 0..1 from bottom-left of the drawing buffer
  const gl=renderer.getContext();
  const w=gl.drawingBufferWidth||2, h=gl.drawingBufferHeight||2;
  const px=new Uint8Array(4);
  gl.readPixels(Math.floor(nx*w),Math.floor(ny*h),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
  return [px[0],px[1],px[2],px[3]];
}

// COMPAT PASS — an extension can be ADVERTISED yet render incomplete FBOs on old drivers
// (GTX 10xx-era / legacy GL). Validate framebuffer completeness right after creation and
// fall back: HalfFloat → UnsignedByte → direct render. Never trust the capability list alone.
function fboComplete(rt){
  try {
    const gl = renderer.getContext();
    renderer.setRenderTarget(rt);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    const ok = (st === gl.FRAMEBUFFER_COMPLETE);
    renderer.setRenderTarget(null);
    return ok;
  } catch (e) { return false; }
}
let rtType = "none";
export function diagnostics(){
  let glInfo = "n/a";
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    glInfo = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.VERSION);
  } catch (e) {}
  return { rtType, ready, failed, enabled, W, H, glInfo,
           webgl2: (()=>{ try { return !!renderer.getContext(); } catch(e){ return false; } })() };
}
function init(){
  try {
    const pr = Math.min(renderer.getPixelRatio(), 1.5);
    W = Math.floor(innerWidth * pr); H = Math.floor(innerHeight * pr);
    let half = false;
    try { half = !!(renderer.extensions && renderer.extensions.has && renderer.extensions.has("EXT_color_buffer_float")); } catch (e) { half = false; }
    rtScene = makeRT(W, H, half);
    if(!fboComplete(rtScene)){
      // float RT unusable here — drop to byte targets (bloom threshold still catches neon)
      rtScene.dispose(); rtScene = makeRT(W, H, false); half = false;
    }
    if(!fboComplete(rtScene)){
      // render targets unusable at all — run without post-processing
      rtScene.dispose(); rtScene = null; failed = true; ready = false; rtType = "none";
      return;
    }
    rtType = half ? "half" : "byte";
    rtA = makeRT(W >> 1, H >> 1, half);
    rtB = makeRT(W >> 1, H >> 1, half);
    matBright = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BRIGHT_FRAG,
      uniforms: { tSrc: { value: null }, uThreshold: { value: 0.62 }, uKnee: { value: 0.35 } }, depthTest: false, depthWrite: false });
    matBlur = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BLUR_FRAG,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    matComp = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: COMPOSITE_FRAG,
      uniforms: { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.9 },
                  uTime: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(0xff2244) } },
      depthTest: false, depthWrite: false });
    ready = true;
    // context loss → visible message instead of a silent grey screen
    try {
      renderer.domElement.addEventListener("webglcontextlost", (ev) => {
        ev.preventDefault(); failed = true; ready = false;
        overlay("WEBGL CONTEXT LOST // обновите страницу (F5). F9 — сброс сохранения.");
      }, false);
    } catch (e) {}
  } catch (e) { failed = true; ready = false; }
}
// small always-readable overlay for fatal render problems (better than a grey void)
let overlayEl = null;
export function overlay(text){
  try {
    if(!overlayEl){
      overlayEl = document.createElement("div");
      overlayEl.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:40;max-width:70vw;background:rgba(8,16,28,.92);border:1px solid rgba(255,45,120,.5);border-radius:8px;padding:10px 12px;color:#FFC9E8;font:11px ui-monospace,monospace;letter-spacing:.06em;white-space:pre-wrap";
      document.body.appendChild(overlayEl);
    }
    overlayEl.textContent = text;
  } catch (e) {}
}
export function hideOverlay(){ try { if(overlayEl){ overlayEl.remove(); overlayEl = null; } } catch (e) {} }

function setSize(){
  if (!ready) return;
  const pr = Math.min(renderer.getPixelRatio(), 1.5);
  W = Math.floor(innerWidth * pr); H = Math.floor(innerHeight * pr);
  rtScene.setSize(W, H);
  rtA.setSize(W >> 1, H >> 1);
  rtB.setSize(W >> 1, H >> 1);
}
export function resize(){ try { setSize(); } catch (e) {} }
if (typeof addEventListener === "function") addEventListener("resize", resize);

// PERF PASS — manual/auto quality switch: setEnabled(false) → direct render, zero extra passes
let enabled = true;
export function setEnabled(on){ enabled = !!on; }
export function isEnabled(){ return enabled && ready && !failed; }

// flash(intensity 0..1, colorHex) — main.js calls on player damage / boss phase
let flashV = 0, flashCol = new THREE.Color(0xff2244);
export function flash(i = 0.5, col = 0xff2244){ flashV = Math.max(flashV, i); flashCol.setHex(col); }
export function decayFlash(dt){ if (flashV > 0) flashV = Math.max(0, flashV - dt * 2.2); }
export function setBloomStrength(v){ if (matComp) matComp.uniforms.uBloom.value = v; }

export function bloomReady(){ return ready && !failed; } // test/observability hook

export function renderFrame(scene, camera, dt = 0.016){
  renderer.info.autoReset = false;
  renderer.info.reset();
  if (failed || !enabled) { renderer.render(scene, camera); return; }
  if (!ready) init();
  if (!ready) { renderer.render(scene, camera); return; }
  try {
    // 1) scene → rtScene
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
    // 2) bright-pass → rtA (half res)
    quad.material = matBright;
    matBright.uniforms.tSrc.value = rtScene.texture;
    renderer.setRenderTarget(rtA);
    renderer.render(quadScene, quadCam);
    // 3) blur H rtA → rtB, blur V rtB → rtA (two iterations for a wider, softer glow)
    quad.material = matBlur;
    for (let i = 0; i < 2; i++) {
      const s = 1 + i * 1.6;
      matBlur.uniforms.tSrc.value = rtA.texture;
      matBlur.uniforms.uDir.value.set(s / (W >> 1), 0);
      renderer.setRenderTarget(rtB);
      renderer.render(quadScene, quadCam);
      matBlur.uniforms.tSrc.value = rtB.texture;
      matBlur.uniforms.uDir.value.set(0, s / (H >> 1));
      renderer.setRenderTarget(rtA);
      renderer.render(quadScene, quadCam);
    }
    // 4) composite → screen
    quad.material = matComp;
    matComp.uniforms.tScene.value = rtScene.texture;
    matComp.uniforms.tBloom.value = rtA.texture;
    matComp.uniforms.uTime.value += dt;
    matComp.uniforms.uFlash.value = flashV;
    matComp.uniforms.uFlashCol.value.copy(flashCol);
    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);
  } catch (e) {
    failed = true; ready = false;
    try { renderer.setRenderTarget(null); renderer.render(scene, camera); } catch (e2) {}
  }
}
