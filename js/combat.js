/* combat.js — guns (seeker option / 1:1 gunfight), body/head damage, gun model & effects, 1:1 round flow */
const FIRE_INT=0.4, GUN_RANGE=80, HP_MAX=100, HEAD_H=0.32;
const dmgBody=()=>CFG.dmg, dmgHead=()=>Math.round(CFG.dmg*1.5);
const hasGun=()=>S.game==='duel'||(S.game==='tag'&&S.role==='seeker'&&CFG.gun);
const oppHasGun=()=>S.game==='duel'||(S.game==='tag'&&S.role==='runner'&&CFG.gun);
const reloadLocked=()=>!!(S.gun&&S.gun.rl>0);
function gunReset(){ S.gun={on:hasGun(),ammo:CFG.mag,rl:0,cd:0,kick:0,magOut:false,magIn:false}; updAmmoScreen(true); }
function gunUpdate(dt){
  const g=S.gun; if(!g||!g.on) return;
  g.cd=Math.max(0,g.cd-dt);
  if(g.rl>0){ g.rl-=dt; const p=1-g.rl/CFG.reload;
    if(!g.magOut&&p>0.2){ g.magOut=true; SFX.magOut(); }
    if(!g.magIn&&p>0.7){ g.magIn=true; SFX.magIn(); }
    if(g.rl<=0){ g.rl=0; g.ammo=CFG.mag; SFX.reloadDone(); flash('재장전 완료! 다시 움직일 수 있어요','good',1); } }
  updAmmoScreen();
}
function doReload(){
  const g=S.gun; if(S.phase!=='play'||!g||!g.on||g.rl>0) return;
  if(g.ammo>=CFG.mag){ flash('탄창이 가득 차 있어요','',0.8); return; }
  const me=S.me; me.slideT=0; S.collect=null;
  g.rl=CFG.reload; g.magOut=false; g.magIn=false; SFX.reload(); flash(`재장전 중이에요. ${CFG.reload}초 동안 움직일 수 없어요`,'danger',Math.min(1.8,CFG.reload));
}
function aimDir(){ const me=S.me, cp=Math.cos(me.pitch); return [-Math.sin(me.yaw)*cp,Math.sin(me.pitch),-Math.cos(me.yaw)*cp]; }
function doFire(){
  const g=S.gun; if(S.phase!=='play'||!g||!g.on) return;
  if(g.rl>0){ SFX.bad(); return; } if(g.cd>0) return;
  if(g.ammo<=0){ SFX.empty(); FX.dry=0.12; flash(prefs.ctrl==='kb'?'탄이 없어요. R로 재장전하세요':'탄이 없어요. 재장전 버튼을 누르세요','danger',1.2); return; }
  g.ammo--; g.cd=FIRE_INT; g.kick=1; S.stats.shots++;
  const me=S.me, d=aimDir(), o=[me.x,me.y+me.eye,me.z];
  const wd=rayDist(o[0],o[1],o[2],d[0],d[1],d[2],GUN_RANGE); let t=wd, hit=false, head=false; const op=S.opp;
  if(op.present&&op.hp>0){ const ph=op.slide?PH_SLIDE:PH, tp=rayPlayer(o[0],o[1],o[2],d[0],d[1],d[2],op.x,op.y,op.z,ph,0.5);
    if(tp>=0&&tp<wd){ t=tp; hit=true; head=(o[1]+d[1]*tp)-op.y>=ph-HEAD_H; } }
  const e=[o[0]+d[0]*t,o[1]+d[1]*t,o[2]+d[2]*t];
  addTracer(muzzleWorld(),e,0xfff2a0); fireFx(); SFX.shot(1);
  me.pitch=Math.min(0.9,me.pitch+0.012);
  if(hit){ S.stats.hits++; if(head) S.stats.heads=(S.stats.heads||0)+1; addImpact(e,head?0xff3b30:0xff6a5a,true); hitMarker(head); damageOpp(head?dmgHead():dmgBody(),head); }
  else if(t<GUN_RANGE-0.5) addImpact(e,0xffd9a0,false);
  if(S.mode==='pvp') netGame({t:'shot',e:e.map(v=>+v.toFixed(2)),hit:hit?1:0,hd:head?1:0});
  if(S.mode==='ai') aiOnShot();
  if(g.ammo===0) flash(prefs.ctrl==='kb'?'탄을 다 썼어요. R로 재장전':'탄을 다 썼어요. 재장전 버튼','danger',1.2);
  updAmmoScreen(true);
}
function damageOpp(dmg,head){
  const op=S.opp, tag=head?'헤드샷!':'명중!';
  if(S.mode==='ai'){ AI.hp=Math.max(0,AI.hp-dmg); op.hp=AI.hp; aiOnHit();
    flash(`${tag} 상대 체력 ${op.hp}`,'good',0.8); if(AI.hp<=0&&S.game==='duel') duelRoundOver(true); }
  else { op.hp=Math.max(0,op.hp-dmg); flash(`${tag} 상대 체력 약 ${op.hp}`,'good',0.8); }
}
function damageMe(dmg,fx,fz,head){
  if(S.phase!=='play') return; const me=S.me; me.hp=Math.max(0,me.hp-dmg); (head?SFX.hurtHead:SFX.hurt)();
  const h=$('hurt'); h.style.transition='none'; h.style.opacity=head?'1':'.85'; void h.offsetWidth; h.style.transition='opacity .7s ease-out'; h.style.opacity='0';
  FX.shake=head?0.35:0.22;
  if(fx!=null) S.hurtDir={x:fx,z:fz,t:perfT};
  if(me.hp<=0){
    if(S.game==='duel'){ if(S.mode==='pvp') netGame({t:'dead',r:S.duel.round}); duelRoundOver(false); }
    else endGame('seeker','shot');
  } else flash(head?`머리에 맞았어요! 체력 ${me.hp}`:`맞았어요! 체력 ${me.hp}`,'danger',0.9);
}
/* remote/AI shot coming at me */
function oppShot(e,hit,head){
  const o=S.opp, from=[o.x,o.y+1.45,o.z]; addTracer(from,e,0xff8a6a); if(!hit) addImpact(e,0xffd9a0,false);
  const d=Math.hypot(o.x-S.me.x,o.z-S.me.z); SFX.shot(Math.max(0.15,1-d/70));
  S.shotPing={x:o.x,y:o.y,z:o.z,t:perfT}; oppFlashT=0.07;
  if(hit) damageMe(head?dmgHead():dmgBody(),o.x,o.z,head);
}
/* ---------- 1:1 round flow ---------- */
function duelRoundOver(iWon){
  if(S.phase!=='play') return;
  S.phase='roundover'; S.roundT=2.6; if(iWon) S.duel.me++; else S.duel.opp++; updOrbChip();
  const done=S.duel.me>=S.duel.target||S.duel.opp>=S.duel.target;
  flash(iWon?`처치! ${S.duel.me} : ${S.duel.opp}`:`쓰러졌어요 ${S.duel.me} : ${S.duel.opp}`,iWon?'good':'danger',2.4);
  (iWon?SFX.collect:SFX.bad)(); if(S.gun) S.gun.rl=0;
}
function duelTick(dt){
  if(S.phase!=='roundover') return; S.roundT-=dt; if(S.roundT>0) return;
  if(S.duel.me>=S.duel.target||S.duel.opp>=S.duel.target){ S.phase='play'; endGame(S.duel.me>=S.duel.target?'me':'opp','duel'); return; }
  S.duel.round++; placePlayers(); if(S.mode==='ai') aiReset(); updOrbChip();
  S.phase='countdown'; S.countdown=2.2; flash(`${S.duel.round}라운드`,'',1.2);
}
/* ---------- first-person gun model ---------- */
scene.add(camera);
const FX={shake:0,dry:0,bobT:0,swayX:0,swayY:0,lastYaw:0,lastPitch:0};
const gunView=new THREE.Group(); camera.add(gunView); gunView.position.set(0.24,-0.24,-0.5);
const gunRoot=new THREE.Group(); gunView.add(gunRoot);
const GM={white:MAT({color:'#eef1f3',roughness:.35,metalness:.05}),gray:MAT({color:'#9aa3ab',roughness:.4,metalness:.5}),dark:MAT({color:'#23272d',roughness:.45,metalness:.6}),
  metal:MAT({color:'#5b636b',roughness:.3,metalness:.85}),blue:MAT({color:'#2f6fe8',emissive:'#0a2a7a',roughness:.3,metalness:.3}),glove:MAT({color:'#2a2f36',roughness:.85}),
  sleeve:MAT({color:'#b23a30',roughness:.7}),brass:MAT({color:'#d4a14a',roughness:.3,metalness:.9})};
