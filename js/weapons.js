/* weapons.js — guns, melee, projectiles, throwables, gadgets (deployables) and the explosion model.
   The shooter's client detects hits and sends 'hit'; the victim's owner applies damage. Projectiles are simulated everywhere, resolved by their owner. */
'use strict';
const curSlot=a=>a.slots[a.cur]||null;
const curW=a=>{ const s=curSlot(a); return s?s.w||WPN[s.id]||null:null; };
let PROJ_SEQ=1;
/* ---------- loadout ---------- */
function equip(a){
  const L=a.load||DEFAULT_LOADOUT; const slot=(id,mul,resMul,att)=>{ const w=att?wpnWith(id,att):WPN[id]; if(!w) return null; const mag=w.mag?Math.round(w.mag*(mul||1)):0; return {id,w,att:att||null,mag,max:mag,res:w.res?Math.round(w.res*(resMul||1)):0}; };
  a.slots=[]; a.thrLeft=0; a.specCd=0; a.c4=[]; a.cur=0; a.prev=1; a.reloadT=0; a.switchT=0.3; a.fireCD=0; a.burstLeft=0; a.cycleT=0; a.ads=false; a.adsT=0; a.bloom=0; a.carry=null; a.tool=false;
  if(Game.kind==='tag'){ if(a.role==='seek'&&Game.cfg.seekerGun) a.slots=[slot('tagpistol')]; return; }
  const m=Game.mode;
  if(m==='pk'){ a.slots=[slot('fists')]; return; }
  if(m==='gg'){ a.slots=[slot(GG_LADDER[Math.min(a.ggLevel,GG_LADDER.length-1)],1,3),slot('knife')]; return; }
  const ext=Math.pow(2,perkN(L,'extmag')), pk=Math.pow(2,perkN(L,'pockets'));
  /* gun slot 1 and gun slot 2 take any firearm; each carries its own attachments */
  const A=Array.isArray(L.att)?L.att:[]; let main=isGun(L.main)?L.main:'m4', side=isGun(L.side)?L.side:'p1912';
  a.slots=[slot(main,ext,pk,attClean(main,A[0])),slot(side,WPN[side].slot==='main'?ext:1,pk,attClean(side,A[1])),slot(L.melee||'knife')].filter(Boolean);
  const th=TH[L.thr]; if(th) a.thrLeft=perkN(L,'armed')?th.armed:th.count;
}
/* ---------- per-frame weapon logic (owner side) ---------- */
function weaponUpdate(a,I,dt){
  if(!a.alive) return;
  a.fireCD-=dt; a.cycleT-=dt; a.specCd-=dt; a.bloom=Math.max(0,a.bloom-dt*2.2);
  recoilRecover(a,dt);
  if(Game.kind==='tag'){ tagGunUpdate(a,I,dt); return; }
  if(a.switchT>0){ a.switchT-=dt; a.ads=false; }
  const want=I.w1?0:I.w2?1:I.w3?2:I.swap?a.prev:I.wheel?((a.cur+(I.wheel>0?1:-1)+a.slots.length)%a.slots.length):-1;
  if(want>=0&&want<a.slots.length&&want!==a.cur&&!a.carryLock) switchTo(a,want);
  const s=curSlot(a), w=curW(a); if(!s||!w) return;
  if(a.boltT>0) a.boltT=Math.max(0,a.boltT-dt);
  /* while the bolt is being worked the scope is down; the aim input is untouched, so the scope comes back by itself afterwards */
  a.ads=!!I.ads&&a.switchT<=0&&a.reloadT<=0&&!(a.boltT>0)&&w.mode!=='melee'&&!w.shield;
  a.adsT=clamp(a.adsT+(a.ads?dt*7*(w.adsSpd||1):-dt*8),0,1);
  /* shoulder (견착): gun up at the shoulder without looking through the sights. Faster than aiming, tighter than hip fire. */
  a.shoulder=!!I.shoulder&&!a.ads&&a.switchT<=0&&a.reloadT<=0&&w.mode!=='melee'&&!w.shield&&!w.item;
  a.shT=clamp((a.shT||0)+(a.shoulder?dt*11*Math.min(1.4,w.adsSpd||1):-dt*9),0,1);
  /* reload */
  if(a.reloadT>0){ a.reloadT-=dt;
    if(a.reloadT<=0){ if(w.shell){ if(s.res>0&&s.mag<s.max){ s.mag++; s.res--; if(s.mag<s.max&&s.res>0&&!(I.fire&&s.mag>0)) a.reloadT=reloadTime(a,w); Sfx.play('reload_pistol',{x:a.x,y:a.y+1,z:a.z,vol:0.35,rate:1.6,dist:20}); } }
      else { const need=s.max-s.mag, take=Math.min(need,s.res); s.mag+=take; s.res-=take; } } }
  if(w.mag&&(I.reload||(s.mag===0&&I.fire&&a.reloadT<=0&&a.fireCD<=0))&&a.reloadT<=0&&s.mag<s.max&&s.res>0&&a.switchT<=0){ startReload(a,w); }
  /* fire */
  const pressedNow=I.fire&&!a.fireHeld; a.fireHeld=!!I.fire;
  if(a.carry==='drive'){ if(I.fire&&a.fireCD<=0&&w.mode==='melee') meleeSwing(a,w); }
  else if(a.switchT<=0&&a.fireCD<=0&&(a.reloadT<=0||(w.shell&&s.mag>0))){
    if(w.mode==='melee'){ if(I.fire) meleeSwing(a,w); }
    else if(w.mode==='burst'){ if(pressedNow&&s.mag>0&&a.burstLeft<=0) a.burstLeft=w.burst; if(a.burstLeft>0&&s.mag>0){ fire(a,w,s); a.burstLeft--; a.fireCD=a.burstLeft>0?60/w.burstRpm:60/w.rpm; } }
    else if(w.mode==='auto'){ if(I.fire&&s.mag>0){ fire(a,w,s); a.fireCD=60/w.rpm; } }
    else if((w.mode==='semi'||w.mode==='pump'||w.mode==='bolt')&&pressedNow&&s.mag>0&&a.cycleT<=0){ if(w.shell) a.reloadT=0; fire(a,w,s); a.fireCD=60/w.rpm; a.cycleT=60/w.rpm;
      if(w.mode==='pump') setTimeout(()=>Sfx.play('pump',{x:a.x,y:a.y+1,z:a.z,vol:0.5,dist:25,dur:0.6}),220);
      if(w.mode==='bolt'){ a.boltDur=a.boltT=60/w.rpm*0.82; boltSounds(a,a.boltDur); } }
    if(pressedNow&&s.mag===0&&!s.res&&w.mag) Sfx.play('empty',{x:a.x,y:a.y,z:a.z,vol:a.local?1:0.3}); }
  if(I.throwHit) throwItem(a);
  if(I.special) useSpecial(a);
  if(a.tool&&I.fire) repairTick(a,dt);
}
function reloadTime(a,w){ return w.reload*Math.pow(0.6,perkN(a.load,'quickload')); }
function startReload(a,w){ a.reloadT=reloadTime(a,w); a.ads=false; if(a===Game.me) Input.adsOff(); a.burstLeft=0; Game.emit('act',{a:a.id,t:'reload'});
  if(!w.shell) Sfx.play(w.cat==='pistol'?'reload_pistol':'reload_rifle',{x:a.x,y:a.y+1,z:a.z,vol:a.local&&!a.bot?0.7:0.4,dist:22}); }
