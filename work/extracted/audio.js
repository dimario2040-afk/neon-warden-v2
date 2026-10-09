// audio.js — procedural audio: 16-bit Sega FM × lo-fi × Hollow Knight pads (WebAudio, zero assets)
// Standalone: imports nothing from the game (no cycles). Starts on first user gesture (autoplay policy).

let ctx=null, master=null, sfxBus=null, musicBus=null, musicIn=null, noiseBuf=null, reverbWet=null;
let started=false, muted=false, currentMood="base";
let step=0, nextNoteTime=0, schedTimer=null;

const MOODS=["base","market","crypt","sunken","maw","venti","stoki","kristall","stanciya","sady","set"];
const layerGains={}, layerTargets={};
const stepDur=60/84/4; // 84 BPM 16th

// note frequencies
const N={A1:55,C2:65.4,D2:73.4,E2:82.4,G1:49,G2:98,A2:110,C3:130.8,D3:146.8,E3:164.8,F3:174.6,G3:196,A3:220,B3:246.9,C4:261.6,E4:329.6,Bb1:58.3,E1:41.2,B2:123.47,Bb2:116.5,Bb3:233.1,D4:293.7}; // v4.1.16: +B2 (PAT.stanciya referenced N.B2 → undefined → AudioParam TypeError)

// per-district patterns (32 steps = 2 bars; number = note, array = chord, 0 = rest)
const PAT={
  base:{ type:'sawtooth', vol:.5, steps:[
    N.A1,0,0,N.A1,0,0,N.C2,0, N.G1,0,0,N.A1,0,N.E2,0,N.D2,
    N.A1,0,0,N.A1,0,0,N.C2,0, N.G1,0,N.G2,0,N.E2,0,N.D2,0 ] },
  market:{ type:'square', vol:.2, steps:[
    N.A3,0,N.E4,0,N.C4,0,N.E4,0, N.A3,0,N.E4,0,N.C4,0,N.G3,0,
    N.D3,0,N.A3,0,N.F3,0,N.A3,0, N.D3,0,N.A3,0,N.F3,0,N.C4,0 ] },
  crypt:{ type:'sine', vol:.3, steps:[
    [N.D3,N.A2,N.F3],0,0,0,0,0,0,0, 0,0,0,0,0,0,N.D4,0,
    [N.Bb2,N.F3,N.D4],0,0,0,0,0,0,0, 0,0,0,0,0,0,N.A2,0 ] },
  sunken:{ type:'sine', vol:.26, steps:[
    [N.E2,N.B3,N.G3],0,0,0,0,0,0,0, 0,0,0,0,N.E3,0,0,0,
    [N.C3,N.G3,N.E4],0,0,0,0,0,0,0, 0,0,0,0,N.D3,0,0,0 ] },
  maw:{ type:'sawtooth', vol:.5, steps:[
    N.E1,0,N.Bb1,0,N.E1,0,N.Bb1,0, [N.E3,N.Bb3],0,0,0,N.E1,0,N.Bb1,0,
    N.E1,0,N.Bb1,0,N.E1,0,N.Bb2,0, [N.E3,N.Bb3],0,0,N.E2,0,N.Bb1,0,0 ] },
  // WAVE 1+ — new biome moods (placeholder patterns, tune per biome)
  venti:{ type:'square', vol:.16, steps:[
    N.E4,0,0,0,N.B3,0,0,0, N.E4,0,0,N.D4,0,0,N.B3,0,
    N.E4,0,0,0,N.G3,0,0,0, N.E4,0,N.D4,0,N.B3,0,0,0 ] },
  stoki:{ type:'sawtooth', vol:.2, steps:[
    [N.E2,N.Bb2],0,0,0,0,0,0,0, 0,0,N.E2,0,0,0,0,0,
    [N.D2,N.A2],0,0,0,0,0,0,0, 0,0,N.D2,0,0,0,0,0 ] },
  kristall:{ type:'sine', vol:.22, steps:[
    N.E4,0,0,0,0,0,N.B3,0, 0,0,0,0,N.E4,0,0,0,
    N.G3,0,0,0,0,0,N.E4,0, 0,0,0,0,N.D4,0,0,0 ] },
  stanciya:{ type:'square', vol:.24, steps:[
    N.E2,0,N.E2,0,N.E2,0,N.E2,0, N.E2,0,N.E2,0,[N.E3,N.B2],0,0,0,
    N.E2,0,N.E2,0,N.E2,0,N.E2,0, N.E2,0,N.D2,0,[N.E3,N.B2],0,0,0 ] },
  sady:{ type:'sine', vol:.28, steps:[
    [N.C3,N.E3,N.G3],0,0,0,0,0,0,0, 0,0,0,0,N.E4,0,0,0,
    [N.A2,N.C3,N.E3],0,0,0,0,0,0,0, 0,0,0,0,N.G3,0,0,0 ] },
  set:{ type:'square', vol:.18, steps:[
    [N.E3,N.Bb3],0,0,N.E3,0,0,0,N.Bb3, 0,0,0,0,[N.E4,N.Bb3],0,0,
    N.E3,0,0,0,N.Bb2,0,0,N.E3, 0,0,N.Bb3,0,0,0,0,0 ] },
};

