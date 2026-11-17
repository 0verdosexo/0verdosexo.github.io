/* modes.js — battle modes. The host runs the rules and broadcasts 'mstate'; every client mirrors it for the HUD and the 3D markers. */
'use strict';
const Modes=(()=>{
  let M=null, vis=[], stAcc=0, holdT=0, holdKey=null;
  const B=()=>BATTLE||{};
  const isTeam=()=>!!BMODES[Game.mode].team;
  /* ---------- init ---------- */
  function init(S){
    const mode=Game.mode, def=BMODES[mode];
    M={mode,score:[0,0],time:def.time?def.time*60:0,limit:def.limit(Game.actors.length),round:1,att:0,roundState:'live',roundT:0,pts:[],hp:null,flags:[],tags:[],bomb:null,drive:null,ver:0,phase:0};
    if(!isTeam()) Game.actors.forEach((a,i)=>{ a.team=i; });
    if(mode==='dom') M.pts=(B().points||[]).map(p=>({n:p.n,x:p.x,y:p.y||0,z:p.z,own:-1,prog:0}));
    if(mode==='hp'){ const L=B().hardpoints||[]; M.hp={i:0,t:60,list:L.map(p=>({x:p.x,y:p.y||0,z:p.z}))}; }
    if(mode==='ctf') M.flags=[0,1].map(t=>{ const p=(B().flags||[])[t]||{x:0,z:0}; return {team:t,hx:p.x,hz:p.z,hy:p.y||0,x:p.x,y:p.y||0,z:p.z,carrier:null,home:true,dropT:0}; });
    if(mode==='upl'){ const d=(B().upload||{}).drive||{x:W*2,z:H*2}; M.drive={x:d.x,y:d.y||0,z:d.z,hx:d.x,hz:d.z,carrier:null,dropT:0,reset:0}; }
    if(mode==='snd'){ M.att=0; M.time=0; newRound(true); }
    if(mode==='pk') M.time=def.time*60;
    buildVisuals();
  }
  function cleanup(){ for(const o of vis) R.scene.remove(o); vis=[]; M=null; }
  /* ---------- spawns ---------- */
  function nodeSpawns(n){ const out=[]; const R2=Math.random; for(let i=0;i<n*6&&out.length<n;i++){ const nd=NODES[(R2()*NODES.length)|0]; if(!nd||!NREACH.has(nd.i)) continue; if(nd.oid) continue; out.push({x:nd.x,y:nd.h,z:nd.z}); } return out; }
  function spawnPoint(a){
    const mode=Game.mode;
    if(mode==='pk'&&PK){ const s=PK.start; const i=Game.actors.indexOf(a); return {x:s.x+((i%4)-1.5)*1.6,y:0.6,z:s.z+(Math.floor(i/4)-1)*1.6,yaw:Math.atan2(-(PK.cps[1]?PK.cps[1].x-s.x:0),-(PK.cps[1]?PK.cps[1].z-s.z:-1))}; }
    let cands; const enemies=Game.actors.filter(v=>v!==a&&v.alive&&isEnemy(a,v));
    if(isTeam()){ let side=a.team; if(mode==='snd') side=a.team===M.att?0:1; const base=(side===0?B().spawnsA:B().spawnsB)||[];
      cands=base.map(p=>Object.assign({base:true},p)); if(mode!=='snd'&&Game.t>20) cands=cands.concat(nodeSpawns(18)); }
    else cands=nodeSpawns(30);
    if(!cands.length) cands=[{x:SPAWN_RUN.x,z:SPAWN_RUN.z}];
    let best=cands[0], bs=-1e9;
    for(const c of cands){ let md=60; for(const e of enemies){ const d=Math.hypot(e.x-c.x,e.z-c.z); if(d<md) md=d; if(los3(e.x,eyeY(e),e.z,c.x,(c.y||0)+1.5,c.z)&&d<45) md-=25; }
      let s=Math.min(md,40)+(c.base?6:0)+Math.random()*4;
      if(isTeam()&&!c.base){ let near=0; for(const t of Game.actors) if(t!==a&&t.alive&&!isEnemy(a,t)&&Math.hypot(t.x-c.x,t.z-c.z)<25) near++; s+=Math.min(near,2)*4; if(md<18) s-=50; }
      if(s>bs){ bs=s; best=c; } }
    const tgt=(isTeam()&&mode!=='ffa')?((a.team===0)===(mode!=='snd'||a.team===M.att)?{x:W*CELL/2,z:0}:{x:W*CELL/2,z:H*CELL}):{x:W*CELL/2,z:H*CELL/2};
    const j=best.base?{x:rand(-1.2,1.2),z:rand(-1.2,1.2)}:{x:0,z:0};
    return {x:best.x+j.x,y:best.y||0,z:best.z+j.z,yaw:Math.atan2(-(tgt.x-best.x),-(tgt.z-best.z))};
  }
  function respawnDelay(v){ return Game.mode==='snd'?1e9:Game.mode==='pk'?0:Game.mode==='duel'?2:3; }
  function canRespawn(a){ return Game.mode!=='snd'; }
  function pkRespawn(a){ const cp=PK&&PK.cps[a.pkCp||0]; if(!cp) return; a.x=cp.x; a.y=cp.y+0.05; a.z=cp.z; a.vx=a.vz=a.vy=0; a.gr=true; Sfx.play('portal',{vol:0.4}); }
  /* ---------- deaths (every client gets onDeath; host scores) ---------- */
  function onDeath(v,k,d){
    if(!M) return; const mode=Game.mode;
    if(!Game.host) return;
    const kt=k&&k!==v?k.team:-1;
    if(mode==='tdm'&&k&&k!==v) M.score[kt]++;
    if((mode==='ffa'||mode==='duel')&&k&&k!==v) k.score++;
    if(mode==='gg'&&k&&k!==v){ const melee=WPN[d.w]&&WPN[d.w].mode==='melee'; k.ggPts+=melee?2:1; if(melee) v.ggPts=Math.max(0,v.ggPts-1); k.score=k.ggPts;
      const lvl=Math.floor(k.ggPts/2); if(lvl!==k.ggLevel){ k.ggLevel=lvl; Game.emit('gg',{a:k.id,l:lvl,p:k.ggPts}); } if(melee) Game.emit('gg',{a:v.id,l:Math.floor(v.ggPts/2),p:v.ggPts}); }
    if(mode==='kc'){ M.tags.push({id:'t'+(M.ver+1)+v.id,x:d.x,y:d.y,z:d.z,team:v.team,k:kt,t:Game.t}); }
    if(mode==='ctf'){ for(const f of M.flags) if(f.carrier===v.id){ f.carrier=null; f.home=false; f.x=d.x; f.y=d.y; f.z=d.z; f.dropT=Game.t; Game.emit('mev',{t:'flagdrop',team:f.team}); } }
    if(mode==='upl'&&M.drive.carrier===v.id){ M.drive.carrier=null; M.drive.x=d.x; M.drive.y=d.y; M.drive.z=d.z; M.drive.dropT=Game.t; }
    if(mode==='snd'&&M.bomb&&M.bomb.carrier===v.id){ M.bomb.carrier=null; M.bomb.x=d.x; M.bomb.y=d.y; M.bomb.z=d.z; }
    M.ver++; broadcast();
  }
  /* ---------- per frame ---------- */
  function update(dt,I){
    if(!M) return;
    const me=Game.me, mode=Game.mode;
    if(Game.host&&Game.state==='live') hostTick(dt);
    if(Game.host){ stAcc+=dt; if(stAcc>0.5){ stAcc=0; broadcast(); } }
    /* local hold-to-interact: plant / defuse */
    for(const a of Game.actors){ if(!a.local||!a.alive) continue; const use=a===me?I.use:a.botUse;
      if(a===me) Bus.emit('prompt',mode==='snd'&&M.roundState==='live'&&sndAction(a)?(sndAction(a).startsWith('plant')?'E 길게: 폭탄 설치':'E 길게: 폭탄 해체'):null);
      if(mode==='snd'&&M.roundState==='live'){ const key=sndAction(a); if(key&&use){ a.holdT=(a.holdT||0)+dt; const need=key.startsWith('plant')?3.5:6; if(a===me) Bus.emit('hold',{p:a.holdT/need,label:key.startsWith('plant')?'폭탄 설치 중':'해체 중'});
          if(a.holdT>=need){ a.holdT=0; Game.emit(key.startsWith('plant')?'plant':'defuse',{a:a.id,s:key.split(':')[1]}); } } else { a.holdT=0; if(a===me) Bus.emit('hold',null); } }
      if(mode==='pk'&&PK) pkCheck(a);
    }
    animateVisuals(dt);
    if(M.time>0&&Game.state==='live'){ M.time-=dt; if(M.time<=0&&Game.host) timeUp(); }
  }
  function sndAction(a){ if(!M.bomb) return null;
    if(a.team===M.att&&M.bomb.carrier===a.id&&!M.bomb.planted){ for(const s of (B().sites||[])) if(Math.hypot(a.x-s.x,a.z-s.z)<4.5) return 'plant:'+s.n; }
    if(a.team!==M.att&&M.bomb.planted&&Math.hypot(a.x-M.bomb.x,a.z-M.bomb.z)<2.6) return 'defuse:'+M.bomb.site; return null; }
  function pkCheck(a){ if(a.pkDone) return;
    if(a.gr&&a.y<0.35){ const onStart=PK&&Math.hypot(a.x-PK.start.x,a.z-PK.start.z)<4.2; if(!onStart){ FX.puff(a.x,0.2,a.z,{color:[1,0.4,0.1],size:1.2,life:0.6,alpha:0.7}); pkRespawn(a); return; } }
    for(const cp of PK.cps){ if(cp.i<=a.pkCp) continue; if(Math.hypot(a.x-cp.x,a.z-cp.z)<(cp.finish?3:2.2)&&Math.abs(a.y-cp.y)<0.6){ a.pkCp=cp.i; Game.emit('pkcp',{a:a.id,i:cp.i,f:!!cp.finish,t:+Game.t.toFixed(2)}); } } }
  /* ---------- host rules ---------- */
  function hostTick(dt){
    const mode=Game.mode; const alive=Game.actors.filter(a=>a.alive);
    const inZone=(p,r)=>{ const c=[0,0]; for(const a of alive){ if(Math.hypot(a.x-p.x,a.z-p.z)<r&&Math.abs(a.y-(p.y||0))<2.5) c[a.team]++; } return c; };
    if(mode==='dom'){ M.domAcc=(M.domAcc||0)+dt;
      for(const p of M.pts){ const c=inZone(p,4.5), diff=c[0]-c[1]; if(diff!==0){ p.prog=clamp(p.prog+Math.sign(diff)*Math.min(3,Math.abs(diff))*dt*0.22,-1,1);
          if(p.prog>=1&&p.own!==0){ p.own=0; Game.emit('mev',{t:'cap',n:p.n,team:0}); } if(p.prog<=-1&&p.own!==1){ p.own=1; Game.emit('mev',{t:'cap',n:p.n,team:1}); }
          if(Math.abs(p.prog)<0.02&&p.own>=0){ p.own=-1; } } }
      if(M.domAcc>=2){ M.domAcc=0; for(const p of M.pts) if(p.own>=0) M.score[p.own]++; } }
    if(mode==='hp'&&M.hp.list.length){ M.hp.t-=dt; if(M.hp.t<=0){ M.hp.i=(M.hp.i+1)%M.hp.list.length; M.hp.t=60; Game.emit('mev',{t:'hpmove'}); }
      M.hpAcc=(M.hpAcc||0)+dt; if(M.hpAcc>=1){ M.hpAcc=0; const c=inZone(M.hp.list[M.hp.i],4.5); if(c[0]>0&&c[1]===0) M.score[0]++; else if(c[1]>0&&c[0]===0) M.score[1]++; M.hp.cont=c[0]>0&&c[1]>0; } }
    if(mode==='kc'){ for(const t of M.tags){ if(t.gone) continue; for(const a of alive){ if(Math.hypot(a.x-t.x,a.z-t.z)<1.5&&Math.abs(a.y-t.y)<1.8){ t.gone=true;
          if(a.team!==t.team){ M.score[a.team]++; a.score+=1; Game.emit('mev',{t:'confirm',a:a.id}); } else Game.emit('mev',{t:'deny',a:a.id}); break; } }
        if(Game.t-t.t>30) t.gone=true; } M.tags=M.tags.filter(t=>!t.gone); }
    if(mode==='ctf'){ for(const f of M.flags){ const enemyTeam=1-f.team;
        if(f.carrier){ const c=Game.byId.get(f.carrier); if(!c||!c.alive){ f.carrier=null; continue; } f.x=c.x; f.y=c.y; f.z=c.z;
          const own=M.flags[c.team]; if(own.home&&Math.hypot(c.x-own.hx,c.z-own.hz)<3.2){ M.score[c.team]++; c.score+=1; c.caps++; f.carrier=null; f.home=true; f.x=f.hx; f.y=f.hy; f.z=f.hz; c.carry=null; Game.emit('mev',{t:'capture',a:c.id,team:c.team}); } continue; }
        for(const a of alive){ if(Math.hypot(a.x-f.x,a.z-f.z)>1.8||Math.abs(a.y-f.y)>2) continue;
          if(a.team===enemyTeam){ f.carrier=a.id; f.home=false; Game.emit('mev',{t:'steal',a:a.id,team:f.team}); break; }
          else if(!f.home){ f.home=true; f.x=f.hx; f.y=f.hy; f.z=f.hz; Game.emit('mev',{t:'return',a:a.id,team:f.team}); break; } }
        if(!f.home&&!f.carrier&&Game.t-f.dropT>20){ f.home=true; f.x=f.hx; f.y=f.hy; f.z=f.hz; Game.emit('mev',{t:'return',team:f.team}); } } }
    if(mode==='upl'){ const d=M.drive; const goals=(B().upload||{}).goals||[];
      if(d.reset>0){ d.reset-=dt; if(d.reset<=0){ d.x=d.hx; d.z=d.hz; d.y=0; d.carrier=null; } }
      else if(d.carrier){ const c=Game.byId.get(d.carrier); if(!c||!c.alive){ d.carrier=null; } else { d.x=c.x; d.y=c.y; d.z=c.z; const g=goals[1-c.team];
          if(g&&Math.hypot(c.x-g.x,c.z-g.z)<3.5){ M.score[c.team]++; c.score+=1; d.carrier=null; d.reset=3; d.x=g.x; d.z=g.z; Game.emit('mev',{t:'upload',a:c.id,team:c.team}); } } }
      else { for(const a of alive){ if(Math.hypot(a.x-d.x,a.z-d.z)<1.8&&Math.abs(a.y-d.y)<2){ d.carrier=a.id; Game.emit('mev',{t:'drive',a:a.id}); break; } }
        if(d.dropT&&Game.t-d.dropT>15&&!d.carrier){ d.dropT=0; d.x=d.hx; d.z=d.hz; d.y=0; } } }
    if(mode==='snd') sndTick(dt,alive);
    checkWin();
  }
  function checkWin(){ if(Game.state!=='live') return; const mode=Game.mode;
    if(isTeam()&&mode!=='snd'){ for(const t of [0,1]) if(M.score[t]>=M.limit) return endMatch({winTeam:t}); }
    if(!isTeam()&&mode!=='pk'){ for(const a of Game.actors) if(a.score>=M.limit) return endMatch({winner:a.id}); }
    if(mode==='snd') for(const t of [0,1]) if(M.score[t]>=M.limit) return endMatch({winTeam:t}); }
  function timeUp(){ if(Game.mode==='snd') return; if(isTeam()) endMatch({winTeam:M.score[0]===M.score[1]?-1:M.score[0]>M.score[1]?0:1});
    else { const s=Game.actors.slice().sort((a,b)=>(Game.mode==='pk'?(b.pkCp-a.pkCp):(b.score-a.score))); endMatch({winner:s[0]?s[0].id:null}); } }
  function endMatch(r){ r.score=M.score.slice(); r.players=Game.actors.map(a=>({id:a.id,s:a.score,k:a.kills,d:a.deaths})); Game.emit('mend',r); }
  /* search & destroy rounds */
  function newRound(first){ M.roundState='live'; M.roundT=100; M.bomb={carrier:null,x:0,y:0,z:0,planted:false,site:null,timer:0}; M.sndEnd=0;
    const atk=Game.actors.filter(a=>a.team===M.att); if(atk.length) M.bomb.carrier=pick(atk).id; if(!first) Game.emit('mev',{t:'round',r:M.round,att:M.att}); }
  function sndTick(dt,alive){
    if(M.roundState==='post'){ M.sndEnd-=dt; if(M.sndEnd<=0){ M.round++; M.att=1-M.att; newRound(); Game.emit('sndreset',{att:M.att,c:M.bomb.carrier}); } return; }
    const b=M.bomb; if(b.carrier){ const c=Game.byId.get(b.carrier); if(c&&c.alive){ b.x=c.x; b.y=c.y; b.z=c.z; } else b.carrier=null; }
    else if(!b.planted){ for(const a of alive) if(a.team===M.att&&Math.hypot(a.x-b.x,a.z-b.z)<1.6){ b.carrier=a.id; break; } }
    if(b.planted){ b.timer-=dt; if(b.timer<=0){ Game.emit('boom',{id:'bomb',a:'world',k:'frag',x:b.x,y:b.y,z:b.z,r:14,d:300,w:'bomb'}); return roundOver(M.att,'폭탄 폭발'); } }
    else { M.roundT-=dt; if(M.roundT<=0) return roundOver(1-M.att,'시간 종료'); }
    const atkAlive=alive.filter(a=>a.team===M.att).length, defAlive=alive.filter(a=>a.team!==M.att).length;
    if(defAlive===0) return roundOver(M.att,'수비 전멸'); if(atkAlive===0&&!b.planted) return roundOver(1-M.att,'공격 전멸'); }
  function roundOver(team,why){ M.score[team]++; M.roundState='post'; M.sndEnd=5; Game.emit('mev',{t:'roundwin',team,why}); }
  /* ---------- events ---------- */
  function handle(t,d,from){
    if(t==='mstate'){ if(!Game.host) applyState(d); return; }
    if(t==='mend'){ Game.end(d); return; }
    if(t==='mev'){ Bus.emit('mev',d); if(d.t==='cap'||d.t==='capture'||d.t==='upload'||d.t==='confirm'||d.t==='roundwin') Sfx.play('capture'); if(d.t==='steal'||d.t==='flagdrop'||d.t==='hpmove') Sfx.play('alarm');
      if(d.t==='steal'||d.t==='drive'){ const a=Game.byId.get(d.a); if(a) a.carry=d.t==='steal'?'flag':'drive'; }
      if(d.t==='capture'||d.t==='upload'){ const a=Game.byId.get(d.a); if(a) a.carry=null; } return; }
    if(t==='gg'){ const a=Game.byId.get(d.a); if(!a) return; a.ggLevel=d.l; a.ggPts=d.p; a.score=d.p; if(a.local){ const s=a.slots[0]; const id=GG_LADDER[Math.min(d.l,GG_LADDER.length-1)]; a.slots[0]={id,mag:WPN[id].mag,max:WPN[id].mag,res:WPN[id].res*3}; if(a.cur===0){ a.switchT=0.4; } if(!a.bot) Bus.emit('mev',{t:'ggup',w:id}); } return; }
    if(t==='plant'&&Game.host&&M.bomb&&!M.bomb.planted){ const a=Game.byId.get(d.a); if(!a) return; M.bomb.planted=true; M.bomb.carrier=null; M.bomb.x=a.x; M.bomb.y=a.y; M.bomb.z=a.z; M.bomb.site=d.s; M.bomb.timer=35; a.score+=2; Game.emit('mev',{t:'planted',s:d.s}); broadcast(); return; }
    if(t==='defuse'&&Game.host&&M.bomb&&M.bomb.planted&&M.roundState==='live'){ const a=Game.byId.get(d.a); if(a) a.score+=2; M.bomb.planted=false; Game.emit('mev',{t:'defused'}); roundOver(1-M.att,'해체 성공'); broadcast(); return; }
    if(t==='sndreset'){ M&&(M.att=d.att); for(const a of Game.actors){ a.respawnAt=0; if(a.local){ Game.spawn(a); } } return; }
    if(t==='pkcp'){ const a=Game.byId.get(d.a); if(a){ a.pkCp=Math.max(a.pkCp,d.i); a.score=a.pkCp; } if(d.f&&Game.host&&Game.state==='live'){ endMatch({winner:d.a}); } if(a&&a.local&&!a.bot) Sfx.play(d.f?'win':'capture'); return; }
  }
  function broadcast(){ if(!Game.host||!M) return; const s={m:Game.mode,sc:M.score,tm:Math.round(M.time),v:M.ver,pl:Game.actors.map(a=>[a.id,a.score,a.kills,a.deaths,a.assists,a.team,a.ggLevel,a.pkCp,a.carry||''])};
    if(M.pts.length) s.pts=M.pts.map(p=>[p.own,+p.prog.toFixed(2)]); if(M.hp) s.hp=[M.hp.i,Math.round(M.hp.t),M.hp.cont?1:0];
    if(M.flags.length) s.fl=M.flags.map(f=>[f.carrier||'',f.home?1:0,+f.x.toFixed(1),+f.y.toFixed(1),+f.z.toFixed(1)]);
    if(Game.mode==='kc') s.tg=M.tags.map(t=>[t.id,+t.x.toFixed(1),+t.y.toFixed(1),+t.z.toFixed(1),t.team]);
    if(M.drive) s.dr=[M.drive.carrier||'',+M.drive.x.toFixed(1),+M.drive.y.toFixed(1),+M.drive.z.toFixed(1)];
    if(M.bomb) s.bm=[M.bomb.carrier||'',M.bomb.planted?1:0,+M.bomb.x.toFixed(1),+M.bomb.y.toFixed(1),+M.bomb.z.toFixed(1),Math.round(M.bomb.timer),M.bomb.site||'',M.att,M.round,M.roundState,Math.round(M.roundT)];
    for(const a of Game.actors){ a.carry=null; } carryMarks();
    Game.emit('mstate',s); }
  function carryMarks(){ for(const f of M.flags) if(f.carrier){ const a=Game.byId.get(f.carrier); if(a) a.carry='flag'; } if(M.drive&&M.drive.carrier){ const a=Game.byId.get(M.drive.carrier); if(a) a.carry='drive'; } if(M.bomb&&M.bomb.carrier){ const a=Game.byId.get(M.bomb.carrier); if(a) a.carry='bomb'; } }
  function applyState(s){ if(!M) return; M.score=s.sc; M.time=s.tm;
    for(const p of s.pl){ const a=Game.byId.get(p[0]); if(!a) continue; a.score=p[1]; a.kills=p[2]; a.deaths=p[3]; a.assists=p[4]; a.team=p[5]; if(a.ggLevel!==p[6]&&!a.local) a.ggLevel=p[6]; a.pkCp=Math.max(a.pkCp,p[7]); }
    if(s.pts) s.pts.forEach((p,i)=>{ if(M.pts[i]){ M.pts[i].own=p[0]; M.pts[i].prog=p[1]; } }); if(s.hp&&M.hp){ M.hp.i=s.hp[0]; M.hp.t=s.hp[1]; M.hp.cont=!!s.hp[2]; }
    if(s.fl) s.fl.forEach((f,i)=>{ const F=M.flags[i]; if(!F) return; F.carrier=f[0]||null; F.home=!!f[1]; F.x=f[2]; F.y=f[3]; F.z=f[4]; });
    if(s.tg) M.tags=s.tg.map(t=>({id:t[0],x:t[1],y:t[2],z:t[3],team:t[4]}));
    if(s.dr&&M.drive){ M.drive.carrier=s.dr[0]||null; M.drive.x=s.dr[1]; M.drive.y=s.dr[2]; M.drive.z=s.dr[3]; }
    if(s.bm){ M.bomb=M.bomb||{}; Object.assign(M.bomb,{carrier:s.bm[0]||null,planted:!!s.bm[1],x:s.bm[2],y:s.bm[3],z:s.bm[4],timer:s.bm[5],site:s.bm[6]}); M.att=s.bm[7]; M.round=s.bm[8]; M.roundState=s.bm[9]; M.roundT=s.bm[10]; }
    for(const a of Game.actors) a.carry=null; carryMarks(); }
  /* ---------- 3D markers ---------- */
  function beam(color,h){ const g=new THREE.Group(); const m=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,h||30,12,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.18,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    m.position.y=(h||30)/2; g.add(m); return g; }
  function ring(r,color){ const m=new THREE.Mesh(new THREE.RingGeometry(r-0.15,r,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.7,depthWrite:false,side:THREE.DoubleSide})); m.rotation.x=-Math.PI/2; m.position.y=0.06;
    const f=new THREE.Mesh(new THREE.CircleGeometry(r,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.08,depthWrite:false})); f.rotation.x=-Math.PI/2; f.position.y=0.05; const g=new THREE.Group(); g.add(m,f); g.userData.ring=m; g.userData.fill=f; return g; }
  function letter(txt,color){ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); g.fillStyle='rgba(10,14,22,0.55)'; g.beginPath(); g.arc(64,64,54,0,Math.PI*2); g.fill(); g.lineWidth=8; g.strokeStyle=color; g.stroke();
    g.fillStyle='#fff'; g.font='900 64px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,64,68); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true})); s.scale.set(1.6,1.6,1); s.renderOrder=9; return s; }
  const add=o=>{ R.scene.add(o); vis.push(o); return o; };
  function core(color){ const g=new THREE.Group(); const m=new THREE.Mesh(new THREE.OctahedronGeometry(0.42,0),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:2.5,roughness:0.2,metalness:0.4})); m.position.y=1.3; g.add(m); g.userData.core=m;
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.9,0.3,16),new THREE.MeshStandardMaterial({color:'#2a2d33',metalness:0.7,roughness:0.4})); base.position.y=0.15; g.add(base); return g; }
  function buildVisuals(){ const mode=Game.mode; M.v={};
    if(mode==='dom'){ M.v.pts=M.pts.map(p=>{ const g=add(new THREE.Group()); g.position.set(p.x,p.y,p.z); const r=ring(4.5,'#ffffff'); g.add(r); const b=beam('#ffffff'); g.add(b); const l=letter(p.n,'#ffffff'); l.position.y=3.2; g.add(l); return {g,r,b,l}; }); }
    if(mode==='hp'){ const g=add(new THREE.Group()); const r=ring(4.5,'#ffffff'); g.add(r); const b=beam('#ffffff'); g.add(b); M.v.hp={g,r,b}; }
    if(mode==='ctf'){ M.v.flags=M.flags.map(f=>{ const g=add(core(TEAM_COLORS[f.team])); const base=add(ring(3.2,TEAM_COLORS[f.team])); base.position.set(f.hx,f.hy,f.hz); return g; }); }
    if(mode==='upl'){ const g=add(core('#36e0ff')); M.v.drive=g; for(const [i,p] of ((B().upload||{}).goals||[]).entries()){ const r=add(ring(3.5,TEAM_COLORS[i])); r.position.set(p.x,p.y||0,p.z); const b=add(beam(TEAM_COLORS[i],20)); b.position.set(p.x,p.y||0,p.z); } }
    if(mode==='snd'){ for(const s of (B().sites||[])){ const r=add(ring(4.5,'#ff9b3d')); r.position.set(s.x,s.y||0,s.z); const l=add(letter(s.n,'#ff9b3d')); l.position.set(s.x,(s.y||0)+3,s.z); }
      const bm=new THREE.Group(); const box=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.3,0.35),new THREE.MeshStandardMaterial({color:'#3a3f2a',roughness:0.6})); box.position.y=0.15; bm.add(box);
      const led=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,6),new THREE.MeshBasicMaterial({color:'#ff2020'})); led.position.set(0.1,0.32,0); bm.add(led); bm.userData.led=led; M.v.bomb=add(bm); }
    if(mode==='kc') M.v.tags=new Map();
    if(mode==='pk'&&PK){ const f=PK.cps[PK.cps.length-1]; const b=add(beam('#33ff88',40)); b.position.set(f.x,f.y,f.z); }
  }
  function animateVisuals(dt){ if(!M||!M.v) return; const t=Game.t, mode=Game.mode; const col=o=>o<0?'#ffffff':TEAM_COLORS[o];
    if(M.v.pts) M.v.pts.forEach((v,i)=>{ const p=M.pts[i]; const c=new THREE.Color(col(p.own)); v.r.userData.ring.material.color.copy(c); v.r.userData.fill.material.color.copy(c); v.b.children[0].material.color.copy(c); v.r.userData.fill.material.opacity=0.06+Math.abs(p.prog)*0.1; });
    if(M.v.hp&&M.hp&&M.hp.list.length){ const p=M.hp.list[M.hp.i]; M.v.hp.g.position.set(p.x,p.y,p.z); const c=new THREE.Color(M.hp.cont?'#ffd34a':'#ffffff'); M.v.hp.r.userData.ring.material.color.copy(c); M.v.hp.b.children[0].material.color.copy(c); }
    if(M.v.flags) M.v.flags.forEach((g,i)=>{ const f=M.flags[i]; g.position.set(f.x,f.y+(f.carrier?1.2:0),f.z); g.userData.core.rotation.y+=dt*2; g.userData.core.position.y=1.3+Math.sin(t*3)*0.1; });
    if(M.v.drive&&M.drive){ const d=M.drive; M.v.drive.position.set(d.x,d.y+(d.carrier?1.2:0),d.z); M.v.drive.userData.core.rotation.y+=dt*2.5; }
    if(M.v.bomb&&M.bomb){ const b=M.bomb; M.v.bomb.visible=!b.carrier; M.v.bomb.position.set(b.x,b.y,b.z); M.v.bomb.userData.led.visible=b.planted?Math.sin(t*(b.timer<10?20:8))>0:true;
      if(b.planted&&Game.host===false){ b.timer=Math.max(0,b.timer-dt); } if(b.planted){ b.beepAcc=(b.beepAcc||0)+dt; if(b.beepAcc>(b.timer<10?0.35:1)){ b.beepAcc=0; Sfx.play('beep',{x:b.x,y:b.y,z:b.z,vol:0.6,dist:45}); } } }
    if(M.v.tags){ const seen=new Set(); for(const tg of M.tags){ seen.add(tg.id); let m=M.v.tags.get(tg.id); if(!m){ m=add(new THREE.Mesh(new THREE.BoxGeometry(0.28,0.4,0.04),new THREE.MeshStandardMaterial({color:TEAM_COLORS[tg.team],emissive:TEAM_COLORS[tg.team],emissiveIntensity:1.6,metalness:0.6,roughness:0.3}))); M.v.tags.set(tg.id,m); }
        m.position.set(tg.x,tg.y+0.8+Math.sin(t*3)*0.12,tg.z); m.rotation.y+=dt*3; }
      for(const [id,m] of M.v.tags) if(!seen.has(id)){ R.scene.remove(m); M.v.tags.delete(id); } }
  }
  /* for HUD & bots */
  function info(){ return M; }
  return {init,cleanup,spawnPoint,respawnDelay,canRespawn,pkRespawn,onDeath,update,handle,info};
})();