function switchTo(a,i){ a.prev=a.cur; a.cur=i; a.reloadT=0; a.burstLeft=0; a.ads=false; a.boltT=0; if(a===Game.me) Input.adsOff(); a.tool=false; const w=curW(a); a.switchT=(w?w.sw:0.4)*Math.pow(0.5,perkN(a.load,'quick')); a.cycleT=0;
  Game.emit('act',{a:a.id,t:'sw',i,w:a.slots[i].id}); if(a.local&&!a.bot) Sfx.play('switch_01',{vol:0.4}); }
/* ---------- guns ---------- */
function spreadOf(a,w){ let s=w.spread*(Math.PI/180);
  const mv=Math.min(1,Math.hypot(a.vx,a.vz)/RUN_SPEED); s*=1+w.move*mv*(a.adsT>0.5?0.5:(a.shT||0)>0.5?0.75:1); if(!a.gr) s*=1.8; if(a.crouch) s*=0.75;
  s*=lerp(w.hip||1,w.ads,Math.max(a.adsT,0.55*(a.shT||0))); s*=Math.pow(0.6,perkN(a.load,'steady')); s*=1+a.bloom; if(a.stunT>0) s*=2; return s; }
function muzzlePos(a){ const d=aimDir(a), r={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)}; const side=a.adsT>0.5?0.02:(a.shT||0)>0.5?0.08:0.16;
  return {x:a.x+d.x*0.6+r.x*side,y:eyeY(a)-0.12+d.y*0.6,z:a.z+d.z*0.6+r.z*side}; }
/* ---------- recoil recovery ----------
   recoilP / recoilY = how far the shots have moved the view (pitch up / yaw) and not yet come back.
   Players: while shooting, the view only drifts back slowly, so a long burst climbs and then levels off
   (level ≈ kicks per second ÷ RCV.fire). After the trigger is released it glides back quickly.
   Pulling the aim against the recoil counts as recovery (see Game applyLook), so a well-controlled spray does not dip below the target.
   Bots keep the old fast snap-back (their accuracy was tuned with it).
   Bigger RCV.fire / RCV.fireTouch = less climb. With the current numbers, a 30-round AK spray aimed climbs about 13° (PC, PUBG-like) and about 5° on touch. */
const RCV={fire:0.1, fireTouch:0.9, release:10, minSpeed:0.15, window:[0.1,0.2]};
function recoilRecover(a,dt){
  if(!a.recoilP&&!a.recoilY) return;
  let rp, ry;
  if(a.bot||a!==Game.me){ // old rule, both axes
    const bk=a.bot?6*((Bots.DIFF[a.diff]||{}).spray||1):3.2; /* bots pull recoil down by difficulty (Bots.DIFF.spray) */
    rp=Math.min(Math.max(a.recoilP,0),dt*bk*Math.max(0.6,a.recoilP*8)); const m=Math.abs(a.recoilY); ry=Math.min(m,dt*bk*Math.max(0.6,m*8)); }
  else { const w=curW(a), iv=w&&w.rpm?60/w.rpm:0.2, win=clamp(iv*1.6,RCV.window[0],RCV.window[1]), shooting=Game.t-a.lastShot<win;
    const k=shooting?(document.body.classList.contains('touch')?RCV.fireTouch:RCV.fire):RCV.release, f=1-Math.exp(-k*dt);
    const step=v=>{ const m=Math.abs(v); return Math.min(m,shooting?m*f:Math.max(m*f,RCV.minSpeed*dt)); };
    rp=step(Math.max(a.recoilP,0)); ry=step(a.recoilY); }
  if(rp>0){ a.pitch-=rp; a.recoilP-=rp; }
  if(ry>0){ const sg=Math.sign(a.recoilY); a.yaw-=sg*ry; a.recoilY-=sg*ry; }
}
/* one shot's recoil, in recoil units (×0.0105 rad in game): v up, h right (negative = left). r1 in [0,1), r2 in [-1,1]. */
function recoilKick(w,first,r1,r2){ const b=w.rb||0;
  return {v:w.rv*(0.9+0.1*r1)*(first?(w.rf||1):1), h:w.rh*(b+(1-Math.abs(b))*r2)}; }