function makeCrushCurve(levels){const n=1024,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.round(x*levels)/levels;}return c;}

function makeReverbIR(){
  const dur=1.7, rate=ctx.sampleRate, len=Math.floor(dur*rate);
  const buf=ctx.createBuffer(2,len,rate);
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<len;i++){ d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.4); }
  }
  return buf;
}

export function audioStart(){
  if(started) return;
  try{
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==='suspended') ctx.resume();
    master=ctx.createGain(); master.gain.value=muted?0:0.5; master.connect(ctx.destination);
    sfxBus=ctx.createGain(); sfxBus.gain.value=0.85; sfxBus.connect(master);
    // reverb send (procedural IR)
    const conv=ctx.createConvolver(); conv.buffer=makeReverbIR();
    reverbWet=ctx.createGain(); reverbWet.gain.value=0.3; conv.connect(reverbWet); reverbWet.connect(master);
    const sfxSend=ctx.createGain(); sfxSend.gain.value=0.35; sfxBus.connect(sfxSend); sfxSend.connect(conv);
    // lo-fi chain on music: input → lowpass → crush → wobble delay → musicBus
    musicIn=ctx.createGain(); musicIn.gain.value=1;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2400; lp.Q.value=0.7;
    const shaper=ctx.createWaveShaper(); shaper.curve=makeCrushCurve(9);
    const wobble=ctx.createDelay(0.05); wobble.delayTime.value=0.014;
    const wlfo=ctx.createOscillator(); wlfo.frequency.value=0.55;
    const wg=ctx.createGain(); wg.gain.value=0.0035; wlfo.connect(wg); wg.connect(wobble.delayTime); wlfo.start();
    musicBus=ctx.createGain(); musicBus.gain.value=0.5;
    musicIn.connect(lp); lp.connect(shaper); shaper.connect(wobble); wobble.connect(musicBus); musicBus.connect(master);
    const musSend=ctx.createGain(); musSend.gain.value=0.5; musicBus.connect(musSend); musSend.connect(conv);
    // vinyl crackle
    noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
    const nd=noiseBuf.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
    const crk=ctx.createBufferSource(); crk.buffer=noiseBuf; crk.loop=true;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3200;
    const crkG=ctx.createGain(); crkG.gain.value=0.013;
    crk.connect(hp); hp.connect(crkG); crkG.connect(musicBus); crk.start();
    // district layers
    for(const m of MOODS){
      const g=ctx.createGain(); g.gain.value= m==="base"?0.55:0.0001;
      g.connect(musicIn);
      layerGains[m]=g; layerTargets[m]= m==="base"?1:0;
    }
    step=0; nextNoteTime=ctx.currentTime+0.1;
    schedTimer=setInterval(schedTick,90);
    started=true;
  }catch(e){ ctx=null; }
}

