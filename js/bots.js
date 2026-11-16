/* bots.js — AI players. They perceive (FOV + line of sight + sounds), path over the nav graph (stairs, ladders, jumps),
   fight with difficulty-based reaction and aim error, and play every mode's objective. Run on the host only. */
'use strict';
const Bots=(()=>{
  const DIFF={easy:{react:0.65,err:0.075,turn:3.2,fov:1.7,hs:0.05,burst:0.35,name:'쉬움'},normal:{react:0.38,err:0.04,turn:5.5,fov:2.0,hs:0.15,burst:0.6,name:'보통'},hard:{react:0.2,err:0.018,turn:9,fov:2.3,hs:0.35,burst:0.9,name:'어려움'}};
  const NAMES=['민준','서연','도윤','하은','시우','지우','예준','수아','주원','지호','서윤','건우','유진','현우','채원','은우','하린','준서','다은','태윤','소율','로운','아린','이안'];
  function botName(i){ return NAMES[i%NAMES.length]+(i>=NAMES.length?i:''); }
  function update(dt){ for(const a of Game.actors) if(a.bot&&a.local){ try{ think(a,dt); }catch(e){ console.error('bot',e); } } }
  function brain(a){ return a.brain||(a.brain={path:null,pi:0,goal:null,goalT:0,repath:0,target:null,seenT:0,lastSeen:null,react:0,strafe:1,strafeT:0,stuckT:0,lastPos:{x:a.x,z:a.z},
    aimErrX:0,aimErrY:0,nextThink:0,throwT:Game.t+rand(5,12),specT:Game.t+rand(4,10),roam:null,site:null,pkI:1,fleeT:0}); }
  const D=a=>DIFF[a.diff]||DIFF.normal;
  /* ---------- main ---------- */
  function think(a,dt){
    const b=brain(a); const I={mx:0,mz:0,jump:false,jumpHit:false,crouch:false,crouchHit:false,fire:false,ads:false,reload:false,use:false,throwHit:false,special:false,swap:false,w1:false,w2:false,w3:false,wheel:0};
    a.botUse=false;
    if(!a.alive){ b.path=null; b.target=null; return; }
    if(Game.freeze||Game.state!=='live'){ moveActor(a,I,dt); return; }
    if(Game.kind==='tag') tagThink(a,b,I,dt); else battleThink(a,b,I,dt);
    a.botUse=!!I.use;
    moveActor(a,I,dt); weaponUpdate(a,I,dt);
  }
  /* ---------- perception ---------- */
  function canSee(a,v,fovMul){ if(!v.alive||v.jailed||v.escaped) return false; const dx=v.x-a.x, dz=v.z-a.z, d=Math.hypot(dx,dz); if(d>90) return false;
    if(d>6){ const f=fwd(a.yaw); const ang=Math.acos(clamp((dx*f.x+dz*f.z)/d,-1,1)); if(ang>(fovMul||D(a).fov)/2) return false; }
    return losSight(a.x,eyeY(a),a.z,v.x,v.y+v.ph-0.25,v.z)||losSight(a.x,eyeY(a),a.z,v.x,v.y+0.9,v.z); }
  function pickTarget(a,b){ let best=null, bd=1e9;
    for(const v of Game.actors){ if(!isEnemy(a,v)||!v.alive||v.spawnProt>0.8) continue; const d=Math.hypot(v.x-a.x,v.z-a.z);
      const heard=v.revealT>Game.t&&d<35; if(!(canSee(a,v)||(heard&&d<10&&canSee(a,v,6.3)))) { if(heard&&!b.lastSeen) b.lastSeen={x:v.x,y:v.y,z:v.z,t:Game.t}; continue; }
      const s=d-(v===b.target?8:0)+(v.hp<40?-5:0); if(s<bd){ bd=s; best=v; } }
    return best; }
  /* ---------- aiming ---------- */
  function aimAt(a,b,x,y,z,dt,rate){ const dx=x-a.x, dy=y-eyeY(a), dz=z-a.z; const yaw=Math.atan2(-dx,-dz), pitch=Math.atan2(dy,Math.hypot(dx,dz));
    const t=D(a).turn*(rate||1)*dt; const dyaw=angDiff(a.yaw,yaw+b.aimErrX), dp=(pitch+b.aimErrY)-a.pitch;
    a.yaw+=clamp(dyaw,-t,t); a.pitch+=clamp(dp,-t*0.7,t*0.7); return Math.abs(dyaw)+Math.abs(dp); }
  function lookAlong(a,x,z,dt){ const yaw=Math.atan2(-(x-a.x),-(z-a.z)); const t=D(a).turn*0.6*dt; a.yaw+=clamp(angDiff(a.yaw,yaw),-t,t); a.pitch+=clamp(-a.pitch*0.5,-t,t); }
  /* move toward a world point by converting to local intents */
  function steer(a,I,x,z,strafeOnly){ const dx=x-a.x, dz=z-a.z, l=Math.hypot(dx,dz); if(l<0.05) return; const wx=dx/l, wz=dz/l;
    const f=fwd(a.yaw), r={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)}; I.mx=wx*r.x+wz*r.z; I.mz=-(wx*f.x+wz*f.z); }
  /* ---------- pathing ---------- */
  function goTo(a,b,I,gx,gy,gz,dt,opts){
    opts=opts||{};
    const far=!b.goal||Math.hypot(b.goal.x-gx,b.goal.z-gz)>3||Math.abs((b.goal.y||0)-gy)>1.5;
    if(far||!b.path||Game.t>b.repath){ b.goal={x:gx,y:gy,z:gz}; b.repath=Game.t+(opts.fast?0.6:2.5);
      const s=nearestNode(a.x,a.y,a.z,true)||nearestNode(a.x,a.y,a.z), e=nearestNode(gx,gy,gz,true,true)||nearestNode(gx,gy,gz,false,true); b.path=navPath(s,e); b.pi=0;
      if(!b.path){ b.path=[{x:gx,z:gz,h:gy}]; } }
    const p=b.path; if(!p||b.pi>=p.length){ if(Math.hypot(gx-a.x,gz-a.z)>0.6) steer(a,I,gx,gz); return true; }
    let w=p[b.pi];
    while(w&&Math.hypot(w.x-a.x,w.z-a.z)<(w.ladder?0.5:0.9)&&Math.abs(w.h-a.y)<1.2){ b.pi++; w=p[b.pi]; }
    if(!w) return true;
    if(w.ladder){ const L=w.ladder, f=FACE[L.face]; const bx=L.x-f[0]*0.55, bz=L.z-f[1]*0.55;
      if(Math.hypot(bx-a.x,bz-a.z)>0.45&&a.y<L.y0+0.5) steer(a,I,bx,bz); else steer(a,I,L.x+f[0]*2,L.z+f[1]*2);
      if(a.y>=L.y1-0.2) b.pi++; return false; }
    steer(a,I,w.x,w.z);
    if(w.jump&&a.gr&&Math.hypot(w.x-a.x,w.z-a.z)<2.2&&w.h>a.y+0.3) I.jumpHit=true;
    /* stuck */
    b.stuckT+=dt; if(b.stuckT>1.2){ const mv=Math.hypot(a.x-b.lastPos.x,a.z-b.lastPos.z); b.lastPos={x:a.x,z:a.z}; b.stuckT=0;
      if(mv<0.6){ I.jumpHit=true; b.repath=0; b.pi=Math.min(b.pi+1,p.length); b.strafe=-b.strafe; } }
    return false;
  }
  function roamPoint(a){ for(let i=0;i<30;i++){ const n=NODES[(Math.random()*NODES.length)|0]; if(n&&NREACH.has(n.i)&&!n.oid) return {x:n.x,y:n.h,z:n.z}; } return {x:SPAWN_RUN.x,y:0,z:SPAWN_RUN.z}; }
  /* ---------- battle ---------- */
  function battleThink(a,b,I,dt){
    const d=D(a), w=curW(a), s=curSlot(a), mode=Game.mode;
    if(mode==='pk') return pkThink(a,b,I,dt);
    /* perception every 0.15s */
    if(Game.t>b.nextThink){ b.nextThink=Game.t+0.15; const t=pickTarget(a,b);
      if(t&&t!==b.target){ b.target=t; b.react=Game.t+d.react*(0.7+Math.random()*0.6); b.aimErrX=(Math.random()-0.5)*d.err*8; b.aimErrY=(Math.random()-0.5)*d.err*5; }
      if(!t&&b.target){ b.lastSeen={x:b.target.x,y:b.target.y,z:b.target.z,t:Game.t}; b.target=null; } }
    const T=b.target&&b.target.alive?b.target:null; if(!T&&b.target) b.target=null;
    b.aimErrX*=Math.max(0,1-dt*1.6); b.aimErrY*=Math.max(0,1-dt*1.6);
    /* objective goal */
    const goal=objective(a,b);
    if(T){ const dist=Math.hypot(T.x-a.x,T.z-a.z);
      /* weapon choice */
      if(dist<2.6&&a.slots.length>2&&a.cur!==2&&a.switchT<=0&&Math.random()<0.6) I.w3=true;
      else if(s&&w&&w.mag&&s.mag===0&&s.res===0&&a.cur===0&&a.slots[1]) I.w2=true;
      else if(s&&w&&w.mag&&s.mag===0&&dist<9&&a.cur===0&&a.slots[1]&&a.slots[1].mag>0) I.w2=true;
      else if(a.cur===2&&dist>5&&a.slots[0]&&(a.slots[0].mag>0||a.slots[0].res>0)) I.w1=true;
      const head=Math.random()<d.hs; const ty=T.y+(head?T.ph-0.15:T.ph*0.62);
      const lead=w&&w.proj?dist/(w.pspeed||40):0.04; const err=aimAt(a,b,T.x+(T.vx||0)*lead,ty,T.z+(T.vz||0)*lead,dt,1.4);
      const ready=Game.t>b.react;
      if(ready&&w){ const tol=w.mode==='melee'?0.6:Math.max(0.03,Math.atan2(0.5,dist)*1.4)+(w.pellets>1?0.08:0);
        if(err<tol&&dist<(w.mode==='melee'?w.reach+0.5:Math.max(w.far*1.2,30))){ if(w.mode==='auto'){ b.burstT=(b.burstT||0)+dt; I.fire=b.burstT<d.burst+0.3*Math.random()||dist<12; if(b.burstT>d.burst+0.5) b.burstT=0; } else I.fire=!a.fireHeld; }
        I.ads=w.mode!=='melee'&&dist>14&&w.cat!=='sg'; }
      /* movement while fighting: strafe, keep preferred range, or push to melee */
      b.strafeT-=dt; if(b.strafeT<=0){ b.strafeT=rand(0.5,1.3); b.strafe=Math.random()<0.5?-1:1; if(a.diff==='hard'&&Math.random()<0.25) I.jumpHit=true; }
      const pref=w&&w.mode==='melee'?1.2:w&&w.cat==='sg'?6:w&&w.cat==='sr'?30:14;
      const r={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)};
      if(goal&&goal.urgent){ goTo(a,b,I,goal.x,goal.y||0,goal.z,dt,{fast:true}); }
      else { const toward=dist>pref+4?1:dist<pref-4?-1:0; const f=fwd(a.yaw);
        I.mx=b.strafe*0.8; I.mz=-toward; if(toward===0&&Math.random()<0.002) I.crouchHit=true; if(a.diff!=='easy'&&dist>18&&w&&w.cat==='sr') I.crouch=true; }
      /* grenades at targets behind cover */
      if(Game.t>b.throwT&&a.thrLeft>0&&dist>7&&dist<24){ b.throwT=Game.t+rand(8,16); if(Math.random()<0.5) I.throwHit=true; }
    } else {
      if(s&&w&&w.mag&&s.mag<s.max*0.5&&s.res>0) I.reload=true;
      if(a.cur!==0&&a.slots[0]&&(a.slots[0].mag>0||a.slots[0].res>0)&&a.switchT<=0) I.w1=true;
      let g=goal; if(!g&&b.lastSeen&&Game.t-b.lastSeen.t<6) g=b.lastSeen; if(!g){ if(!b.roam||Math.hypot(b.roam.x-a.x,b.roam.z-a.z)<3||Game.t>b.roamT){ b.roam=huntPoint(a); b.roamT=Game.t+20; } g=b.roam; }
      const arrived=goTo(a,b,I,g.x,g.y||0,g.z,dt); if(g.hold&&arrived&&g.use) I.use=true;
      if(!b.path||b.pi>=b.path.length) lookAlong(a,a.x+Math.sin(Game.t*0.7+a.x)*5,a.z+Math.cos(Game.t*0.7)*5,dt); else { const p=b.path[Math.min(b.pi+2,b.path.length-1)]; lookAlong(a,p.x,p.z,dt); }
      if(g.use&&Math.hypot(g.x-a.x,g.z-a.z)<(g.r||3)) I.use=true;
    }
    if(Game.t>b.specT&&a.load&&SP[a.load.spec]){ b.specT=Game.t+rand(10,25); const k=a.load.spec; if((k==='health'&&a.hp<70)||(k==='ammo'&&s&&s.res<(w&&w.res||0)*0.4)||(k==='wall'&&T)||k==='trophy') I.special=true; }
  }
  function huntPoint(a){ // somewhere enemies are likely: near an enemy we know about, or random reachable
    const en=Game.actors.filter(v=>isEnemy(a,v)&&v.alive); if(en.length&&Math.random()<0.6){ const v=pick(en); return {x:v.x+rand(-8,8),y:v.y,z:v.z+rand(-8,8)}; } return roamPoint(a); }
  function objective(a,b){ const M=Modes.info(); if(!M) return null; const mode=Game.mode, Bt=BATTLE||{};
    if(mode==='dom'){ let best=null, bd=1e9; for(const p of M.pts){ const own=p.own===a.team&&Math.abs(p.prog)>0.95; const d=Math.hypot(p.x-a.x,p.z-a.z)+(own?60:0)+(a.id.charCodeAt(0)%3)*10; if(d<bd){ bd=d; best=p; } }
      return best?{x:best.x+rand(-2,2),y:best.y,z:best.z+rand(-2,2),hold:true}:null; }
    if(mode==='hp'&&M.hp&&M.hp.list.length){ const p=M.hp.list[M.hp.i]; return {x:p.x,y:p.y,z:p.z,hold:true}; }
    if(mode==='ctf'){ const mine=M.flags[a.team], theirs=M.flags[1-a.team];
      if(theirs.carrier===a.id) return {x:mine.hx,y:mine.hy,z:mine.hz,urgent:true};
      if(mine.carrier){ const c=Game.byId.get(mine.carrier); if(c) return {x:c.x,y:c.y,z:c.z,urgent:true}; }
      if(!mine.home) return {x:mine.x,y:mine.y,z:mine.z,urgent:true};
      return (a.id.charCodeAt(1)%3===0)?{x:mine.hx+rand(-6,6),y:mine.hy,z:mine.hz+rand(-6,6)}:{x:theirs.x,y:theirs.y,z:theirs.z}; }
    if(mode==='upl'&&M.drive){ const d=M.drive, goals=(Bt.upload||{}).goals||[];
      if(d.carrier===a.id){ const g=goals[1-a.team]; return g?{x:g.x,y:g.y||0,z:g.z,urgent:true}:null; }
      return {x:d.x,y:d.y,z:d.z,urgent:!!d.carrier&&Game.byId.get(d.carrier)&&Game.byId.get(d.carrier).team!==a.team}; }
    if(mode==='kc'&&M.tags.length){ let best=null, bd=25; for(const t of M.tags){ const d=Math.hypot(t.x-a.x,t.z-a.z); if(d<bd){ bd=d; best=t; } } if(best) return {x:best.x,y:best.y,z:best.z}; }
    if(mode==='snd'&&M.bomb){ const bm=M.bomb, sites=Bt.sites||[]; if(!b.site||b.round!==M.round){ b.site=pick(sites); b.round=M.round; }
      if(a.team===M.att){ if(bm.carrier===a.id) return b.site?{x:b.site.x,y:b.site.y||0,z:b.site.z,use:true,r:3.5,hold:true}:null;
        if(!bm.carrier&&!bm.planted) return {x:bm.x,y:bm.y,z:bm.z,urgent:true}; if(bm.planted) return {x:bm.x+rand(-5,5),y:bm.y,z:bm.z+rand(-5,5),hold:true};
        const c=Game.byId.get(bm.carrier); return c?{x:c.x+rand(-4,4),y:c.y,z:c.z+rand(-4,4)}:null; }
      else { if(bm.planted) return {x:bm.x,y:bm.y,z:bm.z,use:true,r:2.2,urgent:true}; return b.site?{x:b.site.x+rand(-6,6),y:b.site.y||0,z:b.site.z+rand(-6,6),hold:true}:null; } }
    return null; }
  /* ---------- parkour ---------- */
  function pkThink(a,b,I,dt){ if(!PK) return; const boxes=PK.boxes;
    // find the platform we're on
    let on=-1; for(let i=0;i<boxes.length;i++){ const s=boxes[i]; if(a.x>=s.x0-0.2&&a.x<=s.x1+0.2&&a.z>=s.z0-0.2&&a.z<=s.z1+0.2&&Math.abs(a.y-s.y1)<0.15){ on=i; break; } }
    if(on>=0) b.pkI=on+1; if(b.pkI>=boxes.length) b.pkI=boxes.length-1;
    const nx=boxes[b.pkI], cx=(nx.x0+nx.x1)/2, cz=(nx.z0+nx.z1)/2; steer(a,I,cx,cz); lookAlong(a,cx,cz,dt*3);
    const cur=on>=0?boxes[on]:null; if(cur&&a.gr){ const edge=Math.max(Math.abs(a.x-(cur.x0+cur.x1)/2)-(cur.x1-cur.x0)/2,Math.abs(a.z-(cur.z0+cur.z1)/2)-(cur.z1-cur.z0)/2);
      if(edge>-0.45&&Math.hypot(cx-a.x,cz-a.z)>1.5) I.jumpHit=true; }
    if(a.diff==='easy'&&Math.random()<dt*0.3) I.mx+=rand(-0.5,0.5); }
  /* ---------- tag ---------- */
  function tagThink(a,b,I,dt){ const T=Tag.info(); if(!T) return; if(a.role==='seek') seekThink(a,b,I,dt,T); else runThink(a,b,I,dt,T); }
  function seekThink(a,b,I,dt,T){
    if(T.release>0){ lookAlong(a,SPAWN_RUN.x,SPAWN_RUN.z,dt); return; }
    if(Game.t>b.nextThink){ b.nextThink=Game.t+0.2; let best=null, bd=1e9;
      for(const r of Game.actors){ if(r.role!=='run'||!r.alive||r.jailed||r.escaped) continue; const d=Math.hypot(r.x-a.x,r.z-a.z);
        const vis=(Tag.seekerSees(a,r)&&losSight(a.x,eyeY(a),a.z,r.x,r.y+1.2,r.z))||Tag.revealed(r)&&d<60; if(vis&&d<bd){ bd=d; best=r; } }
      if(best){ b.target=best; b.lastSeen={x:best.x,y:best.y,z:best.z,t:Game.t}; b.noSee=0; } else { b.target=null; b.noSee=(b.noSee||0)+0.2; if(b.noSee>8&&a.radarCd<=Game.t){ a.botRadar=true; b.noSee=0; } } }
    const r=b.target;
    if(r&&r.alive&&!r.jailed){ const d=Math.hypot(r.x-a.x,r.z-a.z);
      if(d<8&&losSight(a.x,eyeY(a),a.z,r.x,r.y+1,r.z)) { steer(a,I,r.x+(r.vx||0)*0.3,r.z+(r.vz||0)*0.3); } else goTo(a,b,I,r.x,r.y,r.z,dt,{fast:true});
      aimAt(a,b,r.x,r.y+1.1,r.z,dt,1.2);
      if(Game.cfg.seekerGun&&d>4&&d<28&&a.slots[0]){ const s=a.slots[0]; if(s.mag>0&&Game.t>b.shotT){ b.shotT=Game.t+rand(0.4,0.9); I.fire=true; } else if(s.mag===0&&d>14) I.reload=true; }
      return; }
    /* no target: check revealed or last seen, else patrol orbs / gate */
    let g=null;
    if(b.lastSeen&&Game.t-b.lastSeen.t<7) g=b.lastSeen;
    else if(T.door&&DOOR&&Math.random()<0.6) g={x:(DOOR.c0+DOOR.c1)/2*CELL+rand(-4,4),y:0,z:(DOOR.r0+3)*CELL};
    else { if(!b.roam||Math.hypot(b.roam.x-a.x,b.roam.z-a.z)<3||Game.t>b.roamT){ const left=T.orbs.filter(o=>!o.taken); const jailed=Game.actors.some(x=>x.jailed);
        b.roam=jailed&&Math.random()<0.25?Object.assign({y:0},Tag.JAIL()):left.length&&Math.random()<0.7?pick(left):roamPoint(a); b.roamT=Game.t+15; } g=b.roam; }
    goTo(a,b,I,g.x,g.y||0,g.z,dt); if(b.path&&b.pi<b.path.length){ const p=b.path[Math.min(b.pi+2,b.path.length-1)]; lookAlong(a,p.x,p.z,dt*1.5); }
  }
  function runThink(a,b,I,dt,T){
    if(a.jailed||a.escaped) return;
    /* danger */
    let danger=null, dd=1e9; for(const s of Game.actors){ if(s.role!=='seek'||!s.alive) continue; const d=Math.hypot(s.x-a.x,s.z-a.z); if(d<dd&&d<22&&losSight(a.x,eyeY(a),a.z,s.x,s.y+1.4,s.z)){ dd=d; danger=s; } }
    if(danger&&(dd<14||Tag.seekerSees(danger,a))){ b.fleeT=Game.t+2.5; b.danger=danger; }
    if(Game.t<b.fleeT&&b.danger){ const s=b.danger;
      if(!b.flee||Game.t>b.fleeRe||Math.hypot(b.flee.x-a.x,b.flee.z-a.z)<3){ b.fleeRe=Game.t+1.5; let best=null, bs=-1e9;
        for(let i=0;i<24;i++){ const n=NODES[(Math.random()*NODES.length)|0]; if(!n||!NREACH.has(n.i)) continue; const ds=Math.hypot(n.x-s.x,n.z-s.z), da=Math.hypot(n.x-a.x,n.z-a.z); if(da>30||da<6) continue;
          const away=((n.x-a.x)*(a.x-s.x)+(n.z-a.z)*(a.z-s.z))/(da*Math.max(1,Math.hypot(a.x-s.x,a.z-s.z))); const sc=ds+away*12-(inZone(n.x,n.z)?15:0)+(n.h>2?3:0); if(sc>bs){ bs=sc; best=n; } }
        if(best) b.flee={x:best.x,y:best.h,z:best.z}; }
      if(b.flee){ goTo(a,b,I,b.flee.x,b.flee.y,b.flee.z,dt,{fast:true}); const p=b.path&&b.path[Math.min(b.pi+1,(b.path.length||1)-1)]; if(p) lookAlong(a,p.x,p.z,dt*2);
        if(dd<8&&a.gr&&Math.random()<dt*1.5) I.crouchHit=true; if(dd<5&&Math.random()<dt*2) I.jumpHit=true; }
      return; }
    /* objectives */
    let g=null, use=false;
    if(T.door&&DOOR) g={x:(DOOR.c0+DOOR.c1)/2*CELL,y:0,z:(DOOR.r0+0.4)*CELL};
    else { const jail=Tag.JAIL(); const jailed=Game.actors.filter(x=>x.jailed).length; const guard=Game.actors.some(s=>s.role==='seek'&&Math.hypot(s.x-jail.x,s.z-jail.z)<16);
      if(jailed&&!guard&&(a.id.charCodeAt(2)%2===0||jailed>=2)){ g={x:jail.x+1.5,y:0,z:jail.z+1.5}; use=Math.hypot(jail.x-a.x,jail.z-a.z)<3; }
      else { const left=T.orbs.filter(o=>!o.taken); let best=null, bs=1e9;
        for(const o of left){ let sc=Math.hypot(o.x-a.x,o.z-a.z)+Math.abs(o.y-a.y)*3; for(const s of Game.actors) if(s.role==='seek'&&s.alive&&Math.hypot(s.x-o.x,s.z-o.z)<12) sc+=40;
          for(const m of Game.actors) if(m!==a&&m.role==='run'&&m.brain&&m.brain.orb===o) sc+=25; if(sc<bs){ bs=sc; best=o; } }
        b.orb=best; if(best){ g={x:best.x,y:best.y,z:best.z}; use=Math.hypot(best.x-a.x,best.z-a.z)<1.5&&Math.abs(best.y-a.y)<1.6; } } }
    if(!g) g=roamPoint(a);
    if(use){ I.use=true; lookAlong(a,g.x,g.z,dt); return; }
    goTo(a,b,I,g.x,g.y||0,g.z,dt); if(b.path&&b.pi<b.path.length){ const p=b.path[Math.min(b.pi+2,b.path.length-1)]; lookAlong(a,p.x,p.z,dt*1.5); }
  }
  return {update,botName,DIFF};
})();