/* bolt sounds: handle up + bolt back, then bolt forward + handle down (cut from the pump and switch samples, pitched down) */
function boltSounds(a,dur){ const at=(f,fn)=>setTimeout(()=>{ if(Game.active) fn(); },f*dur*1000), P=()=>({x:a.x,y:a.y+1.4,z:a.z,dist:28,jitter:false});
  at(0.16,()=>Sfx.play('switch_01',Object.assign(P(),{vol:0.55,rate:0.72})));
  at(0.27,()=>Sfx.play('pump',Object.assign(P(),{vol:0.6,rate:0.82,dur:0.15})));
  at(0.5,()=>Sfx.play('pump',Object.assign(P(),{vol:0.65,rate:0.86,offset:0.13,dur:0.26})));
  at(0.68,()=>Sfx.play('switch_02',Object.assign(P(),{vol:0.5,rate:0.8,dur:0.2}))); }
function fire(a,w,s){
  /* first shot of a string: at least two shot intervals since the last shot */
  const first=Game.t-a.lastShot>=2*60/(w.rpm||60);
  s.mag--; a.lastShot=Game.t; a.bloom=Math.min(1.5,a.bloom+(w.pellets>1?0.3:0.12));
  /* the bullet leaves along the aim as it was when the trigger broke; this shot's kick only moves the view for the NEXT shot */
  const d=aimDir(a), ex=a.x, ey=eyeY(a), ez=a.z;
  const k=recoilKick(w,first,Math.random(),Math.random()*2-1), m=0.0105*(a.adsT>0.5?0.75:(a.shT||0)>0.5?0.88:1)*(a.crouch?0.8:1);
  /* pitch + is up; yaw + turns the view LEFT in this engine, so a kick to the right subtracts */
  a.pitch+=k.v*m; a.recoilP+=k.v*m; a.yaw-=k.h*m; a.recoilY=(a.recoilY||0)-k.h*m;
  a.revealT=perkN(a.load,'ghost')?0:Game.t+(w.silent?0.5:w.loud?3.2:perkN(a.load,'eagle')?3:1.6);
  if(w.proj){ spawnProj(a,w.proj,{x:ex+d.x*0.5,y:ey-0.1+d.y*0.5,z:ez+d.z*0.5},d,w.pspeed,w); }
  else {
    const sp=spreadOf(a,w), ends=[], hits=new Map();
    for(let p=0;p<w.pellets;p++){
      const r=Math.random()*sp, th=Math.random()*Math.PI*2; const dd=perturb(d,Math.cos(th)*r,Math.sin(th)*r);
      shootRay(a,w,ex,ey,ez,dd,ends,hits);
    }
    for(const [vid,h] of hits) Game.emit('hit',{a:a.id,v:vid,d:Math.round(h.d),h:h.head?1:0,w:w.id});
    const mz=muzzlePos(a);
    const ev={a:a.id,w:w.id,o:[+mz.x.toFixed(2),+mz.y.toFixed(2),+mz.z.toFixed(2)],e:ends.map(e=>[+e[0].toFixed(2),+e[1].toFixed(2),+e[2].toFixed(2),e[3]])}; if(w.silent&&!WPN[w.id].silent) ev.sl=1; Game.emit('shot',ev);
  }
  if(a.local&&!a.bot) Bus.emit('fired',{w,kick:k.v*m});
}
function perturb(d,ax,ay){ // rotate dir by small angles around its right and up axes
  const rx=-d.z, rz=d.x, rl=Math.hypot(rx,rz)||1; const ux=-d.x*d.y, uy=d.x*d.x+d.z*d.z, uz=-d.z*d.y; const ul=Math.hypot(ux,uy,uz)||1;
  let x=d.x+rx/rl*ax+ux/ul*ay, y=d.y+uy/ul*ay, z=d.z+rz/rl*ax+uz/ul*ay; const l=Math.hypot(x,y,z); return {x:x/l,y:y/l,z:z/l}; }
