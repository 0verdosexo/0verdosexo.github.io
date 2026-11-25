/* audio.js — Web Audio: real CC0 gun/foley samples with 3D falloff, stereo pan, occlusion muffling; synthesized fallbacks and ambience. */
'use strict';
const Sfx=(()=>{
  let ctx=null, master=null, comp=null, amb=null, verb=null, NZ=null; const buf=new Map(), loading=new Map();
  /* gun recordings: start offset (s) and level so every bang hits about the same loudness (measured RMS of the 200 ms after the bang → about -17 dB) */
  const GSMP={pistol:{g:2.2},pistol_heavy:{g:1.35},pistol_light:{off:0.335,g:1.45},revolver:{g:1.95},magnum:{g:1.4},rifle_ar:{g:1.7},rifle_ak:{g:1.5},battle_rifle:{g:1.85},
    smg:{g:2.05},smg2:{g:2.1},shotgun:{g:1.45},shotgun2:{g:1.4},sniper:{g:1},sniper_heavy:{g:2.1},flintlock:{g:1.5},rifle_lever:{g:1.75}};
  /* what each kind of gun adds on top of its recording: crack (sharp high snap), body (mid punch), boom (low sweep: from Hz, to Hz, seconds, level), echo send */
  const GPROF={pistol:{c:0.5,b:0.35,boom:[150,55,0.13,0.55],e:0.28},magnum:{c:0.75,b:0.5,boom:[140,44,0.24,0.9],e:0.5},smg:{c:0.42,b:0.3,boom:[165,60,0.1,0.45],e:0.2},
    rifle:{c:0.6,b:0.45,boom:[130,47,0.16,0.75],e:0.38},dmr:{c:0.75,b:0.5,boom:[120,42,0.26,0.95],e:0.6},shotgun:{c:0.55,b:0.62,boom:[108,37,0.3,1.05],e:0.6},
    sniper:{c:0.95,b:0.62,boom:[98,33,0.4,1.2],e:0.95},sup:{c:0,b:0.16,boom:null,e:0.08}};
  const FILES=['pistol','pistol_heavy','pistol_light','revolver','rifle_ar','rifle_ak','smg','smg2','shotgun','shotgun2','sniper','sniper_heavy','battle_rifle','rifle_lever','flintlock','magnum',
    'reload_rifle','reload_pistol','pump','explosion','explosion2','step1','step2','step3','step4','step5','step6','step_metal','hit_01','hit_02','hit_03','metal_04','metal_09','glass_01','wooden_02',
    'switch_01','switch_02','slam_01','spring_03','key_open_01','tools_03','machine_02','bell_02','gong_01'];
  function unlock(){ if(ctx){ if(ctx.state==='suspended') ctx.resume(); return; }
    try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(_){ return; }
    comp=ctx.createDynamicsCompressor(); comp.threshold.value=-12; comp.knee.value=6; comp.ratio.value=10; comp.attack.value=0.002; comp.release.value=0.14;
    master=ctx.createGain(); master.gain.value=prefs.sound===false?0:prefs.vol; master.connect(comp); comp.connect(ctx.destination);
    /* echo for gunshot tails: a short outdoor-ish reverb (decaying stereo noise, darker as it fades) */
    try{ const sr=ctx.sampleRate, n=Math.floor(sr*1.6), ir=ctx.createBuffer(2,n,sr);
      for(let c=0;c<2;c++){ const d=ir.getChannelData(c); let lp=0; for(let i=0;i<n;i++){ const t=i/sr, k=0.35+0.6*Math.exp(-t*3); lp=lp*(1-k)+(Math.random()*2-1)*k; d[i]=lp*Math.exp(-t*3.4)*(t<0.012?t/0.012:1); } }
      verb=ctx.createConvolver(); verb.buffer=ir; const wet=ctx.createGain(); wet.gain.value=0.9; verb.connect(wet); wet.connect(master); }catch(_){ verb=null; }
    for(const f of FILES) load(f); }
  function setVolume(){ if(master) master.gain.value=prefs.sound===false?0:prefs.vol; }
  function load(name){ if(buf.has(name)||loading.has(name)||!ctx) return; const p=fetch('assets/sfx/'+name+'.mp3').then(r=>{ if(!r.ok) throw 0; return r.arrayBuffer(); }).then(a=>ctx.decodeAudioData(a)).then(b=>buf.set(name,b)).catch(()=>buf.set(name,null)); loading.set(name,p); }
  /* listener from the camera */
  const L={x:0,y:0,z:0,yaw:0};
  function listener(x,y,z,yaw){ L.x=x; L.y=y; L.z=z; L.yaw=yaw; }
  function spatial(o){ if(o.x==null) return {g:1,pan:0,muffle:false};
    const dx=o.x-L.x, dy=(o.y||0)-L.y, dz=o.z-L.z, d=Math.hypot(dx,dy,dz), max=o.dist||60;
    const g=d<2?1:Math.pow(Math.max(0,1-d/max),1.6)/(1+d*0.02);
    const ang=Math.atan2(dx,-dz)+L.yaw; const pan=clamp(Math.sin(ang)*Math.min(1,d/3),-0.9,0.9)||0;
    let muffle=false; if(d>3&&o.occl!==false&&typeof los3==='function') muffle=!los3(L.x,L.y,L.z,o.x,(o.y||0)+0.8,o.z);
    return {g,pan,muffle,d}; }
  function out(s,o){ let node=s; const sp=spatial(o); if(!(sp.g>0.001)) return null; /* also drops NaN (a position not set yet) */
    const g=ctx.createGain(); g.gain.value=(o.vol!=null?o.vol:1)*sp.g;
    if(sp.muffle){ const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; node.connect(f); node=f; g.gain.value*=0.7; }
    node.connect(g); node=g;
    if(ctx.createStereoPanner&&sp.pan){ const p=ctx.createStereoPanner(); p.pan.value=sp.pan; node.connect(p); node=p; }
    node.connect(master); return g; }
  const SYN=new Set(['hitmark','headmark','killding','killhs','medal','shotthump','kill','kill2','click','empty','beep','deny','whoosh','jump','land','win','lose','capture','alarm','orb','collect','caught','portal','flashbang','bow','throw','snow','rocket']);
  function play(name,o){ o=o||{}; if(!ctx||!master) return;
    if(SYN.has(name)) return synth(name,o);
    const b=buf.get(name); if(!b){ if(b===undefined) load(name); return synth(name,o); }
    const s=ctx.createBufferSource(); s.buffer=b; s.playbackRate.value=(o.rate||1)*(o.jitter===false?1:rand(0.96,1.04));
    if(!out(s,o)) return; s.start(0,o.offset||0); if(o.dur) s.stop(ctx.currentTime+o.dur); }
  function gunProf(w,sup){ if(sup||w.silent) return 'sup'; const id=w.id;
    if(id==='heavysr'||id==='piercesr') return 'sniper'; if(id==='m1'||id==='lightsr'||id==='falcon'||id==='m249') return id==='m249'?'rifle':'dmr';
    if(id==='deagle'||id==='revolver'||id==='flintlock') return 'magnum'; return {pistol:'pistol',smg:'smg',sg:'shotgun',ar:'rifle',lmg:'rifle',dmr:'dmr',sr:'dmr'}[w.cat]||'rifle'; }
  /* one gunshot: the recording (trimmed + level-matched, low end lifted for your own gun) + crack + body + low boom + echo.
     o: {x,y,z,dist,vol,sup,local}. Far shots keep their echo relatively longer, like real gunfire across a map. */
  function gun(w,o){ if(!ctx||!master||!w) return; o=o||{}; const name=w.snd, P=GPROF[gunProf(w,o.sup)], S=GSMP[name]||{g:1}, t=ctx.currentTime, local=!!o.local;
    const vol=o.vol==null?1:o.vol, rate=(w.sndRate||1)*(o.sup?1.35:1), auto=w.mode==='auto';
    const sp=spatial(o); if(!(sp.g>0.001)) return; const far=o.x==null?0:Math.min(1,(sp.d||0)/60);
    const bus=ctx.createGain(); bus.gain.value=vol*sp.g; let node=bus;
    if(sp.muffle){ const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; node.connect(f); node=f; bus.gain.value*=0.7; }
    if(ctx.createStereoPanner&&sp.pan){ const pn=ctx.createStereoPanner(); pn.pan.value=sp.pan; node.connect(pn); node=pn; }
    node.connect(master);
    if(verb&&P.e){ const s=ctx.createGain(); s.gain.value=P.e*(auto?0.6:1)*(0.8+far*0.9); bus.connect(s); s.connect(verb); }
    const b=buf.get(name);
    if(b){ const s=ctx.createBufferSource(); s.buffer=b; s.playbackRate.value=rate*rand(0.97,1.03); const g=ctx.createGain(); g.gain.value=S.g*(o.sup?0.45:1)*(local?1:0.95); let n=s;
      if(local&&!o.sup){ const ls=ctx.createBiquadFilter(); ls.type='lowshelf'; ls.frequency.value=180; ls.gain.value=5; n.connect(ls); n=ls; }
      if(far>0.35){ const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=7000-far*4500; n.connect(lp); n=lp; }
      n.connect(g); g.connect(bus); s.start(t,S.off||0); }
    else if(b===undefined) load(name);
    const nearK=local?1:Math.max(0,1-far*1.4);
    if(!NZ) NZ=[noise(0.04),noise(0.1)];
    if(P.c&&nearK>0){ const s=ctx.createBufferSource(); s.buffer=NZ[0]; const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=2600; const g=ctx.createGain();
      g.gain.setValueAtTime(P.c*0.55*nearK,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.035); s.connect(f); f.connect(g); g.connect(bus); s.start(t); }
    if(P.b){ const s=ctx.createBufferSource(); s.buffer=NZ[1]; const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=rate>1.2?1400:850; f.Q.value=0.9; const g=ctx.createGain();
      g.gain.setValueAtTime(P.b*0.7,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09); s.connect(f); f.connect(g); g.connect(bus); s.start(t); }
    if(P.boom&&(local||far<0.6)){ const [f0,f1,d,v]=P.boom, s=ctx.createOscillator(); s.type='sine'; s.frequency.setValueAtTime(f0,t); s.frequency.exponentialRampToValueAtTime(f1,t+d);
      const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v*(local?1:0.6),t+0.006); g.gain.exponentialRampToValueAtTime(0.001,t+d); s.connect(g); g.connect(bus); s.start(t); s.stop(t+d+0.02); } }
  function noise(dur){ const n=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate), d=n.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return n; }
  /* procedural sounds for things without a sample */
  function synth(name,o){ const t0=ctx.currentTime, R=o.rate||1, V=o.vol==null?1:o.vol; let t=t0;
    /* tone(freq, seconds, wave, volume, end freq, delay) — o.rate shifts the pitch, o.vol scales the level */
    const tone=(f,dur,type,vol,f2,dl)=>{ const t=t0+(dl||0); const s=ctx.createOscillator(); s.type=type||'sine'; s.frequency.setValueAtTime(f*R,t); if(f2) s.frequency.exponentialRampToValueAtTime(f2*R,t+dur);
      const env=ctx.createGain(); env.gain.setValueAtTime(0.0001,t0); env.gain.setValueAtTime((vol||0.3)*V,t); env.gain.exponentialRampToValueAtTime(0.001,t+dur); s.connect(env); if(out(env,o)) { s.start(t); s.stop(t+dur); } };
    const nz=(dur,freq,q,vol,type)=>{ const s=ctx.createBufferSource(); s.buffer=noise(dur); const f=ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq; f.Q.value=q||1;
      const env=ctx.createGain(); env.gain.setValueAtTime((vol||0.4)*V,t); env.gain.exponentialRampToValueAtTime(0.001,t+dur); s.connect(f); f.connect(env); if(out(env,o)) s.start(t); };
    switch(name){
      case 'bow': nz(0.12,1800,2,0.5); tone(220,0.15,'triangle',0.25,110); break;
      case 'throw': nz(0.25,900,0.8,0.35); break;
      case 'snow': nz(0.18,2400,0.7,0.4,'highpass'); break;
      case 'rocket': nz(0.6,500,0.6,0.6,'lowpass'); tone(160,0.5,'sawtooth',0.12,60); break;
      case 'click': tone(1200,0.04,'square',0.08); break;
      case 'empty': tone(900,0.03,'square',0.12); tone(500,0.04,'square',0.06); break;
      /* body hit: a dull "thwack" */
      case 'hitmark': nz(0.05,1700,1.3,0.22); tone(240,0.07,'sine',0.28,130); tone(1450,0.035,'square',0.05); break;
      /* headshot hit: the helmet "dink" */
      case 'headmark': tone(2950,0.2,'sine',0.2,2650); tone(4420,0.09,'sine',0.08); tone(1980,0.12,'triangle',0.07); nz(0.03,6500,2,0.14,'highpass'); break;
      /* kill: a low thump under a bright two-note chime */
      case 'killding': tone(95,0.24,'sine',0.6,38); nz(0.05,2600,1,0.18); tone(1318,0.34,'sine',0.17,null,0.015); tone(1976,0.3,'sine',0.11,null,0.075); tone(2637,0.18,'triangle',0.05,null,0.075); break;
      case 'killhs': tone(95,0.26,'sine',0.62,36); tone(3000,0.22,'sine',0.2,2650); tone(4500,0.1,'sine',0.08); nz(0.04,6500,2,0.16,'highpass');
        tone(1568,0.36,'sine',0.17,null,0.05); tone(2349,0.32,'sine',0.11,null,0.11); tone(3136,0.2,'triangle',0.05,null,0.11); break;
      /* multi-kill / streak medal: whoosh + rising chord */
      case 'medal': nz(0.32,900,0.7,0.24); tone(523,0.42,'triangle',0.14,null,0.04); tone(784,0.42,'triangle',0.12,null,0.09); tone(1046,0.5,'triangle',0.12,null,0.14); tone(1568,0.36,'sine',0.07,null,0.18); break;
      /* extra low end under your own shots */
      case 'shotthump': tone(120,0.12,'sine',0.55,44); nz(0.06,240,0.8,0.35,'lowpass'); break;
      case 'kill': tone(660,0.1,'triangle',0.2); setTimeout(()=>play('kill2',o),70); break;
      case 'kill2': tone(990,0.14,'triangle',0.2); break;
      case 'orb': tone(880,0.12,'sine',0.25,1320); tone(1320,0.25,'sine',0.12,1760); break;
      case 'collect': tone(520,0.08,'triangle',0.08); break;
      case 'caught': tone(300,0.4,'sawtooth',0.25,90); break;
      case 'alarm': tone(740,0.3,'square',0.12); setTimeout(()=>tone(560,0.3,'square',0.12),300); break;
      case 'beep': tone(1760,0.08,'sine',0.2); break;
      case 'capture': tone(523,0.12,'triangle',0.2); setTimeout(()=>{ if(ctx) tone(784,0.2,'triangle',0.2); },120); break;
      case 'whoosh': nz(0.3,600,0.6,0.35); break;
      case 'flashbang': nz(0.6,3000,0.5,0.8,'highpass'); tone(3500,1.5,'sine',0.2); break;
      case 'portal': tone(300,0.5,'sine',0.25,1200); break;
      case 'jump': nz(0.08,700,1,0.12); break;
      case 'land': nz(0.12,300,1,0.3,'lowpass'); break;
      case 'deny': tone(200,0.15,'square',0.15); break;
      case 'win': [523,659,784,1046].forEach((f,i)=>setTimeout(()=>{ if(ctx) tone(f,0.25,'triangle',0.2); },i*120)); break;
      case 'lose': [392,330,262].forEach((f,i)=>setTimeout(()=>{ if(ctx) tone(f,0.35,'triangle',0.2); },i*180)); break;
      default: nz(0.1,1000,1,0.2);
    }
  }
  /* ambience per theme: filtered noise beds */
  function ambience(theme){ if(!ctx) return; stopAmbience(); const t=ctx.currentTime;
    const bed=(freq,q,vol,type,lfo)=>{ const s=ctx.createBufferSource(); s.buffer=noise(4); s.loop=true; const f=ctx.createBiquadFilter(); f.type=type||'lowpass'; f.frequency.value=freq; f.Q.value=q;
      const g=ctx.createGain(); g.gain.value=vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
      if(lfo){ const o=ctx.createOscillator(); o.frequency.value=lfo; const og=ctx.createGain(); og.gain.value=freq*0.4; o.connect(og); og.connect(f.frequency); o.start(t); return [s,o]; } return [s]; };
    amb=[]; if(theme==='desert') amb.push(...bed(500,0.6,0.05,'lowpass',0.07)); else if(theme==='cyber'){ amb.push(...bed(3500,0.4,0.035,'highpass')); amb.push(...bed(120,0.8,0.05,'lowpass',0.03)); }
    else if(theme==='factory'){ amb.push(...bed(220,2,0.04,'bandpass',0.05)); } else amb.push(...bed(800,0.5,0.025,'lowpass',0.1)); }
  function stopAmbience(){ if(amb){ amb.forEach(n=>{ try{ n.stop(); }catch(_){} }); amb=null; } }
  return {unlock,play,gun,listener,setVolume,ambience,stopAmbience,get ready(){return !!ctx;}};
})();

