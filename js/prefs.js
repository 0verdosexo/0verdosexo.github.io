/* prefs.js — saved settings and synthesized sound effects */
const $=id=>document.getElementById(id);
const LS={ get(k,d){ try{ const v=localStorage.getItem('sandtag3-'+k); return v===null?d:JSON.parse(v); }catch(_){ return d; } },
           set(k,v){ try{ localStorage.setItem('sandtag3-'+k,JSON.stringify(v)); }catch(_){} } };
const prefs={ ctrl:LS.get('ctrl',matchMedia('(pointer: coarse)').matches?'joy':'kb'), diff:LS.get('diff','normal'), theme:LS.get('theme','sunset'),
  sens:LS.get('sens',1), sound:LS.get('sound',true), name:LS.get('name',''), map:LS.get('map',''), mode:LS.get('mode','tag'), aiGun:LS.get('aiGun',false),
  gfx:LS.get('gfx',matchMedia('(pointer: coarse)').matches?'medium':'high') };
if(!prefs.name) prefs.name='플레이어'+String((Math.random()*90+10)|0);
const DEF_CFG={mode:'tag',map:'',orbs:10,seekMul:0.95,collect:2,theme:'sunset',zone:true,tp:true,radar:true,swap:true,gun:false,mag:10,reload:3,dmg:10,kills:3};
let CFG=Object.assign({},DEF_CFG);

let AC=null, master=null, noiseBuf=null;
function audioInit(){
  if(AC){ if(AC.state==='suspended') AC.resume().catch(()=>{}); return; }
  try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=0.45; master.connect(AC.destination);
    noiseBuf=AC.createBuffer(1,AC.sampleRate*0.6,AC.sampleRate); const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }catch(_){ AC=null; }
}
function tone(f,d,type,vol,f2,delay){ if(!AC||!prefs.sound) return; const t=AC.currentTime+(delay||0); const o=AC.createOscillator(), g=AC.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(f,t); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t+d);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.2,t+0.012); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+d+0.03); }
function noise(d,vol,freq){ if(!AC||!prefs.sound||!noiseBuf) return; const t=AC.currentTime; const s=AC.createBufferSource(); s.buffer=noiseBuf;
  const f=AC.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq||1000; f.Q.value=0.8; const g=AC.createGain();
  g.gain.setValueAtTime(vol||0.2,t); g.gain.exponentialRampToValueAtTime(0.0001,t+d); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t+d+0.02); }
const SFX={
  tick:()=>tone(700,0.04,'square',0.04), collect:()=>{ tone(660,0.12,'triangle',0.22); tone(990,0.2,'triangle',0.22,null,0.1); },
  jump:()=>tone(280,0.12,'square',0.07,520), land:()=>noise(0.09,0.18,380), slide:()=>noise(0.4,0.2,1700),
  tp:()=>{ tone(180,0.45,'sawtooth',0.1,1500); tone(900,0.3,'sine',0.12,300,0.2); }, door:()=>[523,659,784].forEach((f,i)=>tone(f,0.6,'triangle',0.16,null,i*0.09)),
  radar:()=>{ tone(1300,0.3,'sine',0.2,500); tone(1300,0.3,'sine',0.12,500,0.32); }, beat:()=>{ tone(70,0.14,'sine',0.4); tone(62,0.14,'sine',0.3,null,0.17); },
  step:()=>noise(0.05,0.1,650), win:()=>[523,659,784,1046].forEach((f,i)=>tone(f,0.32,'triangle',0.2,null,i*0.12)),
  lose:()=>[392,330,262].forEach((f,i)=>tone(f,0.4,'triangle',0.2,null,i*0.16)), count:()=>tone(440,0.12,'square',0.1), go:()=>tone(880,0.3,'square',0.12),
  bad:()=>tone(200,0.14,'square',0.08), ui:()=>tone(620,0.05,'triangle',0.08),
  shot:(v)=>{ v=v==null?1:v; noise(0.16,0.35*v,900); tone(140,0.12,'square',0.12*v,60); }, empty:()=>tone(900,0.04,'square',0.06),
  reload:()=>{ tone(300,0.08,'square',0.08); tone(420,0.08,'square',0.08,null,0.15); }, reloadDone:()=>{ tone(500,0.07,'square',0.1); tone(760,0.1,'square',0.1,null,0.08); },
  hurt:()=>{ tone(120,0.25,'sawtooth',0.25,60); noise(0.15,0.2,300); }, hurtHead:()=>{ tone(160,0.3,'sawtooth',0.3,50); noise(0.2,0.28,500); tone(2400,0.08,'sine',0.08); },
  hit:()=>tone(1500,0.06,'square',0.12), headshot:()=>{ tone(1900,0.07,'square',0.14); tone(2600,0.12,'triangle',0.14,null,0.06); },
  magOut:()=>{ noise(0.06,0.15,2500); tone(260,0.06,'square',0.07); }, magIn:()=>{ noise(0.05,0.2,1800); tone(420,0.05,'square',0.1); tone(620,0.05,'square',0.08,null,0.06); }
};
addEventListener('pointerdown',audioInit,{capture:true}); addEventListener('keydown',audioInit,{capture:true});

