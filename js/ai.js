/* ai.js — AI seeker: vision, hearing, radar, multi-level pathfinding */
/* AI seeker sees only a 60° cone in front (cos 30° = 0.866), like the human seeker's view */
const DIFF={ easy:{view:26,near:2.5,hear:8,col:10,radar:0,smart:false,acc:0.32,react:0.8,head:0.08,label:'쉬움'},
  normal:{view:36,near:3,hear:11,col:14,radar:40,smart:true,acc:0.5,react:0.5,head:0.16,label:'보통'},
  hard:{view:46,near:3.5,hear:14,col:17,radar:25,smart:true,acc:0.68,react:0.3,head:0.26,label:'어려움'} };
const AI_FOV_TAG=0.866, AI_FOV_DUEL=0.5;
const AI=Object.assign(newEnt(),{gun:{ammo:5,rl:0,cd:0,aim:0},state:'patrol',path:null,pi:0,repath:0,last:null,searchT:0,stuckT:0,wait:0,radarT:0,radarOn:0,lastSeenT:-99,skipT:0,directT:0,direct:false});
function aiReset(){ const D=DIFF[prefs.diff]||DIFF.normal;
  const sp=S.game==='duel'?(duelSide()==='A'?SPAWN_SEEK:SPAWN_RUN):SPAWN_SEEK;
  Object.assign(AI,newEnt(),{hp:HP_MAX,gun:{ammo:CFG.mag,rl:0,cd:0,aim:0},x:sp.x,z:sp.z,yaw:sp.yaw,state:'patrol',path:null,pi:0,repath:0,last:null,searchT:0,stuckT:0,wait:1,radarT:D.radar||0,radarOn:0,lastSeenT:-99,skipT:0,directT:0,direct:false}); syncAI(); }
function syncAI(){ const o=S.opp; o.x=AI.x; o.y=AI.y; o.z=AI.z; o.yaw=AI.yaw; o.moving=AI.moving; o.air=!AI.gr; o.slide=false; o.hp=AI.hp; o.rl=AI.gun.rl>0; o.noisy=AI.moving; }
const aiGunOn=()=>S.game==='duel'||CFG.gun;
function aiOnShot(){ AI.last={x:S.me.x,y:S.me.y,z:S.me.z}; if(AI.state!=='chase'){ AI.state='chase'; AI.path=null; } }
function aiOnHit(){ aiOnShot(); AI.lastSeenT=perfT; }
function aiFace(x,z,dt){ const want=Math.atan2(-(x-AI.x),-(z-AI.z)); let df=want-AI.yaw; df=Math.atan2(Math.sin(df),Math.cos(df)); AI.yaw+=df*Math.min(1,dt*10); return Math.abs(df); }
function aiCombat(dt,sees,d3,clear){
  const g=AI.gun, D=DIFF[prefs.diff]||DIFF.normal; g.cd-=dt;
  if(g.rl>0){ g.rl-=dt; if(g.rl<=0){ g.rl=0; g.ammo=CFG.mag; } return; }
  if(g.ammo<=0){ g.rl=CFG.reload; return; }
  if(sees&&clear&&d3<45){ g.aim+=dt; const off=aiFace(S.me.x,S.me.z,dt);
    if(g.aim>=D.react&&g.cd<=0&&off<0.25){ g.ammo--; g.cd=FIRE_INT+0.3;
      const me=S.me; let p=D.acc*(1-Math.min(1,d3/55)); if(me.moving&&!me.quiet) p-=0.1; if(me.slideT>0||!me.gr) p-=0.15; p=Math.max(0.06,Math.min(0.9,p));
      const hit=Math.random()<p, head=hit&&Math.random()<D.head, ty=me.y+(head?me.ph-0.15:me.ph>1?1.1:0.45);
      let e=[me.x,ty,me.z]; if(!hit){ e=[me.x+(Math.random()-.5)*3,ty+(Math.random()-.3)*1.5,me.z+(Math.random()-.5)*3]; }
      const o=[AI.x,AI.y+1.45,AI.z], dx=e[0]-o[0],dy=e[1]-o[1],dz=e[2]-o[2], L=Math.hypot(dx,dy,dz)||1, wd=rayDist(o[0],o[1],o[2],dx/L,dy/L,dz/L,L+6);
      if(!hit||wd<L-0.6){ e=[o[0]+dx/L*wd,o[1]+dy/L*wd,o[2]+dz/L*wd]; oppShot(e,false,false); } else oppShot(e,true,head); } }
  else { g.aim=Math.max(0,g.aim-dt*2); if(!sees&&perfT-AI.lastSeenT>4&&g.ammo<CFG.mag) g.rl=CFG.reload; }
}
function randNodeNear(p,rad){ const c=cellOf(p.x),r=cellOf(p.z); for(let i=0;i<30;i++){ const nc=c+Math.round((Math.random()*2-1)*rad), nr=r+Math.round((Math.random()*2-1)*rad);
  if(!inB(nc,nr)) continue; const L=CELLN[nr*W+nc]; if(L.length){ const n=L[(Math.random()*L.length)|0]; return {x:n.x,y:n.h,z:n.z}; } } return {x:p.x,y:p.y||0,z:p.z}; }