function falloff(w,dist){ if(dist<=w.range) return 1; if(dist>=w.far) return w.min; return lerp(1,w.min,(dist-w.range)/(w.far-w.range)); }
function shootRay(a,w,ox,oy,oz,d,ends,hits){
  const maxD=Math.max(60,w.far*1.6); const wr=rayCast(ox,oy,oz,d.x,d.y,d.z,maxD); let wallT=wr.t;
  const cand=[];
  for(const v of Game.actors){ if(v===a||!v.alive||v.jailed) continue; if(Game.kind==='battle'&&!isEnemy(a,v)&&!Game.cfg.ff) continue; if(Game.kind==='tag'&&v.role!=='run') continue;
    const t=rayPlayer(ox,oy,oz,d.x,d.y,d.z,v.x,v.y,v.z,v.ph,0.42); if(t>0&&t<wallT) cand.push({v,t}); }
  cand.sort((p,q)=>p.t-q.t); let pierce=w.pierce||0, endT=wallT, mult=1+0.1*perkN(a.load,'express');
  for(const c of cand){ const hy=oy+d.y*c.t; const head=hy>c.v.y+c.v.ph-0.32;
    const dmg=w.dmg*falloff(w,c.t)*(head?(w.head||1.5):1)*mult; const h=hits.get(c.v.id)||{d:0,head:false}; h.d+=dmg; h.head=h.head||head; hits.set(c.v.id,h);
    if(pierce>0){ pierce--; continue; } endT=c.t; break; }
  const hx=ox+d.x*endT, hy=oy+d.y*endT, hz=oz+d.z*endT;
  let kind=0; if(endT===wallT&&wallT<maxD){ kind=1; if(wr.s&&wr.s.oid){ Game.emit('objdmg',{o:wr.s.oid,d:Math.round(w.dmg*w.pellets>60?w.dmg:w.dmg),a:a.id}); kind=2; } else if(wr.s&&(wr.s.k==='container'||wr.s.k==='silo'||wr.s.k==='car'||wr.s.k==='catwalk'||wr.s.style==='metal')) kind=3; }
  else if(endT<wallT) kind=4;
  ends.push([hx,hy,hz,kind]);
}
/* surface normal estimate at a hit point along direction d */
function hitNormal(x,y,z,d){ const e=0.08; const s=(px,py,pz)=>pointSolid(px,py,pz)?1:0;
  let nx=s(x-e,y,z)-s(x+e,y,z), ny=s(x,y-e,z)-s(x,y+e,z), nz=s(x,y,z-e)-s(x,y,z+e); const l=Math.hypot(nx,ny,nz);
  if(l<0.1) return {x:-d.x,y:-d.y,z:-d.z}; return {x:nx/l,y:ny/l,z:nz/l}; }
