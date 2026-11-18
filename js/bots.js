/* bots.js — AI players. They perceive (FOV + line of sight + sounds + being shot), path over the nav graph (stairs, ladders, jumps),
   fight with difficulty-based reaction and aim error, and play every mode's objective. Run on the host only.
   v7.4: natural movement — paths are straightened (no 2 m grid zig-zag), turning and walking ease in and out, bots stop to shoot
   instead of dancing left-right, back off to cover when hurt, turn round when shot from behind, and keep apart from teammates. */
'use strict';
const Bots=(()=>{
  /* react: seconds before the first shot · err: aim error (rad) · turn: max turn speed (rad/s) · ease: how quickly the aim settles (1/s)
     fov: view cone (rad) · hs: how often they go for the head · burst: trigger time per burst (s), close: extra when the enemy is near · stop: chance to stand still while shooting
     hurt: seconds to react when shot by someone they had not seen · spray: how well they pull down recoil (×) · cover: backs off to cover when hurt
     Measured with dev/botbench.js against a still target, M4 vs M4 (v7.4):
       time to kill  8 m / 20 m / 35 m — easy ≈ 2.9 / 4.0 / 5+ s · normal ≈ 1.6 / 2.2 / 3.2 s · hard ≈ 1.0 / 1.3 / 1.9 s */
  const DIFF={
    easy:  {react:0.85,err:0.12, turn:3.0,ease:4.5,fov:1.6,hs:0.02,burst:0.26,close:0.08,stop:0.15,hurt:0.55,spray:0.45,cover:false,name:'쉬움'},
    normal:{react:0.45,err:0.05, turn:5.5,ease:9,  fov:1.9,hs:0.08,burst:0.5, close:0.3, stop:0.6, hurt:0.32,spray:1.0, cover:true, name:'보통'},
    hard:  {react:0.2, err:0.025,turn:8.0,ease:15, fov:2.2,hs:0.2, burst:0.7, close:0.4, stop:0.92,hurt:0.16,spray:1.6, cover:true, name:'어려움'}};
  const NAMES=['민준','서연','도윤','하은','시우','지우','예준','수아','주원','지호','서윤','건우','유진','현우','채원','은우','하린','준서','다은','태윤','소율','로운','아린','이안'];
  function botName(i){ return NAMES[i%NAMES.length]+(i>=NAMES.length?i:''); }
  let pathBudget=0; // A* searches allowed this frame; the rest wait a frame or two
  function update(dt){ pathBudget=3; for(const a of Game.actors) if(a.bot&&a.local){ try{ think(a,dt); }catch(e){ console.error('bot',e); } } }
  const hashId=s=>{ let h=7; for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return Math.abs(h); };
  function brain(a){ return a.brain||(a.brain={path:null,pi:0,goal:null,goalT:0,repath:0,target:null,seenT:0,lastSeen:null,react:0,strafe:1,strafeT:0,stuckT:0,lastPos:{x:a.x,z:a.z},
    aimErrX:0,aimErrY:0,nextThink:Game.t+Math.random()*0.2,throwT:Game.t+rand(5,12),specT:Game.t+rand(4,10),roam:null,site:null,pkI:1,fleeT:0,
    want:null,mvx:0,mvz:0,sharp:false,lane:(hashId(a.id)%3)-1,spot:(hashId(a.id)%360)/57.3,hurtSeen:a.lastDmgT||0}); }
  const D=a=>DIFF[a.diff]||DIFF.normal;
  /* ---------- main ---------- */
  function think(a,dt){
    const b=brain(a); const I={mx:0,mz:0,jump:false,jumpHit:false,crouch:false,crouchHit:false,fire:false,ads:false,reload:false,use:false,throwHit:false,special:false,swap:false,w1:false,w2:false,w3:false,wheel:0};
    a.botUse=false; b.want=null; b.sharp=false;
    if(!a.alive){ b.path=null; b.target=null; b.mvx=b.mvz=0; return; }
    if(Game.freeze||Game.state!=='live'){ moveActor(a,I,dt); return; }
    if(Game.kind==='tag') tagThink(a,b,I,dt); else battleThink(a,b,I,dt);
    a.botUse=!!I.use;
    applyMove(a,b,I,dt);
    moveActor(a,I,dt); weaponUpdate(a,I,dt);
  }
  /* the brain asks for a world-space direction (b.want); here it is eased (no instant turns), teammates push each other apart, and it becomes stick input */
  function applyMove(a,b,I,dt){
    let wx=b.want?b.want.x:0, wz=b.want?b.want.z:0;
    if(!b.sharp&&Game.mode!=='pk'&&(wx||wz)){ let px=0, pz=0;
      const R=b.target?3.2:4.2; /* keep a few metres from teammates (a bit closer is fine mid-fight) */
      for(const m of Game.actors){ if(m===a||!m.alive||!mate(a,m)||Math.abs(m.y-a.y)>1.5) continue; const dx=a.x-m.x, dz=a.z-m.z, d=Math.hypot(dx,dz); if(d<R&&d>0.01){ const k=(R-d)/R; px+=dx/d*k; pz+=dz/d*k; } }
      /* push sideways only (plus a little slow-down when a teammate is right ahead), so two bots in a doorway or on a bridge never cancel each other out */
      const wl=Math.hypot(wx,wz)||1, ux=wx/wl, uz=wz/wl, along=px*ux+pz*uz; px-=along*ux; pz-=along*uz; if(along<0){ px+=along*0.3*ux; pz+=along*0.3*uz; }
      wx+=px*0.55; wz+=pz*0.55; const l=Math.hypot(wx,wz); if(l>1){ wx/=l; wz/=l; } }
    const f=1-Math.exp(-(b.sharp?40:9)*dt); b.mvx+=(wx-b.mvx)*f; b.mvz+=(wz-b.mvz)*f;
    if(Math.hypot(b.mvx,b.mvz)<0.02&&!wx&&!wz){ b.mvx=b.mvz=0; }
    const fw=fwd(a.yaw), r={x:Math.cos(a.yaw),z:-Math.sin(a.yaw)};
    I.mx=b.mvx*r.x+b.mvz*r.z; I.mz=-(b.mvx*fw.x+b.mvz*fw.z);
  }
  const mate=(a,m)=>Game.kind==='tag'?m.role===a.role:!isEnemy(a,m);
  /* ---------- perception ---------- */
  function canSee(a,v,fovMul){ if(!v.alive||v.jailed||v.escaped) return false; const dx=v.x-a.x, dz=v.z-a.z, d=Math.hypot(dx,dz); if(d>90) return false;
    if(d>6){ const f=fwd(a.yaw); const ang=Math.acos(clamp((dx*f.x+dz*f.z)/d,-1,1)); if(ang>(fovMul||D(a).fov)/2) return false; }
    return losSight(a.x,eyeY(a),a.z,v.x,v.y+v.ph-0.25,v.z)||losSight(a.x,eyeY(a),a.z,v.x,v.y+0.9,v.z); }
  function pickTarget(a,b){ let best=null, bd=1e9;
    const alert=b.hurtBy&&Game.t>b.hurtAt&&Game.t-a.lastDmgT<3;
    for(const v of Game.actors){ if(!isEnemy(a,v)||!v.alive||v.spawnProt>0.8) continue; const d=Math.hypot(v.x-a.x,v.z-a.z);
      const heard=v.revealT>Game.t&&d<35, shooter=alert&&v===b.hurtBy;
      if(!(canSee(a,v)||(heard&&d<10&&canSee(a,v,6.3))||(shooter&&canSee(a,v,6.3)))) { if(heard&&!b.lastSeen) b.lastSeen={x:v.x,y:v.y,z:v.z,t:Game.t}; continue; }
      const s=d-(v===b.target?8:0)+(v.hp<40?-5:0)-(shooter?12:0); if(s<bd){ bd=s; best=v; } }
    return best; }
  /* ---------- aiming & looking: ease toward the goal (fast first, settling at the end) with a top turn speed ---------- */
  function turnStep(diff,ease,max,dt){ const e=1-Math.exp(-ease*dt); let s=diff*e; s+=Math.sign(diff)*Math.min(Math.abs(diff)-Math.abs(s),0.5*dt); return clamp(s,-max,max); }
  function aimAt(a,b,x,y,z,dt,rate){ const dx=x-a.x, dy=y-eyeY(a), dz=z-a.z; const yaw=Math.atan2(-dx,-dz), pitch=Math.atan2(dy,Math.hypot(dx,dz));
    const d=D(a), r=rate||1; const dyaw=angDiff(a.yaw,yaw+b.aimErrX), dp=(pitch+b.aimErrY)-a.pitch;
    a.yaw+=turnStep(dyaw,d.ease*r,d.turn*r*dt,dt); a.pitch+=turnStep(dp,d.ease*r,d.turn*r*0.7*dt,dt);
    return Math.abs(angDiff(a.yaw,yaw+b.aimErrX))+Math.abs((pitch+b.aimErrY)-a.pitch); }
  function lookAlong(a,x,z,dt,rate){ const yaw=Math.atan2(-(x-a.x),-(z-a.z)), d=D(a), r=(rate||1)*0.6;
    a.yaw+=turnStep(angDiff(a.yaw,yaw),d.ease*r,d.turn*r*dt,dt); a.pitch+=(-a.pitch)*(1-Math.exp(-3*dt)); }
  /* when there is nothing to do: check open sight lines (toward where enemies were or are likely) for a second or two each, like a player holding an angle */
  function scan(a,b,dt){
    if(!b.scanT||Game.t>b.scanT){ b.scanT=Game.t+rand(1.3,2.8); const ey=eyeY(a); let best=null, bs=-1e9;
      const hint=b.lastSeen&&Game.t-b.lastSeen.t<12?Math.atan2(-(b.lastSeen.x-a.x),-(b.lastSeen.z-a.z)):null;
      for(let i=0;i<10;i++){ const an=a.yaw+(Math.random()-0.5)*Math.PI*1.7, L=rayDist(a.x,ey,a.z,-Math.sin(an),0,-Math.cos(an),40);
        const sc=Math.min(L,28)+Math.random()*6-(hint!=null?Math.abs(angDiff(an,hint))*6:0)-(L<3?20:0); if(sc>bs){ bs=sc; best=an; } }
      b.scanYaw=best; }
    if(b.scanYaw!=null) lookAlong(a,a.x-Math.sin(b.scanYaw)*10,a.z-Math.cos(b.scanYaw)*10,dt,0.55); }
  /* move toward a world point (sets the wanted direction; applyMove turns it into stick input). s = speed 0..1 */
  function steer(a,I,x,z,s){ const dx=x-a.x, dz=z-a.z, l=Math.hypot(dx,dz); if(l<0.05) return; const b=a.brain; if(b) b.want={x:dx/l*(s==null?1:s),z:dz/l*(s==null?1:s)}; }
  /* can a bot walk straight from where it stands to (tx,tz) on the same floor? (no wall, no step it can't take, no hole) — checked on the centre line and both shoulders */
  function walkLine(a,tx,tz){ const dx=tx-a.x, dz=tz-a.z, l=Math.hypot(dx,dz); if(l<0.5) return true; const nx=-dz/l*0.28, nz=dx/l*0.28;
    for(const s of [0,1,-1]){ const t=traverse(a.x+nx*s,a.y,a.z+nz*s,tx+nx*s,tz+nz*s); if(!t||t.jump||Math.abs(t.y-a.y)>0.3) return false; } return true; }
  /* ---------- pathing ---------- */
  /* the node to start a path from: the nearest one the bot can actually walk to (pressed against a wall, the nearest node is often on the other side of it) */
  function startNode(a){ const i0=Math.floor(a.x/NS), j0=Math.floor(a.z/NS), C=[];
    for(let j=j0-2;j<=j0+2;j++) for(let i=i0-2;i<=i0+2;i++){ if(i<0||j<0||i>=NW||j>=NH) continue; for(const n of CELLN[j*NW+i]){ if(Math.abs(n.h-a.y)>1.2||(n.oid&&OBJS.get(n.oid)&&!OBJS.get(n.oid).alive)) continue; C.push([Math.hypot(n.x-a.x,n.z-a.z)+Math.abs(n.h-a.y)*3,n]); } }
    C.sort((p,q)=>p[0]-q[0]);
    for(let k=0;k<Math.min(C.length,6);k++){ const n=C[k][1]; if(C[k][0]<0.8) return n; const t=traverse(a.x,a.y,a.z,n.x,n.z); if(t&&Math.abs(t.y-n.h)<0.4) return n; }
    return nearestNode(a.x,a.y,a.z,true)||nearestNode(a.x,a.y,a.z); }
  function goTo(a,b,I,gx,gy,gz,dt,opts){
    opts=opts||{};
    const far=!b.goal||Math.hypot(b.goal.x-gx,b.goal.z-gz)>3||Math.abs((b.goal.y||0)-gy)>1.5;
    if((far||!b.path||Game.t>b.repath)&&pathBudget<=0&&!b.path){ if(Math.hypot(gx-a.x,gz-a.z)>0.6) steer(a,I,gx,gz,opts.s); return false; }
    if((far||!b.path||Game.t>b.repath)&&pathBudget>0){ pathBudget--; b.goal={x:gx,y:gy,z:gz}; b.repath=Game.t+(opts.fast?0.6:2.5)*(0.8+Math.random()*0.4);
      const s=startNode(a), e=nearestNode(gx,gy,gz,true,true)||nearestNode(gx,gy,gz,false,true); b.path=navPath(s,e); b.pi=0; b.spT=0;
      if(!b.path){ b.path=[{x:gx,z:gz,h:gy}]; } }
    const p=b.path; if(!p||b.pi>=p.length){ if(Math.hypot(gx-a.x,gz-a.z)>0.6) steer(a,I,gx,gz,opts.s); return true; }
    let w=p[b.pi];
    while(w&&Math.hypot(w.x-a.x,w.z-a.z)<(w.ladder?0.5:0.9)&&Math.abs(w.h-a.y)<1.2){ b.pi++; w=p[b.pi]; }
    if(!w) return true;
    if(w.ladder){ b.sharp=true; const L=w.ladder, f=FACE[L.face]; const bx=L.x-f[0]*0.55, bz=L.z-f[1]*0.55;
      if(Math.hypot(bx-a.x,bz-a.z)>0.45&&a.y<L.y0+0.5) steer(a,I,bx,bz); else steer(a,I,L.x+f[0]*2,L.z+f[1]*2);
      if(a.y>=L.y1-0.2) b.pi++; return false; }
    /* straighten the path: head for the farthest of the next few nodes that can be walked to in a straight line (5×/s) */
    if(a.gr&&!w.jump&&Game.t>(b.spT||0)){ b.spT=Game.t+0.2; let j=b.pi;
      for(let k=b.pi+1;k<Math.min(p.length,b.pi+8);k++){ const n=p[k]; if(n.ladder||n.jump||Math.abs(n.h-a.y)>0.35) break; if(walkLine(a,n.x,n.z)) j=k; }
      if(j>b.pi){ b.pi=j; w=p[j]; } }
    if(w.jump) b.sharp=true;
    steer(a,I,w.x,w.z,opts.s);
    if(w.jump&&a.gr&&Math.hypot(w.x-a.x,w.z-a.z)<2.2&&w.h>a.y+0.3) I.jumpHit=true;
    /* stuck */
    b.stuckT+=dt; if(b.stuckT>1.2){ const mv=Math.hypot(a.x-b.lastPos.x,a.z-b.lastPos.z); b.lastPos={x:a.x,z:a.z}; b.stuckT=0;
      if(mv<0.6){ if(Math.hypot(gx-a.x,gz-a.z)<4&&Math.abs(gy-a.y)<1.2){ b.path=null; return true; } /* jammed right by the goal (usually a teammate on it): good enough */
        I.jumpHit=true; b.repath=0; b.pi=Math.min(b.pi+1,p.length); b.strafe=-b.strafe; b.sharp=true; b.spT=Game.t+1.2; } }
    return false;
  }
  /* where to look while walking a path: the node we are heading for, or the one after it when that is too close */
  function lookAhead(a,b,dt,rate){ const p=b.path; if(!p||b.pi>=p.length) return false; let n=p[b.pi];
    if(Math.hypot(n.x-a.x,n.z-a.z)<3&&b.pi+1<p.length) n=p[b.pi+1]; lookAlong(a,n.x,n.z,dt,rate); return true; }
  function roamPoint(a){ for(let i=0;i<30;i++){ const n=NODES[(Math.random()*NODES.length)|0]; if(n&&NREACH.has(n.i)&&!n.oid) return {x:n.x,y:n.h,z:n.z}; } return {x:SPAWN_RUN.x,y:0,z:SPAWN_RUN.z}; }
  /* a reachable spot near (x,z) on about the same level */
  function nodeNear(x,y,z){ const n=nearestNode(x,y,z,true,true); return n?{x:n.x,y:n.h,z:n.z}:null; }
  /* cover: a spot 3–12 m away the enemy can't see, not toward the enemy */
  function findCover(a,T){ const ey=T.y+T.ph-0.2; let best=null, bs=1e9;
    for(let i=0;i<34;i++){ const an=Math.random()*6.283, r=rand(3,12); const n=nearestNode(a.x+Math.cos(an)*r,a.y,a.z+Math.sin(an)*r,true,true); if(!n||Math.abs(n.h-a.y)>0.6) continue;
      if(Math.hypot(n.x-T.x,n.z-T.z)<Math.hypot(a.x-T.x,a.z-T.z)-1) continue;
      if(losSight(T.x,ey,T.z,n.x,n.h+1.2,n.z)) continue; const d=Math.hypot(n.x-a.x,n.z-a.z); if(d<bs){ bs=d; best={x:n.x,y:n.h,z:n.z}; } }
    return best; }
  /* ---------- battle ---------- */
  function battleThink(a,b,I,dt){
    const d=D(a), w=curW(a), s=curSlot(a), mode=Game.mode;
    if(mode==='pk') return pkThink(a,b,I,dt);
    /* shot by someone: remember who and from where; turn toward them after a short, difficulty-based moment */
    if((a.lastDmgT||0)>b.hurtSeen){ b.hurtSeen=a.lastDmgT; const att=Game.byId.get(a.lastAttacker);
      if(att&&att.alive&&isEnemy(a,att)&&att!==b.target){ if(!(b.hurtBy===att&&Game.t-b.hurtAt<2)) b.hurtAt=Game.t+d.hurt*(0.8+Math.random()*0.4); b.hurtBy=att; b.lastSeen={x:att.x,y:att.y,z:att.z,t:Game.t}; b.nextThink=Math.min(b.nextThink,b.hurtAt); } }
    /* perception every 0.15s */
    if(Game.t>b.nextThink){ b.nextThink=Game.t+0.15; const t=pickTarget(a,b);
      if(t&&t!==b.target){ const alerted=t===b.hurtBy&&Game.t-a.lastDmgT<3;
        b.target=t; b.react=Game.t+d.react*(alerted?0.55:1)*(0.7+Math.random()*0.6); b.aimErrX=(Math.random()-0.5)*d.err*8; b.aimErrY=(Math.random()-0.5)*d.err*5; b.burstT=0; b.cover=null; }
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
      /* the aim keeps wandering a little the whole fight */
      b.wobT=(b.wobT||0)-dt; if(b.wobT<=0){ b.wobT=0.35+Math.random()*0.4; b.aimErrX+=(Math.random()-0.5)*d.err*1.6; b.aimErrY+=(Math.random()-0.5)*d.err*1.1; }
      if(b.headT==null||Game.t>b.headT){ b.headT=Game.t+1.2; b.head=Math.random()<d.hs; } const head=b.head; const ty=T.y+(head?T.ph-0.15:T.ph*0.62);
      const lead=w&&w.proj?dist/(w.pspeed||40):0.04; const err=aimAt(a,b,T.x+(T.vx||0)*lead,ty,T.z+(T.vz||0)*lead,dt,1.4);
      const ready=Game.t>b.react; let shooting=false;
      if(ready&&w){ const tol=w.mode==='melee'?0.6:Math.max(0.03,Math.atan2(0.5,dist)*1.4)+(w.pellets>1?0.08:0);
        if(err<tol*2.2) shooting=true;
        if(err<tol&&dist<(w.mode==='melee'?w.reach+0.5:Math.max(w.far*1.2,30))){
          if(w.mode==='auto'){ if(!b.burstT){ b.plant=Math.random()<d.stop; b.burstLen=d.burst*(0.75+Math.random()*0.5)+(dist<12?d.close:0); }
            b.burstT=(b.burstT||0)+dt; I.fire=b.burstT<b.burstLen; if(b.burstT>b.burstLen+0.18+Math.random()*0.2) b.burstT=0; }
          else { if(!a.fireHeld&&b.plant==null) b.plant=Math.random()<d.stop; I.fire=!a.fireHeld; } }
        else if(w.mode!=='auto') b.plant=null;
        I.ads=w.mode!=='melee'&&dist>14&&w.cat!=='sg'; }
      /* movement while fighting */
      const pref=w&&w.mode==='melee'?1.2:w&&w.cat==='sg'?6:w&&w.cat==='sr'?30:14;
      const fw={x:(T.x-a.x)/(dist||1),z:(T.z-a.z)/(dist||1)}, side={x:-fw.z,z:fw.x};
      const lowHp=d.cover&&a.hp<38&&dist>5&&!(goal&&goal.urgent);
      const empty=s&&w&&w.mag&&s.mag===0&&s.res>0&&dist>8&&d.cover;
      if(goal&&goal.urgent){ goTo(a,b,I,goal.x,goal.y||0,goal.z,dt,{fast:true}); }
      else if(lowHp||empty){ if(!b.cover||Game.t>b.coverT){ b.cover=findCover(a,T); b.coverT=Game.t+2.5; }
        if(b.cover&&Math.hypot(b.cover.x-a.x,b.cover.z-a.z)>0.8) goTo(a,b,I,b.cover.x,b.cover.y,b.cover.z,dt,{fast:true}); else b.want=null; }
      else { /* hold range, strafe in smooth stretches, and plant the feet while the burst is going (harder bots plant more) */
        b.strafeT-=dt; if(b.strafeT<=0){ b.strafeT=rand(0.8,1.8); b.strafe=Math.random()<0.5?-1:1; b.strafeAmp=rand(0.35,0.85); }
        const toward=dist>pref+5?0.9:dist<pref-5&&w&&w.cat!=='sg'?-0.6:0;
        let lat=b.strafe*(b.strafeAmp||0.6), fwd2=toward;
        if(shooting&&b.plant){ lat*=a.diff==='hard'?0:0.2; fwd2*=0.2; }
        if(lat){ const px=a.x+side.x*lat*1.6, pz=a.z+side.z*lat*1.6; if(blockedAt(px,pz,a.y+0.3,PH-0.4)){ b.strafe=-b.strafe; lat=-lat; } }
        const vx=side.x*lat+fw.x*fwd2, vz=side.z*lat+fw.z*fwd2; b.want=(vx||vz)?{x:vx,z:vz}:null;
        if(a.diff==='hard'&&shooting&&b.plant&&dist>20&&w&&w.cat!=='sg') I.crouch=true;
        if(a.diff!=='easy'&&dist>18&&w&&w.cat==='sr') I.crouch=true; }
      /* grenades at targets behind cover */
      if(Game.t>b.throwT&&a.thrLeft>0&&dist>7&&dist<24){ b.throwT=Game.t+rand(8,16); if(Math.random()<0.5) I.throwHit=true; }
    } else {
      b.plant=null; b.burstT=0;
      if(s&&w&&w.mag&&s.mag<s.max*0.5&&s.res>0) I.reload=true;
      if(a.cur!==0&&a.slots[0]&&(a.slots[0].mag>0||a.slots[0].res>0)&&a.switchT<=0) I.w1=true;
      const hurtTurn=b.hurtBy&&b.hurtBy.alive&&Game.t>b.hurtAt&&Game.t-b.hurtAt<2.2;
      let g=goal; b.why=g?'obj':'';
      /* go and check where an enemy was last seen — each bot to its own spot beside it, so several bots do not pile onto one point */
      if(!g&&b.lastSeen&&Game.t-b.lastSeen.t<5.5){ const L=b.lastSeen; if(!b.inv||b.inv.t!==L.t){ const dx=L.x-a.x, dz=L.z-a.z, l=Math.hypot(dx,dz)||1, off=b.lane*rand(2.5,4.5);
          const n=nodeNear(L.x-dz/l*off-dx/l*1.5,L.y,L.z+dx/l*off-dz/l*1.5); b.inv=n?{x:n.x,y:n.y,z:n.z,t:L.t,hold:true}:{x:L.x,y:L.y,z:L.z,t:L.t,hold:true}; }
        g=b.inv; b.why='last'; } if(!g){ if(!b.roam||Math.hypot(b.roam.x-a.x,b.roam.z-a.z)<3||Game.t>b.roamT){ b.roam=huntPoint(a,b); b.roamT=Game.t+20; } g=b.roam; b.why='roam'; }
      let arrived;
      if(g.hold&&Math.hypot(g.x-a.x,g.z-a.z)<(g.use?1.2:1.8)&&Math.abs((g.y||0)-a.y)<1.2){ arrived=true; b.want=null; } else arrived=goTo(a,b,I,g.x,g.y||0,g.z,dt);
      if(g.hold&&arrived&&g.use) I.use=true;
      if(hurtTurn){ const H=b.hurtBy; aimAt(a,b,H.x,H.y+1.3,H.z,dt,1.6); }
      else if(arrived||!lookAhead(a,b,dt)) scan(a,b,dt);
      if(g.use&&Math.hypot(g.x-a.x,g.z-a.z)<(g.r||3)) I.use=true;
    }
    if(Game.t>b.specT&&a.load&&SP[a.load.spec]){ b.specT=Game.t+rand(10,25); const k=a.load.spec; if((k==='health'&&a.hp<70)||(k==='ammo'&&s&&s.res<(w&&w.res||0)*0.4)||(k==='wall'&&T)||k==='trophy') I.special=true; }
  }
  /* somewhere enemies are likely: near an enemy we know about (each bot comes in from its own side), or a random reachable spot away from teammates' picks */
  function huntPoint(a,b){
    const en=Game.actors.filter(v=>isEnemy(a,v)&&v.alive);
    for(let tries=0;tries<4;tries++){ let p=null;
      if(en.length&&Math.random()<0.6){ const v=pick(en), dx=v.x-a.x, dz=v.z-a.z, l=Math.hypot(dx,dz)||1, off=b.lane*rand(7,13)+rand(-3,3);
        p=nodeNear(v.x-dz/l*off+rand(-4,4),v.y,v.z+dx/l*off+rand(-4,4)); }
      if(!p) p=roamPoint(a);
      const crowded=Game.actors.some(m=>m!==a&&m.bot&&m.alive&&mate(a,m)&&m.brain&&m.brain.roam&&Math.hypot(m.brain.roam.x-p.x,m.brain.roam.z-p.z)<9);
      if(!crowded||tries===3) return p; }
    return roamPoint(a); }
  /* a spot inside an objective zone: each bot keeps its own place around the centre so a team does not stand in one pile */
  const spotAround=(b,x,y,z,r)=>{ const an=b.spot, rr=r*(0.45+0.55*((b.lane+1)/2)); const n=nodeNear(x+Math.cos(an)*rr,y||0,z+Math.sin(an)*rr); return n&&Math.hypot(n.x-x,n.z-z)<r+1?n:{x,y:y||0,z}; };
  function objective(a,b){ const M=Modes.info(); if(!M) return null; const mode=Game.mode, Bt=BATTLE||{};
    if(mode==='dom'){ let best=null, bd=1e9;
      for(const p of M.pts){ const own=p.own===a.team&&Math.abs(p.prog)>0.95; let goers=0; for(const m of Game.actors) if(m!==a&&m.alive&&mate(a,m)&&m.brain&&m.brain.domPt===p.n) goers++;
        const d=Math.hypot(p.x-a.x,p.z-a.z)+(own?60:0)+goers*16+(hashId(a.id)%3)*6-(b.domPt===p.n?14:0); if(d<bd){ bd=d; best=p; } }
      if(!best) return null; b.domPt=best.n; if(!b.domSpot||b.domSpot.n!==best.n){ const s=spotAround(b,best.x,best.y,best.z,3.4); b.domSpot={n:best.n,x:s.x,y:s.y,z:s.z}; }
      return {x:b.domSpot.x,y:b.domSpot.y,z:b.domSpot.z,hold:true}; }
    if(mode==='hp'&&M.hp&&M.hp.list.length){ const p=M.hp.list[M.hp.i]; if(!b.hpSpot||b.hpSpot.i!==M.hp.i){ const s=spotAround(b,p.x,p.y,p.z,3.4); b.hpSpot={i:M.hp.i,x:s.x,y:s.y,z:s.z}; } return {x:b.hpSpot.x,y:b.hpSpot.y,z:b.hpSpot.z,hold:true}; }
    if(mode==='ctf'){ const mine=M.flags[a.team], theirs=M.flags[1-a.team];
      if(theirs.carrier===a.id) return {x:mine.hx,y:mine.hy,z:mine.hz,urgent:true};
      if(mine.carrier){ const c=Game.byId.get(mine.carrier); if(c) return {x:c.x,y:c.y,z:c.z,urgent:true}; }
      if(!mine.home) return {x:mine.x,y:mine.y,z:mine.z,urgent:true};
      if(a.id.charCodeAt(1)%3===0){ if(!b.guard){ const s=spotAround(b,mine.hx,mine.hy,mine.hz,7); b.guard={x:s.x,y:s.y,z:s.z}; } return {x:b.guard.x,y:b.guard.y,z:b.guard.z,hold:true}; }
      return {x:theirs.x,y:theirs.y,z:theirs.z}; }
    if(mode==='upl'&&M.drive){ const d=M.drive, goals=(Bt.upload||{}).goals||[];
      if(d.carrier===a.id){ const g=goals[1-a.team]; return g?{x:g.x,y:g.y||0,z:g.z,urgent:true}:null; }
      return {x:d.x,y:d.y,z:d.z,urgent:!!d.carrier&&Game.byId.get(d.carrier)&&Game.byId.get(d.carrier).team!==a.team}; }
    if(mode==='kc'&&M.tags.length){ let best=null, bd=25; for(const t of M.tags){ const d=Math.hypot(t.x-a.x,t.z-a.z); if(d<bd){ bd=d; best=t; } } if(best) return {x:best.x,y:best.y,z:best.z}; }
    if(mode==='snd'&&M.bomb){ const bm=M.bomb, sites=Bt.sites||[]; if(!b.site||b.round!==M.round){ b.site=pick(sites); b.round=M.round; b.sndSpot=null; }
      if(a.team===M.att){ if(bm.carrier===a.id) return b.site?{x:b.site.x,y:b.site.y||0,z:b.site.z,use:true,r:3.5,hold:true}:null;
        if(!bm.carrier&&!bm.planted) return {x:bm.x,y:bm.y,z:bm.z,urgent:true};
        if(bm.planted){ if(!b.sndSpot){ const s=spotAround(b,bm.x,bm.y,bm.z,6); b.sndSpot={x:s.x,y:s.y,z:s.z}; } return {x:b.sndSpot.x,y:b.sndSpot.y,z:b.sndSpot.z,hold:true}; }
        const c=Game.byId.get(bm.carrier); return c?{x:c.x+b.lane*4+rand(-2,2),y:c.y,z:c.z+rand(-3,3)}:null; }
      else { if(bm.planted) return {x:bm.x,y:bm.y,z:bm.z,use:true,r:2.2,urgent:true};
        if(!b.site) return null; if(!b.sndSpot){ const s=spotAround(b,b.site.x,b.site.y,b.site.z,7); b.sndSpot={x:s.x,y:s.y,z:s.z}; } return {x:b.sndSpot.x,y:b.sndSpot.y,z:b.sndSpot.z,hold:true}; } }
    return null; }
  /* ---------- parkour ---------- */
  function pkThink(a,b,I,dt){ if(!PK) return; const boxes=PK.boxes; b.sharp=true;
    // find the platform we're on
    let on=-1; for(let i=0;i<boxes.length;i++){ const s=boxes[i]; if(a.x>=s.x0-0.2&&a.x<=s.x1+0.2&&a.z>=s.z0-0.2&&a.z<=s.z1+0.2&&Math.abs(a.y-s.y1)<0.15){ on=i; break; } }
    if(on>=0) b.pkI=on+1; if(b.pkI>=boxes.length) b.pkI=boxes.length-1;
    const nx=boxes[b.pkI], cx=(nx.x0+nx.x1)/2, cz=(nx.z0+nx.z1)/2; steer(a,I,cx,cz); lookAlong(a,cx,cz,dt,3);
    const cur=on>=0?boxes[on]:null; if(cur&&a.gr){ const edge=Math.max(Math.abs(a.x-(cur.x0+cur.x1)/2)-(cur.x1-cur.x0)/2,Math.abs(a.z-(cur.z0+cur.z1)/2)-(cur.z1-cur.z0)/2);
      if(edge>-0.45&&Math.hypot(cx-a.x,cz-a.z)>1.5) I.jumpHit=true; }
    if(a.diff==='easy'&&b.want&&Math.random()<dt*0.3){ const j=rand(-0.5,0.5); b.want={x:b.want.x-b.want.z*j,z:b.want.z+b.want.x*j}; } }
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
      if(d<8&&losSight(a.x,eyeY(a),a.z,r.x,r.y+1,r.z)) { b.sharp=true; steer(a,I,r.x+(r.vx||0)*0.3,r.z+(r.vz||0)*0.3); } else goTo(a,b,I,r.x,r.y,r.z,dt,{fast:true});
      aimAt(a,b,r.x,r.y+1.1,r.z,dt,1.2);
      if(Game.cfg.seekerGun&&d>4&&d<28&&a.slots[0]){ const s=a.slots[0]; if(s.mag>0&&Game.t>b.shotT){ b.shotT=Game.t+rand(0.4,0.9); I.fire=true; } else if(s.mag===0&&d>14) I.reload=true; }
      return; }
    /* no target: check revealed or last seen, else patrol orbs / gate */
    let g=null;
    if(b.lastSeen&&Game.t-b.lastSeen.t<7) g=b.lastSeen;
    else if(T.door&&DOOR&&Math.random()<0.6) g={x:(DOOR.c0+DOOR.c1)/2*CELL+rand(-4,4),y:0,z:(DOOR.r0+3)*CELL};
    else { if(!b.roam||Math.hypot(b.roam.x-a.x,b.roam.z-a.z)<3||Game.t>b.roamT){ const left=T.orbs.filter(o=>!o.taken); const jailed=Game.actors.some(x=>x.jailed);
        b.roam=jailed&&Math.random()<0.25?Object.assign({y:0},Tag.JAIL()):left.length&&Math.random()<0.7?pick(left):roamPoint(a); b.roamT=Game.t+15; } g=b.roam; }
    const arrived=goTo(a,b,I,g.x,g.y||0,g.z,dt); if(arrived||!lookAhead(a,b,dt,1.5)) scan(a,b,dt);
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
      if(b.flee){ goTo(a,b,I,b.flee.x,b.flee.y,b.flee.z,dt,{fast:true}); lookAhead(a,b,dt,2);
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
    if(use){ b.sharp=true; I.use=true; lookAlong(a,g.x,g.z,dt); return; }
    const arrived=goTo(a,b,I,g.x,g.y||0,g.z,dt); if(arrived||!lookAhead(a,b,dt,1.5)) scan(a,b,dt);
  }
  return {update,botName,DIFF};
})();