function schedTick(){
  if(!ctx||ctx.state!=='running') return;
  // crossfade layers toward targets
  for(const m of MOODS){
    const g=layerGains[m], t=layerTargets[m]? (m==="crypt"||m==="sunken"?0.75:0.55) : 0.0001;
    g.gain.value+= (t-g.gain.value)*0.06;
  }
  // lookahead schedule
  while(nextNoteTime < ctx.currentTime+0.25){
    for(const m of MOODS){
      if(layerGains[m].gain.value<0.02) continue;
      const pat=PAT[m];
      const entry=pat.steps[step%32];
      if(!entry) continue;
      const swing= (m==="market" && (step%2===1))? stepDur*0.55 : 0;
      const dur = Array.isArray(entry)? 3.2 : (m==="crypt"||m==="sunken"? 1.8 : stepDur*(m==="maw"?1.6:1.6));
      const notes=Array.isArray(entry)? entry : [entry];
      const vol=pat.vol*(m==="base"||m==="maw"?1:1);
      for(const f of notes){
        if(m==="base"||m==="maw") fmNote(m,f,nextNoteTime+swing,dur,vol);
        else padNote(m,f,nextNoteTime+swing,dur,vol);
      }
    }
    step++; nextNoteTime+=stepDur;
  }
}

// COMPAT v4.1.16 — every AudioParam write is finite-guarded: one undefined note once
// threw a TypeError out of a keydown handler (user saw "Failed to set the 'value' property
// on 'AudioParam': non-finite") and poisoned the frame it happened in.
function fin(v,fb){ return (typeof v==="number" && isFinite(v))? v : fb; }
function fmNote(layer,f,t,dur,vol){
  f=fin(f,220); t=fin(t,ctx?ctx.currentTime:0); dur=fin(dur,0.2); vol=fin(vol,0.1);
  // Sega-style 2-op FM: saw carrier + square modulator (2:1)
  const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=f;
  const mod=ctx.createOscillator(); mod.type='square'; mod.frequency.value=f*2;
  const mg=ctx.createGain(); mg.gain.value=f*1.15; mod.connect(mg); mg.connect(o.frequency);
  const env=ctx.createGain(); env.gain.setValueAtTime(0.0001,t); env.gain.linearRampToValueAtTime(vol,t+0.012); env.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(env); env.connect(layerGains[layer]);
  o.start(t); o.stop(t+dur+0.05); mod.start(t); mod.stop(t+dur+0.05);
}

function padNote(layer,f,t,dur,vol){
  f=fin(f,220); t=fin(t,ctx?ctx.currentTime:0); dur=fin(dur,0.2); vol=fin(vol,0.1);
  // HK-style: music-box pluck / detuned pad (two oscs ±5 cents)
  const o1=ctx.createOscillator(); o1.type=ctx.createOscillator? 'sine':'sine'; o1.frequency.value=f;
  const o2=ctx.createOscillator(); o2.type='sine'; o2.frequency.value=f; o2.detune.value=5;
  const env=ctx.createGain(); env.gain.setValueAtTime(0.0001,t); env.gain.linearRampToValueAtTime(vol,t+0.25); env.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o1.connect(env); o2.connect(env); env.connect(layerGains[layer]);
  o1.start(t); o1.stop(t+dur+0.05); o2.start(t); o2.stop(t+dur+0.05);
}

export function setDistrictMood(mood){
  if(!started||!MOODS.includes(mood)) return;
  currentMood=mood;
  for(const m of MOODS) layerTargets[m]= (m===mood)?1:0;
}

