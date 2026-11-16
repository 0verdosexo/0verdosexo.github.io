/* audio.js — Web Audio: real CC0 gun/foley samples with 3D falloff, stereo pan, occlusion muffling; synthesized fallbacks and ambience. */
'use strict';
const Sfx=(()=>{
  let ctx=null, master=null, comp=null, amb=null; const buf=new Map(), loading=new Map();
  const FILES=['pistol','pistol_heavy','pistol_light','revolver','rifle_ar','rifle_ak','smg','smg2','shotgun','shotgun2','sniper','sniper_heavy','battle_rifle','rifle_lever','flintlock','magnum',
    'reload_rifle','reload_pistol','pump','explosion','explosion2','step1','step2','step3','step4','step5','step6','step_metal','hit_01','hit_02','hit_03','metal_04','metal_09','glass_01','wooden_02',
    'switch_01','switch_02','slam_01','spring_03','key_open_01','tools_03','machine_02','bell_02','gong_01'];
  function unlock(){ if(ctx){ if(ctx.state==='suspended') ctx.resume(); return; }
    try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(_){ return; }
    comp=ctx.createDynamicsCompressor(); comp.threshold.value=-14; comp.ratio.value=4; master=ctx.createGain(); master.gain.value=prefs.sound===false?0:prefs.vol; master.connect(comp); comp.connect(ctx.destination);
    for(const f of FILES) load(f); }
  function setVolume(){ if(master) master.gain.value=prefs.sound===false?0:prefs.vol; }
  function load(name){ if(buf.has(name)||loading.has(name)||!ctx) return; const p=fetch('assets/sfx/'+name+'.mp3').then(r=>{ if(!r.ok) throw 0; return r.arrayBuffer(); }).then(a=>ctx.decodeAudioData(a)).then(b=>buf.set(name,b)).catch(()=>buf.set(name,null)); loading.set(name,p); }
  /* listener from the camera */
  const L={x:0,y:0,z:0,yaw:0};
  function listener(x,y,z,yaw){ L.x=x; L.y=y; L.z=z; L.yaw=yaw; }
  function spatial(o){ if(o.x==null) return {g:1,pan:0,muffle:false};
    const dx=o.x-L.x, dy=(o.y||0)-L.y, dz=o.z-L.z, d=Math.hypot(dx,dy,dz), max=o.dist||60;
    const g=d<2?1:Math.pow(Math.max(0,1-d/max),1.6)/(1+d*0.02);
    const ang=Math.atan2(dx,-dz)+L.yaw; const pan=clamp(Math.sin(ang)*Math.min(1,d/3),-0.9,0.9);
    let muffle=false; if(d>3&&o.occl!==false&&typeof los3==='function') muffle=!los3(L.x,L.y,L.z,o.x,(o.y||0)+0.8,o.z);
    return {g,pan,muffle,d}; }
  function out(s,o){ let node=s; const sp=spatial(o); if(sp.g<=0.001) return null;
    const g=ctx.createGain(); g.gain.value=(o.vol!=null?o.vol:1)*sp.g;
    if(sp.muffle){ const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; node.connect(f); node=f; g.gain.value*=0.7; }
    node.connect(g); node=g;
    if(ctx.createStereoPanner&&sp.pan){ const p=ctx.createStereoPanner(); p.pan.value=sp.pan; node.connect(p); node=p; }
    node.connect(master); return g; }
  function play(name,o){ o=o||{}; if(!ctx||!master) return;
    const b=buf.get(name); if(!b){ if(b===undefined) load(name); return synth(name,o); }
    const s=ctx.createBufferSource(); s.buffer=b; s.playbackRate.value=(o.rate||1)*(o.jitter===false?1:rand(0.96,1.04));
    if(!out(s,o)) return; s.start(0,o.offset||0); if(o.dur) s.stop(ctx.currentTime+o.dur); }
  function noise(dur){ const n=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate), d=n.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; return n; }
  /* procedural sounds for things without a sample */
  function synth(name,o){ const t=ctx.currentTime; const tone=(f,dur,type,vol,f2)=>{ const s=ctx.createOscillator(); s.type=type||'sine'; s.frequency.setValueAtTime(f,t); if(f2) s.frequency.exponentialRampToValueAtTime(f2,t+dur);
      const env=ctx.createGain(); env.gain.setValueAtTime(vol||0.3,t); env.gain.exponentialRampToValueAtTime(0.001,t+dur); s.connect(env); if(out(env,o)) { s.start(t); s.stop(t+dur); } };
    const nz=(dur,freq,q,vol,type)=>{ const s=ctx.createBufferSource(); s.buffer=noise(dur); const f=ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq; f.Q.value=q||1;
      const env=ctx.createGain(); env.gain.setValueAtTime(vol||0.4,t); env.gain.exponentialRampToValueAtTime(0.001,t+dur); s.connect(f); f.connect(env); if(out(env,o)) s.start(t); };
    switch(name){
      case 'bow': nz(0.12,1800,2,0.5); tone(220,0.15,'triangle',0.25,110); break;
      case 'throw': nz(0.25,900,0.8,0.35); break;
      case 'snow': nz(0.18,2400,0.7,0.4,'highpass'); break;
      case 'rocket': nz(0.6,500,0.6,0.6,'lowpass'); tone(160,0.5,'sawtooth',0.12,60); break;
      case 'click': tone(1200,0.04,'square',0.08); break;
      case 'empty': tone(900,0.03,'square',0.12); tone(500,0.04,'square',0.06); break;
      case 'hitmark': tone(1500,0.05,'square',0.09); break;
      case 'headmark': tone(2100,0.07,'square',0.12); tone(1400,0.08,'triangle',0.08); break;
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
  return {unlock,play,listener,setVolume,ambience,stopAmbience,get ready(){return !!ctx;}};
})();
