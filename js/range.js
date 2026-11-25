/* range.js — 훈련장 (training range): bullseye targets at set distances, dummies you place and set moving,
   any gun in your hands at once (the buy menu, free), endless ammo, nothing can hurt you, and a damage meter (DPS, accuracy, TTK).
   The map's `range` entry gives the start, the targets and the first dummies (maps/range.js). Only the local player is here (offline). */
'use strict';
const Range=(()=>{
  let on=false, T=[], dmode=0, nid=1, st=null, uiT=0, seeded=false, vis=[], holes=[], flash=[];
  const DMODES=['서 있기','좌우 이동','앉았다 서기','다가오기'], DUMMY_MAX=8, ENG_GAP=1.5;
  const ME=()=>Game.me;
  const dummies=()=>Game.actors.filter(a=>a.dummy);
  /* ---------- the damage meter ---------- */
  function newStats(){ return {shots:0,hits:0,heads:0,dmg:0,kills:0,eng:0,engStart:0,lastHit:-99,best:0,last:0,lastHead:false,ttk:null,dist:0,shotHit:false,tScore:0,tHits:0}; }
  function addHit(d,head,dist){ const t=Game.t; if(t-st.lastHit>ENG_GAP){ st.eng=0; st.engStart=t; } st.eng+=d; st.lastHit=t; st.dmg+=d; st.last=d; st.lastHead=!!head; st.dist=dist||0;
    if(!st.shotHit){ st.shotHit=true; st.hits++; } if(head) st.heads++; const v=dps(); if(v>st.best) st.best=v; uiT=0; }
  /* damage per second over the current string of hits (one shot interval added so a single shot is not infinite) */
  function dps(){ const w=curW(ME()), iv=w&&w.rpm?60/w.rpm:0.5; return st.eng/Math.max(0.05,st.lastHit-st.engStart+iv); }
  /* ---------- targets ---------- */
  let TEX=null; function bullTex(){ if(TEX) return TEX; const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
    const ring=(r,col)=>{ g.fillStyle=col; g.beginPath(); g.arc(128,128,r,0,Math.PI*2); g.fill(); };
    ring(127,'#f2efe6'); for(let i=0;i<5;i++) ring(127-i*25,i%2?'#f2efe6':'#c4232b'); ring(14,'#f2efe6'); ring(8,'#c4232b');
    g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=1.5; for(let i=1;i<10;i++){ g.beginPath(); g.arc(128,128,i*12.7,0,Math.PI*2); g.stroke(); }
    TEX=new THREE.CanvasTexture(c); TEX.colorSpace=THREE.SRGBColorSpace; TEX.anisotropy=4; return TEX; }
  function labelTex(txt){ const c=document.createElement('canvas'); c.width=256; c.height=96; const g=c.getContext('2d'); g.fillStyle='#1d1f22'; g.fillRect(0,0,256,96); g.fillStyle='#e2b62a'; g.fillRect(0,0,256,8); g.fillRect(0,88,256,8);
    g.fillStyle='#f4f1e8'; g.font='900 56px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,128,50); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
  const MAT={}; const mat=(k,mk)=>MAT[k]||(MAT[k]=mk());
  function buildTarget(def,i){ const [x,z,y,r,dist]=def;
    const G=new THREE.Group(); G.position.set(x,0,z);
    const wood=mat('wood',()=>new THREE.MeshStandardMaterial({color:'#7a5a3a',roughness:0.85})), steel=mat('steel',()=>new THREE.MeshStandardMaterial({color:'#4a4d52',roughness:0.5,metalness:0.6}));
    const face=new THREE.Mesh(new THREE.CircleGeometry(r,48),new THREE.MeshStandardMaterial({map:bullTex(),roughness:0.8})); face.position.set(0,y,0.061); face.receiveShadow=true; G.add(face);
    const back=new THREE.Mesh(new THREE.BoxGeometry(r*2+0.12,r*2+0.12,0.1),wood); back.position.set(0,y,0); back.castShadow=true; back.receiveShadow=true; G.add(back);
    for(const s of [-1,1]){ const leg=new THREE.Mesh(new THREE.BoxGeometry(0.07,y-r,0.07),steel); leg.position.set(s*r*0.7,(y-r)/2,-0.02); leg.castShadow=true; G.add(leg); }
    const foot=new THREE.Mesh(new THREE.BoxGeometry(r*2,0.08,0.5),steel); foot.position.set(0,0.04,0); G.add(foot);
    const lab=new THREE.Mesh(new THREE.PlaneGeometry(0.75,0.28),new THREE.MeshBasicMaterial({map:labelTex(dist+' m'),toneMapped:false})); lab.position.set(0,Math.max(0.35,y-r-0.25),0.08); G.add(lab);
    const glow=new THREE.Mesh(new THREE.CircleGeometry(r*1.04,48),new THREE.MeshBasicMaterial({color:'#ff3b2f',transparent:true,opacity:0,depthWrite:false})); glow.position.set(0,y,0.064); G.add(glow);
    R.scene.add(G); vis.push(G);
    const s=addDynSolid({x0:x-r-0.06,x1:x+r+0.06,z0:z-0.06,z1:z+0.06,y0:y-r-0.06,y1:y+r+0.06,k:'target',destr:true,hp:1e12,oid:'rt'+i});
    return {i,x,y,z,r,dist,G,s,oid:s.oid,glow,glowT:0,holes:[],__pt:true,alive:true}; }
  /* a bullet hole on the face; ring score 10 at the centre … 1 at the rim */
  const HOLE_G=new THREE.CircleGeometry(0.018,10), HOLE_M=new THREE.MeshBasicMaterial({color:'#121212'});
  function hole(t,p){ const m=new THREE.Mesh(HOLE_G,HOLE_M); m.position.set(p[0]-t.x,p[1],0.066); t.G.add(m); t.holes.push(m); if(t.holes.length>60){ const o=t.holes.shift(); t.G.remove(o); } }
  /* ---------- dummies ---------- */
  function addDummy(x,z,yaw,silent){ const me=ME(); if(dummies().length>=DUMMY_MAX){ if(!silent) HUD.toast(`더미는 ${DUMMY_MAX}개까지 놓을 수 있어요 (X로 치우기)`); return null; }
    const n=nid++, a=newActor({id:'dm'+n,name:'더미 '+n,bot:true,owner:Game.myId,team:1,diff:'normal',
      load:{name:'더미',main:['m4','ak47','smg9','scar'][n%4],side:'p1912',melee:'knife',thr:null,spec:null,perks:[],att:[null,null]}});
    a.local=true; a.dummy=true; a.dmode=dmode; a.sdir=1; a.phase=Math.random()*6; a.home={x,z,y:groundAt(x,z,(me?me.y:0)+3),yaw:yaw||0};
    Game.actors.push(a); Game.byId.set(a.id,a); a.color='#ff5a4e';
    a.av=Avatars.create({color:a.color,look:1,name:a.name,tagColor:'#ff8a7a'}); R.scene.add(a.av.root); a.av.root.visible=false;
    Game.spawn(a); return a; }
  function removeDummy(a){ const i=Game.actors.indexOf(a); if(i>=0) Game.actors.splice(i,1); Game.byId.delete(a.id); if(a.av){ a.av.dispose(); a.av=null; } }
  /* N: put a dummy where you are looking (on the floor, 3–70 m away) */
  function placeDummy(){ const me=ME(); if(!me) return; const d=aimDir(me), ex=me.x, ey=eyeY(me), ez=me.z; const r=rayCast(ex,ey,ez,d.x,d.y,d.z,72);
    let t=Math.min(r.t,70)-0.7; t=Math.max(3,t); let x=ex+d.x*t, z=ez+d.z*t; const W2=W*CELL, H2=H*CELL; x=clamp(x,6,W2-6); z=clamp(z,6,H2-6);
    const yaw=Math.atan2(-(me.x-x),-(me.z-z)); const a=addDummy(x,z,yaw); if(a){ Sfx.play('switch_01',{vol:0.5}); HUD.toast(`${a.name} 배치 · ${Math.round(Math.hypot(x-me.x,z-me.z))} m`); } }
  function cycleMode(){ dmode=(dmode+1)%DMODES.length; for(const a of dummies()){ a.dmode=dmode; a.sdir=1; } $('rgMode').textContent=DMODES[dmode]; HUD.toast('더미 동작: '+DMODES[dmode]); Sfx.play('click'); }
  function clearDummies(){ const n=dummies().length; for(const a of dummies()) removeDummy(a); HUD.toast(n?`더미 ${n}개를 치웠어요`:'치울 더미가 없어요'); Sfx.play('click'); }
  function resetStats(){ st=newStats(); for(const t of T){ for(const h of t.holes) t.G.remove(h); t.holes=[]; } uiT=0; HUD.toast('기록을 초기화했어요'); Sfx.play('click'); }
  /* dummies move by the same physics as players: stand, strafe ±2.5 m, crouch up and down, or walk toward you and back */
  function driveDummy(a,dt){ const me=ME(); if(!a.alive) return;
    if(me){ const want=Math.atan2(-(me.x-a.x),-(me.z-a.z)); a.yaw+=angDiff(a.yaw,want)*Math.min(1,dt*5); } a.pitch=0;
    const rx=Math.cos(a.yaw), rz=-Math.sin(a.yaw), fx=-Math.sin(a.yaw), fz=-Math.cos(a.yaw), ox=a.x-a.home.x, oz=a.z-a.home.z;
    const I={mx:0,mz:0,lookX:0,lookY:0}; const side=ox*rx+oz*rz, ahead=ox*fx+oz*fz;
    if(a.dmode===1){ if(side>2.5) a.sdir=-1; else if(side<-2.5) a.sdir=1; I.mx=a.sdir; I.mz=ahead>0.6?0.6:ahead<-0.6?-0.6:0; }
    else if(a.dmode===2){ I.crouch=Math.sin((Game.t+a.phase)*2.4)>0; }
    else if(a.dmode===3){ if(ahead>6) a.sdir=-1; else if(ahead<0.2) a.sdir=1; I.mz=a.sdir>0?-0.55:0.55; I.mx=side>0.6?-0.6:side<-0.6?0.6:0; }
    else { const dh=Math.hypot(ox,oz); if(dh>0.8){ I.mx=-(side)/dh; I.mz=(ahead)/dh; } }
    I.walk=a.dmode===3; moveActor(a,I,dt); }
  /* ---------- weapons: the buy menu, everything free ---------- */
  const COLS=()=>{ const by=c=>Object.keys(WPN).filter(k=>WPN[k].cat===c&&WPN[k].slot!=='tag'&&WPN[k].mode!=='melee');
    return [{name:'권총',items:by('pistol')},{name:'기관단총',items:by('smg')},{name:'산탄총',items:by('sg')},{name:'돌격소총',items:by('ar')},{name:'기관총',items:by('lmg')},{name:'지정사수',items:by('dmr')},{name:'저격총',items:by('sr')},
      {name:'특수·근접',items:by('other').concat(['shield','knife','axe','fists'].filter((k,i,a)=>WPN[k]&&a.indexOf(k)===i&&!by('other').includes(k)))},{name:'투척',items:Object.keys(TH)}]; };
  function held(k){ const me=ME(); return !!me&&(me.slots.some(s=>s.id===k)||me.load.thr===k); }
  function give(k){ const me=ME(); if(!me) return; const L=me.load;
    if(TH[k]){ L.thr=k; me.thrLeft=9; HUD.toast(`투척: ${TH[k].name} (G)`); return; }
    const w=WPN[k]; if(!w) return;
    if(w.mode==='melee'&&k!=='shield') L.melee=k; else if(w.slot==='side'){ if(L.main===k) L.main=L.side; L.side=k; } else { if(L.side===k) L.side=L.main; L.main=k; }
    L.att=[attClean(L.main,prefs.gunAtt[L.main]),attClean(L.side,prefs.gunAtt[L.side])];
    const keepThr=L.thr; equip(me); L.thr=keepThr; me.thrLeft=9;
    const i=me.slots.findIndex(s=>s.id===k); if(i>=0){ me.prev=me.cur; me.cur=i; } me.switchT=0.35; Game.emit('act',{a:me.id,t:'sw',i:me.cur,w:me.slots[me.cur].id}); }
  function openMenu(){ if(Buy.isOpen()) return; Buy.open({free:true,title:'무기 선택',sub:'고르면 바로 손에 들려요 · 부품은 L(로드아웃)에서 바꿔요',columns:COLS,state:k=>({ok:true,own:held(k),price:0}),pick:give,dirty:()=>false}); }
  /* the loadout screen (L) came back: hold the new guns right away */
  function applyLoad(L){ const me=ME(); if(!me) return; me.load=L; equip(me); me.thrLeft=9; Game.emit('act',{a:me.id,t:'sw',i:me.cur,w:me.slots[me.cur].id}); }
  /* ---------- mode hooks ---------- */
  function init(){ on=true; seeded=false; st=newStats(); dmode=0; nid=1; T=[]; vis=[];
    const def=(MAP&&MAP.range)||{targets:[]}; def.targets.forEach((d,i)=>T.push(buildTarget(d,i)));
    document.body.classList.add('rangemode'); $('hRange').style.display=''; $('rangeBar').style.display=''; $('rgMode').textContent=DMODES[dmode];
    $('rangeBar').querySelectorAll('button').forEach(b=>{ const go=()=>act(b.dataset.r); b.onclick=go; b.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); go(); },{passive:false}); }); }
  function act(k){ if(!on) return; if(k==='weap') openMenu(); if(k==='dummy') placeDummy(); if(k==='dmove') cycleMode(); if(k==='dclear') clearDummies(); if(k==='dreset') resetStats(); if(k==='load') UI.openGameLoadout(); }
  function cleanup(){ if(!on) return; on=false; for(const o of vis) R.scene.remove(o); vis=[]; for(const t of T) removeDynSolid(t.s); T=[];
    document.body.classList.remove('rangemode'); $('hRange').style.display='none'; $('rangeBar').style.display='none'; }
  function spawnPoint(a){ if(a.dummy&&a.home) return {x:a.home.x,y:a.home.y,z:a.home.z,yaw:a.home.yaw}; const s=(MAP.range&&MAP.range.start)||SPAWN_RUN; return {x:s.x,y:0.4,z:s.z,yaw:s.yaw||0}; }
  function update(dt,I){ if(!on) return; const me=ME();
    if(!seeded&&me){ seeded=true; for(const d of ((MAP.range&&MAP.range.dummies)||[])){ addDummy(d[0],d[1],Math.atan2(-(me.x-d[0]),-(me.z-d[1])),true); }
      HUD.msg('훈련장',isTouch?'아래 버튼으로 무기·더미를 바꿔요':[['buy','무기'],['dummy','더미 놓기'],['dmove','더미 동작'],['dclear','치우기'],['dreset','기록 초기화']].map(([k,t])=>Input.keyLabel(k)+' '+t).join(' · '),5); }
    for(const a of dummies()) driveDummy(a,dt);
    if(me){ for(const s of me.slots) if(s.max) s.res=999; if(me.load&&TH[me.load.thr]&&me.thrLeft<3) me.thrLeft=9; me.hp=me.maxHp;
      if(I){ if(I.buy) openMenu(); if(I.dummy) placeDummy(); if(I.dmove) cycleMode(); if(I.dclear) clearDummies(); if(I.dreset) resetStats(); } }
    for(const t of T){ if(t.glowT>0){ t.glowT-=dt; t.glow.material.opacity=Math.max(0,t.glowT/0.18)*0.45; } }
    uiT-=dt; if(uiT<=0){ uiT=0.2; paint(); } }
  function paint(){ const me=ME(); if(!me) return; const w=curW(me); const live=Game.t-st.lastHit<ENG_GAP, v=st.eng>0?dps():0;
    $('rgDps').textContent=Math.round(v); $('rgDps').classList.toggle('idle',!live); $('rgBest').textContent=st.best>0?'최고 '+Math.round(st.best):''; $('rgWeap').textContent=w?w.name:'';
    const acc=st.shots?Math.round(st.hits/st.shots*100):0, hs=st.hits?Math.round(st.heads/st.hits*100):0;
    const row=(n,v)=>`<span>${n}<b>${v}</b></span>`;
    $('rgStats').innerHTML=row('마지막 피해',st.last?Math.round(st.last)+(st.lastHead?' (머리)':''):'-')+row('총 피해',Math.round(st.dmg))+row('명중률',st.shots?acc+'%':'-')+row('헤드샷',st.hits?hs+'%':'-')
      +row('발사 / 명중',`${st.shots} / ${st.hits}`)+row('처치',st.kills)+row('처치 시간',st.ttk!=null?st.ttk.toFixed(2)+'초':'-')+row('거리',st.dist?Math.round(st.dist)+' m':'-')+row('표적 점수',st.tHits?(st.tScore/st.tHits).toFixed(1):'-'); }
  /* shots, hits on dummies (hitmark) and on targets (objdmg) */
  Bus.on('fired',()=>{ if(!on) return; st.shots++; st.shotHit=false; });
  Bus.on('hitmark',e=>{ if(!on||!e.v||!e.v.dummy) return; const me=ME(); if(e.v.firstHitT==null) e.v.firstHitT=Game.t; addHit(e.d,e.head,me?Math.hypot(e.v.x-me.x,e.v.z-me.z):0); if(e.v.av) e.v.av.play('Hit_Chest',2); });
  function onObj(d){ if(!on) return false; const t=T.find(x=>x.oid===d.o); if(!t) return false; const me=ME(); if(!me||d.a!==me.id) return true;
    const dmg=d.f!=null?+d.f:d.d, p=d.p; if(p) hole(t,p); t.glowT=0.18;
    if(p){ const rr=Math.hypot(p[0]-t.x,p[1]-t.y)/t.r; const sc=rr<=1?Math.max(1,10-Math.floor(rr*10)):0; st.tScore+=sc; st.tHits++; }
    addHit(dmg,false,Math.hypot(t.x-me.x,t.z-me.z)); HUD.dmgAt(t,Math.round(dmg),false); return true; }
  function onDeath(v,k){ if(!on) return; const me=ME(); if(v.dummy&&k===me){ st.kills++; if(v.firstHitT!=null) st.ttk=Game.t-v.firstHitT; } if(v.dummy) v.firstHitT=null; uiT=0; }
  return {init,cleanup,update,spawnPoint,onObj,onDeath,applyLoad,act,get on(){ return on; }};
})();