/* lobby music: one track on a loop while you are in the menus, faded out when a match starts.
   Starts on the first tap/key press (browsers block sound before that). Volume follows the sound settings; prefs.music===false turns it off. */
const Music=(()=>{
  let el=null, want=false, cur=0, timer=0, unlocked=false;
  const target=()=>want&&prefs.sound!==false&&prefs.music!==false?Math.min(1,(prefs.vol==null?0.8:prefs.vol)*0.5):0;
  function ensure(){ if(el) return el; el=new Audio(); el.src=assetURL('assets/music/lobby.mp3'); el.loop=true; el.preload='auto'; el.volume=0; return el; }
  function tick(){ const t=target(); const step=0.04; if(Math.abs(cur-t)<=step) cur=t; else cur+=cur<t?step:-step;
    if(el) el.volume=Math.max(0,Math.min(1,cur));
    if(cur<=0&&el&&!el.paused&&t===0) el.pause();
    if(cur===t){ clearInterval(timer); timer=0; } }
  function run(){ if(!unlocked) return; const t=target(); if(t>0){ const e=ensure(); if(e.paused){ const p=e.play(); if(p&&p.catch) p.catch(()=>{}); } } if(!timer) timer=setInterval(tick,50); }
  function set(on){ want=!!on; run(); }
  function unlock(){ unlocked=true; run(); }
  function refresh(){ run(); }
  document.addEventListener('visibilitychange',()=>{ if(!el) return; if(document.hidden) el.pause(); else if(target()>0){ const p=el.play(); if(p&&p.catch) p.catch(()=>{}); } });
  return {set,unlock,refresh,get playing(){ return !!el&&!el.paused; }};
})();

