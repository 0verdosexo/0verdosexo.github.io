/* actors.js — players and bots share one actor model: movement, health, damage, death, perks. Bots feed the same intents as humans. */
'use strict';
const RUN_SPEED=6.6, SLIDE_V=11.5, CROUCH_H=1.2, EYE=0.14;
const NOINTENT={mx:0,mz:0,lookX:0,lookY:0};
function newActor(o){
  return Object.assign({id:uid(6),name:'플레이어',bot:false,owner:null,local:false,team:0,color:'#3d8bff',role:null,
    x:0,y:0,z:0,yaw:0,pitch:0,vx:0,vz:0,vy:0,gr:true,ph:PH,kx:0,kz:0,climbing:false,fell:false,
    crouch:false,slideT:0,sdx:0,sdz:0,speedNow:0,stepAcc:0,
    hp:100,maxHp:100,alive:false,deadT:0,respawnAt:0,spawnProt:0,lastDmgT:-99,regenNow:false,
    kills:0,deaths:0,assists:0,score:0,streak:0,dmgBy:{},caps:0,
    load:null,slots:[],cur:0,prev:1,switchT:0,reloadT:0,fireCD:0,burstLeft:0,cycleT:0,ads:false,adsT:0,bloom:0,recoilP:0,recoilY:0,lastShot:-9,
    thrLeft:0,specCd:0,c4:[],slowT:0,slowF:0,stunT:0,blindT:0,carry:null,
    jailed:false,escaped:false,caught:false,collect:null,radarCd:0,gunMag:10,gunReloadT:0,revealT:0,
    ggLevel:0,ggPts:0,pkCp:0,pkDone:false,
    net:null,av:null,lastHeard:-9,emote:0},o);
}
const isEnemy=(a,b)=>a&&b&&a!==b&&(Game.teamMode?a.team!==b.team:true);
const eyeY=a=>a.y+a.ph-EYE;
function fwd(yaw){ return {x:-Math.sin(yaw),z:-Math.cos(yaw)}; }
function aimDir(a){ const cp=Math.cos(a.pitch); return {x:-Math.sin(a.yaw)*cp,y:Math.sin(a.pitch),z:-Math.cos(a.yaw)*cp}; }
/* ---------- perks & speed ---------- */
function actorSpeed(a){
  let s=RUN_SPEED;
  if(Game.kind==='tag'){ if(a.role==='seek') s*=0.95; if(a.carry==='slow') s*=0.9; }
  else { const w=curW(a); if(w) s*=w.speed||1; s*=1+0.05*perkN(a.load,'sprinter'); if(w&&w.mode==='melee'&&perkN(a.load,'berserk')) s*=1+0.2*perkN(a.load,'berserk');
    if(a.ads) s*=0.62; else if(a.shoulder) s*=0.85; if(Game.t-a.lastShot<0.25&&w&&w.mode!=='melee') s*=1-0.25/(1+perkN(a.load,'under')*1.5);
    if(a.carry==='flag') s*=0.93; if(a.carry==='drive') s*=0.9; if(a.carry==='bomb') s*=0.97; }
  if(a.crouch) s*=0.5; if(a.slowT>0) s*=1-a.slowF; if(a.stunT>0) s*=0.55;
  return s;
}
/* ---------- movement (players & bots) ---------- */
function moveActor(a,I,dt){
  if(!a.alive) return;
  if(a.jailed&&Game.kind==='tag'){ I=NOINTENT; }
  const frozen=(Game.kind==='tag'&&a.role==='seek'&&(a.gunReloadT>0||(Tag.info()&&Tag.info().release>0)))||Game.freeze;
  let speed=actorSpeed(a); if(frozen) speed=0;
  const f=fwd(a.yaw), rx=Math.cos(a.yaw), rz=-Math.sin(a.yaw);
  let wx=rx*I.mx+f.x*(-I.mz), wz=rz*I.mx+f.z*(-I.mz); const wl=Math.hypot(wx,wz); if(wl>1){ wx/=wl; wz/=wl; }
  if(I.walk&&!a.bot) speed*=0.55;
  /* slide: crouch tapped while running fast on the ground */
  const canSlide=Game.kind==='battle'||a.role==='run';
  if(I.crouchHit&&a.gr&&canSlide&&a.slideT<=0&&wl>0.5&&Math.hypot(a.vx,a.vz)>4&&!frozen){ a.slideT=0.8; const l=Math.hypot(wx,wz)||1; a.sdx=wx/l; a.sdz=wz/l; Sfx.play('slam_01',{x:a.x,y:a.y,z:a.z,vol:0.25,rate:1.6}); }
  let wantPh=PH;
  if(a.slideT>0){ a.slideT-=dt; wantPh=PH_SLIDE; const k=Math.max(0,a.slideT/0.8); const v=RUN_SPEED*0.9+(SLIDE_V-RUN_SPEED*0.9)*k;
    a.vx=a.sdx*v+wx*1.5; a.vz=a.sdz*v+wz*1.5; a.crouch=false;
    if(a.slideT<=0&&!headroom(a,CROUCH_H)) a.slideT=0.05; // stay low under obstacles
  } else {
    a.crouch=!!I.crouch&&a.gr; if(a.crouch) wantPh=CROUCH_H;
    const acc=a.gr?(wl>0.01?55:40):9; const tx=wx*speed, tz=wz*speed;
    a.vx+=clamp(tx-a.vx,-acc*dt,acc*dt); a.vz+=clamp(tz-a.vz,-acc*dt,acc*dt);
  }
  if(wantPh>a.ph){ if(headroom(a,wantPh)) a.ph=wantPh; else if(headroom(a,CROUCH_H)) { a.ph=Math.max(a.ph,CROUCH_H); if(a.slideT<=0) a.crouch=true; } }
  else a.ph=wantPh;
  if(I.jumpHit&&a.gr&&!frozen&&a.ph>=CROUCH_H-0.01&&!(a.slideT>0&&!headroom(a,PH))){ a.vy=JUMP_V; a.gr=false; a.slideT=0; if(a.local&&!a.bot) Sfx.play('jump'); }
  const door=Game.doorOpenFor?Game.doorOpenFor(a):false;
  const px=a.x, pz=a.z;
  const land=physStep(a,a.vx*dt,a.vz*dt,dt,door);
  const moved=Math.hypot(a.x-px,a.z-pz); a.speedNow=moved/Math.max(dt,1e-4);
  if(land>9&&a.local) Sfx.play('land',{vol:Math.min(1,land/14)});
  if(land>15&&Game.kind==='battle'&&!BMODES[Game.mode].noDamage&&!(a.padT>Game.t)) damage(a,{dmg:(land-15)*6,from:a.id,w:'fall'});
  if(a.gr&&moved>0&&a.slideT<=0){ a.stepAcc+=moved; const stride=a.crouch?1.2:2.1; if(a.stepAcc>stride){ a.stepAcc=0; footstep(a); } }
  if(a.fell){ a.fell=false; onFall(a); }
}
function footstep(a){ if(a.crouch&&!a.local) return; const L=cellSolids(a.x,a.z); let metal=false;
  if(L) for(const s of L) if(s.alive!==false&&(s.k==='catwalk'||s.k==='bridge'||s.k==='track'||s.k==='container'||s.k==='silo'||s.style==='metal')&&a.x>=s.x0&&a.x<=s.x1&&a.z>=s.z0&&a.z<=s.z1&&Math.abs(s.y1-a.y)<0.1){ metal=true; break; }
  const vol=a.local&&!a.bot?0.22:0.5; Sfx.play(metal?'step_metal':'step'+(1+((Math.random()*6)|0)),{x:a.x,y:a.y,z:a.z,vol,dist:28,rate:metal?rand(0.9,1.1):1}); }
