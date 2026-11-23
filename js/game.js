/* game.js — a match session: actors, main loop, events (local + network), camera & first-person view model. */
'use strict';
const Game={active:false,kind:'battle',mode:'tdm',mapId:'fortress',cfg:{},actors:[],byId:new Map(),me:null,host:true,online:false,myId:null,
  t:0,state:'pre',stateT:0,projs:[],deps:[],teamMode:true,freeze:false,paused:false,spectate:null,result:null,seed:1};
(()=>{
  let raf=0, last=0, sendAcc=0, fpsAcc=0, fpsN=0, vm=null, vmId=null, shake=0, bob=0, swayX=0, swayY=0, lastI=NOINTENT, chatOpen=false, frameN=0;
  /* shot feel: a quick camera roll and a small FOV jolt per shot. Neither moves the screen centre, so the crosshair always shows where the next bullet goes. */
  let punchR=0, fovK=0, rollB=0, fovS=0, vmJx=0, vmJy=0;
  /* prefs.hfov = horizontal field of view; the camera wants vertical. Capped at 80° vertical for tall windows. */
  const fovBase=()=>{ const h=prefs.hfov||100, asp=Math.max(0.5,innerWidth/Math.max(1,innerHeight)); return Math.min(80,2*Math.atan(Math.tan(h*Math.PI/360)/asp)*180/Math.PI); };
  /* ---------- start / stop ---------- */
  Game.start=async function(S){
    Game.stop(true); Music.set(false);
    Object.assign(Game,{active:true,kind:S.kind,mode:S.kind==='tag'?'tag':S.mode,mapId:S.map,cfg:Object.assign({},S.cfg||{}),host:!!S.host,online:!!S.online,myId:S.myId,seed:S.seed||1,
      t:0,state:'loading',stateT:0,projs:[],deps:[],actors:[],byId:new Map(),me:null,freeze:true,paused:false,spectate:null,result:null,round:0});
    Game.teamMode=S.kind==='tag'?false:!!BMODES[S.mode].team;
    /* loading screen: picture of the chosen map behind, percent in the corner */
    UI.loadBg(S.map); UI.showLoading(true,'맵 불러오는 중…'); UI.loadPct(2); await new Promise(r=>setTimeout(r,30));
    const def=SandTag.maps[S.map]; setMapData(def,{mode:Game.mode}); SMOKES.length=0;
    const th=THEMES[def.theme]; await R.setTheme(th); { const night=(th.sun&&th.sun.int||1)<1.5; Avatars.setVis(night?{rim:0.52,lift:0.09,mul:1,fog:0.5}:{rim:0.22,lift:0,mul:0.72,fog:0.45}); } UI.loadPct(14); await new Promise(r=>setTimeout(r,0)); await World.build(def,th); FX.init(); Interact.build(); UI.loadPct(46); await Avatars.init(); UI.loadPct(50);
    for(let i=0;i<120&&Assets.done<Assets.pending;i++){ UI.showLoading(true,`질감 불러오는 중… ${Assets.done}/${Assets.pending}`); UI.loadPct(50+28*Assets.done/Math.max(1,Assets.pending)); await new Promise(r=>setTimeout(r,100)); }
    UI.loadPct(78);
    /* actors */
    for(const p of S.players){ const a=newActor({id:p.id,name:p.name,bot:!!p.bot,owner:p.owner,team:p.team||0,load:p.load||null,pref:p.pref||null,diff:p.diff||Game.cfg.diff||'normal',color:p.color});
      a.local=p.owner===Game.myId; a.ch=p.ch; Game.actors.push(a); Game.byId.set(a.id,a); if(a.id===S.meId) Game.me=a; }
    if(Game.kind==='tag') Tag.init(S); else Modes.init(S);
    for(const a of Game.actors){ a.color=colorOf(a); if(a!==Game.me){ a.av=Avatars.create({color:a.color,look:lookOf(a),name:a.name,tagColor:tagColorOf(a)}); R.scene.add(a.av.root); a.av.root.visible=false; } }
    for(const a of Game.actors) if(a.local) spawn(a,true);
    UI.loadPct(82); await warmUp();
    UI.loadPct(100); await new Promise(r=>setTimeout(r,120));
    UI.showLoading(false); UI.show('game'); HUD.start(); Sfx.ambience(def.theme);
    Game.state='pre'; Game.stateT=3; Game.freeze=true; Input.setEnabled(true); if(!isTouch) Input.requestLock();
    last=performance.now(); if(!Game._noLoop) raf=requestAnimationFrame(loop);
  };
  /* build, upload and compile everything that would otherwise first appear mid-match (gun models, deployables, textures, shaders) */
  async function warmUp(){ if(Game._noLoop&&new URLSearchParams(location.search).get('norender')) return; try{
    UI.showLoading(true,'그래픽 준비 중…'); await new Promise(r=>setTimeout(r,0));
    const tmp=new THREE.Group(), built=new Set(); const want=(id,att)=>{ if(!id||!WPN[id]) return; const k=id+'|'+attKey(attClean(id,att)); if(built.has(k)) return; built.add(k); try{ tmp.add(Guns.tp(id,att)); }catch(e){} };
    const me=Game.me, pvp=Game.kind==='battle'&&Game.mode!=='gg'&&Game.mode!=='pk';
    for(const a of Game.actors){ const L=a.load; if(L&&pvp&&a!==me) for(const k of ['main','side','melee']) want(L[k],attOf(a,L[k])); }
    if(Game.mode==='gg'&&typeof GG_LADDER!=='undefined') for(const w of GG_LADDER) want(w,null);
    if(Game.kind==='tag') want('p1912',null);
    R.scene.add(tmp);
    if(me) for(const sl of me.slots||[]){ try{ getVM(sl.id,sl.att); }catch(e){} }
    if(Game.kind==='tag'&&me&&me.role==='seek') try{ getVM('tagpistol'); }catch(e){}
    for(const v of VMC.values()) R.vmCam.add(v.group);
    if(Game.kind==='battle') World.addDynObj({x0:-900,x1:-899,z0:-900,z1:-899.5,y0:-80,y1:-78,k:'wallDep',oid:'__warm'});
    UI.loadPct(88); for(let i=0;i<60&&Assets.done<Assets.pending;i++) await new Promise(r=>setTimeout(r,100));
    UI.loadPct(91); await new Promise(r=>setTimeout(r,0));
    const r=R.renderer, seen=new Set();
    const up=o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[]; for(const m of ms) for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap']){ const t=m[k]; if(t&&t.image&&!seen.has(t)){ seen.add(t); try{ r.initTexture(t); }catch(e){} } } };
    R.scene.traverse(up); R.vmScene.traverse(up);
    /* hidden things (avatars before spawn, effects, zones) are skipped by compile, so show everything for one frame under the loading screen */
    const hid=[]; const showAll=o=>{ if(!o.visible){ hid.push(o); o.visible=true; } }; R.scene.traverse(showAll); R.vmScene.traverse(showAll);
    await R.precompile(); r.shadowMap.needsUpdate=true; const au=r.shadowMap.autoUpdate; r.shadowMap.autoUpdate=true; R.render(); r.shadowMap.autoUpdate=au;
    for(const o of hid) o.visible=false;
    R.scene.remove(tmp); for(const v of VMC.values()) R.vmCam.remove(v.group); if(Game.kind==='battle') World.removeDyn('__warm');
  }catch(e){ console.warn('warm-up',e); } }
  Game.stop=function(silent){ cancelAnimationFrame(raf); if(!Game.active) return; Game.active=false; Input.setEnabled(false); Input.exitLock(); Sfx.stopAmbience();
    for(const a of Game.actors) if(a.av) a.av.dispose(); for(const P of Game.projs) if(P.mesh) R.scene.remove(P.mesh); for(const D of Game.deps) if(D.mesh) R.scene.remove(D.mesh);
    if(vm){ R.vmCam.remove(vm.group); vm=null; vmId=null; } if(Game.kind==='tag') Tag.cleanup(); else Modes.cleanup(); Interact.clear(); FX.clear(); HUD.stop(); };
  function colorOf(a){ if(Game.kind==='tag') return a.role==='seek'?'#ff4d3d':'#3d8bff'; return Game.teamMode?TEAM_COLORS[a.team]:FFA_COLORS[Game.actors.indexOf(a)%FFA_COLORS.length]; }
  /* which outfit: 0 = black SWAT operator, 1 = balaclava / grey top / olive trousers. One per team (tag: seekers are the SWAT side; free-for-all alternates). */
  function lookOf(a){ if(!a) return 0; if(Game.kind==='tag') return a.role==='seek'?0:1; const mine=prefs.char?1:0;
    /* offline team games: my team wears the operator I picked in the lobby, the other team wears the other one. Online the outfit follows the team so everyone sees the same thing. */
    if(Game.teamMode) return Game.online||!Game.me?(a.team===1?1:0):(a.team===Game.me.team?mine:1-mine);
    return a===Game.me?mine:a.ch!=null?(a.ch?1:0):Game.actors.indexOf(a)%2; }
  function tagColorOf(a){ if(!Game.me) return '#fff'; if(Game.kind==='tag') return a.role==='seek'?'#ff8a7a':'#9cc8ff'; return isEnemy(Game.me,a)?'#ff8a7a':'#9cc8ff'; }
  Game.colorOf=colorOf;
  /* ---------- spawn ---------- */
  /* never start inside a wall, a prop or another player: if the chosen point is blocked, take the nearest free spot around it */
  function safeSpot(p,a){ const y0=p.y||0;
    const ok=(x,z)=>{ const g=groundAt(x,z,y0+0.6); if(Math.abs(g-y0)>0.75||blockedAt(x,z,g,PH)) return false;
      let free=0; for(let i=0;i<8;i++){ const an=i/8*Math.PI*2; if(!blockedAt(x+Math.cos(an)*0.7,z+Math.sin(an)*0.7,g,PH)) free++; } if(free<5) return false;
      for(const o of Game.actors) if(o!==a&&o.alive&&Math.abs(o.y-g)<1.6&&Math.hypot(o.x-x,o.z-z)<0.95) return false; return true; };
    if(ok(p.x,p.z)) return p;
    for(let r=0.6;r<=8;r+=0.6){ const n=Math.max(8,Math.round(r*7)), off=Math.random()*6.28; for(let i=0;i<n;i++){ const an=off+i/n*Math.PI*2, x=p.x+Math.cos(an)*r, z=p.z+Math.sin(an)*r; if(ok(x,z)) return Object.assign({},p,{x,z,y:groundAt(x,z,y0+0.6)}); } }
    return p; }
  Game.safeSpot=safeSpot;
  function spawn(a,first){
    const p=Game.mode==='pk'?Game.spawnPoint(a):safeSpot(Game.spawnPoint(a),a); a.x=p.x; a.y=p.y||0; a.z=p.z; a.yaw=p.yaw!=null?p.yaw:0; a.pitch=0; a.vx=a.vz=a.vy=0; a.kx=a.kz=0; a.gr=true; a.ph=PH; a.slideT=0;
    a.alive=true; a.hp=100; a.maxHp=100; a.dmgBy={}; a.spawnProt=Game.kind==='battle'&&!a.dummy?1.6:0; a.slowT=a.stunT=a.blindT=0; a.jailed=false; a.carry=null; a.regenNow=false; a.recoilP=0; a.recoilY=0; a.boltT=0;
    if(Game.kind==='battle') applyPerksOnSpawn(a); equip(a);
    Game.emit('spawn',{a:a.id,x:+a.x.toFixed(2),y:+a.y.toFixed(2),z:+a.z.toFixed(2),yaw:+a.yaw.toFixed(2),w:a.slots[a.cur]?a.slots[a.cur].id:null,hp:a.maxHp});
  }
  Game.spawn=spawn;
  /* loadout changes during a match (from the death screen or the pause menu): kept for the next spawn */
  Game.canEditLoadout=()=>Game.active&&Game.kind==='battle'&&!['snd','gg','pk'].includes(Game.mode)&&Game.state!=='end';
  Game.setMyLoad=function(L){ const me=Game.me; if(!me||!Game.canEditLoadout()) return; if(Game.mode==='range'){ Range.applyLoad(L); return; } const was=JSON.stringify(me.load); me.load=L; if(was===JSON.stringify(L)) return;
    Game.emit('setload',{a:me.id,load:L}); if(me.alive) HUD.toast('바뀐 로드아웃은 다음 부활부터 적용돼요'); };
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
        case 'setload': { const a=Game.byId.get(d.a); if(a&&!a.local&&d.load) a.load=d.load; break; }
        case 'takeover': { if(d.a===Game.myId&&from!==Game.myId){ Bus.emit('kicked','연결이 오래 끊겨서 봇이 자리를 이어받았어요'); break; } const a=Game.byId.get(d.a); if(a){ a.bot=true; a.owner=from; a.local=from===Game.myId; a.name=a.name+' (봇)'; } break; }
        default: if(Game.kind==='tag') Tag.handle(t,d,from); else Modes.handle(t,d,from);
      }
    }catch(e){ console.error('event',t,e); }
  };
  function onShot(d){ const a=Game.byId.get(d.a); const w=WPN[d.w]; if(!w) return;
    const local=a&&a.local&&!a.bot; let o=d.o;
    if(local&&vm&&vm.gun){ const p=new THREE.Vector3().copy(vm.gun.userData.muzzle); vm.gun.localToWorld(p); /* vm space → world approx */ }
    const sup=!!d.sl;
    if(!local){ if(a&&a.av){ a.av.play('Pistol_Shoot',1.6); } Sfx.gun(w,{x:o[0],y:o[1],z:o[2],sup,dist:w.silent||sup?28:(perkN(a&&a.load,'ghost')?60:150),vol:perkN(a&&a.load,'ghost')?0.6:1}); if(!sup) FX.muzzle(o[0],o[1],o[2],0,0,0,w.cat==='sg'||w.cat==='sr'); }
    else { Sfx.gun(w,{local:true,sup,vol:perkN(a.load,'ghost')?0.65:1}); if(w.smokePuff) FX.puff(o[0],o[1],o[2],{size:1.2,life:2,alpha:0.5,grow:3});
      if(a&&w.cat!=='sg'&&!w.proj&&w.id!=='revolver'){ const r={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)}, f=fwd(a.yaw); FX.casing(a.x+r.x*0.25+f.x*0.35,eyeY(a)-0.18,a.z+r.z*0.25+f.z*0.35,r.x*rand(2,3)+a.vx,rand(2,3.5),r.z*rand(2,3)+a.vz,w.cat==='sr'); } }
    for(const e of d.e){ const dx=e[0]-o[0], dy=e[1]-o[1], dz=e[2]-o[2], L=Math.hypot(dx,dy,dz)||1;
      if(w.pellets===1||Math.random()<0.35) FX.tracer(o[0]+dx/L*(local?1.2:0.3),o[1]+dy/L*(local?1.2:0.3),o[2]+dz/L*(local?1.2:0.3),e[0],e[1],e[2]);
      if(e[3]===1||e[3]===2||e[3]===3){ const n=hitNormal(e[0],e[1],e[2],{x:dx/L,y:dy/L,z:dz/L}); FX.impact(e[0]+n.x*0.02,e[1]+n.y*0.02,e[2]+n.z*0.02,n.x,n.y,n.z,e[3]===3?'metal':e[3]===2?'wood':e[1]<0.05?'sand':'concrete');
        if(Math.random()<0.3) Sfx.play(e[3]===3?'metal_04':'hit_0'+(1+((Math.random()*3)|0)),{x:e[0],y:e[1],z:e[2],vol:0.25,dist:25,rate:rand(1.2,1.6)}); }
      if(a&&!local&&Math.random()<0.5){ /* whiz near me */ const me=Game.me; if(me&&me.alive){ const t=((me.x-o[0])*dx+(eyeY(me)-o[1])*dy+(me.z-o[2])*dz)/(L*L); if(t>0&&t<1){ const px=o[0]+dx*t-me.x, pz=o[2]+dz*t-me.z; if(Math.hypot(px,pz)<2) Sfx.play('whoosh',{vol:0.25,rate:2.2}); } } } }
    if(a&&!local&&Game.me&&isEnemy(Game.me,a)) a.revealT=perkN(a.load,'ghost')?a.revealT:Game.t+(sup?0.5:1.6);
  }
  function onHit(d){ const v=Game.byId.get(d.v), a=Game.byId.get(d.a); if(!v) return;
    if(v.local&&v.alive){ const before=v.hp; const got=damage(v,{dmg:d.d,from:d.a,w:d.w,head:!!d.h});
      if(d.slow){ v.slowT=1.6; v.slowF=d.slow; } if(d.kb&&a){ const dx=v.x-a.x, dz=v.z-a.z, l=Math.hypot(dx,dz)||1; v.kx+=dx/l*d.kb; v.kz+=dz/l*d.kb; v.vy=Math.max(v.vy,2.5); v.gr=false; }
      if(d.kx){ v.kx+=d.kx*3; v.kz+=d.kz*3; } }
    if(a&&a.local&&!a.bot&&d.d>0) Bus.emit('hitmark',{head:!!d.h,kill:false,v,d:d.d});
    if(Game.kind==='battle'||Game.cfg.seekerGun){ const dx=v.x-(a?a.x:v.x), dz=v.z-(a?a.z:v.z), l=Math.hypot(dx,dz)||1; FX.blood(v.x,v.y+(d.h?v.ph-0.15:1.1),v.z,dx/l,dz/l,d.h?16:7); if(d.h) FX.puff(v.x,v.y+v.ph-0.15,v.z,{color:[0.42,0.02,0.02],size:0.32,life:0.45,alpha:0.6,grow:3,drag:3}); }
    if(v.av&&!v.local) v.av.play('Hit_Chest',2);
    if(d.m) Sfx.play(WPN[d.w]&&WPN[d.w].shield?'slam_01':'hit_0'+(1+((Math.random()*3)|0)),{x:v.x,y:v.y+1,z:v.z,vol:0.7});
  }
  function onSpawn(d){ const a=Game.byId.get(d.a); if(!a) return; if(!a.local){ a.x=d.x; a.y=d.y; a.z=d.z; a.yaw=d.yaw; a.alive=true; a.hp=d.hp||100; a.maxHp=d.hp||100; a.jailed=false; a.net={x:d.x,y:d.y,z:d.z,yaw:d.yaw,pitch:0,f:1,w:d.w,t:Game.t}; }
    if(a.av){ a.av.revive(); a.av.root.visible=true; const id=d.w&&Game.kind==='battle'?d.w:(d.w==='tagpistol'?'p1912':null); a.av.setGun(id,attOf(a,id)); } }
  function onAct(d){ const a=Game.byId.get(d.a); if(!a) return; if(d.t==='sw'&&!a.local){ if(a.av){ const id=d.w==='tagpistol'?'p1912':d.w; a.av.setGun(id,attOf(a,id)); } a.curW=d.w; }
    if(!a.av||a.local) return; if(d.t==='reload') a.av.play('Pistol_Reload',1.2); if(d.t==='melee') a.av.play('Sword_Attack',1.6); if(d.t==='throw') a.av.play('Punch_Cross',1.3); }
  function onObjDmg(d){ if(Game.mode==='range'&&typeof Range!=='undefined'&&Range.onObj(d)) return; const o=OBJS.get(d.o); if(!o||!o.alive) return; o.hp-=d.d; if(o.hp<=0&&Game.host){ Game.emit('objbrk',{o:d.o,a:d.a}); } }
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
      if(a.av&&s[7]!==a.curW){ a.curW=s[7]; const id=s[7]==='tagpistol'?'p1912':s[7]||null; a.av.setGun(id,attOf(a,id)); } } }
  function sendStates(){ const own=Game.actors.filter(a=>a.local); if(!own.length) return; Net.send('state',{s:own.map(packState)},true); }
  function interpRemote(a,dt){ const n=a.net; if(!n) return; const k=Math.min(1,dt*14);
    if(Math.hypot(n.x-a.x,n.z-a.z)>6){ a.x=n.x; a.y=n.y; a.z=n.z; } else { a.x+=(n.x-a.x)*k; a.y+=(n.y-a.y)*k; a.z+=(n.z-a.z)*k; }
    a.yaw+=angDiff(a.yaw,n.yaw)*k; a.pitch+=(n.pitch-a.pitch)*k; a.crouch=!!(n.f&2); a.slideT=n.f&4?0.3:0; a.ads=!!(n.f&8); a.gr=!!(n.f&16); a.ph=a.slideT>0?PH_SLIDE:a.crouch?CROUCH_H:PH; a.emote=n.f&256?Game.t+1:0; }
  /* ---------- main loop ---------- */
  function loop(now){
    raf=requestAnimationFrame(loop); const raw=(now-last)/1000; let dt=Math.min(0.05,raw); last=now; if(!Game.active){ aq.t=0; aq.n=0; aq.cool=4; return; } step(dt,true); autoQ(raw); }
  /* auto quality: if the frame rate stays low, step the graphics preset down one level */
  const aq={t:0,n:0,sum:0,cool:4};
  function autoQ(raw){ if(prefs.gfxAuto===false||document.hidden||raw>2) return;
    if(aq.cool>0){ aq.cool-=raw; return; }
    aq.t+=raw; aq.n++; if(aq.t<3) return; const fps=aq.n/aq.t; aq.t=0; aq.n=0;
    const order=['ultra','high','medium','low'], i=order.indexOf(prefs.gfx);
    if(fps<42&&i>=0&&i<order.length-1){ prefs.gfx=order[i+1]; savePrefs(); R.applyQuality(QUALITY_PRESETS[prefs.gfx]); aq.cool=5;
      HUD.toast('화면이 버벅여서 그래픽을 '+QUALITY_PRESETS[prefs.gfx].name+'(으)로 낮췄어요'); } }
  Game._step=(dt,render)=>step(dt,render);
  Game._noLoop=false;
  function step(dt,render){ frameN++;
    fpsAcc+=dt; fpsN++; if(fpsAcc>0.5){ Bus.emit('fps',Math.round(fpsN/fpsAcc)); fpsAcc=0; fpsN=0; }
    Game.t+=dt;
    if(Game.state==='pre'){ Game.stateT-=dt; Game.freeze=true; if(Game.stateT<=0){ Game.state='live'; Game.freeze=false; Sfx.play('beep'); Bus.emit('go'); } }
    const me=Game.me; let I=NOINTENT;
    if(!Game.paused&&!chatOpen&&!UI.overlayOpen()) I=Input.sample(); else Input.sample();
    if(I!==NOINTENT&&me&&!me.bot&&me.alive&&Game.state==='live'&&!Game.freeze&&autoFireOn()&&autoTarget(me)) I.fire=true;
    lastI=I;
    if(me&&!me.bot){ applyLook(me,I,dt);
      if(me.alive){ moveActor(me,I,dt); if(Game.state!=='end'&&!Game.freeze){ weaponUpdate(me,I,dt); }
        /* frozen (countdown, search & destroy buy time): the gun comes up and can be switched, aimed and reloaded, but not fired or thrown */
        else if(Game.state!=='end'&&Game.kind==='battle'){ weaponUpdate(me,Object.assign({},I,{fire:false,throwHit:false,special:false}),dt); me.recoilP=0; me.recoilY=0; }
        else if(Game.freeze&&(me.recoilP>0||me.recoilY)){ me.recoilP=0; me.recoilY=0; } }
      /* weapon inspect (Y): look the gun over; anything else you do cancels it */
      if(I.inspect&&me.alive&&me.adsT<0.15&&!(me.reloadT>0)&&!(me.switchT>0)) me.inspT=me.inspT>0?0:INSPECT;
      if(me.inspT>0&&(I.fire||I.ads||I.shoulder||I.reload||I.swap||I.w1||I.w2||I.w3||I.throwHit||me.reloadT>0||me.switchT>0||!me.alive)) me.inspT=0;
      if(I.emote) Game.emit('emote',{a:me.id});
      if(I.loadout&&Game.canEditLoadout()) UI.openGameLoadout();
      if(I.chat&&!isTouch) UI.openChat(); }
    for(const a of Game.actors){
      if(!isFinite(a.yaw)) a.yaw=0; if(!isFinite(a.pitch)) a.pitch=0; if(!isFinite(a.x)||!isFinite(a.z)||!isFinite(a.y)){ const p=Game.spawnPoint(a); a.x=p.x; a.y=p.y||0; a.z=p.z; a.vx=a.vz=a.vy=0; }
      if(!isFinite(a.hp)) a.hp=a.maxHp||100;
      if(a.local){ /* safety net: if a player ever ends up inside something solid (a prop dropped on them, a bad spawn), move them to the nearest free spot */
        a.stuckC=(a.stuckC||0)-dt; if(a.stuckC<=0){ a.stuckC=0.25; if(a.alive&&!a.climbing&&Game.mode!=='pk'&&blockedAt(a.x,a.z,a.y,a.ph||PH,true,RAD*0.55)){ a.stuckT=(a.stuckT||0)+0.25; if(a.stuckT>=0.75){ const q=safeSpot({x:a.x,y:a.y,z:a.z},a); a.x=q.x; a.z=q.z; a.y=q.y; a.vx=a.vz=0; a.stuckT=0; } } else a.stuckT=0; }
        a.spawnProt-=dt; if(a.slowT>0) a.slowT-=dt; if(a.stunT>0) a.stunT-=dt; if(a.blindT>0) a.blindT-=dt; regen(a,dt);
        if(!a.alive){ a.deadT+=dt; if(Game.state==='live'&&a.respawnAt>0&&Game.t>=a.respawnAt&&(Game.kind==='tag'||Modes.canRespawn(a))&&!(a===Game.me&&UI.cur!=='game')){ a.respawnAt=0; spawn(a); } } }
      else { interpRemote(a,dt); if(!a.alive) a.deadT+=dt; }
    }
    const P=Game._prof, T0=P?performance.now():0;
    if((Game.host||window.__forceBots)&&!Game.paused) Bots.update(dt);
    const T1=P?performance.now():0;
    updateProjs(dt); updateDeps(dt);
    for(let i=SMOKES.length-1;i>=0;i--) if(SMOKES[i].until<Game.t) SMOKES.splice(i,1);
    if(Game.kind==='tag') Tag.update(dt,I); else Modes.update(dt,I); Interact.update(dt,I);
    const T2=P?performance.now():0;
    if(Game.online){ sendAcc+=dt; if(sendAcc>=0.085){ sendAcc=0; sendStates(); } }
    updateCamera(me,dt,I); updateAvatars(dt); updateViewmodel(me,dt,I);
    const T3=P?performance.now():0;
    World.update(dt,Game.t); FX.update(dt);
    const T4=P?performance.now():0;
    Sfx.listener(R.camera.position.x,R.camera.position.y,R.camera.position.z,R.camera.rotation.y);
    HUD.update(dt); Buy.update(dt);
    const T5=P?performance.now():0;
    if(render) R.render();
    if(P){ P.bots+=T1-T0; P.mode+=T2-T1; P.avatars+=T3-T2; P.fx+=T4-T3; P.hud+=T5-T4; P.n++; }
  }
  /* touch aim assist: the view turns slower while the crosshair is near an enemy, so a thumb can settle on the target (stronger through a scope) */
  let assistT=0, assistK=1;
  function aimAssist(me,w,dt){ if(!document.body.classList.contains('touch')||prefs.aimAssist===false||!w||w.mode==='melee'||Game.state!=='live'){ assistK=1; return 1; }
    assistT-=dt; if(assistT<=0){ assistT=0.07; assistK=autoTarget(me,true)?(me.adsT>0.6?0.45:0.62):1; } return assistK; }
  function applyLook(me,I,dt){ if(!me.alive&&!me.jailed) return; const w=curW(me); const z=(me.ads&&w?lerp(1,w.zoom,me.adsT):1)*lerp(1,SH_ZOOM,me.shT||0)*aimAssist(me,w,dt); const st=me.stunT>0?0.45:1;
    const dy=-I.lookX*z*st, dp=-I.lookY*z*st; me.yaw+=dy; me.pitch=clamp(me.pitch+dp,-1.45,1.45); swayX+=I.lookX*0.6; swayY+=I.lookY*0.6;
    /* pulling against the recoil counts as recovering it, so the automatic recovery does not drag the aim past the target */
    if(dp<0&&me.recoilP>0) me.recoilP=Math.max(0,me.recoilP+dp);
    if(me.recoilY&&dy&&Math.sign(dy)!==Math.sign(me.recoilY)) me.recoilY=Math.abs(me.recoilY)<=Math.abs(dy)?0:me.recoilY+dy; }
  Bus.on('shake',e=>{ const me=Game.me; if(!me) return; const d=Math.hypot(e.x-me.x,e.z-me.z); shake=Math.max(shake,Math.max(0,1-d/(e.r*4))*0.6); });
  Bus.on('hurt',e=>{ shake=Math.max(shake,0.12); });
  Bus.on('fired',({w})=>{ const me=Game.me, rec=Math.min(w.rv!=null?w.rv:(w.recoil||1),4.5), ads=me&&me.adsT>0.5;
    punchR+=(Math.random()<0.5?-1:1)*(0.003+0.0022*rec)*(ads?0.55:1); fovK=Math.min(0.06,fovK+(0.006+0.006*rec)*(ads?0.7:1));
    vmJx=Math.random()*2-1; vmJy=Math.random()*2-1;
  });
  /* ---------- touch auto-fire: shoot when the crosshair rests on a visible enemy ---------- */
  function autoFireOn(){ return prefs.autoFire!==false&&document.body.classList.contains('touch'); }
  function autoTarget(me,wide){ const w=curW(me); if(!w||me.tool) return null; if(!wide&&w.scope&&me.adsT<0.85) return null;
    const tagGun=Game.kind==='tag'&&me.role==='seek'&&Game.cfg.seekerGun; if(Game.kind!=='battle'&&!tagGun) return null;
    const cp=Math.cos(me.pitch), fx=-Math.sin(me.yaw)*cp, fy=Math.sin(me.pitch), fz=-Math.cos(me.yaw)*cp;
    const ex=me.x, ey=eyeY(me), ez=me.z, range=w.mode==='melee'?(w.reach||2)+0.6:(w.far||60);
    for(const a of Game.actors){ if(a===me||!a.alive) continue;
      if(tagGun){ if(a.role!=='run'||a.jailed||a.escaped) continue; } else if(!isEnemy(me,a)||a.spawnProt>0) continue;
      for(const hy of [a.ph*0.62,a.ph-0.2]){ const dx=a.x-ex, dy=a.y+hy-ey, dz=a.z-ez, d=Math.hypot(dx,dy,dz); if(d>range||d<0.01) continue;
        const cos=(dx*fx+dy*fy+dz*fz)/d, tol=w.mode==='melee'?0.45:Math.atan((wide?1.25:0.42)/d)+0.004;
        if(cos<Math.cos(tol)) continue; if(losSight(ex,ey,ez,a.x,a.y+hy,a.z)) return a; } }
    return null; }
  /* ---------- camera ---------- */
  function updateCamera(me,dt,I){
    const cam=R.camera; if(!me){ return; }
    /* who we are watching is decided again every frame. It used to stay set after the spectate ended (search & destroy: dead → next round),
       and the hands and gun stayed hidden for the rest of the match even though the gun still fired. */
    Game.spectate=null;
    let tx,ty,tz,yaw,pitch; const w=curW(me);
    if(me.alive||me.jailed){ tx=me.x; ty=eyeY(me); tz=me.z; yaw=me.yaw; pitch=me.pitch;
      const sp=Math.hypot(me.vx,me.vz); if(me.gr&&sp>0.5&&me.slideT<=0) bob+=dt*sp*1.25; ty+=Math.sin(bob*2)*0.035*Math.min(1,sp/6)*(1-me.adsT*0.8);
      rollB=lerp(rollB,me.slideT>0?0.06:0,dt*8);
    } else if(me.escaped||(Game.mode==='snd'&&me.deadT>3)){ // spectate a teammate
      const list=Game.actors.filter(a=>a!==me&&a.alive&&!a.escaped&&(Game.kind==='tag'?a.role===me.role:!isEnemy(me,a)));
      const sp=list[Math.floor(Game.t/8)%Math.max(1,list.length)];
      if(sp){ const f=fwd(sp.yaw); tx=sp.x-f.x*3.2; tz=sp.z-f.z*3.2; ty=sp.y+2.4; yaw=sp.yaw; pitch=-0.25; Game.spectate=sp; } else { tx=me.x; ty=me.y+3; tz=me.z; yaw=me.yaw; pitch=-0.3; }
    } else { // death cam: look at killer from above own body
      const k=Game.byId.get(me.lastAttacker); const r=4+Math.min(2,me.deadT); tx=me.x; ty=me.y+2.6; tz=me.z;
      yaw=me.yaw; pitch=-0.35; if(k&&k!==me){ yaw=Math.atan2(-(k.x-me.x),-(k.z-me.z)); pitch=Math.atan2(k.y+1-ty,Math.hypot(k.x-me.x,k.z-me.z)); }
      const f=fwd(yaw); tx-=f.x*r*0.6; tz-=f.z*r*0.6; }
    if(shake>0){ shake=Math.max(0,shake-dt*1.6); tx+=(Math.random()-0.5)*shake*0.25; ty+=(Math.random()-0.5)*shake*0.25; pitch+=(Math.random()-0.5)*shake*0.04; }
    punchR*=Math.exp(-dt*16); fovK*=Math.exp(-dt*12); if(!me.alive){ punchR=0; fovK=0; }
    cam.position.set(tx,ty,tz); cam.rotation.y=yaw; cam.rotation.x=pitch; cam.rotation.z=rollB+punchR;
    const zoom=(me.ads&&w?lerp(1,w.zoom,me.adsT):1)*lerp(1,SH_ZOOM,me.shT||0); const tf=fovBase()*zoom*(me.slideT>0?1.06:1);
    if(!fovS) fovS=cam.fov; if(Math.abs(fovS-tf)>0.05) fovS=lerp(fovS,tf,Math.min(1,dt*14)); else fovS=tf;
    const fv=fovS*(1+fovK); if(Math.abs(cam.fov-fv)>0.01){ cam.fov=fv; cam.updateProjectionMatrix(); }
  }
  /* ---------- third-person avatars ---------- */
  const _frus=new THREE.Frustum(), _pm=new THREE.Matrix4(), _sph=new THREE.Sphere(new THREE.Vector3(),1.6);
  function updateAvatars(dt){ const me=Game.me; const cam=R.camera, cp=cam.position; _frus.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
    for(const a of Game.actors){ if(!a.av) continue; const A=a.av;
      const dist=Math.hypot(a.x-cp.x,a.z-cp.z); _sph.center.set(a.x,a.y+1,a.z); const onScreen=_frus.intersectsSphere(_sph);
      const skip=!onScreen&&dist>6?6:dist>70?5:dist>35?2:0;
      const sh=dist<26; if(A._sh!==sh){ A._sh=sh; A.root.traverse(o=>{ if(o.isMesh) o.castShadow=sh; }); } a.avAcc=(a.avAcc||0)+dt; a.avN=(a.avN||0)+1;
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
    const att=s&&id===s.id?s.att:null, vk=id?id+'|'+attKey(att):null;
    if(vk!==vmId){ if(vm){ R.vmCam.remove(vm.group); } vm=id?getVM(id,att):null; vmId=vk; if(vm){ R.vmCam.add(vm.group); vm.group.position.set(HIP.x,HIP.y-0.25,HIP.z); vm.group.rotation.set(0,0,0); } }
    /* safety net: the model must be in the view-model camera, and one bad number must not hide it for good */
    if(vm&&vm.group.parent!==R.vmCam) R.vmCam.add(vm.group);
    if(vm){ const g=vm.group; if(![g.position.x,g.position.y,g.position.z,g.rotation.x,g.rotation.y,g.rotation.z].every(Number.isFinite)){ g.position.set(HIP.x,HIP.y-0.25,HIP.z); g.rotation.set(0,0,0); } }
    if(!vm) return; const w=(s&&id===s.id&&s.w)||WPN[id]||{}; const u=vm.gun.userData; const g=vm.group;
    const scoped=u.scope&&me.adsT>0.85; g.visible=!scoped&&!Game.spectate;
    swayX*=Math.max(0,1-dt*10); swayY*=Math.max(0,1-dt*10);
    const ads=me.adsT, sp=Math.hypot(me.vx,me.vz);
    const az=u.adsZ!=null?u.adsZ:(u.pistol?-0.27:-0.21);
    /* hip → shoulder (견착: raised, pulled toward the middle and canted) → sights */
    const sh=me.shT||0, S=u.pistol?SH_P:SH, hx=lerp(HIP.x,S.x,sh), hy=lerp(HIP.y,S.y,sh), hz=lerp(u.pistol?HIP.z-0.08:HIP.z,S.z,sh), hr=lerp(HIP.ry,S.ry,sh);
    let px=lerp(hx,0,ads), py=lerp(hy,-(u.sight||0.1),ads), pz=lerp(hz,az,ads), rx=S.rx*sh, ry=lerp(hr,0,ads), rz=S.rz*sh*(1-ads);
    if(u.melee&&!u.shield){ px=0.16; py=-0.16; pz=-0.3; ry=0; } if(u.shield){ px=0.05; py=-0.2; pz=-0.45; ry=0; } if(u.item){ px=0.18; py=-0.17; pz=-0.32; ry=0; }
    const bb=Math.sin(bob*2)*0.012*Math.min(1,sp/6)*(1-ads*0.85), bs=Math.cos(bob)*0.014*Math.min(1,sp/6)*(1-ads*0.85);
    px+=bs-clamp(swayX,-0.4,0.4)*0.04; py+=bb+clamp(swayY,-0.4,0.4)*0.03;
    if(me.slideT>0){ rz+=0.25; px-=0.03; }
    const pose={px,py,pz,rx,ry,rz}; /* CS2-style reloads for the families ReloadAnim knows; the simple dip for the rest */
    if(ReloadAnim.apply(vm,me,w,s,dt,pose)){ px=pose.px; py=pose.py; pz=pose.pz; rx=pose.rx; ry=pose.ry; rz=pose.rz; }
    else if(me.reloadT>0||(me.gunReloadT>0)){ const T=me.reloadT>0?me.reloadT:me.gunReloadT, D=(w.reload||1); const k=Math.sin(Math.min(1,1-T/D)*Math.PI); py-=0.07*k; rx-=0.5*k; rz+=0.35*k; if(u.mag) u.mag.position.y=(u.mag.userData.y0??(u.mag.userData.y0=u.mag.position.y))-0.18*Math.max(0,Math.sin(Math.min(1,(1-T/D)*1.4)*Math.PI)); }
    else if(u.mag&&u.mag.userData.y0!=null) u.mag.position.y=u.mag.userData.y0;
    if(me.switchT>0){ py-=me.switchT*0.6; rx-=me.switchT*1.2; }
    if(me.inspT>0&&!u.item){ me.inspT-=dt; const p=1-me.inspT/INSPECT, e=x=>x<0?0:x>1?1:x*x*(3-2*x);
      /* raise and turn the left side toward you, roll over to the right side, then a look down the top, and back */
      const a=e(p/0.18)-e((p-0.42)/0.16), b=e((p-0.42)/0.16)-e((p-0.7)/0.14), c=e((p-0.7)/0.14)-e((p-0.86)/0.14);
      px+=-0.05*a+0.01*b-0.03*c; py+=0.035*a+0.03*b+0.035*c; pz+=-0.02*a-0.07*b-0.04*c;
      ry+=0.72*a-0.18*b+0.08*c; rz+=0.42*a-0.72*b; rx+=0.05*a+0.08*b+0.42*c; }
    /* per-shot kick: fast attack, springy return, a little random twist so a burst does not look like one frame repeated */
    const since=Game.t-me.lastShot; if(since<0.4&&!u.melee){ const rec=Math.min(w.recoil||1,3.5), k=since<0.02?since/0.02:Math.exp(-(since-0.02)*16), sa=ads>0.5?0.55:1;
      pz+=0.05*k*rec*sa; rx+=0.08*k*rec*sa; py+=0.006*k*rec*sa; rz+=0.05*k*vmJx*Math.min(rec,2)*sa; ry+=0.025*k*vmJy*Math.min(rec,2)*sa; }
    if(u.melee&&since<0.4){ const k=Math.sin(Math.min(1,since/0.35)*Math.PI); rx-=0.9*k; ry+=0.7*k; px-=0.12*k; }
    /* bolt cycle: tip the rifle in, lift and pull the bolt, push it home, bring the rifle back up */
    if(me.boltT>0&&me.boltDur){ const p=1-me.boltT/me.boltDur, e=x=>x<0?0:x>1?1:x*x*(3-2*x), t=e(p/0.14)-e((p-0.82)/0.18);
      rz+=0.42*t; ry+=0.08*t; rx+=0.05*t; py-=0.03*t; px-=0.012*t; pz+=0.02*t;
      if(u.bolt){ const up=e((p-0.14)/0.13)-e((p-0.66)/0.12), back=e((p-0.27)/0.16)-e((p-0.5)/0.15);
        if(!u.boltSlide) u.bolt.rotation.z=up*1.15; u.bolt.position.z=u.bolt.userData.z0+back*(u.boltSlide?0.06:0.085);
        if(vm.rl) ReloadAnim.boltHand(vm,e((p-0.06)/0.1)-e((p-0.74)/0.14)); /* the right hand works the bolt knob */ } }
    else if(u.bolt&&!(me.reloadT>0)&&(u.bolt.rotation.z||u.bolt.position.z!==u.bolt.userData.z0)){ u.bolt.rotation.z=0; u.bolt.position.z=u.bolt.userData.z0; }
    if(u.pump){ const ct=me.cycleT; u.pump.position.z=(u.pump.userData.z0||0)+(ct>0&&ct<0.6?Math.sin(clamp(1-ct/0.6,0,1)*Math.PI)*0.09:0); }
    if(![px,py,pz,rx,ry,rz].every(Number.isFinite)){ px=HIP.x; py=HIP.y; pz=HIP.z; rx=0; ry=HIP.ry||0; rz=0; }
    g.position.set(lerp(g.position.x,px,Math.min(1,dt*18)),lerp(g.position.y,py,Math.min(1,dt*18)),lerp(g.position.z,pz,Math.min(1,dt*22)));
    g.rotation.set(lerp(g.rotation.x,rx,Math.min(1,dt*16)),lerp(g.rotation.y,ry,Math.min(1,dt*16)),lerp(g.rotation.z,rz,Math.min(1,dt*16)));
    if(vm.flash){ const on=since<0.045&&!u.melee&&!w.silent&&!w.noFlash&&!w.proj; vm.flash.visible=on; if(on){ vm.flash.rotation.z=Math.random()*3; const s=0.7+Math.random()*0.6; vm.flash.scale.setScalar(s*(w.cat==='sg'||w.cat==='sr'?1.5:1)); } }
  }
  /* first-person models are built once per weapon and reused (they used to be rebuilt, and leaked, on every switch) */
  const VMC=new Map(), HIP=Guns.HIP, INSPECT=2.6, SH_ZOOM=0.92,
    SH={x:0.09,y:-0.131,z:-0.28,rx:0.045,ry:0.075,rz:0.58}, SH_P={x:0.07,y:-0.122,z:-0.34,rx:0.03,ry:0.04,rz:0.3};
  function getVM(id,att){ const look=lookOf(Game.me), k=id+'|'+attKey(att)+'|'+look; let v=VMC.get(k);
    if(!v){ if(VMC.size>14){ for(const [kk,o] of VMC){ if(o!==vm){ o.group.traverse(m=>{ if(m.isMesh) m.geometry.dispose(); }); VMC.delete(kk); break; } } }
      v=Guns.viewmodel(id,att,look); v.flash=makeFlash(); v.gun.add(v.flash); v.flash.position.copy(v.gun.userData.muzzle||new THREE.Vector3(0,0.05,-0.5)); VMC.set(k,v); } return v; }
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
