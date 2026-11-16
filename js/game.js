/* game.js — a match session: actors, main loop, events (local + network), camera & first-person view model. */
'use strict';
const Game={active:false,kind:'battle',mode:'tdm',mapId:'fortress',cfg:{},actors:[],byId:new Map(),me:null,host:true,online:false,myId:null,
  t:0,state:'pre',stateT:0,projs:[],deps:[],teamMode:true,freeze:false,paused:false,spectate:null,result:null,seed:1};
(()=>{
  let raf=0, last=0, sendAcc=0, fpsAcc=0, fpsN=0, vm=null, vmId=null, shake=0, bob=0, swayX=0, swayY=0, lastI=NOINTENT, chatOpen=false, frameN=0;
  const fovBase=()=>prefs.fov||78;
  /* ---------- start / stop ---------- */
  Game.start=async function(S){
    Game.stop(true);
    Object.assign(Game,{active:true,kind:S.kind,mode:S.kind==='tag'?'tag':S.mode,mapId:S.map,cfg:Object.assign({},S.cfg||{}),host:!!S.host,online:!!S.online,myId:S.myId,seed:S.seed||1,
      t:0,state:'loading',stateT:0,projs:[],deps:[],actors:[],byId:new Map(),me:null,freeze:true,paused:false,spectate:null,result:null,round:0});
    Game.teamMode=S.kind==='tag'?false:!!BMODES[S.mode].team;
    UI.showLoading(true,'맵 불러오는 중…');
    const def=SandTag.maps[S.map]; setMapData(def,{mode:Game.mode}); SMOKES.length=0;
    const th=THEMES[def.theme]; await R.setTheme(th); await World.build(def,th); FX.init(); await Avatars.init();
    for(let i=0;i<120&&Assets.done<Assets.pending;i++){ UI.showLoading(true,`질감 불러오는 중… ${Assets.done}/${Assets.pending}`); await new Promise(r=>setTimeout(r,100)); }
    /* actors */
    for(const p of S.players){ const a=newActor({id:p.id,name:p.name,bot:!!p.bot,owner:p.owner,team:p.team||0,load:p.load||null,pref:p.pref||null,diff:p.diff||Game.cfg.diff||'normal',color:p.color});
      a.local=p.owner===Game.myId; Game.actors.push(a); Game.byId.set(a.id,a); if(a.id===S.meId) Game.me=a; }
    if(Game.kind==='tag') Tag.init(S); else Modes.init(S);
    for(const a of Game.actors){ a.color=colorOf(a); if(a!==Game.me){ a.av=Avatars.create({color:a.color,name:a.name,tagColor:tagColorOf(a)}); R.scene.add(a.av.root); a.av.root.visible=false; } }
    for(const a of Game.actors) if(a.local) spawn(a,true);
    UI.showLoading(false); UI.show('game'); HUD.start(); Sfx.ambience(def.theme);
    Game.state='pre'; Game.stateT=3; Game.freeze=true; Input.setEnabled(true); if(!isTouch) Input.requestLock();
    last=performance.now(); if(!Game._noLoop) raf=requestAnimationFrame(loop);
  };
  Game.stop=function(silent){ cancelAnimationFrame(raf); if(!Game.active) return; Game.active=false; Input.setEnabled(false); Input.exitLock(); Sfx.stopAmbience();
    for(const a of Game.actors) if(a.av) a.av.dispose(); for(const P of Game.projs) if(P.mesh) R.scene.remove(P.mesh); for(const D of Game.deps) if(D.mesh) R.scene.remove(D.mesh);
    if(vm){ R.vmCam.remove(vm.group); vm=null; vmId=null; } if(Game.kind==='tag') Tag.cleanup(); else Modes.cleanup(); FX.clear(); HUD.stop(); };
  function colorOf(a){ if(Game.kind==='tag') return a.role==='seek'?'#ff4d3d':'#3d8bff'; return Game.teamMode?TEAM_COLORS[a.team]:FFA_COLORS[Game.actors.indexOf(a)%FFA_COLORS.length]; }
  function tagColorOf(a){ if(!Game.me) return '#fff'; if(Game.kind==='tag') return a.role==='seek'?'#ff8a7a':'#9cc8ff'; return isEnemy(Game.me,a)?'#ff8a7a':'#9cc8ff'; }
  Game.colorOf=colorOf;
  /* ---------- spawn ---------- */
  function spawn(a,first){
    const p=Game.spawnPoint(a); a.x=p.x; a.y=p.y||0; a.z=p.z; a.yaw=p.yaw!=null?p.yaw:0; a.pitch=0; a.vx=a.vz=a.vy=0; a.kx=a.kz=0; a.gr=true; a.ph=PH; a.slideT=0;
    a.alive=true; a.hp=100; a.maxHp=100; a.dmgBy={}; a.spawnProt=Game.kind==='battle'?1.6:0; a.slowT=a.stunT=a.blindT=0; a.jailed=false; a.carry=null; a.regenNow=false; a.recoilP=0;
    if(Game.kind==='battle') applyPerksOnSpawn(a); equip(a);
    Game.emit('spawn',{a:a.id,x:+a.x.toFixed(2),y:+a.y.toFixed(2),z:+a.z.toFixed(2),yaw:+a.yaw.toFixed(2),w:a.slots[a.cur]?a.slots[a.cur].id:null,hp:a.maxHp});
  }
  Game.spawn=spawn;
  Game.spawnPoint=a=>Game.kind==='tag'?Tag.spawnPoint(a):Modes.spawnPoint(a);
  Game.respawnDelay=v=>Game.kind==='tag'?0:Modes.respawnDelay(v);
  Game.doorOpenFor=a=>Game.kind==='tag'&&Tag.doorOpenFor(a);
  Game.onDeath=(v,k,d)=>{ if(Game.kind==='tag') Tag.onDeath(v,k,d); else Modes.onDeath(v,k,d); };
  /* ---------- events ---------- */
  Game.emit=function(t,d){ if(Game.online&&Net.connected) Net.send(t,d); Game.handle(t,d,Game.myId); };
  Game.handle=function(t,d,from){
    try{
      switch(t){
        case 'state': netState(d); break;
        case 'shot': onShot(d); break;
        case 'hit': onHit(d); break;
        case 'die': onDie(d); break;
        case 'spawn': onSpawn(d); break;
        case 'act': onAct(d); break;
        case 'proj': onProj(d); break;
        case 'boom': onBoom(d); break;
        case 'det': { const P=Game.projs.find(p=>p.id===d.id); if(P&&P.mine) boom(P); break; }
        case 'zap': { const P=Game.projs.find(p=>p.id===d.id); if(P) P.dead=true; FX.sparkle(d.x,d.y,d.z,[1,0.6,0.2],14); Sfx.play('switch_02',{x:d.x,y:d.y,z:d.z,rate:2}); break; }
        case 'dep': onDep(d); break;
        case 'depx': { const D=Game.deps.find(x=>x.id===d.id); if(D) removeDep(D); break; }
        case 'objdmg': onObjDmg(d); break;
        case 'objbrk': onObjBreak(d); break;
        case 'objfix': onObjFix(d); break;
        case 'fx': if(d.t==='block'){ FX.sparkle(d.x,d.y,d.z,[1,0.9,0.5],6); Sfx.play('metal_09',{x:d.x,y:d.y,z:d.z,vol:0.5}); } break;
        case 'chat': Bus.emit('chat',d); break;
        case 'emote': { const a=Game.byId.get(d.a); if(a) a.emote=Game.t+4; break; }
        case 'takeover': { if(d.a===Game.myId&&from!==Game.myId){ Bus.emit('kicked','연결이 오래 끊겨서 봇이 자리를 이어받았어요'); break; } const a=Game.byId.get(d.a); if(a){ a.bot=true; a.owner=from; a.local=from===Game.myId; a.name=a.name+' (봇)'; } break; }
        default: if(Game.kind==='tag') Tag.handle(t,d,from); else Modes.handle(t,d,from);
      }
    }catch(e){ console.error('event',t,e); }
  };
  function onShot(d){ const a=Game.byId.get(d.a); const w=WPN[d.w]; if(!w) return;
    const local=a&&a.local&&!a.bot; let o=d.o;
    if(local&&vm&&vm.gun){ const p=new THREE.Vector3().copy(vm.gun.userData.muzzle); vm.gun.localToWorld(p); /* vm space → world approx */ }
    if(!local){ if(a&&a.av){ a.av.play('Pistol_Shoot',1.6); } Sfx.play(w.snd,{x:o[0],y:o[1],z:o[2],rate:w.sndRate,dist:w.silent?25:(perkN(a&&a.load,'ghost')?60:130),vol:perkN(a&&a.load,'ghost')?0.6:1}); FX.muzzle(o[0],o[1],o[2],0,0,0,w.cat==='sg'||w.cat==='sr'); }
    else { Sfx.play(w.snd,{rate:w.sndRate,vol:perkN(a.load,'ghost')?0.6:0.9}); if(w.smokePuff) FX.puff(o[0],o[1],o[2],{size:1.2,life:2,alpha:0.5,grow:3});
      if(a&&w.cat!=='sg'&&!w.proj&&w.id!=='revolver'){ const r={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)}, f=fwd(a.yaw); FX.casing(a.x+r.x*0.25+f.x*0.35,eyeY(a)-0.18,a.z+r.z*0.25+f.z*0.35,r.x*rand(2,3)+a.vx,rand(2,3.5),r.z*rand(2,3)+a.vz,w.cat==='sr'); } }
    for(const e of d.e){ const dx=e[0]-o[0], dy=e[1]-o[1], dz=e[2]-o[2], L=Math.hypot(dx,dy,dz)||1;
      if(w.pellets===1||Math.random()<0.35) FX.tracer(o[0]+dx/L*(local?1.2:0.3),o[1]+dy/L*(local?1.2:0.3),o[2]+dz/L*(local?1.2:0.3),e[0],e[1],e[2]);
      if(e[3]===1||e[3]===2||e[3]===3){ const n=hitNormal(e[0],e[1],e[2],{x:dx/L,y:dy/L,z:dz/L}); FX.impact(e[0]+n.x*0.02,e[1]+n.y*0.02,e[2]+n.z*0.02,n.x,n.y,n.z,e[3]===3?'metal':e[3]===2?'wood':e[1]<0.05?'sand':'concrete');
        if(Math.random()<0.3) Sfx.play(e[3]===3?'metal_04':'hit_0'+(1+((Math.random()*3)|0)),{x:e[0],y:e[1],z:e[2],vol:0.25,dist:25,rate:rand(1.2,1.6)}); }
      if(a&&!local&&Math.random()<0.5){ /* whiz near me */ const me=Game.me; if(me&&me.alive){ const t=((me.x-o[0])*dx+(eyeY(me)-o[1])*dy+(me.z-o[2])*dz)/(L*L); if(t>0&&t<1){ const px=o[0]+dx*t-me.x, pz=o[2]+dz*t-me.z; if(Math.hypot(px,pz)<2) Sfx.play('whoosh',{vol:0.25,rate:2.2}); } } } }
    if(a&&!local&&Game.me&&isEnemy(Game.me,a)) a.revealT=perkN(a.load,'ghost')?a.revealT:Game.t+1.6;
  }
  function onHit(d){ const v=Game.byId.get(d.v), a=Game.byId.get(d.a); if(!v) return;
    if(v.local&&v.alive){ const before=v.hp; const got=damage(v,{dmg:d.d,from:d.a,w:d.w,head:!!d.h});
      if(d.slow){ v.slowT=1.6; v.slowF=d.slow; } if(d.kb&&a){ const dx=v.x-a.x, dz=v.z-a.z, l=Math.hypot(dx,dz)||1; v.kx+=dx/l*d.kb; v.kz+=dz/l*d.kb; v.vy=Math.max(v.vy,2.5); v.gr=false; }
      if(d.kx){ v.kx+=d.kx*3; v.kz+=d.kz*3; } }
    if(a&&a.local&&!a.bot&&d.d>0) Bus.emit('hitmark',{head:!!d.h,kill:false,v});
    if(Game.kind==='battle'||Game.cfg.seekerGun){ const dx=v.x-(a?a.x:v.x), dz=v.z-(a?a.z:v.z), l=Math.hypot(dx,dz)||1; FX.blood(v.x,v.y+(d.h?v.ph-0.15:1.1),v.z,dx/l,dz/l,d.h?10:6); }
    if(v.av&&!v.local) v.av.play('Hit_Chest',2);
    if(d.m) Sfx.play(WPN[d.w]&&WPN[d.w].shield?'slam_01':'hit_0'+(1+((Math.random()*3)|0)),{x:v.x,y:v.y+1,z:v.z,vol:0.7});
  }
  function onSpawn(d){ const a=Game.byId.get(d.a); if(!a) return; if(!a.local){ a.x=d.x; a.y=d.y; a.z=d.z; a.yaw=d.yaw; a.alive=true; a.hp=d.hp||100; a.maxHp=d.hp||100; a.jailed=false; a.net={x:d.x,y:d.y,z:d.z,yaw:d.yaw,pitch:0,f:1,w:d.w,t:Game.t}; }
    if(a.av){ a.av.revive(); a.av.root.visible=true; a.av.setGun(d.w&&Game.kind==='battle'?d.w:(d.w==='tagpistol'?'p1912':null)); } }
  function onAct(d){ const a=Game.byId.get(d.a); if(!a) return; if(d.t==='sw'&&!a.local){ if(a.av) a.av.setGun(d.w==='tagpistol'?'p1912':d.w); a.curW=d.w; }
    if(!a.av||a.local) return; if(d.t==='reload') a.av.play('Pistol_Reload',1.2); if(d.t==='melee') a.av.play('Sword_Attack',1.6); if(d.t==='throw') a.av.play('Punch_Cross',1.3); }
  function onObjDmg(d){ const o=OBJS.get(d.o); if(!o||!o.alive) return; o.hp-=d.d; if(o.hp<=0&&Game.host){ Game.emit('objbrk',{o:d.o,a:d.a}); } }
  function onObjBreak(d){ const o=OBJS.get(d.o); if(!o||!o.alive) return; o.alive=false; o.hp=0; o.s.alive=false;
    const dep=Game.deps.find(D=>D.oid===d.o); if(dep){ removeDep(dep); return; }
    World.breakObj(d.o); Sfx.play(o.kind==='crate'?'wooden_02':'metal_09',{x:(o.s.x0+o.s.x1)/2,y:o.s.y0+0.5,z:(o.s.z0+o.s.z1)/2,vol:0.8});
    if(o.explosive&&Game.host){ const s=o.s; Game.emit('boom',{id:'obj'+d.o,a:d.a||'world',k:'frag',x:(s.x0+s.x1)/2,y:s.y0+0.6,z:(s.z0+s.z1)/2,r:5,d:95,w:'barrel'}); } }
  function onObjFix(d){ const o=OBJS.get(d.o); if(!o) return; if(o.alive){ o.hp=Math.min(o.max,o.hp+d.d); return; } o.hp=Math.min(o.max,o.hp+d.d);
    if(o.hp>=o.max*0.5){ /* don't restore onto a player */ const s=o.s; if(Game.actors.some(a=>a.alive&&a.x+RAD>s.x0&&a.x-RAD<s.x1&&a.z+RAD>s.z0&&a.z-RAD<s.z1&&a.y<s.y1&&a.y+a.ph>s.y0)) return;
      o.alive=true; s.alive=true; World.restoreObj(d.o); } }
  /* ---------- network state ---------- */
  function packState(a){ const s=curSlot(a); let f=(a.alive?1:0)|(a.crouch?2:0)|(a.slideT>0?4:0)|(a.ads?8:0)|(a.gr?16:0)|(a.jailed?32:0)|(a.escaped?64:0)|(a.climbing?128:0)|(a.emote>Game.t?256:0)|(a.tool?512:0);
    return [a.id,+a.x.toFixed(2),+a.y.toFixed(2),+a.z.toFixed(2),+a.yaw.toFixed(3),+a.pitch.toFixed(3),f,s?s.id:'',Math.round(a.hp),a.revealT>Game.t?1:0]; }
  function netState(d){ for(const s of d.s){ const a=Game.byId.get(s[0]); if(!a||a.local) continue;
      a.net={x:s[1],y:s[2],z:s[3],yaw:s[4],pitch:s[5],f:s[6],w:s[7],t:Game.t}; a.hp=s[8]; if(s[9]) a.revealT=Game.t+1.6;
      const al=!!(s[6]&1); if(al&&!a.alive&&a.deadT>0.5){ a.alive=true; if(a.av) a.av.revive(); }
      a.jailed=!!(s[6]&32); a.escaped=!!(s[6]&64);
      if(a.av&&s[7]!==a.curW){ a.curW=s[7]; a.av.setGun(s[7]==='tagpistol'?'p1912':s[7]||null); } } }
  function sendStates(){ const own=Game.actors.filter(a=>a.local); if(!own.length) return; Net.send('state',{s:own.map(packState)},true); }
  function interpRemote(a,dt){ const n=a.net; if(!n) return; const k=Math.min(1,dt*14);
    if(Math.hypot(n.x-a.x,n.z-a.z)>6){ a.x=n.x; a.y=n.y; a.z=n.z; } else { a.x+=(n.x-a.x)*k; a.y+=(n.y-a.y)*k; a.z+=(n.z-a.z)*k; }
    a.yaw+=angDiff(a.yaw,n.yaw)*k; a.pitch+=(n.pitch-a.pitch)*k; a.crouch=!!(n.f&2); a.slideT=n.f&4?0.3:0; a.ads=!!(n.f&8); a.gr=!!(n.f&16); a.ph=a.slideT>0?PH_SLIDE:a.crouch?CROUCH_H:PH; a.emote=n.f&256?Game.t+1:0; }
  /* ---------- main loop ---------- */
  function loop(now){
    raf=requestAnimationFrame(loop); let dt=Math.min(0.05,(now-last)/1000); last=now; if(!Game.active) return; step(dt,true); }
  Game._step=(dt,render)=>step(dt,render);
  Game._noLoop=false;
  function step(dt,render){ frameN++;
    fpsAcc+=dt; fpsN++; if(fpsAcc>0.5){ Bus.emit('fps',Math.round(fpsN/fpsAcc)); fpsAcc=0; fpsN=0; }
    Game.t+=dt;
    if(Game.state==='pre'){ Game.stateT-=dt; Game.freeze=true; if(Game.stateT<=0){ Game.state='live'; Game.freeze=false; Sfx.play('beep'); Bus.emit('go'); } }
    const me=Game.me; let I=NOINTENT;
    if(!Game.paused&&!chatOpen&&!UI.overlayOpen()) I=Input.sample(); else Input.sample();
    lastI=I;
    if(me&&!me.bot){ applyLook(me,I,dt);
      if(me.alive){ moveActor(me,I,dt); if(Game.state!=='end'&&!Game.freeze){ weaponUpdate(me,I,dt); } else if(Game.freeze&&me.recoilP>0){ me.recoilP=0; } }
      if(I.emote) Game.emit('emote',{a:me.id});
      if(I.chat&&!isTouch) UI.openChat(); }
    for(const a of Game.actors){
      if(!isFinite(a.yaw)) a.yaw=0; if(!isFinite(a.pitch)) a.pitch=0; if(!isFinite(a.x)||!isFinite(a.z)||!isFinite(a.y)){ const p=Game.spawnPoint(a); a.x=p.x; a.y=p.y||0; a.z=p.z; a.vx=a.vz=a.vy=0; }
      if(!isFinite(a.hp)) a.hp=a.maxHp||100;
      if(a.local){ a.spawnProt-=dt; if(a.slowT>0) a.slowT-=dt; if(a.stunT>0) a.stunT-=dt; if(a.blindT>0) a.blindT-=dt; regen(a,dt);
        if(!a.alive){ a.deadT+=dt; if(Game.state==='live'&&a.respawnAt>0&&Game.t>=a.respawnAt&&(Game.kind==='tag'||Modes.canRespawn(a))){ a.respawnAt=0; spawn(a); } } }
      else { interpRemote(a,dt); if(!a.alive) a.deadT+=dt; }
    }
    const P=Game._prof, T0=P?performance.now():0;
    if((Game.host||window.__forceBots)&&!Game.paused) Bots.update(dt);
    const T1=P?performance.now():0;
    updateProjs(dt); updateDeps(dt);
    for(let i=SMOKES.length-1;i>=0;i--) if(SMOKES[i].until<Game.t) SMOKES.splice(i,1);
    if(Game.kind==='tag') Tag.update(dt,I); else Modes.update(dt,I);
    const T2=P?performance.now():0;
    if(Game.online){ sendAcc+=dt; if(sendAcc>=0.085){ sendAcc=0; sendStates(); } }
    updateCamera(me,dt,I); updateAvatars(dt); updateViewmodel(me,dt,I);
    const T3=P?performance.now():0;
    World.update(dt,Game.t); FX.update(dt);
    const T4=P?performance.now():0;
    Sfx.listener(R.camera.position.x,R.camera.position.y,R.camera.position.z,R.camera.rotation.y);
    HUD.update(dt);
    const T5=P?performance.now():0;
    if(render) R.render();
    if(P){ P.bots+=T1-T0; P.mode+=T2-T1; P.avatars+=T3-T2; P.fx+=T4-T3; P.hud+=T5-T4; P.n++; }
  }
  function applyLook(me,I,dt){ if(!me.alive&&!me.jailed) return; const w=curW(me); const z=me.ads&&w?lerp(1,w.zoom,me.adsT):1; const st=me.stunT>0?0.45:1;
    me.yaw-=I.lookX*z*st; me.pitch=clamp(me.pitch-I.lookY*z*st,-1.45,1.45); swayX+=I.lookX*0.6; swayY+=I.lookY*0.6; }
  Bus.on('shake',e=>{ const me=Game.me; if(!me) return; const d=Math.hypot(e.x-me.x,e.z-me.z); shake=Math.max(shake,Math.max(0,1-d/(e.r*4))*0.6); });
  Bus.on('hurt',e=>{ shake=Math.max(shake,0.12); });
  /* ---------- camera ---------- */
  function updateCamera(me,dt,I){
    const cam=R.camera; if(!me){ return; }
    let tx,ty,tz,yaw,pitch; const w=curW(me);
    if(me.alive||me.jailed){ tx=me.x; ty=eyeY(me); tz=me.z; yaw=me.yaw; pitch=me.pitch;
      const sp=Math.hypot(me.vx,me.vz); if(me.gr&&sp>0.5&&me.slideT<=0) bob+=dt*sp*1.25; ty+=Math.sin(bob*2)*0.035*Math.min(1,sp/6)*(1-me.adsT*0.8);
      if(me.slideT>0) cam.rotation.z=lerp(cam.rotation.z,0.06,dt*8); else cam.rotation.z=lerp(cam.rotation.z,0,dt*8);
    } else if(me.escaped||(Game.mode==='snd'&&me.deadT>3)){ // spectate a teammate
      const list=Game.actors.filter(a=>a!==me&&a.alive&&!a.escaped&&(Game.kind==='tag'?a.role===me.role:!isEnemy(me,a)));
      const sp=list[Math.floor(Game.t/8)%Math.max(1,list.length)];
      if(sp){ const f=fwd(sp.yaw); tx=sp.x-f.x*3.2; tz=sp.z-f.z*3.2; ty=sp.y+2.4; yaw=sp.yaw; pitch=-0.25; Game.spectate=sp; } else { tx=me.x; ty=me.y+3; tz=me.z; yaw=me.yaw; pitch=-0.3; }
    } else { // death cam: look at killer from above own body
      const k=Game.byId.get(me.lastAttacker); const r=4+Math.min(2,me.deadT); tx=me.x; ty=me.y+2.6; tz=me.z;
      yaw=me.yaw; pitch=-0.35; if(k&&k!==me){ yaw=Math.atan2(-(k.x-me.x),-(k.z-me.z)); pitch=Math.atan2(k.y+1-ty,Math.hypot(k.x-me.x,k.z-me.z)); }
      const f=fwd(yaw); tx-=f.x*r*0.6; tz-=f.z*r*0.6; }
    if(shake>0){ shake=Math.max(0,shake-dt*1.6); tx+=(Math.random()-0.5)*shake*0.25; ty+=(Math.random()-0.5)*shake*0.25; pitch+=(Math.random()-0.5)*shake*0.04; }
    cam.position.set(tx,ty,tz); cam.rotation.y=yaw; cam.rotation.x=pitch;
    const zoom=me.ads&&w?lerp(1,w.zoom,me.adsT):1; const tf=fovBase()*zoom*(me.slideT>0?1.06:1);
    if(Math.abs(cam.fov-tf)>0.05){ cam.fov=lerp(cam.fov,tf,Math.min(1,dt*14)); cam.updateProjectionMatrix(); }
  }
  /* ---------- third-person avatars ---------- */
  function updateAvatars(dt){ const me=Game.me; const cp=R.camera.position;
    for(const a of Game.actors){ if(!a.av) continue; const A=a.av;
      const dist=Math.hypot(a.x-cp.x,a.z-cp.z); const skip=dist>70?5:dist>35?2:0; a.avAcc=(a.avAcc||0)+dt; a.avN=(a.avN||0)+1;
      let vis=a.alive||a.deadT<4; if(a.escaped) vis=false;
      if(Game.kind==='tag'&&me&&me.role==='seek'&&a.role==='run'&&a.alive) vis=vis&&Tag.seekerSees(me,a);
      A.root.visible=vis; if(!vis) continue;
      A.root.position.set(a.x,a.y,a.z); A.root.rotation.y=a.yaw;
      const sp=a.local?a.speedNow:(a.net?Math.min(9,Math.hypot(a.net.x-a.x,a.net.z-a.z)*14):0);
      if(skip&&a.avN%(skip+1)!==0) continue; const adt=a.avAcc; a.avAcc=0;
      A.update(adt,{speed:a.local?a.speedNow:a.speedSm=(lerp(a.speedSm||0,sp,Math.min(1,dt*6))),crouch:a.crouch,air:!a.gr&&!a.climbing,slide:a.slideT>0,armed:!!(A.gunId),pitch:a.pitch,dance:a.emote>Game.t});
      if(A.tag){ A.tag.visible=a.alive&&(Game.kind==='battle'?(!isEnemy(me,a)||Math.hypot(a.x-R.camera.position.x,a.z-R.camera.position.z)<18):true); }
    } }
  /* ---------- first-person view model ---------- */
  function updateViewmodel(me,dt,I){
    if(!me) return; let id=null; const s=curSlot(me);
    if(me.alive&&!Game.paused){ if(me.tool) id='repair'; else if(me.carry==='drive') id='knife'; else if(s) id=s.id; }
    if(Game.kind==='tag'&&!(me.role==='seek'&&Game.cfg.seekerGun)) id=null;
    if(id!==vmId){ if(vm){ R.vmCam.remove(vm.group); } vm=id?Guns.viewmodel(id):null; vmId=id; if(vm){ R.vmCam.add(vm.group); vm.flash=makeFlash(); vm.gun.add(vm.flash); vm.flash.position.copy(vm.gun.userData.muzzle||new THREE.Vector3(0,0.05,-0.5)); } }
    if(!vm) return; const w=WPN[id]||{}; const u=vm.gun.userData; const g=vm.group;
    const scoped=u.scope&&me.adsT>0.85; g.visible=!scoped&&!Game.spectate;
    swayX*=Math.max(0,1-dt*10); swayY*=Math.max(0,1-dt*10);
    const ads=me.adsT, sp=Math.hypot(me.vx,me.vz);
    let px=lerp(0.19,0,ads), py=lerp(-0.2,-(u.sight||0.1),ads), pz=lerp(-0.46,-0.34,ads), rx=0, ry=lerp(-0.05,0,ads), rz=0;
    if(u.melee&&!u.shield){ px=0.2; py=-0.22; pz=-0.38; } if(u.shield){ px=0.05; py=-0.2; pz=-0.45; } if(u.item){ px=0.22; py=-0.2; pz=-0.38; }
    const bb=Math.sin(bob*2)*0.012*Math.min(1,sp/6)*(1-ads*0.85), bs=Math.cos(bob)*0.014*Math.min(1,sp/6)*(1-ads*0.85);
    px+=bs-clamp(swayX,-0.4,0.4)*0.04; py+=bb+clamp(swayY,-0.4,0.4)*0.03;
    if(me.slideT>0){ rz+=0.25; px-=0.03; }
    if(me.reloadT>0||(me.gunReloadT>0)){ const T=me.reloadT>0?me.reloadT:me.gunReloadT, D=(w.reload||1); const k=Math.sin(Math.min(1,1-T/D)*Math.PI); py-=0.07*k; rx-=0.5*k; rz+=0.35*k; if(u.mag) u.mag.position.y=(u.mag.userData.y0??(u.mag.userData.y0=u.mag.position.y))-0.18*Math.max(0,Math.sin(Math.min(1,(1-T/D)*1.4)*Math.PI)); }
    else if(u.mag&&u.mag.userData.y0!=null) u.mag.position.y=u.mag.userData.y0;
    if(me.switchT>0){ py-=me.switchT*0.6; rx-=me.switchT*1.2; }
    const since=Game.t-me.lastShot; if(since<0.25&&!u.melee){ const k=Math.max(0,1-since/0.09); pz+=0.045*k*(w.recoil||1)*(ads>0.5?0.5:1); rx+=0.07*k*(w.recoil||1); }
    if(u.melee&&since<0.4){ const k=Math.sin(Math.min(1,since/0.35)*Math.PI); rx-=0.9*k; ry+=0.7*k; px-=0.12*k; }
    if(u.pump){ const ct=me.cycleT; u.pump.position.z=-0.38+(ct>0&&ct<0.6?Math.sin(clamp(1-ct/0.6,0,1)*Math.PI)*0.09:0); }
    g.position.set(lerp(g.position.x,px,Math.min(1,dt*18)),lerp(g.position.y,py,Math.min(1,dt*18)),lerp(g.position.z,pz,Math.min(1,dt*22)));
    g.rotation.set(lerp(g.rotation.x,rx,Math.min(1,dt*16)),lerp(g.rotation.y,ry,Math.min(1,dt*16)),lerp(g.rotation.z,rz,Math.min(1,dt*16)));
    if(vm.flash){ const on=since<0.045&&!u.melee&&!w.silent&&!w.proj; vm.flash.visible=on; if(on){ vm.flash.rotation.z=Math.random()*3; const s=0.7+Math.random()*0.6; vm.flash.scale.setScalar(s*(w.cat==='sg'||w.cat==='sr'?1.5:1)); } }
  }
  function makeFlash(){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); const gr=g.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,230,1)'); gr.addColorStop(0.3,'rgba(255,200,90,0.9)'); gr.addColorStop(1,'rgba(255,120,20,0)'); g.fillStyle=gr; g.beginPath();
    for(let i=0;i<10;i++){ const a=i/10*Math.PI*2, r=i%2?14:32; g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r); } g.fill();
    const t=new THREE.CanvasTexture(c); const m=new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.16),new THREE.MeshBasicMaterial({map:t,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,color:'#ffffff'}));
    m.visible=false; return m; }
  Game.setChatOpen=v=>{ chatOpen=v; };
  Game.isOver=()=>Game.state==='end';
  Game.end=function(result){ if(Game.state==='end') return; Game.state='end'; Game.result=result; Game.freeze=true; Input.exitLock(); Bus.emit('end',result);
    const me=Game.me; const win=result&&me&&(result.winTeam!=null?result.winTeam===me.team:result.winner===me.id||(result.winRole&&result.winRole===me.role)); Sfx.play(win?'win':'lose');
    if(me&&!me.bot){ prefs.xp=(prefs.xp||0)+Math.round(me.kills*10+me.score*0.5+(win?100:30)); savePrefs(); } };
})();