function gbox(w,h,d,m,x,y,z,p,rx){ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); b.position.set(x,y,z); if(rx) b.rotation.x=rx; (p||gunRoot).add(b); return b; }
function gcyl(r,len,m,x,y,z,p){ const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),m); c.rotation.x=Math.PI/2; c.position.set(x,y,z); (p||gunRoot).add(c); return c; }
gbox(.075,.075,.30,GM.white,0,0,0);                         // receiver
gbox(.07,.03,.32,GM.gray,0,.052,-.01);                       // top cover
gbox(.077,.012,.24,GM.blue,0,.018,-.02);                     // blue accent band
gbox(.03,.012,.2,GM.dark,0,.073,-.02);                       // rail
for(let i=0;i<6;i++) gbox(.034,.008,.012,GM.dark,0,.081,-.1+i*.035);
gbox(.04,.03,.02,GM.dark,0,.085,.12); gbox(.012,.03,.015,GM.dark,0,.084,-.15); // sights
gbox(.08,.06,.12,GM.gray,0,-.005,-.2);                       // handguard
for(let i=0;i<3;i++) gbox(.082,.008,.02,GM.dark,0,.006,-.24+i*.035);
gcyl(.016,.16,GM.dark,0,.02,-.32); gcyl(.025,.05,GM.metal,0,.02,-.41); // barrel + muzzle device
gbox(.002,.025,.06,GM.dark,.039,.03,.02);                    // ejection port
gbox(.05,.06,.09,GM.dark,0,-.005,.19);                       // stock stub
gbox(.06,.16,.075,GM.dark,0,-.1,.09,null,.28);              // grip
gbox(.012,.008,.09,GM.dark,0,-.075,-.005); gbox(.012,.045,.008,GM.dark,0,-.052,-.05); // trigger guard
gbox(.008,.03,.01,GM.metal,0,-.05,.0);                       // trigger
const mag=new THREE.Group(); mag.position.set(0,-.1,-.075); gunRoot.add(mag);
gbox(.05,.15,.06,GM.gray,0,0,0,mag,-.12); gbox(.056,.02,.068,GM.blue,0,-.075,-.009,mag,-.12);
const ammoCv=document.createElement('canvas'); ammoCv.width=64; ammoCv.height=32; const ammoTex=new THREE.CanvasTexture(ammoCv);
ammoTex.encoding=THREE.sRGBEncoding; const ammoPanel=new THREE.Mesh(new THREE.PlaneGeometry(.05,.025),new THREE.MeshBasicMaterial({map:ammoTex,toneMapped:false})); ammoPanel.rotation.y=-Math.PI/2; ammoPanel.position.set(-.039,.012,-.05); gunRoot.add(ammoPanel);
let ammoShown='';
function updAmmoScreen(force){ const g=S.gun; if(!g) return; const s=g.rl>0?'RL':String(g.ammo); if(!force&&s===ammoShown) return; ammoShown=s;
  const x=ammoCv.getContext('2d'); x.fillStyle='#0b1a3a'; x.fillRect(0,0,64,32); x.fillStyle=g.rl>0?'#ffcf5a':g.ammo<=Math.max(1,CFG.mag*0.2)?'#ff6a5a':'#5ff0f5';
  x.font='bold 24px monospace'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(s,32,17); ammoTex.needsUpdate=true; }