function tone(type,f0,f1,dur,vol){
  if(!ctx||ctx.state!=='running') return;
  f0=fin(f0,440); f1=fin(f1,f0); dur=fin(dur,0.1); vol=fin(vol,0.1);
  const o=ctx.createOscillator(); o.type=type;
  o.frequency.setValueAtTime(f0,ctx.currentTime);
  if(f1&&f1!==f0) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),ctx.currentTime+dur);
  const g=ctx.createGain(); g.gain.setValueAtTime(vol,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  o.connect(g); g.connect(sfxBus); o.start(); o.stop(ctx.currentTime+dur+0.03);
}
function noiseHit(dur,vol,freq){
  if(!ctx||ctx.state!=='running') return;
  dur=fin(dur,0.1); vol=fin(vol,0.1); freq=fin(freq,800);
  const b=ctx.createBufferSource(); b.buffer=noiseBuf;
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq||800; bp.Q.value=1.2;
  const g=ctx.createGain(); g.gain.setValueAtTime(vol,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
  b.connect(bp); bp.connect(g); g.connect(sfxBus); b.start(); b.stop(ctx.currentTime+dur+0.03);
}

export const sfx={
  jump(){tone('square',280,620,.09,.16)},
  dbljump(){tone('square',420,880,.09,.14)},
  land(){tone('sine',130,55,.09,.22);noiseHit(.06,.1,300)},
  dash(){noiseHit(.16,.18,1400)},
  swing(){noiseHit(.07,.12,2200);tone('square',900,180,.06,.07)},
  hit(){tone('square',180,60,.07,.2);noiseHit(.05,.16,500)},
  kill(){tone('sawtooth',400,50,.3,.22);noiseHit(.25,.2,700)},
  chest(){if(ctx)[523,659,784].forEach((f,i)=>setTimeout(()=>tone('sine',f,f,.3,.14),i*90))},
  pickup(){tone('sine',880,1245,.16,.13)},
  hack(){tone('sine',1400,180,.18,.18);noiseHit(.08,.09,2400)},
  door(){tone('sine',180,90,.25,.15);noiseHit(.2,.08,400)},
  pyre(){if(ctx)[262,330,392,523].forEach((f,i)=>setTimeout(()=>tone('sine',f,f,.55,.11),i*90))},
  hurt(){tone('square',140,90,.14,.22);noiseHit(.1,.13,250)},
  boss(){tone('sawtooth',60,40,.6,.28);noiseHit(.4,.13,150)},
  ending(){if(ctx)[262,330,392,523,659].forEach((f,i)=>setTimeout(()=>tone('sine',f,f,.95,.13),i*160))},
  // ── HK-FEEL PASS — combat/heal/boss palette ──
  upswing(){noiseHit(.06,.1,2600);tone('square',1200,300,.06,.06)},
  pogo(){tone('square',300,760,.08,.16);noiseHit(.05,.12,900)},
  soul(){tone('sine',1050,1500,.07,.05)}, // tiny tick per nail-hit soul gain
  focusTick(step){ // rising pulse while channeling — step 0..7
    const f=320+step*55; tone('sine',f,f*1.02,.1,.07+Math.min(.05,step*.006));
  },
  heal(){if(ctx)[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone('sine',f,f,.22,.1),i*55)); noiseHit(.14,.05,3000)},
  denied(){tone('square',180,120,.1,.1)},
  charge(){tone('sawtooth',90,240,.45,.14);noiseHit(.4,.06,400)},
  slam(){tone('sine',110,38,.22,.3);noiseHit(.18,.22,220)},
  roar(){tone('sawtooth',70,34,.8,.3);tone('square',140,60,.6,.12);noiseHit(.7,.16,180)},
  phase(){if(ctx)[196,262,330,392].forEach((f,i)=>setTimeout(()=>tone('square',f,f*.99,.3,.09),i*70)); noiseHit(.5,.1,300)},
  orb(){tone('sine',700,420,.12,.08)},
  teleport(){noiseHit(.2,.14,2800);tone('sine',900,180,.2,.1)},
};

export function toggleMute(){
  muted=!muted;
  if(master) master.gain.value=muted?0:0.5;
  return muted;
}
export function isMuted(){ return muted; }