function onFall(a){ if(Game.kind==='tag'){ if(a.local) teleportToSpawn(a); }
  else if(Game.mode==='pk'){ if(a.local) Modes.pkRespawn(a); }
  else if(a.local) damage(a,{dmg:999,from:a.id,w:'void'}); }
function teleportToSpawn(a){ const p=Game.spawnPoint(a); a.x=p.x; a.y=p.y||0; a.z=p.z; a.yaw=p.yaw||0; a.vx=a.vz=a.vy=0; a.gr=true; }
/* ---------- health ---------- */
function damage(v,o){ // applied only by the victim's owner
  if(!v.alive||!v.local) return 0;
  if(Game.kind==='battle'&&BMODES[Game.mode].noDamage) return 0;
  if(v.spawnProt>0&&o.from!==v.id) return 0;
  let d=o.dmg; if(o.from===v.id&&o.w!=='fall'&&o.w!=='void') d*=0.5;
  const att=Game.byId.get(o.from);
  if(att&&att!==v&&!isEnemy(att,v)&&Game.kind==='battle'&&!Game.cfg.ff) return 0;
  if(Game.kind==='tag'&&!(att&&att.role==='seek'&&v.role==='run')) return 0;
  /* shield blocks bullets from the front */
  const vw=curW(v); if(vw&&vw.shield&&att&&o.kind!=='boom'&&o.w!=='fall'){ const dx=att.x-v.x, dz=att.z-v.z, f=fwd(v.yaw); if((dx*f.x+dz*f.z)/(Math.hypot(dx,dz)||1)>0.45){ Game.emit('fx',{t:'block',x:v.x,y:v.y+1.2,z:v.z}); return 0; } }
  d=Math.round(d); if(!(d>0)) return 0;
  v.hp-=d; v.lastDmgT=Game.t; v.regenNow=false; if(att&&att!==v){ v.dmgBy[att.id]=(v.dmgBy[att.id]||0)+d; v.lastAttacker=att.id; }
  if(!v.bot) Bus.emit('hurt',{d,from:att,dirX:att?att.x:v.x,dirZ:att?att.z:v.z});
  if(v.hp<=0){ v.hp=0; kill(v,o,att); }
  return d;
}
function kill(v,o,att){
  const assist=Object.keys(v.dmgBy).filter(id=>id!==(att&&att.id)&&v.dmgBy[id]>=30);
  Game.emit('die',{v:v.id,k:att?att.id:v.id,w:o.w||'',h:!!o.head,x:+v.x.toFixed(2),y:+v.y.toFixed(2),z:+v.z.toFixed(2),as:assist,carry:v.carry});
}
/* every client: someone died */
function onDie(d){
  const v=Game.byId.get(d.v); if(!v) return; const k=Game.byId.get(d.k);
  v.alive=false; v.hp=0; v.deadT=0; v.deaths++; v.streak=0; v.dmgBy={}; v.slideT=0; v.carry=null; v.ads=false; v.shoulder=false; v.shT=0; if(v===Game.me) Input.adsOff();
  if(v.av) v.av.die();
  if(k&&k!==v){ k.kills++; k.streak++; }
  for(const id of (d.as||[])){ const a=Game.byId.get(id); if(a) a.assists++; }
  if(k&&k!==v&&k.local&&Game.kind==='battle'){ // killer perks
    if(perkN(k.load,'vampire')) k.hp=Math.min(k.maxHp,k.hp+40*perkN(k.load,'vampire'));
    if(perkN(k.load,'killregen')) k.regenNow=true;
    if(perkN(k.load,'ammocol')) for(const s of k.slots){ const w=WPN[s.id]; if(w&&w.mag) s.res=Math.min(s.res+Math.ceil(w.mag*0.5*perkN(k.load,'ammocol')),w.res*4); } }
  v.respawnAt=Game.t+(Game.respawnDelay?Game.respawnDelay(v):3);
  Bus.emit('killfeed',{k,v,w:d.w,h:d.h});
  if(Game.onDeath) Game.onDeath(v,k,d);
}
function regen(a,dt){ if(!a.alive||a.hp>=a.maxHp||Game.kind!=='battle') return; if(a.regenNow||Game.t-a.lastDmgT>4.5){ a.hp=Math.min(a.maxHp,a.hp+25*dt); } }
function applyPerksOnSpawn(a){
  a.maxHp=Math.round(100*(1+0.1*perkN(a.load,'kevlar'))); a.hp=a.maxHp;
}