gbox(.075,.09,.1,GM.glove,0,-.11,.1,null,.28);               // trigger hand
const sleeve=gbox(.09,.09,.35,GM.sleeve,.03,-.2,.3,null,.55);
gbox(.088,.05,.09,GM.glove,-.008,-.045,-.2);                 // support hand
/* muzzle flash: two crossed star planes + glow */
const starTex=cvTex(64,64,(x)=>{ const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,230,1)'); g.addColorStop(.3,'rgba(255,200,90,.9)'); g.addColorStop(1,'rgba(255,120,30,0)');
  x.fillStyle=g; x.beginPath(); for(let i=0;i<10;i++){ const a=i/10*Math.PI*2, r=i%2?10:32; x.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r); } x.closePath(); x.fill(); });
const flashMat=new THREE.MeshBasicMaterial({map:starTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});
const flashG=new THREE.Group(); flashG.position.set(0,.02,-.46); gunRoot.add(flashG);
const fl1=new THREE.Mesh(new THREE.PlaneGeometry(.22,.22),flashMat), fl2=new THREE.Mesh(new THREE.PlaneGeometry(.12,.3),flashMat); fl2.rotation.y=Math.PI/2; flashG.add(fl1,fl2);
const muzzle=new THREE.Sprite(new THREE.SpriteMaterial({map:HALO,color:0xffd27a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); muzzle.scale.set(.4,.4,1); flashG.add(muzzle);
flashG.visible=false; let muzzleT=0; gunView.visible=false;
function fireFx(){ flashG.visible=true; muzzleT=0.05; flashG.rotation.z=Math.random()*Math.PI; const s=.8+Math.random()*.5; flashG.scale.set(s,s,s); ejectShell(); }
function muzzleWorld(){ const v=new THREE.Vector3(0,.02,-.46); gunRoot.localToWorld(v); return [v.x,v.y,v.z]; }
/* shells */
const shellGeo=new THREE.CylinderGeometry(.006,.006,.022,6), shells=[];
function ejectShell(){
  const p=new THREE.Vector3(.04,.03,.02); gunRoot.localToWorld(p);
  const r=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion), u=new THREE.Vector3(0,1,0);
  const m=new THREE.Mesh(shellGeo,GM.brass); m.position.copy(p); scene.add(m);
  const v=r.multiplyScalar(1.6+Math.random()).add(u.multiplyScalar(1.8+Math.random()*.8));
  shells.push({m,v,t:1.4,floor:S.me.y+0.012,spin:new THREE.Vector3(Math.random()*20,Math.random()*20,0)});
  if(shells.length>14){ const s=shells.shift(); scene.remove(s.m); }
}
/* tracers (thin glowing beams) and impacts */
const tracers=[], tracerGeo=new THREE.CylinderGeometry(.012,.012,1,6,1,true), UPV=new THREE.Vector3(0,1,0);
function addTracer(a,b,color){
  const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), dir=B.clone().sub(A), len=dir.length(); if(len<0.05) return;
  const m=new THREE.Mesh(tracerGeo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  m.position.copy(A).addScaledVector(dir,.5); m.scale.set(1,len,1); m.quaternion.setFromUnitVectors(UPV,dir.normalize()); scene.add(m); tracers.push({m,t:0.12,max:0.12});
}
const impacts=[];
function addImpact(e,color,flesh){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:HALO,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  sp.position.set(...e); sp.scale.set(.2,.2,1); scene.add(sp); impacts.push({sp,t:flesh?0.22:0.3,max:flesh?0.22:0.3,grow:flesh?2.5:1.6}); }
function clearTracers(){ for(const arr of [tracers,impacts]) while(arr.length){ const t=arr.pop(), o=t.m||t.sp; scene.remove(o); o.material.dispose(); }
  while(shells.length){ scene.remove(shells.pop().m); } }
let oppFlashT=0;
const oppFlash=new THREE.Sprite(new THREE.SpriteMaterial({map:HALO,color:0xffd27a,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})); oppFlash.scale.set(.7,.7,1); oppFlash.visible=false; scene.add(oppFlash);
const smooth=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
function combatVisuals(dt){
  for(let i=tracers.length-1;i>=0;i--){ const t=tracers[i]; t.t-=dt; t.m.material.opacity=Math.max(0,t.t/t.max)*.9; if(t.t<=0){ scene.remove(t.m); t.m.material.dispose(); tracers.splice(i,1); } }
  for(let i=impacts.length-1;i>=0;i--){ const t=impacts[i]; t.t-=dt; const k=1-t.t/t.max; t.sp.scale.setScalar(.2+k*t.grow*.3); t.sp.material.opacity=1-k; if(t.t<=0){ scene.remove(t.sp); t.sp.material.dispose(); impacts.splice(i,1); } }
  for(let i=shells.length-1;i>=0;i--){ const s=shells[i]; s.t-=dt;
    if(s.m.position.y>s.floor){ s.v.y-=14*dt; s.m.position.addScaledVector(s.v,dt); s.m.rotation.x+=s.spin.x*dt; s.m.rotation.y+=s.spin.y*dt; if(s.m.position.y<s.floor){ s.m.position.y=s.floor; s.m.rotation.set(Math.PI/2,s.m.rotation.y,0); } }
    if(s.t<=0){ scene.remove(s.m); shells.splice(i,1); } }
  if(muzzleT>0){ muzzleT-=dt; if(muzzleT<=0) flashG.visible=false; }
  if(oppFlashT>0){ oppFlashT-=dt; const o=S.opp; oppFlash.visible=true; oppFlash.position.set(o.x-Math.sin(o.yaw)*.6,o.y+1.4,o.z-Math.cos(o.yaw)*.6); } else oppFlash.visible=false;
  const g=S.gun, me=S.me; gunView.visible=!!(g&&g.on)&&(S.phase==='play'||S.phase==='countdown'||S.phase==='roundover');
  if(!g||!gunView.visible) return;
  setCol(sleeve.material.color,S.game==='duel'?'#2f5fd0':'#b23a30');
  g.kick=Math.max(0,g.kick-dt*7); FX.dry=Math.max(0,FX.dry-dt);
  // sway: the gun lags behind quick turns
  let dy=me.yaw-FX.lastYaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); const dp=me.pitch-FX.lastPitch; FX.lastYaw=me.yaw; FX.lastPitch=me.pitch;
  FX.swayX+=(Math.max(-.05,Math.min(.05,dy*0.9))-FX.swayX)*Math.min(1,dt*10); FX.swayY+=(Math.max(-.04,Math.min(.04,-dp*0.9))-FX.swayY)*Math.min(1,dt*10);
  const moving=me.moving&&me.gr&&S.phase==='play'&&!reloadLocked(); FX.bobT+=dt*(moving?(me.quiet?6:10):0);
  const bx=moving?Math.sin(FX.bobT)*.009:0, by=moving?Math.abs(Math.cos(FX.bobT))*.011:Math.sin(perfT*1.6)*.002;
  // reload motion: lower+tilt, magazine out, new magazine in, raise
  let low=0, magOff=0, magVis=true;
  if(g.rl>0){ const p=1-g.rl/CFG.reload; low=smooth(0,.15,p)*(1-smooth(.82,1,p));
    const out=smooth(.15,.35,p), inn=smooth(.5,.78,p); magOff=p<.5?-.32*out:-.32*(1-inn); magVis=!(p>.35&&p<.5); }
  mag.position.y=-.1+magOff; mag.visible=magVis;
  gunRoot.position.set(bx+FX.swayX,by+FX.swayY-low*.07-FX.dry*.05,g.kick*.06);
  gunRoot.rotation.set(g.kick*.2-low*.35+FX.dry*.4,FX.swayX*1.5,low*.55);
}
/* subtle camera shake when hit (applied after the camera is placed each frame) */
function applyShake(dt){ if(FX.shake<=0) return; FX.shake=Math.max(0,FX.shake-dt); const s=FX.shake;
  camera.rotation.z+=(Math.random()-.5)*s*.12; camera.rotation.x+=(Math.random()-.5)*s*.05; }