/* ---------- melee ---------- */
function meleeSwing(a,w){
  a.fireCD=w.rate/(perkN(a.load,'berserk')?1+0.2*perkN(a.load,'berserk'):1); a.lastShot=Game.t;
  Game.emit('act',{a:a.id,t:'melee',w:w.id});
  const f=aimDir(a); let best=null, bd=1e9;
  for(const v of Game.actors){ if(v===a||!v.alive||v.jailed||!isEnemy(a,v)) continue; if(Game.kind==='tag') continue;
    const dx=v.x-a.x, dy=(v.y+1)-(eyeY(a)-0.3), dz=v.z-a.z, dist=Math.hypot(dx,dz); if(dist>w.reach+0.4||Math.abs(dy)>1.6) continue;
    const c=(dx*f.x+dz*f.z)/(dist||1); if(c<Math.cos(w.arc)) continue; if(!los3(a.x,eyeY(a),a.z,v.x,v.y+1.1,v.z)) continue; if(dist<bd){ bd=dist; best=v; } }
  if(best){ let dmg=w.dmg*(1+0.1*perkN(a.load,'express'));
    if(w.backstab){ const vf=fwd(best.yaw), dx=best.x-a.x, dz=best.z-a.z; if((dx*vf.x+dz*vf.z)/(Math.hypot(dx,dz)||1)>0.5) dmg=w.backstab; }
    Game.emit('hit',{a:a.id,v:best.id,d:Math.round(dmg),h:0,w:w.id,m:1,kb:w.knock||0}); }
  else { const r=rayCast(a.x,eyeY(a),a.z,f.x,f.y,f.z,w.reach); if(r.t<w.reach){ if(r.s&&r.s.oid) Game.emit('objdmg',{o:r.s.oid,d:w.dmg,a:a.id}); Sfx.play('hit_0'+(1+((Math.random()*3)|0)),{x:a.x,y:a.y+1,z:a.z,vol:0.5}); } }
}
/* ---------- tag seeker gun ---------- */
function tagGunUpdate(a,I,dt){
  if(a.role!=='seek'||!Game.cfg.seekerGun) return; const s=a.slots[0]; if(!s) return; const w=WPN.tagpistol;
  if(a.gunReloadT>0){ a.gunReloadT-=dt; if(a.gunReloadT<=0){ s.mag=w.mag; } return; }
  if((I.reload&&s.mag<w.mag)||(s.mag===0&&I.fire&&!a.fireHeld)){ a.gunReloadT=w.reload; Game.emit('act',{a:a.id,t:'reload'}); Sfx.play('reload_pistol',{x:a.x,y:a.y+1,z:a.z,vol:0.6}); a.fireHeld=!!I.fire; return; }
  const pressedNow=I.fire&&!a.fireHeld; a.fireHeld=!!I.fire; a.ads=!!I.ads; a.adsT=clamp(a.adsT+(a.ads?dt*7:-dt*8),0,1);
  if(pressedNow&&s.mag>0&&a.fireCD<=0){ fire(a,w,s); a.fireCD=60/w.rpm; }
}
/* ---------- projectiles & throwables ---------- */
function spawnProj(a,kind,o,d,speed,w){
  const id=a.id+'.'+(PROJ_SEQ++);
  Game.emit('proj',{id,a:a.id,k:kind,w:w?w.id:null,p:[+o.x.toFixed(2),+o.y.toFixed(2),+o.z.toFixed(2)],v:[+(d.x*speed).toFixed(2),+(d.y*speed).toFixed(2),+(d.z*speed).toFixed(2)]});
}
function throwItem(a){
  const L=a.load; if(!L) return; const th=TH[L.thr]; if(!th) return;
  if(th.kind==='c4'&&a.c4.length){ for(const id of a.c4) Game.emit('det',{id}); a.c4=[]; Sfx.play('beep',{x:a.x,y:a.y,z:a.z}); return; }
  if(a.thrLeft<=0||a.switchT>0) return; a.thrLeft--; a.switchT=0.35;
  const d=aimDir(a), e={x:a.x+d.x*0.6,y:eyeY(a)-0.15,z:a.z+d.z*0.6};
  Game.emit('act',{a:a.id,t:'throw'});
  if(th.kind==='rocket'){ spawnProj(a,'rocket',e,d,th.speed); Sfx.play('rocket',{x:a.x,y:a.y+1,z:a.z}); return; }
  const sp=th.kind==='mine'?9:19; const v={x:d.x,y:d.y+0.18,z:d.z}; const l=Math.hypot(v.x,v.y,v.z);
  spawnProj(a,th.kind,e,{x:v.x/l,y:v.y/l,z:v.z/l},sp); Sfx.play('throw',{x:a.x,y:a.y+1,z:a.z,vol:0.6});
}
/* all clients: a projectile was launched */
function onProj(p){
  if(![...p.p,...p.v].every(v=>isFinite(v))) return;
  const a=Game.byId.get(p.a); const w=p.w?WPN[p.w]:null;
  const P={id:p.id,a:p.a,k:p.k,w:p.w,x:p.p[0],y:p.p[1],z:p.p[2],vx:p.v[0],vy:p.v[1],vz:p.v[2],t:0,mine:!!(a&&a.local),stuck:null,armed:false,mesh:null,team:a?a.team:-1,start:{x:p.p[0],z:p.p[2]}};
  const g=w?w.pgrav:(p.k==='rocket'?0:20); P.g=g; P.fuse=TH[p.k==='grenade'?'frag':p.k]&&TH[p.k==='grenade'?'frag':p.k].fuse;
  const def=Object.values(TH).find(t=>t.kind===p.k); if(def) P.def=def; if(p.k==='grenade') P.def=TH.frag;
  P.mesh=projMesh(p.k); if(P.mesh){ P.mesh.position.set(P.x,P.y,P.z); R.scene.add(P.mesh); }
  if(a&&!a.local){ const ws=w&&w.snd; if(ws) Sfx.play(ws,{x:P.x,y:P.y,z:P.z,rate:w.sndRate}); if(a.av) a.av.play(p.k==='bolt'||p.k==='snow'||p.k==='microrocket'?'Pistol_Shoot':'Punch_Cross'); }
  if(a&&a.local&&w&&w.snd) Sfx.play(w.snd,{rate:w.sndRate,vol:a.bot?undefined:0.8,x:a.bot?P.x:undefined,y:P.y,z:P.z});
  if(a&&a.local&&p.k==='c4') a.c4.push(p.id);
  Game.projs.push(P);
}
function projMesh(k){
  if(k==='bolt'||k==='shuriken'||k==='snow'||k==='microrocket'||k==='rocket'){ const g=new THREE.Group();
    if(k==='snow'){ g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6),Guns.mats().snow)); }
    else if(k==='shuriken'){ const m=Guns.make('shuriken'); g.add(m); }
    else { const m=new THREE.Mesh(new THREE.CylinderGeometry(k==='bolt'?0.012:0.04,k==='bolt'?0.012:0.04,k==='bolt'?0.5:0.4,6),Guns.mats().metal2); m.rotation.x=Math.PI/2; g.add(m);
      if(k!=='bolt'){ const f=new THREE.Mesh(new THREE.SphereGeometry(0.08,8,6),new THREE.MeshBasicMaterial({color:'#ffb24a'})); f.position.z=0.25; g.add(f); } }
    return g; }
  return Guns.make(k==='grenade'?'frag':k);
}
function updateProjs(dt){
  for(const P of Game.projs){ if(P.dead) continue; P.t+=dt;
    if(P.stuck){ if(P.stuckA){ const v=Game.byId.get(P.stuckA); if(v&&v.alive){ P.x=v.x+P.ox; P.y=v.y+P.oy; P.z=v.z+P.oz; } } }
    else {
      const ox=P.x, oy=P.y, oz=P.z; P.vy-=P.g*dt; const nx=P.x+P.vx*dt, ny=P.y+P.vy*dt, nz=P.z+P.vz*dt;
      /* actor hit (direct projectiles & sticky) */
      let hitA=null; if(['bolt','shuriken','snow','microrocket','rocket','sticky'].includes(P.k)){
        for(const v of Game.actors){ if(!v.alive||v.id===P.a||v.jailed) continue; const owner=Game.byId.get(P.a); if(owner&&!isEnemy(owner,v)) continue;
          const t=segActor(ox,oy,oz,nx,ny,nz,v); if(t>=0){ hitA={v,t}; break; } } }
      /* world hit */
      const steps=Math.max(1,Math.ceil(Math.hypot(nx-ox,ny-oy,nz-oz)/0.2)); let hitW=null;
      for(let i=1;i<=steps;i++){ const t=i/steps, px=ox+(nx-ox)*t, py=oy+(ny-oy)*t, pz=oz+(nz-oz)*t; const h=pointHit(px,py,pz); if(h){ hitW={t,x:ox+(nx-ox)*(i-1)/steps,y:oy+(ny-oy)*(i-1)/steps,z:oz+(nz-oz)*(i-1)/steps,s:h===true?null:h}; break; } }
      if(hitA&&(!hitW||hitA.t<=hitW.t)) projHitActor(P,hitA.v,ox+(nx-ox)*hitA.t,oy+(ny-oy)*hitA.t,oz+(nz-oz)*hitA.t);
      else if(hitW) projHitWorld(P,hitW);
      else { P.x=nx; P.y=ny; P.z=nz; }
      if(P.y<-40) P.dead=true;
    }
    if(P.mesh){ P.mesh.position.set(P.x,P.y,P.z); if(!P.stuck&&(P.vx||P.vz)){ if(P.k==='shuriken') P.mesh.rotation.y+=dt*30; else P.mesh.lookAt(P.x-P.vx,P.y-P.vy,P.z-P.vz); if(P.k==='grenade'||P.k==='frag'||P.k==='flash'||P.k==='smoke'||P.k==='stun') P.mesh.rotation.x+=dt*8; } }
    if((P.k==='rocket'||P.k==='microrocket')&&!P.dead&&Math.random()<0.8) FX.puff(P.x,P.y,P.z,{vy:0.3,size:0.5,life:0.8,alpha:0.4,color:[0.7,0.7,0.7],grow:2});
    /* timers (owner resolves) */
    if(P.mine&&!P.dead){
      if(P.fuse&&P.t>=P.fuse&&P.k!=='mine'&&P.k!=='c4') boom(P);
      if(P.k==='mine'&&P.stuck){ if(P.t-P.stuckT>(TH.mine.arm)){ P.armed=true; const owner=Game.byId.get(P.a);
          for(const v of Game.actors){ if(v.alive&&owner&&isEnemy(owner,v)&&Math.hypot(v.x-P.x,v.z-P.z)<TH.mine.trig&&Math.abs(v.y-P.y)<1.5){ boom(P); break; } } } }
      if(P.t>(P.k==='c4'||P.k==='mine'?180:12)) { boom(P); }
    }
  }
  for(const P of Game.projs) if(P.dead&&P.mesh){ R.scene.remove(P.mesh); P.mesh=null; }
  Game.projs=Game.projs.filter(P=>!P.dead||P.keep>0);
}
function segActor(ax,ay,az,bx,by,bz,v){ // closest approach of segment to the actor's vertical capsule
  const steps=4; for(let i=0;i<=steps;i++){ const t=i/steps, x=ax+(bx-ax)*t, y=ay+(by-ay)*t, z=az+(bz-az)*t; if(Math.hypot(x-v.x,z-v.z)<0.48&&y>v.y&&y<v.y+v.ph+0.1) return t; } return -1; }