function aiPickGoal(){
  const opts=[]; orbs.filter(o=>!o.taken).forEach(o=>opts.push([{x:o.x,y:o.y,z:o.z},3]));
  ZONES.forEach(q=>{ const p=ctr(((q.c0+q.c1)/2)|0,((q.r0+q.r1)/2)|0); opts.push([{x:p.x,y:0,z:p.z},1.4]); });
  const frac=S.collected.size/Math.max(1,orbTotal()); opts.push([doorFront(),frac>=0.8?10:frac>=0.5?2.5:0.5]);
  CFG.tp&&PORTALS.forEach(p=>opts.push([{x:p.ex,y:0,z:p.ez},0.7]));
  const n=NODES[(Math.random()*NODES.length)|0]; opts.push([{x:n.x,y:n.h,z:n.z},1.2]);
  let tot=opts.reduce((a,b)=>a+b[1],0), r=Math.random()*tot; for(const [p,w] of opts){ r-=w; if(r<=0) return p; } return opts[0][0];
}
function aiPathTo(p){
  const a=nearestNode(AI.x,AI.y,AI.z), b=nearestNode(p.x,p.y||0,p.z); AI.path=navPath(a,b); AI.pi=0;
  if(AI.path&&b&&Math.hypot(b.x-p.x,b.z-p.z)<3&&Math.abs(b.h-(p.y||0))<0.5) AI.path.push({x:p.x,z:p.z,h:p.y||0});
}
function aiMove(tx,tz,dt){
  const dx=tx-AI.x, dz=tz-AI.z, d=Math.hypot(dx,dz), sp=RUN_SPEED*(S.game==='duel'?1:CFG.seekMul)*dt;
  const st=d>0.05?Math.min(d,sp)/d:0; physStep(AI,dx*st,dz*st,dt,false);
  if(d>0.05){ const want=Math.atan2(-dx,-dz); let df=want-AI.yaw; df=Math.atan2(Math.sin(df),Math.cos(df)); AI.yaw+=df*Math.min(1,dt*9); }
  return d;
}
function aiFollow(dt){
  if(!AI.path||AI.pi>=AI.path.length){ physStep(AI,0,0,dt,false); return true; }
  AI.skipT-=dt;
  if(AI.skipT<=0){ AI.skipT=0.25;
    for(let i=Math.min(AI.path.length-1,AI.pi+4);i>AI.pi;i--){ const w=AI.path[i]; if(Math.abs(w.h-AI.y)>0.3) continue;
      const t=traverse(AI.x,AI.y,AI.z,w.x,w.z); if(t&&!t.jump&&Math.abs(t.y-w.h)<0.3){ AI.pi=i; break; } } }
  const w=AI.path[AI.pi], d=Math.hypot(w.x-AI.x,w.z-AI.z);
  if(AI.gr&&w.h>AI.y+STEP&&d<2.4){ AI.vy=JUMP_V; AI.gr=false; }
  aiMove(w.x,w.z,dt);
  if(d<0.75&&Math.abs(w.h-AI.y)<1.0) AI.pi++;
  return AI.pi>=AI.path.length;
}
function aiOnTeleport(from){ const D=DIFF[prefs.diff]||DIFF.normal; if(D.smart&&perfT-AI.lastSeenT<1.5){ const d=PORTALS[1-from]; AI.last={x:d.ex,y:0,z:d.ez}; AI.state='chase'; AI.path=null; AI.repath=0; } }
function aiUpdate(dt){
  const D=DIFF[prefs.diff]||DIFF.normal, r=S.me;
  if(AI.wait>0){ AI.wait-=dt; AI.moving=false; physStep(AI,0,0,dt,false); syncAI(); return; }
  const d=Math.hypot(r.x-AI.x,r.z-AI.z), d3=Math.hypot(d,r.y-AI.y);
  const duel=S.game==='duel', fov=duel?AI_FOV_DUEL:AI_FOV_TAG;
  if(S.phase!=='play'||AI.hp<=0){ physStep(AI,0,0,dt,false); syncAI(); return; }
  let sees=false;
  const clear=d3<D.view+10&&los3(AI.x,AI.y+1.6,AI.z,r.x,r.y+(r.ph>1?1.2:0.45),r.z);
  if(!duel&&CFG.zone&&inZone(r.x,r.z)) sees=true;
  if(AI.radarOn>0){ AI.radarOn-=dt; sees=true; }
  if(!sees&&d3<(duel?D.view+10:D.view)&&clear){
    const fx=-Math.sin(AI.yaw), fz=-Math.cos(AI.yaw), dot=((r.x-AI.x)*fx+(r.z-AI.z)*fz)/(d||1); if(d3<D.near||dot>fov) sees=true; }
  const heard=!sees&&((r.noisy&&d3<D.hear)||(S.collect&&d3<D.col));
  if(D.radar>0&&!duel){ AI.radarT-=dt; if(AI.radarT<=0&&perfT-AI.lastSeenT>10){ AI.radarT=D.radar; AI.radarOn=RADAR_T; sees=true; SFX.radar(); flash('AI 술래가 레이더를 썼어요! 위치가 드러났어요','danger',1.8); } }
  if(sees){ AI.last={x:r.x,y:r.y,z:r.z}; if(AI.state!=='chase'){ AI.path=null; } AI.state='chase'; AI.lastSeenT=perfT; }
  else if(heard){ AI.last={x:r.x+(Math.random()-.5)*3,y:r.y,z:r.z+(Math.random()-.5)*3}; if(AI.state!=='chase'){ AI.state='chase'; AI.path=null; } }
  const ox=AI.x, oz=AI.z;
  if(aiGunOn()) aiCombat(dt,sees,d3,clear);
  const holding=aiGunOn()&&(AI.gun.rl>0||(duel&&sees&&clear&&d3<26&&AI.gun.ammo>0));
  if(holding){ physStep(AI,0,0,dt,false); AI.path=null; if(sees) aiFace(r.x,r.z,dt); }
  else if(AI.state==='chase'){
    AI.directT-=dt;
    if(AI.directT<=0){ AI.directT=0.15; AI.direct=false;
      if(sees&&d<22&&Math.abs(r.y-AI.y)<0.7){ const t=traverse(AI.x,AI.y,AI.z,r.x,r.z); AI.direct=!!(t&&!t.jump&&Math.abs(t.y-r.y)<0.5); } }
    if(AI.direct&&sees){ aiMove(r.x,r.z,dt); AI.path=null; }
    else { AI.repath-=dt; if(!AI.path||AI.repath<=0){ aiPathTo(AI.last); AI.repath=0.6; }
      const done=aiFollow(dt); if((done||!AI.path)&&!sees){ AI.state='search'; AI.searchT=5; AI.path=null; } }
  } else if(AI.state==='search'){
    AI.searchT-=dt; if(!AI.path) aiPathTo(randNodeNear(AI.last,3)); if(aiFollow(dt)) AI.path=null;
    if(AI.searchT<=0){ AI.state='patrol'; AI.path=null; }
  } else {
    if(!AI.path){ aiPathTo(aiPickGoal()); if(!AI.path){ AI.wait=0.3; physStep(AI,0,0,dt,false); } }
    else if(aiFollow(dt)){ AI.path=null; AI.wait=0.3+Math.random()*0.7; }
  }
  const mv=Math.hypot(AI.x-ox,AI.z-oz); AI.moving=mv>0.01;
  AI.stuckT=!holding&&mv<RUN_SPEED*CFG.seekMul*dt*0.2?AI.stuckT+dt:0;
  if(AI.stuckT>0.7&&AI.gr&&AI.stuckT<0.75){ AI.vy=JUMP_V; AI.gr=false; }
  if(AI.stuckT>1.6){ AI.path=null; AI.stuckT=0; if(AI.state==='chase'){ AI.state='search'; AI.searchT=2; } }
  syncAI();
  if(!duel&&d<CATCH_R&&Math.abs(r.y-AI.y)<1.7) endGame('seeker','catch');
}