function hitMarker(head){ SFX[head?'headshot':'hit'](); const c=$('cross'); c.classList.remove('hit','head'); void c.offsetWidth; c.classList.add(head?'head':'hit'); clearTimeout(hitMarker.t); hitMarker.t=setTimeout(()=>c.classList.remove('hit','head'),260); }
/* gun in the opponent's hand */
const oppGun=new THREE.Group(); oppGun.position.set(0,-.6,0);
(function(){ const add=(geo,m,x,y,z)=>{ const b=new THREE.Mesh(geo,m); b.position.set(x,y,z); b.castShadow=GQ.shadow>0; oppGun.add(b); };
  add(new THREE.BoxGeometry(.08,.36,.09),GM.white,0,-.08,0); add(new THREE.BoxGeometry(.082,.28,.016),GM.blue,0,-.08,-.046);
  add(new THREE.CylinderGeometry(.016,.016,.18,8),GM.dark,0,-.34,0); add(new THREE.BoxGeometry(.06,.07,.13),GM.dark,0,.04,.08); add(new THREE.BoxGeometry(.045,.05,.13),GM.gray,0,-.13,.07); })();
function setOppGun(on){ if(oppGun.parent) oppGun.parent.remove(oppGun); const om=oppModel();
  runnerModel.userData.armedPose=false; seekerModel.userData.armedPose=false; if(on){ om.userData.arms[1].add(oppGun); om.userData.armedPose=true; } }