function projHitActor(P,v,x,y,z){
  P.x=x; P.y=y; P.z=z;
  if(P.k==='sticky'){ P.stuck=true; P.stuckA=v.id; P.ox=x-v.x; P.oy=y-v.y; P.oz=z-v.z; P.vx=P.vy=P.vz=0; Sfx.play('slam_01',{x,y,z,vol:0.4,rate:1.8}); return; }
  if(P.k==='rocket'||P.k==='microrocket'){ if(P.mine) boom(P); P.dead=true; return; }
  P.dead=true; if(!P.mine) return;
  const w=WPN[P.w]; if(!w) return; const head=y>v.y+v.ph-0.32; let dmg=w.dmg*(head?(w.head||1.5):1)*(1+0.1*perkN((Game.byId.get(P.a)||{}).load,'express'));
  Game.emit('hit',{a:P.a,v:v.id,d:Math.round(dmg),h:head?1:0,w:w.id,slow:w.slow||0,kb:w.knock||0,kx:+(P.vx/40).toFixed(2),kz:+(P.vz/40).toFixed(2)});
}
function projHitWorld(P,h){
  P.x=h.x; P.y=h.y; P.z=h.z; const n=hitNormal(h.x+P.vx*0.01,h.y+P.vy*0.01,h.z+P.vz*0.01,{x:P.vx,y:P.vy,z:P.vz});
  switch(P.k){
    case 'rocket': case 'microrocket': if(P.mine) boom(P); P.dead=true; return;
    case 'bolt': case 'shuriken': P.stuck=true; P.vx=P.vy=P.vz=0; P.keep=1; setTimeout(()=>{ P.dead=true; P.keep=0; },6000); if(h.s&&h.s.oid&&P.mine) Game.emit('objdmg',{o:h.s.oid,d:20,a:P.a}); Sfx.play('wooden_02',{x:P.x,y:P.y,z:P.z,vol:0.4,rate:1.4}); return;
    case 'snow': P.dead=true; FX.puff(P.x,P.y,P.z,{size:0.6,life:0.6,color:[0.95,0.97,1],alpha:0.8,grow:2}); return;
    case 'sticky': case 'c4': P.stuck=true; P.stuckT=P.t; P.vx=P.vy=P.vz=0; Sfx.play('slam_01',{x:P.x,y:P.y,z:P.z,vol:0.3,rate:1.8}); return;
    case 'mine': if(n.y>0.6){ P.stuck=true; P.stuckT=P.t; P.vx=P.vy=P.vz=0; P.y=h.y; return; } break;
  }
  /* bounce */
  const dot=P.vx*n.x+P.vy*n.y+P.vz*n.z; P.vx=(P.vx-2*dot*n.x)*0.42; P.vy=(P.vy-2*dot*n.y)*0.42; P.vz=(P.vz-2*dot*n.z)*0.42;
  if(Math.hypot(P.vx,P.vy,P.vz)>2) Sfx.play('metal_04',{x:P.x,y:P.y,z:P.z,vol:0.3,rate:1.5,dist:20});
  if(n.y>0.6&&Math.abs(P.vy)<1.2){ P.vy=0; P.vx*=0.8; P.vz*=0.8; P.y=h.y+0.02; if(Math.hypot(P.vx,P.vz)<0.4){ P.vx=P.vz=0; P.stuck=true; P.stuckT=P.t; } }
}
/* owner: projectile explodes → everyone handles 'boom' */
function boom(P){ if(P.dead) return; P.dead=true; if(!isFinite(P.x)||!isFinite(P.y)||!isFinite(P.z)) return; const def=P.def||(P.k==='microrocket'?{kind:'micro',r:WPN.mrl.splash.r,dmg:WPN.mrl.splash.dmg}:P.k==='rocket'?TH.rocket:TH.frag);
  let dmg=def.dmg||0; if(P.k==='microrocket'){ const dist=Math.hypot(P.x-P.start.x,P.z-P.start.z); dmg=WPN.mrl.splash.dmg*(0.6+Math.min(1,dist/40)*0.8); }
  Game.emit('boom',{id:P.id,a:P.a,k:P.k==='grenade'?'frag':P.k,x:+P.x.toFixed(2),y:+P.y.toFixed(2),z:+P.z.toFixed(2),r:def.r||3,d:Math.round(dmg),w:P.k==='microrocket'?'mrl':P.k}); }
