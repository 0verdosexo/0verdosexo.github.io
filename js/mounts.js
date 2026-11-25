/* mounts.js — emplaced weapons a player (or a bot) can man (v7.11): Maxim M1910, MG42, 45 mm AT gun, Pak 40.
   Stand at the gun and press E: you are held at the gun, your view turns inside its arc, the trigger fires the gun itself
   (endless belt, but machine guns overheat; AT guns fire one high-explosive shell at a time). E again lets go.
   Positions come from the map (MAP.mounts), so every client builds the same guns. Who is manning a gun is sent as a state flag;
   other clients turn the gun to that player's aim. */
'use strict';
const Mounts=(()=>{
  const KIND={
    maxim:{w:'mnt_maxim',name:'맥심 기관총',piv:0.45,heat:0.0125,cool:0.26,mg:true},
    mg42:{w:'mnt_mg42',name:'MG42 기관총',piv:0.38,heat:0.0078,cool:0.36,mg:true},
    at45:{w:'mnt_at45',name:'45mm 대전차포',piv:0.85,heat:0,cool:0,mg:false},
    pak40:{w:'mnt_pak40',name:'Pak 40 대전차포',piv:0.9,heat:0,cool:0,mg:false} };
  let L=[], grp=null, hud=null, mats=null;
  const PITCH=[-0.32,0.38];
  /* ---------- models ---------- */
  function M(){ if(mats) return mats; const S=(c,r,m)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
    mats={gun:S('#2e3032',0.45,0.75), olive:S('#4b5638',0.7,0.35), grey:S('#5a5e5c',0.65,0.4), wood:S('#5a3e26',0.85,0), brass:S('#8a6a2a',0.45,0.8), tyre:S('#1b1b1b',0.9,0), dark:S('#18191a',0.6,0.5)}; return mats; }
  const bx=(g,mat,w,h,d,x,y,z,rx,ry,rz)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); m.castShadow=true; g.add(m); return m; };
  const cy=(g,mat,r0,r1,h,x,y,z,rx,ry,rz,seg)=>{ const m=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,seg||12),mat); m.position.set(x,y,z); m.rotation.set(rx||0,ry||0,rz||0); m.castShadow=true; g.add(m); return m; };
  const H2=Math.PI/2;
  /* every model: a base that stays put and a "gun" group that turns (yaw, then pitch); the barrel points along -z; muzzle = gun.userData.muzzle */
  function build1(m){ const k=m.k, X=M(), base=new THREE.Group(), turn=new THREE.Group(), gun=new THREE.Group(); base.position.set(m.x,m.y,m.z); base.rotation.y=m.yaw;
    const piv=KIND[k].piv; turn.position.set(0,piv,0); base.add(turn); turn.add(gun);
    if(k==='maxim'){ /* Sokolov wheeled carriage, shield, water jacket */
      for(const s of [-1,1]){ cy(base,X.tyre,0.24,0.24,0.07,s*0.32,0.24,0.25,0,0,H2,14); cy(base,X.olive,0.06,0.06,0.09,s*0.32,0.24,0.25,0,0,H2,8); }
      bx(base,X.olive,0.7,0.05,0.08,0,0.24,0.25); bx(base,X.olive,0.06,0.05,1.0,0,0.14,0.75,0.15); bx(base,X.olive,0.12,0.3,0.1,0,piv-0.15,0.05);
      bx(turn,X.olive,0.62,0.32,0.03,0,-0.14,-0.18,0.12,0,0); bx(turn,X.dark,0.12,0.03,0.035,0.0,-0.02,-0.19);
      cy(gun,X.olive,0.075,0.075,0.62,0,0.02,-0.5,H2,0,0,14); for(let i=0;i<6;i++) cy(gun,X.olive,0.079,0.079,0.02,0,0.02,-0.25-i*0.1,H2,0,0,14);
      cy(gun,X.gun,0.018,0.018,0.2,0,0.02,-0.9,H2,0,0,8); bx(gun,X.gun,0.14,0.15,0.36,0,0.01,0.0); bx(gun,X.brass,0.03,0.025,0.03,0,0.11,-0.05);
      for(const s of [-1,1]) bx(gun,X.wood,0.03,0.12,0.03,s*0.07,0.0,0.24,0.3); bx(gun,X.gun,0.17,0.02,0.02,0,0.05,0.22); bx(gun,X.olive,0.2,0.18,0.22,0.17,-0.05,0.0); gun.userData.muzzle=new THREE.Vector3(0,0.02,-1.0); }
    else if(k==='mg42'){ /* MG42 on its bipod over the sandbags (or a lafette in the pillbox) */
      bx(gun,X.gun,0.08,0.09,0.42,0,0,0.02); cy(gun,X.gun,0.034,0.034,0.5,0,0.01,-0.42,H2,0,0,10); for(let i=0;i<5;i++) bx(gun,X.dark,0.07,0.012,0.04,0,0.035,-0.24-i*0.08);
      cy(gun,X.gun,0.012,0.012,0.12,0,0.01,-0.72,H2,0,0,8); bx(gun,X.wood,0.05,0.1,0.26,0,-0.03,0.34,0.12); bx(gun,X.wood,0.035,0.11,0.04,0,-0.08,0.1,0.25); bx(gun,X.gun,0.1,0.04,0.08,-0.06,-0.04,-0.02);
      for(const s of [-1,1]) bx(gun,X.gun,0.015,0.3,0.015,s*0.08,-0.15,-0.36,0.4,0,s*0.25); bx(base,X.olive,0.22,0.16,0.12,0.25,piv-0.25,0.05);
      if(m.inside){ for(const s of [-1,1]) bx(base,X.gun,0.03,piv,0.03,s*0.18,piv/2,0.25,0,0,s*0.15); bx(base,X.gun,0.03,piv,0.03,0,piv/2,0.5,-0.3); }
      gun.userData.muzzle=new THREE.Vector3(0,0.01,-0.78); }
    else { /* towed AT gun: split trails, wheels, shield, long barrel */ const pak=k==='pak40', c=pak?X.grey:X.olive, BL=pak?3.0:2.1;
      for(const s of [-1,1]){ cy(base,X.tyre,0.36,0.36,0.14,s*0.82,0.36,0.1,0,0,H2,16); cy(base,c,0.18,0.18,0.16,s*0.82,0.36,0.1,0,0,H2,10);
        bx(base,c,0.1,0.1,2.0,s*0.45,0.18,1.05,0.1,s*0.28,0); bx(base,c,0.2,0.08,0.22,s*0.75,0.03,1.95); }
      bx(base,c,1.5,0.12,0.18,0,0.38,0.1); bx(base,c,0.3,piv-0.38,0.3,0,(piv+0.38)/2,0.1);
      const sh=pak?[[0.62,0.72,0.025,-0.52,0.02,-0.25,0,0.22],[0.62,0.72,0.025,0.52,0.02,-0.25,0,-0.22],[0.5,0.55,0.025,0,0.1,-0.3,0,0]]:[[1.3,0.7,0.025,0,0.05,-0.3,0,0]];
      for(const [w,h,d,x,y,z,rx,ry] of sh) bx(turn,c,w,h,d,x,y,z,0.15,ry,0);
      bx(gun,c,0.26,0.22,0.9,0,0,0.2); cy(gun,X.gun,0.05,0.06,BL,0,0.02,-BL/2,H2,0,0,12); if(pak){ bx(gun,X.gun,0.16,0.1,0.18,0,0.02,-BL-0.05); } else cy(gun,X.gun,0.06,0.06,0.12,0,0.02,-BL,H2,0,0,10);
      bx(gun,X.gun,0.06,0.18,0.06,0.2,-0.08,0.5); cy(gun,X.brass,0.04,0.04,0.35,-0.25,-0.1,0.9,H2,0,0,8); gun.userData.muzzle=new THREE.Vector3(0,0.02,-BL-0.15); }
    base.traverse(o=>{ if(o.isMesh) o.receiveShadow=true; }); grp.add(base); return {base,turn,gun}; }
  function build(){ clear(); const D=MAP&&MAP.mounts; if(!D||!D.length) return; grp=new THREE.Group(); grp.name='mounts'; R.scene.add(grp);
    L=D.map(d=>{ const parts=build1(d); return Object.assign({def:d,id:d.id,k:d.k,heat:0,lock:0,cd:0,aimY:d.yaw,aimP:0,occ:null},parts); }); }
  function clear(){ if(grp){ R.scene.remove(grp); grp.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); } grp=null; L=[]; if(hud) hud.style.display='none';
    if(typeof Game!=='undefined'&&Game.actors) for(const a of Game.actors){ a.mount=null; a.mountNet=false; } }
  /* ---------- who is where ---------- */
  const opOf=m=>({x:m.def.op[0],z:m.def.op[1],y:m.def.op[2]});
  function occupant(m){ for(const a of Game.actors){ if(!a.alive) continue; if(a.mount===m) return a; if(!a.local&&a.mountNet){ const o=opOf(m); if(Math.hypot(a.x-o.x,a.z-o.z)<1.0&&Math.abs(a.y-o.y)<0.8) return a; } } return null; }
  function near(a){ let best=null, bd=1.7; for(const m of L){ const o=opOf(m), d=Math.hypot(a.x-o.x,a.z-o.z); if(d<bd&&Math.abs(a.y-o.y)<1.3&&!occupant(m)){ bd=d; best=m; } } return best; }
  function promptFor(a){ if(!L.length||!a||a.bot) return null; if(a.mount) return null; const m=near(a); return m?'E: '+KIND[m.k].name+' 잡기':null; }
  /* ---------- getting on and off ---------- */
  function enter(a,m){ a.mount=m; m.occ=a; const o=opOf(m); a.x=o.x; a.z=o.z; a.y=o.y; a.vx=a.vz=a.vy=0; a.crouch=false; a.ads=false; a.adsT=0; a.yaw=m.def.yaw; a.pitch=0; a.mcd=0; a.reloadT=0; a.mountT=Game.t;
    a.mslot={id:KIND[m.k].w,mag:9999,max:9999,res:0,w:WPN[KIND[m.k].w]};
    if(!a.bot&&a===Game.me){ Sfx.play('switch_01',{vol:0.6,rate:0.7}); showHud(m); } }
  function leave(a){ const m=a.mount; if(!m) return; a.mount=null; a.mslot=null; m.occ=null; if(a===Game.me){ if(hud) hud.style.display='none'; Sfx.play('switch_02',{vol:0.5,rate:0.8}); }
    /* step back off the fire step / out from behind the gun */
    const back=Math.atan2(Math.sin(m.def.yaw),Math.cos(m.def.yaw)); const bx=a.x+Math.sin(back)*0.5, bz=a.z+Math.cos(back)*0.5; if(!blockedAt(bx,bz,a.y,PH)){ a.x=bx; a.z=bz; } }
  /* held at the gun: position pinned, view inside the arc */
  function pin(a){ const m=a.mount, o=opOf(m); a.x=o.x; a.z=o.z; a.y=o.y; a.vx=a.vz=0; a.vy=0; a.gr=true; a.crouch=false;
    let d=a.yaw-m.def.yaw; d=Math.atan2(Math.sin(d),Math.cos(d)); const arc=m.def.arc; if(d>arc) a.yaw=m.def.yaw+arc; else if(d<-arc) a.yaw=m.def.yaw-arc;
    a.pitch=Math.max(PITCH[0],Math.min(PITCH[1],a.pitch)); }
  /* the trigger, while manning (called instead of the normal weapon logic) */
  function weapon(a,I,dt){ const m=a.mount, K=KIND[m.k], w=a.mslot.w; recoilRecover(a,dt); a.bloom=Math.max(0,(a.bloom||0)-dt*2.2); a.mcd-=dt;
    if(I.useHit){ leave(a); return; }
    if(K.mg&&Game.t-(a.mShot||0)>0.35){ m.heat=Math.max(0,m.heat-dt*K.cool*(m.lock>0?1.6:1)); } if(K.mg){ if(m.lock>0){ m.lock-=dt; if(m.lock<=0&&a===Game.me) Sfx.play('switch_02',{vol:0.4,rate:1.3}); } }
    const can=a.mcd<=0&&!(m.lock>0)&&Game.state==='live'&&!Game.freeze;
    if(I.fire&&can&&(w.mode!=='semi'||!a.fireHeld)){ a.mslot.mag=9999; fire(a,w,a.mslot); a.mcd=60/w.rpm; a.mShot=Game.t;
      if(K.mg){ m.heat+=K.heat; if(m.heat>=1){ m.heat=1; m.lock=2.6; if(a===Game.me){ Sfx.play('switch_01',{vol:0.7,rate:1.6}); HUD.toast&&HUD.toast('총열 과열! 잠시 식혀요'); } } }
      else if(a===Game.me) setTimeout(()=>Sfx.play('reload_shotgun',{vol:0.5,rate:0.6}),900); }
    a.fireHeld=!!I.fire; if(a===Game.me) updHud(m,a); }
  function muzzle(a){ const m=a.mount||null; if(!m||!m.gun.userData.muzzle) return null; m.gun.updateMatrixWorld(true); const p=m.gun.userData.muzzle.clone().applyMatrix4(m.gun.matrixWorld); return {x:p.x,y:p.y,z:p.z}; }
  /* ---------- per frame ---------- */
  function update(dt,I){ if(!L.length||!Game.active) return; const me=Game.me;
    if(me&&!me.bot){ if(me.mount&&(!me.alive||Game.state==='end')) leave(me);
      else if(!me.mount&&me.alive&&I&&I.useHit&&Game.state==='live'){ const m=near(me); if(m) enter(me,m); } }
    for(const a of Game.actors) if(a.mount&&!a.alive) leave(a);
    if(Game.host||window.__forceBots) botsUse(dt);
    /* turn each gun to its gunner's aim (smoothly), or let it settle */
    for(const m of L){ const a=occupant(m); m.occ=a; const ty=a?a.yaw:m.def.yaw, tp=a?a.pitch:-0.05; const k=Math.min(1,dt*(a?18:2));
      let d=ty-m.aimY; d=Math.atan2(Math.sin(d),Math.cos(d)); m.aimY+=d*k; m.aimP+=(tp-m.aimP)*k;
      m.turn.rotation.y=m.aimY-m.def.yaw; m.gun.rotation.x=m.aimP; } }
  /* bots: a bot that walks past a free gun of its own side mans it while it has something to shoot at, then gets back to work */
  function botsUse(dt){ for(const a of Game.actors){ if(!a.bot||!a.local||!a.alive) continue;
      if(a.mount){ const m=a.mount, see=a.brain&&a.brain.target&&a.brain.target.alive; if(see) a.mSeen=Game.t;
        if(Game.t-(a.mSeen||a.mountT)>7||Game.t-a.mountT>45||a.hp<35) leave(a); continue; }
      if((a.mCool||0)>Game.t) continue; a.mCool=Game.t+1.5+Math.random();
      for(const m of L){ if(m.def.team!=null&&m.def.team!==a.team) continue; if(occupant(m)) continue; const o=opOf(m);
        if(Math.hypot(a.x-o.x,a.z-o.z)<3.2&&Math.abs(a.y-o.y)<1.3&&Math.random()<0.55){ enter(a,m); a.mSeen=Game.t; break; } } } }
  /* ---------- the little gun panel ---------- */
  function showHud(m){ if(!hud){ hud=document.createElement('div'); hud.id='hMount'; hud.style.cssText='position:fixed;left:50%;bottom:120px;transform:translateX(-50%);background:rgba(12,14,16,.72);color:#eee;padding:8px 14px;border-radius:10px;font:600 13px/1.3 sans-serif;text-align:center;z-index:30;pointer-events:none;min-width:200px';
      hud.innerHTML='<div id="hMountN"></div><div style="height:6px;background:#333;border-radius:3px;margin:6px 0 4px;overflow:hidden"><div id="hMountB" style="height:100%;width:0;background:#ffb347"></div></div><div id="hMountH" style="opacity:.75;font-size:11px"></div>';
      document.body.appendChild(hud); }
    hud.style.display='block'; $('hMountN').textContent=KIND[m.k].name; $('hMountH').textContent=(isTouch?'손 버튼':'E')+': 내리기 · '+(KIND[m.k].mg?'오래 쏘면 과열돼요':'한 발씩 장전돼요'); }
  function updHud(m,a){ if(!hud) return; const b=$('hMountB'); if(!b) return; const K=KIND[m.k];
    if(K.mg){ b.style.width=Math.round(m.heat*100)+'%'; b.style.background=m.lock>0?'#ff4d3d':m.heat>0.7?'#ff8a3a':'#ffb347'; }
    else { const r=1-Math.max(0,a.mcd)/(60/WPN[K.w].rpm); b.style.width=Math.round(r*100)+'%'; b.style.background=r>=1?'#4dff8a':'#9aa0a6'; } }
  return {build,clear,update,pin,weapon,muzzle,promptFor,leave,get list(){ return L; }};
})();
