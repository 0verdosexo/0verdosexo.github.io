/* tag.js — 술래잡기 for N players: seekers (술래) chase runners (도망자). Runners collect orbs, then escape through the gate.
   Caught runners go to the cage; a free runner can rescue them. The host owns orbs/door/jail; catches come from the seeker's owner. */
'use strict';
const Tag=(()=>{
  let T=null, vis=null, stAcc=0;
  const JAIL=()=>MAP.jail||{x:SPAWN_SEEK.x+8,z:SPAWN_SEEK.z};
  function init(S){
    const runners=Game.actors.filter(a=>a.role!=='seek'); for(const a of Game.actors){ const p=S.players.find(q=>q.id===a.id); a.role=p&&p.role||'run'; a.team=a.role==='seek'?1:0; }
    const nOrbs=Game.cfg.orbs||clamp(8+Math.floor(Game.actors.filter(a=>a.role==='run').length/2),8,14);
    T={orbs:pickOrbs(Game.seed,nOrbs).map((o,i)=>({id:i,x:o.x,y:o.y,z:o.z,taken:false})),door:false,time:(Game.cfg.time||10)*60,release:6,ver:0,radar:0,escaped:0,runners:Game.actors.filter(a=>a.role==='run').length};
    buildVisuals();
  }
  function cleanup(){ if(vis){ for(const o of vis.all) R.scene.remove(o); } vis=null; T=null; }
  function spawnPoint(a){ const i=Game.actors.filter(b=>b.role===a.role).indexOf(a); const s=a.role==='seek'?SPAWN_SEEK:SPAWN_RUN; const off=[[0,0],[2,0],[-2,0],[0,2],[2,2],[-2,2],[0,-2],[2,-2],[-2,-2],[4,0],[-4,0],[4,2],[-4,2]][i%13];
    let x=s.x+off[0], z=s.z+off[1]; if(blockedAt(x,z,0,PH,false)){ x=s.x; z=s.z; } return {x,y:0,z,yaw:s.yaw!=null?s.yaw:(a.role==='seek'?Math.PI:0)}; }
  function doorOpenFor(a){ return T&&T.door&&a.role==='run'; }
  const free=()=>Game.actors.filter(a=>a.role==='run'&&!a.jailed&&!a.escaped);
  function seekerSees(s,r){ if(r.escaped) return false; if(r.jailed) return true; if(inZone(r.x,r.z)) return true; const dx=r.x-s.x, dz=r.z-s.z, d=Math.hypot(dx,dz); if(d<2.2) return true; if(d>75) return false;
    const f=fwd(s.yaw); return (dx*f.x+dz*f.z)/d>Math.cos(Math.PI/6); }
  /* runner revealed to seekers (minimap): in a yellow zone, radar, or collecting */
  function revealed(r){ return T&&(inZone(r.x,r.z)||Game.t<T.radar||r.collect); }
  /* ---------- per frame ---------- */
  function update(dt,I){
    if(!T) return; const me=Game.me;
    if(Game.state==='live'){ if(T.release>0){ T.release-=dt; } T.time-=dt; if(Game.host&&T.time<=0) finish('time'); }
    for(const a of Game.actors){ if(!a.local||!a.alive) continue;
      const use=a===me?I.use:a.botUse;
      if(a.role==='seek'){
        if(Game.state==='live'&&T.release<=0) for(const r of Game.actors){ if(r.role!=='run'||!r.alive||r.jailed||r.escaped) continue; if(Math.hypot(r.x-a.x,r.z-a.z)<1.25&&Math.abs(r.y-a.y)<1.6&&!(r.catchT>Game.t)){ r.catchT=Game.t+1.5; Game.emit('catch',{s:a.id,r:r.id}); } }
        if(a===me&&I.radar&&a.radarCd<=Game.t){ a.radarCd=Game.t+10; Game.emit('radar',{a:a.id}); }
        if(a.bot&&a.botRadar&&a.radarCd<=Game.t){ a.radarCd=Game.t+10; a.botRadar=false; Game.emit('radar',{a:a.id}); } }
      else if(a.role==='run'&&!a.jailed&&!a.escaped){
        /* orbs */
        let near=null; for(const o of T.orbs){ if(o.taken) continue; if(Math.hypot(o.x-a.x,o.z-a.z)<1.7&&Math.abs(o.y-a.y)<1.8){ near=o; break; } }
        const jailNear=Game.actors.some(r=>r.jailed)&&Math.hypot(JAIL().x-a.x,JAIL().z-a.z)<3.2;
        if(use&&(near||jailNear)){ const key=near?'o'+near.id:'jail'; if(!a.collect||a.collect.key!==key) a.collect={key,t:0}; a.collect.t+=dt; const need=near?2:2.5;
          if(a===me) Bus.emit('hold',{p:a.collect.t/need,label:near?'구슬 모으는 중':'동료 구출 중'}); if(Math.random()<dt*6) Sfx.play('collect',{x:a.x,y:a.y,z:a.z,vol:0.3,rate:1+a.collect.t/need});
          if(a.collect.t>=need){ a.collect=null; if(near) Game.emit('orb',{a:a.id,o:near.id}); else Game.emit('free',{a:a.id}); if(a===me) Bus.emit('hold',null); } }
        else { if(a.collect&&a===me) Bus.emit('hold',null); a.collect=null; if(a===me) Bus.emit('prompt',near?'E 길게: 구슬 모으기':jailNear?'E 길게: 동료 구출':null); }
        /* portals */
        if(PORTALS.length===2&&(a.portalCd||0)<Game.t) PORTALS.forEach((p,i)=>{ if(Math.hypot(p.x-a.x,p.z-a.z)<1.3){ const q=PORTALS[1-i]; a.x=q.ex; a.z=q.ez; a.yaw=q.eyaw; a.portalCd=Game.t+1.5; Sfx.play('portal'); FX.ring(q.ex,1,q.ez,[0.3,0.8,1],1.2); } });
        /* escape through the open gate */
        if(T.door&&DOOR&&cellOf(a.z)<=DOOR.r0&&cellOf(a.x)>=DOOR.c0&&cellOf(a.x)<DOOR.c1){ a.escaped=true; a.alive=false; Game.emit('escape',{a:a.id}); }
      }
      if(a.jailed){ const j=JAIL(); const dx=a.x-j.x, dz=a.z-j.z, d=Math.hypot(dx,dz); if(d>2.2){ a.x=j.x+dx/d*2.2; a.z=j.z+dz/d*2.2; } }
    }
    if(Game.host){ stAcc+=dt; if(stAcc>0.5){ stAcc=0; broadcast(); } }
    animate(dt);
  }
  function finish(why){ if(Game.state==='end') return; const need=Math.max(1,Math.ceil(T.runners/2)); const runWin=T.escaped>=need;
    Game.emit('tend',{winRole:runWin?'run':'seek',why,esc:T.escaped,need}); }
  function checkEnd(){ if(!Game.host||Game.state!=='live') return; if(free().length===0) finish('done'); }
  function broadcast(){ if(!Game.host||!T) return; Game.emit('tstate',{o:T.orbs.map(o=>o.taken?1:0),d:T.door?1:0,tm:Math.round(T.time),rl:+T.release.toFixed(1),e:T.escaped,
    p:Game.actors.map(a=>[a.id,a.jailed?1:0,a.escaped?1:0,a.kills,a.score])}); }
  /* ---------- events ---------- */
  function handle(t,d){
    if(!T) return;
    if(t==='tstate'&&!Game.host){ d.o.forEach((v,i)=>{ if(T.orbs[i]) T.orbs[i].taken=!!v; }); if(d.d&&!T.door) openDoor(); T.time=d.tm; T.release=d.rl; T.escaped=d.e;
      for(const p of d.p){ const a=Game.byId.get(p[0]); if(!a) continue; if(!a.local){ a.jailed=!!p[1]; a.escaped=!!p[2]; } a.kills=p[3]; a.score=p[4]; } return; }
    if(t==='orb'){ const o=T.orbs[d.o]; if(!o||o.taken) return; o.taken=true; const a=Game.byId.get(d.a); if(a) a.score+=1; FX.sparkle(o.x,o.y+1,o.z,[1,0.85,0.3],24); Sfx.play('orb',{x:o.x,y:o.y,z:o.z,dist:40});
      Bus.emit('tagmsg',`${a?a.name:'?'} 구슬 획득 (${T.orbs.filter(x=>x.taken).length}/${T.orbs.length})`);
      if(T.orbs.every(x=>x.taken)&&!T.door) openDoor(); if(Game.host) broadcast(); return; }
    if(t==='catch'){ const r=Game.byId.get(d.r), s=Game.byId.get(d.s); if(!r||r.escaped||r.jailed) return; r.jailed=true; r.catchT=Game.t+1.5; r.collect=null; if(s) { s.kills++; s.score+=1; }
      if(r.local){ const j=JAIL(); r.x=j.x+rand(-1,1); r.z=j.z+rand(-1,1); r.y=0; r.vx=r.vz=0; r.alive=true; r.hp=100; }
      Sfx.play('caught',{x:r.x,y:r.y,z:r.z,dist:50}); Bus.emit('tagmsg',`${s?s.name:'술래'}가 ${r.name}를 잡았어요!`); if(r===Game.me) Bus.emit('caught');
      if(Game.host){ broadcast(); checkEnd(); } return; }
    if(t==='free'){ const a=Game.byId.get(d.a); let n=0; for(const r of Game.actors){ if(!r.jailed) continue; n++; r.jailed=false; if(r.local){ const p=spawnPoint(r); r.x=p.x; r.z=p.z; r.y=0; } }
      if(a) a.score+=n; FX.ring(JAIL().x,1,JAIL().z,[0.3,1,0.5],3); Sfx.play('capture'); Bus.emit('tagmsg',`${a?a.name:''}가 동료 ${n}명을 구출했어요!`); if(Game.host) broadcast(); return; }
    if(t==='escape'){ const a=Game.byId.get(d.a); if(!a) return; a.escaped=true; a.alive=false; if(a.av) a.av.root.visible=false; T.escaped=Game.actors.filter(x=>x.escaped).length; a.score+=3;
      Sfx.play('win',{vol:0.5}); Bus.emit('tagmsg',`${a.name} 탈출 성공! (${T.escaped}/${Math.ceil(T.runners/2)} 필요)`); if(Game.host){ broadcast(); checkEnd(); } return; }
    if(t==='radar'){ T.radar=Game.t+3; Sfx.play('alarm',{vol:0.5}); if(Game.me&&Game.me.role==='run') Bus.emit('tagmsg','술래가 레이더를 썼어요! 3초간 위치가 드러나요'); return; }
    if(t==='tend'){ Game.end(d); return; }
  }
  function onDeath(v,k,d){ // seeker gun brought a runner to 0 HP → caught
    if(v.role==='run'&&!v.escaped){ v.alive=true; v.hp=100; if(v.av) v.av.revive(); if(v.local) Game.emit('catch',{s:k?k.id:'',r:v.id}); }
    v.respawnAt=0; }
  function openDoor(){ T.door=true; Sfx.play('gong_01',{vol:0.8}); Bus.emit('tagmsg','구슬을 모두 모았어요! 탈출문이 열렸어요'); if(vis&&vis.gate) vis.gateOpen=true; }
  /* ---------- visuals ---------- */
  function buildVisuals(){ vis={all:[],orbs:[]}; const add=o=>{ R.scene.add(o); vis.all.push(o); return o; };
    const om=new THREE.MeshStandardMaterial({color:'#ffd34a',emissive:'#ffb020',emissiveIntensity:2.2,roughness:0.2,metalness:0.3});
    for(const o of T.orbs){ const g=add(new THREE.Group()); const s=new THREE.Mesh(new THREE.IcosahedronGeometry(0.32,2),om); s.position.y=1.1; g.add(s);
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,8,6,1,true),new THREE.MeshBasicMaterial({color:'#ffd34a',transparent:true,opacity:0.25,blending:THREE.AdditiveBlending,depthWrite:false})); b.position.y=4.5; g.add(b);
      g.position.set(o.x,o.y,o.z); vis.orbs.push({g,s,o}); }
    if(DOOR){ const x0=DOOR.c0*CELL, x1=DOOR.c1*CELL, z=(DOOR.r0+1)*CELL; const g=add(new THREE.Group());
      const frame=new THREE.Mesh(new THREE.BoxGeometry(x1-x0+1.2,7,1.2),new THREE.MeshStandardMaterial({color:'#2b2f36',metalness:0.7,roughness:0.4})); frame.position.set((x0+x1)/2,3.5,z-0.6); g.add(frame);
      const gate=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,5.6,0.4),new THREE.MeshStandardMaterial({color:'#ff4d3d',emissive:'#ff2a1a',emissiveIntensity:0.8,metalness:0.6,roughness:0.35})); gate.position.set((x0+x1)/2,2.8,z-0.3); g.add(gate); vis.gate=gate;
      frame.geometry=new THREE.BoxGeometry(x1-x0+1.2,1,1.2); frame.position.y=6.4; }
    const j=JAIL(); const cg=add(new THREE.Group()); const bar=new THREE.MeshStandardMaterial({color:'#9aa0a8',metalness:0.9,roughness:0.3});
    for(let i=0;i<20;i++){ const a=i/20*Math.PI*2; const m=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,3,6),bar); m.position.set(Math.cos(a)*2.5,1.5,Math.sin(a)*2.5); cg.add(m); }
    const top=new THREE.Mesh(new THREE.TorusGeometry(2.5,0.08,6,32),bar); top.rotation.x=Math.PI/2; top.position.y=3; cg.add(top); const bot=top.clone(); bot.position.y=0.05; cg.add(bot); cg.position.set(j.x,0,j.z); vis.jail=cg;
    for(const p of PORTALS){ const g=add(new THREE.Group()); const r=new THREE.Mesh(new THREE.TorusGeometry(1.1,0.1,8,32),new THREE.MeshBasicMaterial({color:'#3dd8ff'})); r.position.y=1.3; g.add(r);
      const d=new THREE.Mesh(new THREE.CircleGeometry(1.05,32),new THREE.MeshBasicMaterial({color:'#3dd8ff',transparent:true,opacity:0.35,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false})); d.position.y=1.3; g.add(d);
      g.position.set(p.x,0,p.z); g.rotation.y=p.yaw+Math.PI/2; vis.portal=(vis.portal||[]).concat(g); }
  }
  function animate(dt){ if(!vis) return; const t=Game.t; for(const v of vis.orbs){ v.g.visible=!v.o.taken; v.s.rotation.y+=dt*1.5; v.s.position.y=1.1+Math.sin(t*2+v.o.id)*0.15; }
    if(vis.gate){ const ty=vis.gateOpen?8.6:2.8; vis.gate.position.y+= (ty-vis.gate.position.y)*Math.min(1,dt*1.5); vis.gate.material.color.set(T.door?'#3dff8a':'#ff4d3d'); vis.gate.material.emissive.set(T.door?'#20ff60':'#ff2a1a'); }
    World.setZonesVisible(true); }
  function info(){ return T; }
  return {init,cleanup,spawnPoint,doorOpenFor,seekerSees,revealed,update,handle,onDeath,info,JAIL};
})();