/* all clients */
function onBoom(b){
  const P=Game.projs.find(p=>p.id===b.id); if(P){ P.dead=true; }
  const att=Game.byId.get(b.a); const k=b.k;
  if(k==='smoke'){ FX.smokeCloud(b.x,b.y,b.z,b.r,TH.smoke.life); SMOKES.push({x:b.x,y:b.y+1.4,z:b.z,r:b.r,until:Game.t+TH.smoke.life}); Sfx.play('whoosh',{x:b.x,y:b.y,z:b.z}); return; }
  if(k==='flash'){ FX.flashLight(b.x,b.y+0.5,b.z,'#ffffff',400,0.25,30); FX.sparkle(b.x,b.y+0.3,b.z,[1,1,1],20); Sfx.play('flashbang',{x:b.x,y:b.y,z:b.z,dist:60});
    for(const v of Game.actors){ if(!v.local||!v.alive) continue; const dx=b.x-v.x, dy=b.y-eyeY(v), dz=b.z-v.z, d=Math.hypot(dx,dy,dz); if(d>TH.flash.r) continue; if(!los3(v.x,eyeY(v),v.z,b.x,b.y+0.2,b.z)) continue;
      const ad=aimDir(v), c=(dx*ad.x+dy*ad.y+dz*ad.z)/(d||1); const s=TH.flash.blind*(c>0.3?1:c>-0.2?0.45:0.15)*(1-d/TH.flash.r*0.5); v.blindT=Math.max(v.blindT,s); if(!v.bot) Bus.emit('flashed',s); } return; }
  if(k==='repulse'||k==='implode'){ FX.ring(b.x,b.y+0.5,b.z,k==='repulse'?[0.3,0.8,1]:[0.4,1,0.5],b.r); Sfx.play('whoosh',{x:b.x,y:b.y,z:b.z,rate:k==='repulse'?1.4:0.7});
    const def=TH[k]; for(const v of Game.actors){ if(!v.local||!v.alive) continue; const dx=v.x-b.x, dz=v.z-b.z, d=Math.hypot(dx,dz)||0.1; if(d>def.r) continue; const s=def.force*(1-d/def.r)*(k==='repulse'?1:-1);
      v.kx+=dx/d*s; v.kz+=dz/d*s; v.vy=Math.max(v.vy,k==='repulse'?6:3); v.gr=false; if(att&&isEnemy(att,v)) damage(v,{dmg:def.dmg,from:b.a,w:k,kind:'boom'}); } return; }
  if(k==='stun'){ FX.ring(b.x,b.y+0.3,b.z,[1,0.9,0.3],b.r); Sfx.play('whoosh',{x:b.x,y:b.y,z:b.z});
    for(const v of Game.actors){ if(!v.local||!v.alive) continue; if(Math.hypot(v.x-b.x,v.z-b.z)>b.r) continue; if(!los3(b.x,b.y+0.4,b.z,v.x,v.y+1,v.z)) continue; v.stunT=TH.stun.stun; if(!v.bot) Bus.emit('stunned'); } return; }
  /* explosive */
  FX.explosion(b.x,b.y,b.z,b.r); Sfx.play(Math.random()<0.5?'explosion':'explosion2',{x:b.x,y:b.y,z:b.z,dist:120,vol:1.2});
  Bus.emit('shake',{x:b.x,z:b.z,r:b.r});
  for(const v of Game.actors){ if(!v.local||!v.alive) continue; const cy=v.y+v.ph*0.5, d=Math.hypot(v.x-b.x,cy-b.y,v.z-b.z); if(d>b.r) continue;
    if(!los3(b.x,b.y+0.3,b.z,v.x,cy,v.z)&&!los3(b.x,b.y+0.3,b.z,v.x,v.y+v.ph-0.2,v.z)) continue;
    const f=d<1?1:Math.max(0.15,1-(d-1)/(b.r-1)); damage(v,{dmg:b.d*f,from:b.a,w:b.w,kind:'boom'}); const dd=d||0.1; v.kx+=(v.x-b.x)/dd*6*f; v.kz+=(v.z-b.z)/dd*6*f; }
  if(Game.host) for(const [id,o] of OBJS){ if(!o.alive) continue; const s=o.s, cx=(s.x0+s.x1)/2, cy=(s.y0+s.y1)/2, cz=(s.z0+s.z1)/2; const d=Math.hypot(cx-b.x,cy-b.y,cz-b.z);
    if(d<b.r+1) Game.emit('objdmg',{o:id,d:Math.round(b.d*Math.max(0.3,1-d/(b.r+1))*1.5),a:b.a}); }
  for(const D of Game.deps){ if(D.solid&&Math.hypot(D.x-b.x,D.z-b.z)<b.r+1) Game.emit('objdmg',{o:D.oid,d:Math.round(b.d),a:b.a}); }
}
/* ---------- gadgets ---------- */
function useSpecial(a){
  const L=a.load; if(!L) return; const sp=SP[L.spec]; if(!sp) return;
  if(L.spec==='repair'){ a.tool=!a.tool; if(a.local&&!a.bot) Sfx.play('tools_03',{vol:0.5}); return; }
  if(a.specCd>0) return;
  const f=fwd(a.yaw); let x=a.x+f.x*1.6, z=a.z+f.z*1.6;
  if(L.spec==='wall'){ x=a.x+f.x*2.2; z=a.z+f.z*2.2; if(blockedAt(x,z,a.y,1.6,false,0.8)) { Sfx.play('deny'); return; } }
  a.specCd=sp.cd*Math.pow(0.4,perkN(L,'equip'));
  Game.emit('dep',{id:a.id+'.d'+(PROJ_SEQ++),k:L.spec,a:a.id,t:a.team,x:+x.toFixed(2),y:+groundAt(x,z,a.y+0.5).toFixed(2),z:+z.toFixed(2),yaw:+a.yaw.toFixed(2)});
}
function onDep(d){
  const sp=SP[d.k]; const D={id:d.id,k:d.k,a:d.a,team:d.t,x:d.x,y:d.y,z:d.z,yaw:d.yaw,born:Game.t,life:sp.life||30,charges:sp.charges||0,acc:0,mesh:null,oid:null,solid:null};
  if(d.k==='wall'){ const c=Math.cos(d.yaw), s=Math.sin(d.yaw); const along=Math.abs(c)>Math.abs(s); const hw=1.4, ht=0.22;
    const b=along?{x0:d.x-hw,x1:d.x+hw,z0:d.z-ht,z1:d.z+ht}:{x0:d.x-ht,x1:d.x+ht,z0:d.z-hw,z1:d.z+hw};
    D.solid=addDynSolid(Object.assign(b,{y0:d.y,y1:d.y+1.9,k:'wallDep',destr:true,hp:sp.hp,oid:d.id})); D.oid=d.id; World.addDynObj(D.solid); }
  else { D.mesh=Guns.make(d.k); D.mesh.scale.setScalar(d.k==='trophy'?3:2.4); D.mesh.position.set(d.x,d.y,d.z); D.mesh.rotation.y=d.yaw; R.scene.add(D.mesh);
    const ring=new THREE.Mesh(new THREE.RingGeometry((sp.r||1)-0.08,sp.r||1,48),new THREE.MeshBasicMaterial({color:d.k==='health'?'#5dff8a':d.k==='ammo'?'#ffd34a':'#ff9b3d',transparent:true,opacity:0.35,depthWrite:false}));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.05; D.mesh.add(ring); ring.scale.setScalar(1/D.mesh.scale.x); }
  Sfx.play('switch_02',{x:d.x,y:d.y,z:d.z,vol:0.6}); Game.deps.push(D);
}
function removeDep(D){ D.dead=true; if(D.mesh) R.scene.remove(D.mesh); if(D.solid){ removeDynSolid(D.solid); World.removeDyn(D.oid); OBJS.delete(D.oid); } }
function updateDeps(dt){
  for(const D of Game.deps){ if(D.dead) continue; const owner=Game.byId.get(D.a);
    if(Game.t-D.born>D.life&&owner&&owner.local){ Game.emit('depx',{id:D.id}); continue; }
    D.acc+=dt; const sp=SP[D.k];
    if((D.k==='ammo'||D.k==='health')&&D.acc>=0.5){ D.acc=0;
      for(const v of Game.actors){ if(!v.local||!v.alive||v.team!==D.team&&Game.teamMode||(!Game.teamMode&&v.id!==D.a)) continue; if(Math.hypot(v.x-D.x,v.z-D.z)>sp.r) continue;
        if(D.k==='health'&&v.hp<v.maxHp){ v.hp=Math.min(v.maxHp,v.hp+sp.heal*0.5); }
        if(D.k==='ammo') for(const s of v.slots){ const w=WPN[s.id]; if(w&&w.res&&s.res<w.res*1.5) s.res=Math.min(Math.round(w.res*1.5),s.res+Math.ceil(w.mag*0.25)); } } }
    if(D.k==='trophy'&&owner&&owner.local&&D.charges>0){
      for(const P of Game.projs){ if(P.dead||P.team===D.team&&Game.teamMode) continue; if(!['grenade','frag','rocket','microrocket','sticky','flash','stun','repulse','implode'].includes(P.k)) continue;
        if(Math.hypot(P.x-D.x,P.y-D.y-0.6,P.z-D.z)<sp.r){ D.charges--; Game.emit('zap',{id:P.id,d:D.id,x:+P.x.toFixed(2),y:+P.y.toFixed(2),z:+P.z.toFixed(2)}); if(D.charges<=0) Game.emit('depx',{id:D.id}); break; } } }
  }
  Game.deps=Game.deps.filter(D=>!D.dead);
}
function repairTick(a,dt){ const f=aimDir(a); const r=rayCast(a.x,eyeY(a),a.z,f.x,f.y,f.z,SP.repair.reach);
  let target=r.s&&r.s.oid?r.s.oid:null;
  if(!target){ // look for destroyed objects in front
    for(const [id,o] of OBJS){ if(o.alive) continue; const s=o.s, cx=(s.x0+s.x1)/2, cz=(s.z0+s.z1)/2; if(Math.hypot(cx-a.x,cz-a.z)<SP.repair.reach){ const dx=cx-a.x, dz=cz-a.z, l=Math.hypot(dx,dz)||1; if((dx*f.x+dz*f.z)/l>0.7){ target=id; break; } } } }
  if(!target) return; a.repAcc=(a.repAcc||0)+dt*SP.repair.rate; if(a.repAcc>=10){ Game.emit('objfix',{o:target,d:Math.round(a.repAcc),a:a.id}); a.repAcc=0; FX.sparkle(a.x+f.x*2,eyeY(a)-0.3,a.z+f.z*2,[1,0.8,0.3],4); } }
