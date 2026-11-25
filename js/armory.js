/* armory.js — the main menu's loadout as a place to walk through.
   Five rooms: a workshop in the middle (정비실) and four armories built after reference photos —
     r1 구형 소총 보관실  white plaster hall, rows of wooden A-frame racks, one kind of rifle per rack
     r2 신사의 무기고     walnut panelling, back-lit niches, knives fanned out, pistols on lit shelves, a chandelier
     r3 군 무기 케이지    concrete, chain-link cage, OD-green two-tier cabinets full of carbines, crates of grenades, a parts bench
     r4 총포상            cream slatwall covered in hanging rifles with price tags, glass counters with pistols and parts
   Look at a thing and press the use key (E) or click:
     a gun goes into the gun slot in your hands (1번 / 2번), a knife or axe into the melee slot, a grenade / device into its slot,
     a part onto the gun in your hands, a patch on the board becomes a perk.
   Drawn on the main canvas with its own scene, only while the screen is open. Every gun of one kind in one room is ONE instanced mesh,
   and the furniture of a room is merged into a few meshes, so hundreds of guns cost a few dozen draw calls. Rooms out of sight are not drawn. */
'use strict';
const Armory=(()=>{
  const PI=Math.PI, H2=PI/2, EYE=1.62, RAD=0.3, REACH=2.8, WT=0.12;
  let on=false, built=false, building=null, scene=null, cam=null, vmScene=null, vmCam=null, comp=null, lastSize='', szKey='', raf=0, last=0;
  let rooms=[], RM={}, cur='hub', solids=[], picks=[], aim=null, hl=null, hand='main', vm=null, vmKey='', raise=0, menuOn=false, insp=0, firePrev=false, dirLight=null;
  let benchG=null, benchKey='', perkMarks=[], toastT=0, density=1, T=null;
  const P={x:0,z:3.2,yaw:0,pitch:-0.05,vx:0,vz:0,bob:0,step:0};
  const SRC=new Map(), PL=[];
  const _v=new THREE.Vector3(), _v2=new THREE.Vector3(), _ray=new THREE.Ray(), _m=new THREE.Matrix4(), _box=new THREE.Box3(), _fr=new THREE.Frustum(), _pm=new THREE.Matrix4();
  /* ---------- small matrix helpers ---------- */
  const mT=(x,y,z)=>new THREE.Matrix4().makeTranslation(x,y,z), mX=a=>new THREE.Matrix4().makeRotationX(a), mY=a=>new THREE.Matrix4().makeRotationY(a), mZ=a=>new THREE.Matrix4().makeRotationZ(a);
  const mul=(...ms)=>{ const r=new THREE.Matrix4(); for(const m of ms) r.multiply(m); return r; };
  /* ---------- procedural textures (uv in metres: a texture that shows S metres has repeat 1/S) ---------- */
  let rnd=mulberry(7);
  function canvas(w,h,fn){ const c=document.createElement('canvas'); c.width=w; c.height=h; fn(c.getContext('2d'),w,h); return c; }
  function tx(c,m,o){ o=o||{}; const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; if(o.srgb!==false) t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=Math.min(8,R.renderer.capabilities.getMaxAnisotropy()); if(m) t.repeat.set(1/(Array.isArray(m)?m[0]:m),1/(Array.isArray(m)?m[1]:m)); return t; }
  function specks(x,w,h,n,cols,r0,r1){ for(let i=0;i<n;i++){ x.fillStyle=cols[(rnd()*cols.length)|0]; x.beginPath(); x.arc(rnd()*w,rnd()*h,r0+rnd()*(r1-r0),0,7); x.fill(); } }
  function grain(x,x0,y0,w,h,n,a,vert){ for(let i=0;i<n;i++){ const p=rnd()*(vert?w:h); x.strokeStyle=rnd()<0.6?`rgba(0,0,0,${a*rnd()})`:`rgba(255,226,190,${a*0.45*rnd()})`; x.lineWidth=0.6+rnd()*1.8; x.beginPath();
      if(vert){ let q=x0+p; x.moveTo(q,y0); for(let k=1;k<=10;k++){ q+=(rnd()-0.5)*2.5; x.lineTo(q,y0+h*k/10); } } else { let q=y0+p; x.moveTo(x0,q); for(let k=1;k<=10;k++){ q+=(rnd()-0.5)*2.5; x.lineTo(x0+w*k/10,q); } } x.stroke(); } }
  function noise(x,w,h,n,a){ for(let i=0;i<n;i++){ const v=(rnd()-0.5)*a; x.fillStyle=v>0?`rgba(255,255,255,${v})`:`rgba(0,0,0,${-v})`; x.fillRect(rnd()*w,rnd()*h,1+rnd()*3,1+rnd()*3); } }
  function makeTex(){ rnd=mulberry(7); const X={};
    X.terrazzo=tx(canvas(512,512,(x,w,h)=>{ x.fillStyle='#cfc9bd'; x.fillRect(0,0,w,h); for(let i=0;i<4;i++) for(let j=0;j<4;j++){ x.fillStyle=`rgba(${rnd()<0.5?'255,255,255':'70,60,50'},${0.03+rnd()*0.05})`; x.fillRect(i*128,j*128,128,128); }
      specks(x,w,h,5200,['#8b847a','#b5ac9d','#ece7dd','#6a6158','#a68f77','#5b5550'],0.5,2.1); x.strokeStyle='rgba(70,64,56,.5)'; x.lineWidth=2; for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*128,0); x.lineTo(i*128,h); x.stroke(); x.beginPath(); x.moveTo(0,i*128); x.lineTo(w,i*128); x.stroke(); } }),2.4);
    X.planks=tx(canvas(512,512,(x,w,h)=>{ /* dark oak boards, 0.16 m wide, staggered joints (2 m square) */ const bw=41;
      for(let r=0;r*bw<h;r++){ let off=-((r*97)%200); while(off<w){ const L=150+((rnd()*180)|0), t=0.75+rnd()*0.35; x.fillStyle=`rgb(${(58*t)|0},${(36*t)|0},${(22*t)|0})`; x.fillRect(off,r*bw,L,bw); grain(x,off,r*bw,L,bw,14,0.35,false); x.fillStyle='rgba(0,0,0,.6)'; x.fillRect(off,r*bw,2,bw); off+=L; }
        x.fillStyle='rgba(0,0,0,.55)'; x.fillRect(0,r*bw,w,2); } }),2);
    X.walnut=tx(canvas(512,512,(x,w,h)=>{ /* one 1.2 m raised panel */ x.fillStyle='#4a2b18'; x.fillRect(0,0,w,h); grain(x,0,0,w,h,140,0.28,true);
      const fr=46, b=18; x.fillStyle='rgba(0,0,0,.28)'; x.fillRect(fr,fr,w-2*fr,h-2*fr);
      x.fillStyle='rgba(255,210,160,.12)'; x.fillRect(fr,fr,w-2*fr,b); x.fillRect(fr,fr,b,h-2*fr); x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(fr,h-fr-b,w-2*fr,b); x.fillRect(w-fr-b,fr,b,h-2*fr);
      x.fillStyle='#4f2e19'; x.fillRect(fr+b,fr+b,w-2*(fr+b),h-2*(fr+b)); grain(x,fr+b,fr+b,w-2*(fr+b),h-2*(fr+b),60,0.3,true);
      x.strokeStyle='rgba(0,0,0,.6)'; x.lineWidth=3; x.strokeRect(1.5,1.5,w-3,h-3); }),1.2);
    X.coffer=tx(canvas(256,256,(x,w,h)=>{ x.fillStyle='#3b2416'; x.fillRect(0,0,w,h); grain(x,0,0,w,h,40,0.25,false); x.fillStyle='#1d3a33'; x.fillRect(30,30,w-60,h-60); x.strokeStyle='#b8925a'; x.lineWidth=3; x.strokeRect(36,36,w-72,h-72);
      x.fillStyle='rgba(255,255,255,.05)'; x.fillRect(30,30,w-60,8); }),1.4);
    X.slat=tx(canvas(256,256,(x,w,h)=>{ /* slatwall: a groove every 7.5 cm (256 px = 0.6 m) */ x.fillStyle='#ebe6d9'; x.fillRect(0,0,w,h); noise(x,w,h,900,0.05);
      for(let y=0;y<h;y+=32){ x.fillStyle='#8f8878'; x.fillRect(0,y+24,w,4); x.fillStyle='rgba(0,0,0,.16)'; x.fillRect(0,y+20,w,4); x.fillStyle='rgba(255,255,255,.55)'; x.fillRect(0,y+28,w,2); } }),0.6);
    X.vinyl=tx(canvas(256,256,(x,w,h)=>{ for(let i=0;i<4;i++) for(let j=0;j<4;j++){ const t=0.92+rnd()*0.1; x.fillStyle=`rgb(${(150*t)|0},${(148*t)|0},${(142*t)|0})`; x.fillRect(i*64,j*64,64,64); }
      specks(x,w,h,2200,['#6f6d68','#c9c6bd','#8d8a84'],0.4,1.4); x.strokeStyle='rgba(40,40,40,.35)'; x.lineWidth=1.5; for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*64,0); x.lineTo(i*64,h); x.stroke(); x.beginPath(); x.moveTo(0,i*64); x.lineTo(w,i*64); x.stroke(); } }),1.2);
    X.tiles=tx(canvas(256,256,(x,w,h)=>{ /* drop ceiling, 0.6 m tiles */ x.fillStyle='#e9e8e3'; x.fillRect(0,0,w,h); specks(x,w,h,2600,['#cfcdc6','#b9b7b0','#f4f3ef'],0.4,1.1);
      x.fillStyle='#f6f6f4'; for(const p of [0,128]){ x.fillRect(p,0,6,h); x.fillRect(0,p,w,6); } x.fillStyle='rgba(0,0,0,.12)'; for(const p of [6,134]){ x.fillRect(p,0,2,h); x.fillRect(0,p,w,2); } }),1.2);
    X.block=tx(canvas(512,256,(x,w,h)=>{ /* painted concrete block, 0.4 × 0.2 m (512 px = 1.6 m) */ x.fillStyle='#b9bdb3'; x.fillRect(0,0,w,h); noise(x,w,h,3000,0.07);
      x.fillStyle='rgba(60,62,58,.45)'; for(let r=0;r<4;r++){ x.fillRect(0,r*64,w,3); const o=r%2?64:0; for(let c=-1;c<5;c++) x.fillRect(o+c*128,r*64,3,64); } }),[1.6,0.8]);
    X.mesh=tx(canvas(128,128,(x,w,h)=>{ /* chain-link: 128 px = 0.12 m */ x.clearRect(0,0,w,h); x.strokeStyle='#a9aeb1'; x.lineWidth=5; x.lineCap='round';
      x.beginPath(); x.moveTo(0,0); x.lineTo(64,64); x.lineTo(128,0); x.moveTo(0,128); x.lineTo(64,64); x.lineTo(128,128); x.stroke(); x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=1.5; x.stroke(); }),0.12);
    X.od=tx(canvas(128,128,(x,w,h)=>{ x.fillStyle='#4a5034'; x.fillRect(0,0,w,h); noise(x,w,h,1400,0.08); }),0.5);
    X.tartan=tx(canvas(128,128,(x,w,h)=>{ x.fillStyle='#163027'; x.fillRect(0,0,w,h); x.fillStyle='rgba(18,26,52,.85)'; x.fillRect(0,40,w,26); x.fillRect(40,0,26,h); x.fillStyle='rgba(0,0,0,.5)'; x.fillRect(0,92,w,10); x.fillRect(92,0,10,h);
      x.fillStyle='rgba(150,30,30,.6)'; x.fillRect(0,20,w,2); x.fillRect(20,0,2,h); x.fillStyle='rgba(0,0,0,.45)'; for(let i=0;i<4;i++) for(let j=0;j<4;j++){ x.beginPath(); x.arc(16+i*32+(j%2)*16,16+j*32,3.2,0,7); x.fill(); } }),0.35);
    X.rug=tx(canvas(256,512,(x,w,h)=>{ x.fillStyle='#3f1111'; x.fillRect(0,0,w,h); x.strokeStyle='#9c7f48'; x.lineWidth=6; x.strokeRect(14,14,w-28,h-28); x.strokeStyle='#1d2b48'; x.lineWidth=14; x.strokeRect(34,34,w-68,h-68);
      x.fillStyle='rgba(156,127,72,.45)'; for(let j=0;j<6;j++){ x.save(); x.translate(w/2,90+j*66); x.rotate(PI/4); x.fillRect(-16,-16,32,32); x.restore(); } noise(x,w,h,3000,0.08); }));
    X.pine=tx(canvas(256,64,(x,w,h)=>{ x.fillStyle='#8c6a48'; x.fillRect(0,0,w,h); grain(x,0,0,w,h,40,0.3,false); }),[1,0.25]);
    X.cork=tx(canvas(256,256,(x,w,h)=>{ x.fillStyle='#b27a46'; x.fillRect(0,0,w,h); specks(x,w,h,4000,['#8a5a2e','#c99560','#6d4422','#d8a873'],0.5,1.8); }),0.5);
    X.peg=tx(canvas(256,256,(x,w,h)=>{ x.fillStyle='#cdb894'; x.fillRect(0,0,w,h); noise(x,w,h,800,0.06); x.fillStyle='#3a3024'; for(let i=0;i<10;i++) for(let j=0;j<10;j++){ x.beginPath(); x.arc(13+i*25.6,13+j*25.6,3.4,0,7); x.fill(); } }),0.25);
    X.epoxy=tx(canvas(256,256,(x,w,h)=>{ x.fillStyle='#5b5f64'; x.fillRect(0,0,w,h); noise(x,w,h,4000,0.08); specks(x,w,h,400,['#6d7177','#4b4f54'],1,3); }),2);
    X.plaster=tx(canvas(256,256,(x,w,h)=>{ x.fillStyle='#efece5'; x.fillRect(0,0,w,h); noise(x,w,h,2600,0.035); for(let i=0;i<30;i++){ x.fillStyle=`rgba(${rnd()<0.5?'255,255,255':'120,110,95'},0.025)`; x.beginPath(); x.arc(rnd()*w,rnd()*h,10+rnd()*40,0,7); x.fill(); } }),1.6);
    X.panels=tx(canvas(512,512,(x,w,h)=>{ /* painted steel wall panels, 1.2 m wide (512 px = 2.4 m) */ x.fillStyle='#b9bec3'; x.fillRect(0,0,w,h); noise(x,w,h,2500,0.04);
      for(const px of [0,256]){ x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(px,0,3,h); x.fillStyle='rgba(255,255,255,.35)'; x.fillRect(px+3,0,2,h); for(let y=24;y<h;y+=64){ x.fillStyle='rgba(0,0,0,.35)'; x.beginPath(); x.arc(px+14,y,3,0,7); x.fill(); x.beginPath(); x.arc(px+242,y,3,0,7); x.fill(); } }
      x.fillStyle='rgba(0,0,0,.3)'; x.fillRect(0,0,w,3); x.fillStyle='rgba(0,0,0,.3)'; x.fillRect(0,256,w,3); }),2.4);
    X.felt=tx(canvas(64,64,(x,w,h)=>{ x.fillStyle='#16181b'; x.fillRect(0,0,w,h); noise(x,w,h,300,0.08); }),0.3);
    X.runner=tx(canvas(128,256,(x,w,h)=>{ x.fillStyle='#6b1a17'; x.fillRect(0,0,w,h); x.fillStyle='#c19a52'; x.fillRect(6,0,4,h); x.fillRect(w-10,0,4,h); x.fillStyle='#1f2a44'; x.fillRect(14,0,7,h); x.fillRect(w-21,0,7,h);
      x.fillStyle='rgba(193,154,82,.5)'; for(let y=32;y<h;y+=64){ x.save(); x.translate(w/2,y); x.rotate(PI/4); x.fillRect(-12,-12,24,24); x.restore(); } noise(x,w,h,1600,0.08); }),[1.8,3.6]);
    X.ribs=tx(canvas(64,64,(x,w,h)=>{ x.fillStyle='#1d1e20'; x.fillRect(0,0,w,h); for(let i=0;i<w;i+=8){ x.fillStyle='#2c2e31'; x.fillRect(i,0,4,h); } noise(x,w,h,200,0.06); }),0.12);
    X.doormat=tx(canvas(256,144,(x,w,h)=>{ x.fillStyle='#7a5a32'; x.fillRect(0,0,w,h); noise(x,w,h,3000,0.18); x.strokeStyle='#2a1e12'; x.lineWidth=8; x.strokeRect(8,8,w-16,h-16); x.fillStyle='#2a1e12'; x.font=`900 34px ${'sans-serif'}`; x.textAlign='center'; x.textBaseline='middle'; x.fillText('WELCOME',w/2,h/2); }));
    X.brick=tx(canvas(256,256,(x,w,h)=>{ x.fillStyle='#3a2a22'; x.fillRect(0,0,w,h); for(let r=0;r<8;r++) for(let c=-1;c<5;c++){ const o=r%2?32:0, t=0.75+rnd()*0.3; x.fillStyle=`rgb(${(120*t)|0},${(58*t)|0},${(40*t)|0})`; x.fillRect(o+c*64+2,r*32+2,60,28); } x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(0,0,w,h*0.15); noise(x,w,h,1500,0.1); }),0.5);
    X.globe=new THREE.CanvasTexture(canvas(256,128,(x,w,h)=>{ x.fillStyle='#c9b98a'; x.fillRect(0,0,w,h); x.fillStyle='#7d8f62'; for(let i=0;i<14;i++){ x.beginPath(); x.ellipse(rnd()*w,h*(0.2+rnd()*0.6),8+rnd()*26,6+rnd()*18,rnd()*3,0,7); x.fill(); }
      x.strokeStyle='rgba(60,40,20,.35)'; x.lineWidth=1; for(let i=1;i<8;i++){ x.beginPath(); x.moveTo(i*w/8,0); x.lineTo(i*w/8,h); x.stroke(); } for(let i=1;i<4;i++){ x.beginPath(); x.moveTo(0,i*h/4); x.lineTo(w,i*h/4); x.stroke(); } })); X.globe.colorSpace=THREE.SRGBColorSpace;
    /* soft shade for the foot and the top of every wall: dark at v=0, clear at v=1 */
    X.grad=new THREE.CanvasTexture(canvas(4,64,(x,w,h)=>{ const g=x.createLinearGradient(0,h,0,0); g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(0.35,'rgba(0,0,0,.35)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(0,0,w,h); }));
    return X; }
  /* ---------- per-room materials: every material of a room reflects that room (its own small environment map) ---------- */
  function rm(Rm,key,o){ const k=key; if(Rm.mats.has(k)) return Rm.mats.get(k); const p=Object.assign({},o); const env=p.env; delete p.env;
    const m=new THREE.MeshStandardMaterial(p); m.envMap=Rm.env; m.envMapIntensity=env!=null?env:1; Rm.mats.set(k,m); return m; }
  function basic(Rm,key,o){ if(Rm.mats.has(key)) return Rm.mats.get(key); const m=new THREE.MeshBasicMaterial(o); Rm.mats.set(key,m); return m; }
  function tiled(t,m){ const c=t.clone(); c.repeat.set(1/(Array.isArray(m)?m[0]:m),1/(Array.isArray(m)?m[1]:m)); c.needsUpdate=true; return c; }
  function pbrTex(name,m){ const s=Assets.texSet(name), o={}; o.map=tiled(s.map,m); if(s.normalMap){ o.normalMap=tiled(s.normalMap,m); o.roughnessMap=tiled(s.armMap,m); } return o; }
  /* a box of light shaped like the room, turned into reflections + ambient light for that room */
  function makeEnv(d){ const s=new THREE.Scene(), e=d.env, W=d.x1-d.x0, D=d.z1-d.z0, h=d.h, list=[];
    const mats=[e.wall,e.wall,e.ceil,e.floor,e.wall,e.wall].map(c=>{ const m=new THREE.MeshBasicMaterial({color:c,side:THREE.BackSide}); list.push(m); return m; });
    const box=new THREE.Mesh(new THREE.BoxGeometry(W,h,D),mats); box.position.y=h/2-1.6; s.add(box);
    for(const L of e.lights){ const m=new THREE.MeshBasicMaterial({color:new THREE.Color(L[4]).multiplyScalar(L[5]),side:THREE.DoubleSide}); list.push(m);
      const p=new THREE.Mesh(new THREE.PlaneGeometry(L[2],L[3]),m); if(L[6]!=null){ p.position.set(L[0],L[6]-1.6,L[1]); p.rotation.y=L[7]||0; } else { p.rotation.x=H2; p.position.set(L[0],h-1.62,L[1]); } s.add(p); }
    const pm=new THREE.PMREMGenerator(R.renderer); const t=pm.fromScene(s,0.035,0.05,60).texture; pm.dispose(); s.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); list.forEach(m=>m.dispose()); return t; }
  /* ---------- rooms ---------- */
  const DEF=[
    {id:'hub',name:'정비실',sub:'작업대에서 세부 설정 · 퍼크 게시판 · 투척·장비 선반 · 출구',x0:-6,x1:6,z0:-6,z1:6,h:3.6,doors:['n','s','e','w'],ox:0,oz:0,rot:0,light:'#eef3ff',li:5,genv:1,
      env:{wall:'#8f959c',floor:'#4a4e53',ceil:'#2a2d31',lights:[[-2.4,-2.2,4.6,0.3,'#eef4ff',6],[2.4,-2.2,4.6,0.3,'#eef4ff',6],[-2.4,2.2,4.6,0.3,'#eef4ff',6],[2.4,2.2,4.6,0.3,'#eef4ff',6]]}},
    {id:'r1',name:'구형 소총 보관실',sub:'목재 거치대마다 한 종류씩 · 벽 거치대엔 옛 기관단총 · 기관총',x0:-10,x1:10,z0:-16,z1:0,h:4.2,doors:['s'],ox:0,oz:-6,rot:0,light:'#fff3e2',li:7,genv:0.72,
      env:{wall:'#e3dfd6',floor:'#b9b3a7',ceil:'#d9d6cf',lights:[[-5,-4,1.2,0.6,'#fff6e8',4.2],[5,-4,1.2,0.6,'#fff6e8',4.2],[-5,0,1.2,0.6,'#fff6e8',4.2],[5,0,1.2,0.6,'#fff6e8',4.2],[-5,4,1.2,0.6,'#fff6e8',4.2],[5,4,1.2,0.6,'#fff6e8',4.2]]}},
    {id:'r2',name:'신사의 무기고',sub:'저격총 · 지정사수 소총 · 권총 · 나이프 · 고배율 조준경 · 벽난로',x0:-6,x1:6,z0:-14,z1:0,h:3.4,doors:['s'],ox:6,oz:0,rot:-H2,light:'#ffd29a',li:6,genv:1.3,
      env:{wall:'#2d1a10',floor:'#22150d',ceil:'#1d2420',lights:[[0,-6.6,4.8,1.6,'#ffe7c2',2.0,1.9,0],[-5.8,0,8,1.4,'#ffe2b8',1.1,1.9,H2],[5.8,0,8,1.4,'#ffe2b8',1.1,1.9,-H2],[0,0,0.7,0.7,'#ffcf8a',9]]}},
    {id:'r3',name:'군 무기 보관 케이지',sub:'돌격소총 · 기관단총 · 기관총 · 중화기 · 방패 · 투척 · 부품 작업대',x0:-10,x1:10,z0:-16,z1:0,h:4.0,doors:['s'],ox:0,oz:6,rot:PI,light:'#e8f1ff',li:8,genv:0.95,
      env:{wall:'#9a9f97',floor:'#77766f',ceil:'#3c3f42',lights:[[-6,-4,3,0.25,'#e6f1ff',7],[0,-4,3,0.25,'#e6f1ff',7],[6,-4,3,0.25,'#e6f1ff',7],[-6,3,3,0.25,'#e6f1ff',7],[0,3,3,0.25,'#e6f1ff',7],[6,3,3,0.25,'#e6f1ff',7]]}},
    {id:'r4',name:'총포상',sub:'산탄총 · 벽걸이 소총 · 권총 진열장 · 특수 화기 · 조준경·총구 부품 · 근접 무기',x0:-6,x1:6,z0:-14,z1:0,h:3.3,doors:['s'],ox:-6,oz:0,rot:H2,light:'#ffffff',li:6,genv:0.62,
      env:{wall:'#e6e1d4',floor:'#8a8b8c',ceil:'#e3e2dd',lights:[[-3,-4,1.2,1.2,'#ffffff',3.4],[3,-4,1.2,1.2,'#ffffff',3.4],[-3,1,1.2,1.2,'#ffffff',3.4],[3,1,1.2,1.2,'#ffffff',3.4],[0,5,1.2,1.2,'#ffffff',3.4]]}}];
  /* a frame = a place to build in: (x,z) and a turn inside a room. Its +z points out of a wall into the room when it is a wall frame. */
  function F(Rm,x,z,yaw,y){ const g=new THREE.Group(); g.position.set(x,y||0,z); g.rotation.y=yaw||0; Rm.g.add(g); g.updateMatrix();
    return {Rm,g,S:g.matrix.clone(),yaw:yaw||0}; }
  const sub=(f,x,z,yaw,y)=>{ const g=new THREE.Group(); g.position.set(x,y||0,z); g.rotation.y=yaw||0; f.g.add(g); g.updateMatrix(); return {Rm:f.Rm,g,S:f.S.clone().multiply(g.matrix),yaw:f.yaw+(yaw||0)}; };
  /* frame point → room point (x,z) */
  function fp(f,x,z){ _v.set(x,0,z).applyMatrix4(f.S); return [_v.x,_v.z]; }
  /* static boxes: min/max corners in the frame */
  function B(f,x0,y0,z0,x1,y1,z1,mat){ const m=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1-x0),Math.abs(y1-y0),Math.abs(z1-z0)),mat); m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); m.userData.st=1; f.g.add(m); return m; }
  function cyl(f,x,y,z,r,h,mat,seg,rx,rz){ const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg||12),mat); m.position.set(x,y,z); if(rx) m.rotation.x=rx; if(rz) m.rotation.z=rz; m.userData.st=1; f.g.add(m); return m; }
  function plane(f,w,h,mat,x,y,z,ry,rx,uvm){ const g=new THREE.PlaneGeometry(w,h); if(uvm){ const u=g.attributes.uv; for(let i=0;i<u.count;i++) u.setXY(i,uvm[0]+u.getX(i)*w,uvm[1]+u.getY(i)*h); }
    const m=new THREE.Mesh(g,mat); m.position.set(x,y,z); if(ry) m.rotation.y=ry; if(rx) m.rotation.x=rx; m.userData.st=1; f.g.add(m); return m; }
  /* collision: a rectangle in the frame → world rectangle */
  function solid(f,x0,z0,x1,z1){ const a=fp(f,x0,z0), b=fp(f,x1,z1), Rm=f.Rm; const p=wpt(Rm,a[0],a[1]), q=wpt(Rm,b[0],b[1]);
    solids.push({x0:Math.min(p[0],q[0]),z0:Math.min(p[1],q[1]),x1:Math.max(p[0],q[0]),z1:Math.max(p[1],q[1])}); }
  function wpt(Rm,x,z){ _v2.set(x,0,z).applyMatrix4(Rm.M); return [_v2.x,_v2.z]; }
  /* soft dark patch on the floor under furniture (drawn into the room's floor shade at the end) */
  function shade(f,x0,z0,x1,z1,a,soft){ const p=fp(f,x0,z0), q=fp(f,x1,z1); f.Rm.shades.push([Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.max(p[0],q[0]),Math.max(p[1],q[1]),a==null?0.45:a,soft==null?0.18:soft]); }
  /* ---------- labels: every label of a room is drawn into one atlas (one material) ---------- */
  function atlas(){ const c=document.createElement('canvas'); c.width=c.height=2048; return {c,x:c.getContext('2d'),px:0,py:0,row:0,items:[]}; }
  /* cut the atlas to the rows used and point every label at its place */
  function packAtlas(A){ const used=Math.max(8,A.py+A.row+2), Hc=Math.min(2048,Math.ceil(used/64)*64); let c=A.c; if(Hc<2048){ c=canvas(2048,Hc,x=>x.drawImage(A.c,0,0)); A.c.width=A.c.height=1; }
    for(const it of A.items){ const u=it.g.attributes.uv, r=it.r; for(let i=0;i<u.count;i++) u.setXY(i,(r[0]+u.getX(i)*r[2])/2048,1-(r[1]+(1-u.getY(i))*r[3])/Hc); u.needsUpdate=true; } A.items=[]; return c; }
  function alloc(A,w,h){ if(A.px+w>2048){ A.px=0; A.py+=A.row+2; A.row=0; } if(A.py+h>2048) return null; const r=[A.px,A.py,w,h]; A.px+=w+2; A.row=Math.max(A.row,h); return r; }
  function lab(f,w,h,x,y,z,draw,o){ o=o||{}; const Rm=f.Rm, A=o.glow?Rm.glowA:Rm.labA, ppm=o.ppm||320; const pw=Math.max(8,Math.round(w*ppm)), ph=Math.max(8,Math.round(h*ppm)); const r=alloc(A,pw,ph); if(!r) return null;
    A.x.save(); A.x.translate(r[0],r[1]); A.x.beginPath(); A.x.rect(0,0,pw,ph); A.x.clip(); draw(A.x,pw,ph); A.x.restore();
    const g=o.circle?new THREE.CircleGeometry(Math.min(w,h)/2,36):new THREE.PlaneGeometry(w,h); A.items.push({g,r});
    const m=new THREE.Mesh(g,o.glow?Rm.glowM:Rm.labM); m.position.set(x,y,z); if(o.ry) m.rotation.y=o.ry; if(o.rx) m.rotation.x=o.rx; if(o.rz) m.rotation.z=o.rz; m.userData.st=1; f.g.add(m); return m; }
  if(typeof CanvasRenderingContext2D!=='undefined'&&!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){ this.rect(x,y,w,h); };
  function wrap(c,t,maxW,maxL){ const out=[]; let line=''; for(const w of String(t).split(' ')){ const tryL=line?line+' '+w:w; if(c.measureText(tryL).width>maxW&&line){ out.push(line); line=w; } else line=tryL; } if(line) out.push(line); return out.slice(0,maxL||3); }
  const FONT='"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  function sign(f,w,h,x,y,z,lines,o){ o=o||{}; return lab(f,w,h,x,y,z,(c,W,H)=>{ c.fillStyle=o.bg||'#17191c'; c.fillRect(0,0,W,H); if(o.border){ c.strokeStyle=o.border; c.lineWidth=Math.max(2,H*0.04); c.strokeRect(c.lineWidth/2,c.lineWidth/2,W-c.lineWidth,H-c.lineWidth); }
      const Ls=lines.map(L=>Array.isArray(L)?L:[L,0.4,o.fg||'#f1f1f1',800]), lh=Ls.map(q=>q[1]*H*1.18), tot=lh.reduce((a,b)=>a+b,0); let y0=(H-tot)/2;
      Ls.forEach((q,i)=>{ c.font=`${q[3]||700} ${Math.round(H*q[1])}px ${FONT}`; c.fillStyle=q[2]||o.fg||'#fff'; c.textAlign=o.align||'center'; c.textBaseline='middle'; c.fillText(q[0],o.align==='left'?W*0.06:W/2,y0+lh[i]/2,W*0.92); y0+=lh[i]; }); },o); }
  /* ---------- sources: one model per gun / part / item, the template for instances ---------- */
  function srcOf(key,mk){ let s=SRC.get(key); if(s) return s; const g=mk(); g.updateMatrixWorld(true); const meshes=[]; g.traverse(o=>{ if(o.isMesh&&o.geometry) meshes.push({geo:o.geometry,mat:o.material,rel:o.matrixWorld.clone()}); });
    s={key,meshes,box:new THREE.Box3().setFromObject(g)}; if(s.box.isEmpty()) s.box.set(V3(-0.05,-0.05,-0.05),V3(0.05,0.05,0.05)); SRC.set(key,s); return s; }
  const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const gsrc=(id,hi)=>srcOf('g|'+id+(hi?'|hi':''),()=>id==='fists'?gloves():Guns.tp(id,null,hi));
  const psrc=(slot,opt)=>srcOf('p|'+slot+'|'+opt,()=>{ const g=Guns.partTP(slot,opt); g.scale.setScalar(1.5); const o=new THREE.Group(); o.add(g); return o; });
  function gloves(){ const g=new THREE.Group(), m=new THREE.MeshStandardMaterial({color:'#1b1c1e',roughness:0.8}); for(const s of [-1,1]){ const a=new THREE.Mesh(new THREE.RoundedBoxGeometry(0.09,0.03,0.17,2,0.012),m); a.position.set(s*0.06,0.015,0); a.rotation.y=s*0.2; g.add(a);
      const c=new THREE.Mesh(new THREE.RoundedBoxGeometry(0.08,0.035,0.06,2,0.01),new THREE.MeshStandardMaterial({color:'#5a5a52',roughness:0.9})); c.position.set(s*0.06+s*0.015,0.017,0.1); c.rotation.y=s*0.2; g.add(c); } return g; }
  /* where a model sits (model space → frame space) */
  function mStand(s,x,y,z,face,lean,spin){ const b=s.box; return mul(mT(x,y,z),mY(face||0),mX(-(lean||0)),mY(spin||0),mX(H2),mT(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,-b.max.z)); }
  function mHang(s,x,y,z,dir,tilt){ const c=s.box.getCenter(new THREE.Vector3()); return mul(mT(x,y,z),mZ(tilt||0),mY(dir<0?H2:-H2),mT(-c.x,-c.y,-c.z)); }
  function mFlat(s,x,y,z,yaw,dir){ const b=s.box, c=b.getCenter(new THREE.Vector3()); return mul(mT(x,y+(b.max.x-b.min.x)/2,z),mY(yaw||0),mX(-H2),mY(dir<0?H2:-H2),mT(-c.x,-c.y,-c.z)); }
  const half=s=>(s.box.max.x-s.box.min.x)/2;
  function mFace(s,x,y,z,rz){ const c=s.box.getCenter(new THREE.Vector3()); return mul(mT(x,y,z+(s.box.max.y-s.box.min.y)/2),mZ(rz||0),mX(H2),mT(-c.x,-c.y,-c.z)); }
  /* place a model: kind gun / melee / thr / spec / part / perk / bench / exit */
  function put(f,s,m,info){ const Rm=f.Rm, lm=f.S.clone().multiply(m); PL.push({Rm,s,m:lm}); if(info){ const w=Rm.M.clone().multiply(lm); picks.push(Object.assign({Rm,s,w,inv:w.clone().invert(),box:s.box.clone().expandByScalar(0.012)},info)); } }
  function gunInfo(id){ const w=WPN[id]; if(TH[id]) return {kind:'thr',id}; if(SP[id]) return {kind:'spec',id}; if(id==='fists'||(w&&w.slot==='melee')) return {kind:'melee',id}; return {kind:'gun',id}; }
  const gun=(f,id,m,hi)=>put(f,gsrc(id,hi),m,gunInfo(id));
  const part=(f,slot,opt,m)=>put(f,psrc(slot,opt),m,{kind:'part',slot,opt});
  /* ---------- walls, floor, ceiling of one room ---------- */
  function shell(Rm,o){ const d=Rm.d, W=d.x1-d.x0, D=d.z1-d.z0, h=d.h, f0=Rm.f0;
    plane(f0,W,D,o.floor,(d.x0+d.x1)/2,0,(d.z0+d.z1)/2,0,-H2,[d.x0,-d.z1]);
    plane(f0,W,D,o.ceil,(d.x0+d.x1)/2,h,(d.z0+d.z1)/2,0,H2,[d.x0,d.z0]);
    const sides={n:[(d.x0+d.x1)/2,d.z0+WT,0,W],s:[(d.x0+d.x1)/2,d.z1-WT,PI,W],w:[d.x0+WT,(d.z0+d.z1)/2,H2,D],e:[d.x1-WT,(d.z0+d.z1)/2,-H2,D]};
    const gradM=basic(Rm,'grad',{color:'#000',map:T.grad,transparent:true,depthWrite:false,opacity:0.5});
    for(const k in sides){ const [x,z,yaw,len]=sides[k], f=F(Rm,x,z,yaw); Rm.w[k]=f; const L=len-2*WT, door=d.doors.includes(k);
      const seg=(a,b,y0,y1)=>{ if(b-a<0.01) return; plane(f,b-a,y1-y0,o.wall,(a+b)/2,(y0+y1)/2,0,0,0,[a,y0]); };
      if(door){ seg(-L/2,-1,0,h); seg(1,L/2,0,h); seg(-1,1,2.6,h); } else seg(-L/2,L/2,0,h);
      /* soft shade at the foot of the wall and under the ceiling */
      const foot=(a,b)=>{ if(b-a>0.01) plane(f,b-a,0.5,gradM,(a+b)/2,0.25,0.004); };
      if(door){ foot(-L/2,-1); foot(1,L/2); } else foot(-L/2,L/2);
      plane(f,L,0.35,gradM,0,h-0.175,0.004).rotation.z=PI;
      if(o.base){ const bb=(a,b)=>{ if(b-a>0.01) B(f,a,0,0,b,o.baseH||0.12,0.02,o.base); }; if(door){ bb(-L/2,-1); bb(1,L/2); } else bb(-L/2,L/2); }
      /* collision: the wall line ± WT (door gaps 2 m wide) */
      const cs=(a,b)=>solid(f,a,-2*WT,b,0); if(door){ cs(-L/2-WT,-1); cs(1,L/2+WT); } else cs(-L/2-WT,L/2+WT);
      if(door){ /* frame of the doorway on this side */ const jm=o.jamb||rm(Rm,'jamb',{color:'#2b2e33',roughness:0.5,metalness:0.6});
        B(f,-1.1,0,-WT-0.02,-1,2.6,0.03,jm); B(f,1,0,-WT-0.02,1.1,2.6,0.03,jm); B(f,-1.1,2.6,-WT-0.02,1.1,2.7,0.03,jm); B(f,-1,-0.01,-WT-0.02,1,0.012,0.02,jm); } }
  }
  /* ---------- one rack of rifles standing in a row (A-frame: both sides lean in) ---------- */
  function rackA(f,x0,x1,zc,id,o){ const Rm=f.Rm, stl=o&&o.steel, wd=stl?rm(Rm,'rackS',{color:'#6a7076',roughness:0.42,metalness:0.7}):rm(Rm,'pine',{map:T.pine,roughness:0.75,color:'#c2a990'}), dk=stl?rm(Rm,'rackSD',{color:'#3b3f44',roughness:0.5,metalness:0.6}):rm(Rm,'pineD',{map:T.pine,roughness:0.8,color:'#7d6650'});
    for(const ex of [x0+0.05,x1-0.05]){ for(const s of [-1,1]){ const leg=B(f,ex-0.035,0,-0.035,ex+0.035,1.25,0.035,wd); leg.position.set(ex,0.62,zc+s*0.24); leg.rotation.x=-s*0.29; }
      B(f,ex-0.03,0.3,zc-0.36,ex+0.03,0.37,zc+0.36,wd); }
    for(const s of [-1,1]){ B(f,x0,0,zc+s*0.26,x1,0.06,zc+s*0.44,dk); B(f,x0,0.06,zc+s*0.44-0.02*s,x1,0.18,zc+s*0.44,wd); B(f,x0,0.5,zc+s*0.17,x1,0.56,zc+s*0.2,wd); }
    B(f,x0,1.14,zc-0.06,x1,1.22,zc+0.06,wd);
    const s=gsrc(id), len=s.box.max.z-s.box.min.z, lean=Math.asin(Math.min(0.85,0.3/len)), sp=0.2/density; const r=mulberry(hashStr(id+x0));
    for(const side of [-1,1]) for(let x=x0+0.22;x<=x1-0.2;x+=sp) gun(f,id,mStand(s,x,0.065,zc+side*0.34,side>0?0:PI,lean,(r()-0.5)*0.35));
    solid(f,x0,zc-0.5,x1,zc+0.5); shade(f,x0-0.1,zc-0.55,x1+0.1,zc+0.55,0.5,0.22);
    const nm=WPN[id].name, n=Math.floor((x1-x0-0.42)/sp+1)*2;
    for(const ex of [x0,x1]){ const o=ex===x0?-1:1; B(f,ex+o*0.005-0.012,0.84,zc-0.2,ex+o*0.005+0.012,1.06,zc+0.2,dk); }
    for(const ex of [x0,x1]) sign(f,0.34,0.14,ex+(ex===x0?-0.02:0.02),0.95,zc,[[nm,0.42,'#2a1c0c',800],[n+'정',0.3,'#4a3a22',700]],{bg:stl?'#d9d6c8':'#c7a560',ry:ex===x0?-H2:H2,top:0.42}); }
  /* ---------- two-tier steel cabinet of upright guns (open front faces the frame's +z) ---------- */
  function cabinet(f,x,z,yaw,w,ids,o){ o=o||{}; const c=sub(f,x,z,yaw), Rm=f.Rm, od=rm(Rm,'od',{map:T.od,roughness:0.62,metalness:0.35,color:'#8a946a'}), dk=rm(Rm,'odD',{color:'#2b2f22',roughness:0.7,metalness:0.3});
    const H=o.h||2.3, d=0.62, tiers=ids.length, th=(H-0.12)/tiers;
    B(c,-w/2,0,-d/2,w/2,H,-d/2+0.03,od); B(c,-w/2,0,-d/2,-w/2+0.04,H,d/2,od); B(c,w/2-0.04,0,-d/2,w/2,H,d/2,od); B(c,-w/2,H-0.05,-d/2,w/2,H,d/2,od); B(c,-w/2,0,-d/2,w/2,0.08,d/2,od);
    const back=rm(Rm,'odB',{map:T.od,color:'#b9c29a',roughness:0.7,metalness:0.2}), strip=basic(Rm,'cabL',{color:new THREE.Color('#eaf3ff').multiplyScalar(1.4)});
    for(let t=0;t<tiers;t++){ const y0=0.08+t*th; if(t>0) B(c,-w/2,y0-0.035,-d/2,w/2,y0,d/2,od); B(c,-w/2+0.04,y0,-d/2+0.03,w/2-0.04,y0+th-0.04,-d/2+0.04,back); B(c,-w/2+0.08,y0+th-0.075,-0.05,w/2-0.08,y0+th-0.06,0.02,strip); B(c,-w/2+0.04,y0,-0.05,w/2-0.04,y0+0.07,0.2,dk); B(c,-w/2+0.04,y0+th*0.72,-0.24,w/2-0.04,y0+th*0.72+0.05,-0.12,dk);
      const id=ids[t]; if(!id) continue; const s=gsrc(id), len=s.box.max.z-s.box.min.z, n=Math.max(2,Math.floor((w-0.16)/(o.sp||0.13)*density)), step=(w-0.2)/(n-1);
      for(let i=0;i<n;i++) gun(c,id,mStand(s,-w/2+0.1+i*step,y0+0.05,0.06,0,Math.min(0.2,0.16/len),0.5));
      sign(c,0.5,0.09,0,y0+th-0.11,d/2+0.003,[[WPN[id].name+' · '+n+'정',0.62,'#111',800]],{bg:'#f2f0e6'}); }
    solid(c,-w/2,-d/2,w/2,d/2); shade(c,-w/2-0.05,-d/2-0.05,w/2+0.05,d/2+0.12,0.55,0.15); }
  /* ---------- a glass counter along the frame's x (customers stand on +z) ---------- */
  function counter(f,x0,x1,z,o){ o=o||{}; const Rm=f.Rm, d=0.68, H=0.96, dk=rm(Rm,'ctr',{color:'#1d1e21',roughness:0.4,metalness:0.4}), felt=o.light?rm(Rm,'feltL',{color:'#cfc8b8',roughness:1}):rm(Rm,'felt',{map:T.felt,roughness:1,color:'#ffffff'}),
      gl=rm(Rm,'glass',{color:'#dfeff2',roughness:0.06,metalness:0,transparent:true,opacity:0.08,depthWrite:false,env:0.7}), tr=rm(Rm,'chrome',{color:'#c8ccd0',roughness:0.2,metalness:1});
    B(f,x0,0,z-d/2,x1,0.42,z+d/2,dk); B(f,x0,0.42,z-d/2,x1,0.47,z+d/2,felt); B(f,x0,0.47,z-d/2,x1,H-0.03,z-d/2+0.02,dk);
    B(f,x0,0.47,z+d/2-0.008,x1,H,z+d/2,gl); B(f,x0,H-0.008,z-d/2,x1,H,z+d/2,gl); for(const ex of [x0,x1]) B(f,ex-0.012,0.42,z-d/2,ex+0.012,H,z+d/2,tr); B(f,x0,H-0.006,z+d/2-0.012,x1,H+0.004,z+d/2+0.004,tr);
    B(f,x0+0.03,H-0.06,z-d/2+0.03,x1-0.03,H-0.045,z-d/2+0.06,basic(Rm,'strip',{color:new THREE.Color('#fff4e0').multiplyScalar(0.95)}));
    solid(f,x0,z-d/2,x1,z+d/2); shade(f,x0-0.05,z-d/2-0.05,x1+0.05,z+d/2+0.1,0.5,0.15); return {y:0.47}; }
  /* ---------- a back-lit niche on a wall frame (r2): a cream panel that glows, wood trim around it ---------- */
  function niche(f,x0,y0,x1,y1){ const Rm=f.Rm, tr=rm(Rm,'trim',{color:'#3a2214',roughness:0.45,map:T.walnut}), glow=rm(Rm,'nicheGlow',{color:'#f3e7cf',emissive:'#ffe9c8',emissiveIntensity:0.4,roughness:0.9});
    B(f,x0,y0,0,x1,y1,0.02,glow); const t=0.07, dp=0.16; B(f,x0-t,y0-t,0,x0,y1+t,dp,tr); B(f,x1,y0-t,0,x1+t,y1+t,dp,tr); B(f,x0,y1,0,x1,y1+t,dp,tr); B(f,x0,y0-t,0,x1,y0,dp,tr); }
  /* drawers along a wall frame (r2) */
  function drawers(f,x0,x1,o){ const Rm=f.Rm, wd=rm(Rm,'drw',{map:T.walnut,color:'#d8c0a8',roughness:0.5}), br=rm(Rm,'brass',{color:'#c9a25a',roughness:0.3,metalness:1}), H=(o&&o.h)||0.92, D=0.56;
    B(f,x0,0,0,x1,H,D,wd); B(f,x0-0.02,H,0,x1+0.02,H+0.04,D+0.03,wd); const n=Math.max(1,Math.round((x1-x0)/0.8)), w=(x1-x0)/n;
    for(let i=0;i<n;i++) for(let j=0;j<3;j++){ const a=x0+i*w+0.03, b=x0+(i+1)*w-0.03, y0=0.08+j*0.28, y1=y0+0.25; B(f,a,y0,D,b,y1,D+0.018,wd); const k=new THREE.Mesh(new THREE.SphereGeometry(0.018,10,8),br); k.position.set((a+b)/2,(y0+y1)/2,D+0.03); k.userData.st=1; f.g.add(k); }
    solid(f,x0,0,x1,D); shade(f,x0,0,x1,D+0.15,0.5,0.12); }
  /* ---------- furniture and props ----------
     Built from boxes and cylinders in a few shared looks per room, so a room's furniture still merges into a few meshes;
     the model props (crates, plants, carts…) are instanced like the guns. On a wall frame +z points out of the wall. */
  const LOOK={
    oak:{map:'pine',color:'#a8805a',roughness:0.68}, oakD:{map:'pine',color:'#6e5038',roughness:0.7}, walnut:{map:'walnut',color:'#c9a184',roughness:0.5},
    steel:{color:'#5b6066',roughness:0.45,metalness:0.7}, grey:{color:'#7b8086',roughness:0.5,metalness:0.45}, dark:{color:'#1c1d20',roughness:0.5,metalness:0.35},
    white:{color:'#e6e4de',roughness:0.55,metalness:0.05}, red:{color:'#b3281e',roughness:0.4,metalness:0.3}, od:{map:'od',color:'#8a946a',roughness:0.62,metalness:0.3}, odD:{color:'#3b412c',roughness:0.65,metalness:0.3},
    leather:{color:'#6b3520',roughness:0.42}, leatherK:{color:'#2a1a12',roughness:0.45}, fabric:{color:'#4a5562',roughness:0.95}, fabricR:{color:'#7a2a26',roughness:0.95},
    paper:{color:'#f0ede4',roughness:0.9}, card:{color:'#b48f62',roughness:0.92}, tan:{color:'#b7a07a',roughness:0.97}, rubber:{color:'#232427',roughness:0.95},
    pot:{color:'#a2583a',roughness:0.85}, brass:{color:'#c9a25a',roughness:0.3,metalness:1}, chrome:{color:'#c8ccd0',roughness:0.2,metalness:1},
    blue:{color:'#2f4f7a',roughness:0.5,metalness:0.2}, green:{color:'#2e5a3c',roughness:0.45,metalness:0.2}, yellow:{color:'#d9a81c',roughness:0.5,metalness:0.2},
    stone:{color:'#bdb5a6',roughness:0.85}, soot:{color:'#141210',roughness:1},
    water:{color:'#8ec3e6',roughness:0.08,transparent:true,opacity:0.55,depthWrite:false}, glassA:{color:'#d9a256',roughness:0.1,transparent:true,opacity:0.6,depthWrite:false},
    glassC:{color:'#dfeff2',roughness:0.05,transparent:true,opacity:0.1,depthWrite:false},
    b0:{color:'#7b2420',roughness:0.7}, b1:{color:'#22406a',roughness:0.7}, b2:{color:'#2f5a33',roughness:0.7}, b3:{color:'#6a5530',roughness:0.7}, b4:{color:'#3e2c4e',roughness:0.7}, b5:{color:'#c9bc98',roughness:0.75}};
  function pm(Rm,k){ const o=Object.assign({},LOOK[k]); if(typeof o.map==='string') o.map=T[o.map]; return rm(Rm,'L_'+k,o); }
  const glow=(Rm,col,k)=>basic(Rm,'G_'+col+(k||1.6),{color:new THREE.Color(col).multiplyScalar(k||1.6)});
  const shadeM=Rm=>basic(Rm,'lshade',{color:new THREE.Color('#ffe2b4').multiplyScalar(1.25),side:THREE.DoubleSide});
  const st=(f,m)=>{ m.userData.st=1; f.g.add(m); return m; };
  const rbox=(f,w,h,d,x,y,z,mat,r)=>{ const m=st(f,new THREE.Mesh(new THREE.RoundedBoxGeometry(w,h,d,2,r||Math.min(w,h,d)*0.25),mat)); m.position.set(x,y,z); return m; };
  /* model props (GLB): loaded once, scaled to a height, standing on y=0, centred */
  const MODELS={}, PROPS=['potted_plant','crate_wood','crate_wood2','mil_crate','mil_crate2','ammo_box','jerrycan','barrel_rust','tool_cart','plastic_crate','cardboard','trash_can','generator','propane','cement_bag','storage_cart'];
  async function loadProps(){ const r=await Promise.all(PROPS.map(n=>Promise.resolve().then(()=>Assets.model(n)).catch(()=>null))); PROPS.forEach((n,i)=>MODELS[n]=r[i]); }
  function msrc(name,h){ const M0=MODELS[name]; if(!M0||!M0.scene) return null; return srcOf('m|'+name+'|'+h,()=>{ const g=M0.scene.clone(true), mid=new THREE.Group(), o=new THREE.Group(); mid.add(g); o.add(mid);
      g.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(g), s=h/Math.max(1e-3,b.max.y-b.min.y); mid.scale.setScalar(s); mid.position.set(-(b.min.x+b.max.x)/2*s,-b.min.y*s,-(b.min.z+b.max.z)/2*s); return o; }); }
  function prop(f,name,h,x,z,yaw,o){ o=o||{}; const s=msrc(name,h); if(!s) return null; put(f,s,mul(mT(x,o.y||0,z),mY(yaw||0)));
    if(o.solid!==false&&!o.y){ const c=sub(f,x,z,yaw), b=s.box; solid(c,b.min.x,b.min.z,b.max.x,b.max.z); shade(c,b.min.x-0.04,b.min.z-0.04,b.max.x+0.04,b.max.z+0.04,0.4,0.1); } return s; }
  const plant=(f,x,z,h)=>prop(f,'potted_plant',h||1.1,x,z,Math.abs(x*7+z*3)%6);
  /* seats and tables (a seat faces −z: its back is on +z) */
  function chair(f,x,z,yaw,k){ const c=sub(f,x,z,yaw), w=pm(f.Rm,k||'oak');
    B(c,-0.22,0.43,-0.21,0.22,0.47,0.21,w); for(const [a,b] of [[-0.19,-0.18],[0.19,-0.18],[-0.19,0.18],[0.19,0.18]]) B(c,a-0.02,0,b-0.02,a+0.02,0.43,b+0.02,w);
    for(const a of [-0.19,0.19]) B(c,a-0.02,0.47,0.16,a+0.02,0.98,0.2,w); for(const y of [0.62,0.78,0.92]) B(c,-0.19,y,0.17,0.19,y+0.05,0.19,w); solid(c,-0.24,-0.23,0.24,0.23); return c; }
  function stool(f,x,z,k){ const c=sub(f,x,z,0), Rm=f.Rm, ch=pm(Rm,'chrome'); cyl(c,0,0.66,0,0.17,0.05,pm(Rm,k||'leatherK'),16); cyl(c,0,0.33,0,0.025,0.62,ch,8); cyl(c,0,0.01,0,0.2,0.02,ch,16);
    const r=st(c,new THREE.Mesh(new THREE.TorusGeometry(0.15,0.012,6,20),ch)); r.rotation.x=H2; r.position.y=0.25; solid(c,-0.2,-0.2,0.2,0.2); }
  function ochair(f,x,z,yaw){ const c=sub(f,x,z,yaw), Rm=f.Rm, k=pm(Rm,'dark'), fb=pm(Rm,'fabric');
    rbox(c,0.5,0.09,0.48,0,0.48,0,fb,0.03); const bk=rbox(c,0.46,0.52,0.07,0,0.84,0.22,fb,0.03); bk.rotation.x=-0.1; B(c,-0.03,0.5,0.2,0.03,0.62,0.25,k);
    cyl(c,0,0.27,0,0.025,0.42,k,8); for(let i=0;i<5;i++){ const a=sub(c,0,0,i/5*PI*2); B(a,-0.018,0.03,0,0.018,0.07,0.3,k); cyl(a,0,0.025,0.29,0.025,0.05,k,8); }
    for(const s of [-1,1]) B(c,s*0.27-0.02,0.52,-0.12,s*0.27+0.02,0.7,0.12,k); solid(c,-0.3,-0.3,0.3,0.3); }
  function table(f,x,z,w,d,h,yaw,k,lk){ const c=sub(f,x,z,yaw), t=pm(f.Rm,k||'oak'), l=pm(f.Rm,lk||k||'oak');
    B(c,-w/2,h-0.045,-d/2,w/2,h,d/2,t); for(const sx of [-1,1]) for(const sz of [-1,1]) B(c,sx*(w/2-0.06)-0.03,0,sz*(d/2-0.06)-0.03,sx*(w/2-0.06)+0.03,h-0.045,sz*(d/2-0.06)+0.03,l);
    B(c,-w/2+0.06,h-0.14,-d/2+0.05,w/2-0.06,h-0.045,-d/2+0.07,l); B(c,-w/2+0.06,h-0.14,d/2-0.07,w/2-0.06,h-0.045,d/2-0.05,l);
    solid(c,-w/2,-d/2,w/2,d/2); shade(c,-w/2,-d/2,w/2,d/2,0.32,0.18); return c; }
  function roundTable(f,x,z,r,h,k){ const c=sub(f,x,z,0), m=pm(f.Rm,k||'walnut'); cyl(c,0,h-0.02,0,r,0.04,m,24); cyl(c,0,h/2,0,0.04,h-0.04,m,10); cyl(c,0,0.02,0,r*0.55,0.04,m,20);
    solid(c,-r*0.7,-r*0.7,r*0.7,r*0.7); shade(c,-r,-r,r,r,0.3,0.15); return c; }
  function sofa(f,x,z,yaw,w,k){ const c=sub(f,x,z,yaw), Rm=f.Rm, L=pm(Rm,k||'leather'), d=0.9, ft=pm(Rm,'leatherK');
    rbox(c,w,0.26,d,0,0.27,0,L,0.05); rbox(c,w,0.52,0.24,0,0.62,d/2-0.12,L,0.08); for(const s of [-1,1]) rbox(c,0.22,0.36,d,s*(w/2-0.11),0.58,0,L,0.08);
    const n=Math.max(1,Math.round((w-0.44)/0.6)), cw=(w-0.44)/n; for(let i=0;i<n;i++) rbox(c,cw-0.02,0.13,d-0.3,-w/2+0.22+cw*(i+0.5),0.465,-0.1,L,0.05);
    for(const sx of [-1,1]) for(const sz of [-1,1]) cyl(c,sx*(w/2-0.08),0.07,sz*(d/2-0.08),0.035,0.14,ft,8);
    solid(c,-w/2,-d/2,w/2,d/2); shade(c,-w/2-0.05,-d/2-0.05,w/2+0.05,d/2+0.05,0.45,0.15); return c; }
  /* shelves, books, boxes */
  function books(f,x0,x1,y,z0,z1,seed){ const Rm=f.Rm, r=mulberry(seed||hashStr(Rm.id+x0+'|'+y+'|'+z0)), dep=z1-z0; let x=x0;
    while(x<x1-0.04){ const q=r(); if(q<0.06){ x+=0.05+r()*0.1; continue; }
      if(q<0.13&&x1-x>0.3){ let yy=y; const n=2+((r()*3)|0); for(let i=0;i<n;i++){ const t=0.03+r()*0.02, w=0.16+r()*0.07; B(f,x,yy,z0+0.01,x+w,yy+t,z0+Math.min(dep,0.17+r()*0.05),pm(Rm,'b'+((r()*6)|0))); yy+=t; } x+=0.27; continue; }
      const t=0.022+r()*0.035, h=0.16+r()*0.13; B(f,x,y,z0+0.01,x+t,y+h,z0+Math.min(dep,0.15+r()*0.08),pm(Rm,'b'+((r()*6)|0))); x+=t+0.003; } }
  function boxes(f,x0,x1,y,z0,z1,keys,seed,o){ o=o||{}; const Rm=f.Rm, r=mulberry(seed||hashStr(Rm.id+'bx'+x0+'|'+y+'|'+z0)), W=o.w||[0.18,0.44], Hh=o.h||[0.1,0.34], D=o.d||[0.2,0.4]; let x=x0+0.02;
    while(x<x1-0.1){ const w=Math.min(x1-x-0.02,W[0]+r()*(W[1]-W[0])), h=Hh[0]+r()*(Hh[1]-Hh[0]), d=Math.min(z1-z0-0.02,D[0]+r()*(D[1]-D[0])), k=keys[(r()*keys.length)|0];
      B(f,x,y,z0+0.01,x+w,y+h,z0+0.01+d,pm(Rm,k)); if(r()<0.3&&h<0.2) B(f,x+0.02,y+h,z0+0.03,x+w*0.8,y+h+0.05+r()*0.07,z0+d*0.8,pm(Rm,keys[(r()*keys.length)|0])); x+=w+0.025+r()*0.05; } }
  function shelfUnit(f,x0,x1,D,H,n,k,fill){ const w=pm(f.Rm,k||'oak'); B(f,x0,0,0,x0+0.035,H,D,w); B(f,x1-0.035,0,0,x1,H,D,w); B(f,x0,0,0,x1,H,0.015,w);
    for(let i=0;i<=n;i++){ const y=0.08+i*(H-0.1)/n; B(f,x0+0.035,y-0.028,0,x1-0.035,y,D,w); if(i<n&&fill) fill(y,i); }
    solid(f,x0,0,x1,D+0.02); shade(f,x0-0.05,0,x1+0.05,D+0.12,0.42,0.12); }
  function ammoShelf(f,x0,x1,H){ const Rm=f.Rm, wd=pm(Rm,'white'); H=H||0.82; B(f,x0,0,0,x1,0.08,0.42,pm(Rm,'dark'));
    for(const y of [0.08,0.44,H]) B(f,x0,y,0,x1,y+0.025,0.42,wd); const nb=Math.max(1,Math.round((x1-x0)/1.2)); for(let i=0;i<=nb;i++){ const x=x0+i*(x1-x0)/nb; B(f,x-0.015,0,0,x+0.015,H+0.025,0.42,wd); }
    for(const y of [0.105,0.465]) boxes(f,x0+0.03,x1-0.03,y,0.03,0.41,['b0','b1','b2','b3','yellow','red','card','dark'],null,{w:[0.1,0.2],h:[0.07,0.15],d:[0.14,0.3]});
    boxes(f,x0+0.05,x1-0.05,H+0.025,0.05,0.38,['b1','red','yellow','b2','card'],null,{w:[0.1,0.18],h:[0.06,0.12],d:[0.12,0.22]}); solid(f,x0,0,x1,0.44); shade(f,x0,0,x1,0.5,0.35,0.1); }
  function gondola(f,x,z,len,yaw){ const c=sub(f,x,z,yaw), Rm=f.Rm, wd=pm(Rm,'white'); B(c,-len/2,0,-0.04,len/2,1.45,0.04,rm(Rm,'peg',{map:T.peg,roughness:0.85}));
    for(const s of [-1,1]) for(const y of [0.1,0.5,0.9]){ B(c,-len/2,y,s>0?0.04:-0.36,len/2,y+0.025,s>0?0.36:-0.04,wd);
      boxes(c,-len/2+0.04,len/2-0.04,y+0.025,s>0?0.06:-0.34,s>0?0.34:-0.06,['b0','b1','b2','yellow','red','card','dark'],hashStr(Rm.id+y+s+x),{w:[0.1,0.22],h:[0.08,0.2],d:[0.12,0.26]}); }
    B(c,-len/2-0.03,0,-0.38,-len/2,1.5,0.38,wd); B(c,len/2,0,-0.38,len/2+0.03,1.5,0.38,wd); solid(c,-len/2-0.04,-0.38,len/2+0.04,0.38); shade(c,-len/2-0.08,-0.42,len/2+0.08,0.42,0.4,0.12); return c; }
  function filing(f,x,z,yaw,n,k){ const c=sub(f,x,z,yaw), Rm=f.Rm, m=pm(Rm,k||'grey'), h=pm(Rm,'chrome'); n=n||4; const H=n*0.33+0.04; B(c,-0.23,0,-0.31,0.23,H,0.31,m);
    for(let i=0;i<n;i++){ const y=0.04+i*0.33; B(c,-0.215,y+0.01,0.31,0.215,y+0.31,0.322,m); B(c,-0.07,y+0.22,0.322,0.07,y+0.24,0.345,h); B(c,-0.04,y+0.25,0.322,0.04,y+0.29,0.326,pm(Rm,'paper')); }
    solid(c,-0.24,-0.32,0.24,0.35); shade(c,-0.26,-0.34,0.26,0.36,0.4,0.1); return c; }
  function trunk(f,x,z,yaw){ const c=sub(f,x,z,yaw), Rm=f.Rm, w=pm(Rm,'oakD'), m=pm(Rm,'dark'); B(c,-0.45,0,-0.27,0.45,0.42,0.27,w); B(c,-0.46,0.42,-0.28,0.46,0.52,0.28,w);
    for(const x2 of [-0.3,0.3]) B(c,x2-0.025,0,-0.285,x2+0.025,0.525,0.285,m); B(c,-0.04,0.36,0.28,0.04,0.45,0.295,pm(Rm,'brass')); for(const s of [-1,1]) B(c,s*0.46-0.02,0.28,-0.06,s*0.46+0.02,0.31,0.06,m);
    solid(c,-0.47,-0.29,0.47,0.29); shade(c,-0.5,-0.32,0.5,0.32,0.45,0.1); return c; }
  function coatRack(f,x,z){ const c=sub(f,x,z,0), Rm=f.Rm, w=pm(Rm,'oakD'); cyl(c,0,0.9,0,0.025,1.8,w,8);
    for(let i=0;i<4;i++){ const a=sub(c,0,0,i*H2+0.3); B(a,-0.02,0,-0.02,0.02,0.04,0.3,w); B(a,-0.012,1.62,0,0.012,1.66,0.16,w); }
    [[0.2,1.56,0.05,'odD'],[-0.05,1.5,0.2,'oakD'],[-0.18,1.56,-0.08,'odD']].forEach(([x2,y,z2,k])=>{ const h=st(c,new THREE.Mesh(new THREE.SphereGeometry(0.13,14,8,0,PI*2,0,PI/2),pm(Rm,k))); h.position.set(x2,y,z2); h.rotation.set(0.3*Math.sign(z2||1),0,0.3*Math.sign(x2)); });
    solid(c,-0.25,-0.25,0.25,0.25); shade(c,-0.3,-0.3,0.3,0.3,0.3,0.12); }
  function clothesRack(f,x,z,yaw,keys){ const c=sub(f,x,z,yaw), Rm=f.Rm, ch=pm(Rm,'chrome'); for(const s of [-0.7,0.7]){ cyl(c,s,0.75,0,0.015,1.5,ch,8); B(c,s-0.02,0,-0.25,s+0.02,0.03,0.25,ch); }
    cyl(c,0,1.5,0,0.013,1.44,ch,8,0,H2); for(let i=0;i<8;i++){ const x2=-0.6+i*0.17; B(c,x2-0.02,0.72,-0.23,x2+0.02,1.45,0.23,pm(Rm,keys[i%keys.length])); B(c,x2-0.005,1.45,-0.02,x2+0.005,1.5,0.02,ch); }
    solid(c,-0.75,-0.27,0.75,0.27); shade(c,-0.78,-0.3,0.78,0.3,0.35,0.12); }
  /* lights */
  function deskLamp(f,x,y,z,yaw){ const c=sub(f,x,z,yaw,y), Rm=f.Rm, br=pm(Rm,'brass'); cyl(c,0,0.012,0,0.075,0.024,br,14); cyl(c,0,0.17,0,0.011,0.3,br,6);
    const s=st(c,new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.32,14,1,false,0,PI),pm(Rm,'green'))); s.rotation.z=H2; s.position.set(0,0.34,0); plane(c,0.3,0.12,glow(Rm,'#ffe3b0',2.2),0,0.335,0,0,H2); }
  function floorLamp(f,x,z){ const c=sub(f,x,z,0), Rm=f.Rm, br=pm(Rm,'brass'); cyl(c,0,0.015,0,0.15,0.03,br,16); cyl(c,0,0.8,0,0.014,1.56,br,6);
    st(c,new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.23,0.3,18,1,true),shadeM(Rm))).position.set(0,1.62,0); solid(c,-0.16,-0.16,0.16,0.16); shade(c,-0.25,-0.25,0.25,0.25,0.3,0.12); }
  function sconce(f,x,y){ const Rm=f.Rm, br=pm(Rm,'brass'); B(f,x-0.06,y-0.1,0,x+0.06,y+0.1,0.02,br); B(f,x-0.012,y-0.02,0.02,x+0.012,y+0.01,0.14,br);
    st(f,new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.09,0.14,14,1,true),shadeM(Rm))).position.set(x,y+0.06,0.15); }
  function track(f,x0,x1,z,y,n){ const Rm=f.Rm, dk=pm(Rm,'dark'), gl=glow(Rm,'#fff2dc',2.2); B(f,x0,y-0.03,z-0.02,x1,y,z+0.02,dk);
    for(let i=0;i<n;i++){ const x=x0+(i+0.5)*(x1-x0)/n; cyl(f,x,y-0.07,z,0.012,0.08,dk,6); cyl(f,x,y-0.15,z-0.04,0.045,0.14,dk,12,-0.5); cyl(f,x,y-0.21,z-0.075,0.036,0.01,gl,12,-0.5); } }
  function pipeRun(f,x0,x1,z,y,r,top,k){ const Rm=f.Rm; cyl(f,(x0+x1)/2,y,z,r,x1-x0,pm(Rm,k||'grey'),10,0,H2); for(let x=x0+0.5;x<x1;x+=1.8) B(f,x-0.015,y,z-0.015,x+0.015,top,z+0.015,pm(Rm,'dark')); }
  /* small things */
  const mug=(f,x,y,z,k)=>cyl(f,x,y+0.05,z,0.04,0.1,pm(f.Rm,k||'white'),10);
  function bottle(f,x,y,z,k,h){ h=h||0.22; cyl(f,x,y+h*0.38,z,0.035,h*0.76,pm(f.Rm,k||'glassA'),10); cyl(f,x,y+h*0.88,z,0.012,h*0.24,pm(f.Rm,k||'glassA'),8); }
  function papers(f,x,y,z,n,seed){ const Rm=f.Rm, r=mulberry(seed||hashStr(Rm.id+x+'|'+z)); for(let i=0;i<n;i++){ const p=plane(f,0.21,0.297,pm(Rm,'paper'),x+(r()-0.5)*0.2,y+0.003+i*0.002,z+(r()-0.5)*0.15,0,-H2); p.rotation.z=(r()-0.5)*0.8; } }
  function ammoCan(f,x,y,z,yaw){ const c=sub(f,x,z,yaw,y), Rm=f.Rm; B(c,-0.14,0,-0.06,0.14,0.18,0.06,pm(Rm,'od')); B(c,-0.145,0.18,-0.066,0.145,0.2,0.066,pm(Rm,'odD')); B(c,-0.05,0.2,-0.008,0.05,0.215,0.008,pm(Rm,'dark')); B(c,0.11,0.1,-0.072,0.14,0.19,-0.06,pm(Rm,'odD')); }
  function sandbags(f,x0,x1,z,rows){ const Rm=f.Rm, m=pm(Rm,'tan'), g=new THREE.RoundedBoxGeometry(0.5,0.15,0.32,2,0.06), r=mulberry(hashStr(Rm.id+x0+'|'+z));
    for(let k=0;k<rows;k++){ const off=k%2?0.26:0; for(let x=x0+off;x+0.5<=x1+0.01;x+=0.53){ const b=st(f,new THREE.Mesh(g,m)); b.position.set(x+0.25,0.075+k*0.14,z+(r()-0.5)*0.04); b.rotation.y=(r()-0.5)*0.12; b.rotation.z=(r()-0.5)*0.05; } }
    solid(f,x0,z-0.18,x1,z+0.18); shade(f,x0-0.05,z-0.25,x1+0.05,z+0.25,0.4,0.1); }
  function radiator(f,x0,x1,y0,h){ const m=pm(f.Rm,'white'); for(let x=x0;x<=x1;x+=0.07) B(f,x,y0,0.03,x+0.045,y0+h,0.12,m); B(f,x0,y0+0.04,0.05,x1+0.045,y0+0.08,0.1,m); B(f,x0,y0+h-0.08,0.05,x1+0.045,y0+h-0.04,0.1,m);
    for(const x of [x0+0.05,x1-0.02]) B(f,x,0,0.06,x+0.03,y0,0.09,m); solid(f,x0,0,x1+0.05,0.14); }
  function extinguisher(f,x,z){ const c=sub(f,x,z,0), Rm=f.Rm, rd=pm(Rm,'red'), dk=pm(Rm,'dark'); cyl(c,0,0.3,0,0.08,0.52,rd,14); cyl(c,0,0.58,0,0.035,0.06,dk,8); B(c,-0.07,0.61,-0.015,0.06,0.635,0.015,dk);
    cyl(c,0.09,0.36,0,0.012,0.42,dk,6,0,0.12); B(c,-0.12,0,-0.12,0.12,0.03,0.12,dk); solid(c,-0.12,-0.12,0.12,0.12); }
  function cooler(f,x,z,yaw){ const c=sub(f,x,z,yaw), Rm=f.Rm, wt=pm(Rm,'white'); B(c,-0.17,0,-0.17,0.17,0.98,0.17,wt); cyl(c,0,1.0,0,0.06,0.05,wt,12); cyl(c,0,1.22,0,0.14,0.42,pm(Rm,'water'),18);
    B(c,-0.1,0.72,0.17,-0.04,0.8,0.21,pm(Rm,'blue')); B(c,0.04,0.72,0.17,0.1,0.8,0.21,pm(Rm,'red')); B(c,-0.13,0.62,0.1,0.13,0.64,0.24,pm(Rm,'grey')); cyl(c,0.24,0.6,0,0.04,0.3,wt,10);
    solid(c,-0.2,-0.2,0.2,0.2); shade(c,-0.22,-0.22,0.22,0.22,0.3,0.1); }
  function coffeeStation(f,x0,x1){ const Rm=f.Rm, wt=pm(Rm,'white'), tp=pm(Rm,'oakD'), ch=pm(Rm,'chrome');
    B(f,x0,0,0,x1,0.86,0.58,wt); B(f,x0-0.01,0.86,0,x1+0.01,0.9,0.62,tp); for(let x=x0+0.02;x<x1-0.1;x+=0.6){ const e=Math.min(x+0.57,x1-0.02); B(f,x,0.08,0.58,e,0.8,0.6,wt); B(f,x+0.05,0.7,0.6,x+0.2,0.72,0.62,ch); }
    B(f,x0,1.5,0,x1,2.15,0.36,wt); for(let x=x0+0.02;x<x1-0.1;x+=0.6){ const e=Math.min(x+0.57,x1-0.02); B(f,x,1.52,0.36,e,2.13,0.375,wt); B(f,x+0.05,1.58,0.375,x+0.2,1.6,0.39,ch); }
    const m=x0+0.4; B(f,m-0.17,0.9,0.12,m+0.17,1.32,0.46,pm(Rm,'dark')); B(f,m-0.12,1.0,0.46,m+0.12,1.03,0.5,ch); cyl(f,m,0.97,0.38,0.05,0.1,pm(Rm,'glassA'),12); B(f,m-0.12,1.2,0.461,m+0.12,1.27,0.463,glow(Rm,'#7fd1ff',1.2));
    ['white','red','blue','white','yellow'].forEach((k,i)=>mug(f,x0+0.8+i*0.13,0.9,0.42,k)); cyl(f,x1-0.32,1.0,0.3,0.08,0.2,ch,14); B(f,x1-0.75,0.9,0.1,x1-0.5,1.18,0.32,pm(Rm,'red'));
    solid(f,x0,0,x1,0.62); shade(f,x0,0,x1,0.7,0.4,0.12); }
  function radio(f,x,y,z,yaw){ const c=sub(f,x,z,yaw,y), Rm=f.Rm; B(c,-0.22,0,-0.13,0.22,0.26,0.13,pm(Rm,'odD')); B(c,-0.2,0.04,0.13,0.2,0.22,0.135,pm(Rm,'dark'));
    for(let i=0;i<3;i++) cyl(c,-0.12+i*0.12,0.17,0.15,0.025,0.03,pm(Rm,'chrome'),10,H2); B(c,-0.16,0.06,0.136,0.16,0.1,0.138,glow(Rm,'#9cff9c',1.1)); cyl(c,0.17,0.5,-0.08,0.006,0.5,pm(Rm,'dark'),5); }
  function monitor(f,x,y,z,yaw,title){ const c=sub(f,x,z,yaw,y), Rm=f.Rm, dk=pm(Rm,'dark'); B(c,-0.08,0,-0.12,0.08,0.015,0.02,dk); B(c,-0.02,0.015,-0.06,0.02,0.2,-0.03,dk); B(c,-0.28,0.12,-0.06,0.28,0.45,-0.03,dk);
    lab(c,0.52,0.29,0,0.285,-0.028,(x2,W,H)=>{ x2.fillStyle='#0d1a26'; x2.fillRect(0,0,W,H); x2.fillStyle='#4fc3f7'; x2.font=`800 ${Math.round(H*0.13)}px ${FONT}`; x2.textAlign='left'; x2.textBaseline='top'; x2.fillText(title||'반출 기록',W*0.05,H*0.06);
      x2.fillStyle='rgba(180,220,255,.7)'; for(let i=0;i<6;i++) x2.fillRect(W*0.05,H*(0.3+i*0.11),W*(0.4+((i*37)%50)/100),H*0.05); },{glow:true,ppm:300}); B(c,-0.22,0,0.06,0.22,0.02,0.2,dk); }
  function toolBoard(f,x0,x1,y0,y1){ const Rm=f.Rm, st2=pm(Rm,'steel'), rd=pm(Rm,'red'), dk=pm(Rm,'dark'), yl=pm(Rm,'yellow'); B(f,x0,y0,0,x1,y1,0.02,rm(Rm,'peg',{map:T.peg,roughness:0.85}));
    const cols=Math.floor((x1-x0-0.1)/0.22); for(let i=0;i<cols;i++){ const x=x0+0.16+i*0.22; for(let j=0;j<2;j++){ const y=y1-0.3-j*0.62, t=(i+j*3)%5;
      if(t===0){ B(f,x-0.012,y-0.2,0.03,x+0.012,y+0.08,0.045,st2); const h=st(f,new THREE.Mesh(new THREE.TorusGeometry(0.035,0.012,6,14),st2)); h.position.set(x,y+0.11,0.04); }
      else if(t===1){ cyl(f,x,y-0.1,0.05,0.016,0.22,rd,8); B(f,x-0.06,y+0.01,0.03,x+0.06,y+0.05,0.07,st2); }
      else if(t===2){ cyl(f,x,y-0.12,0.045,0.02,0.12,yl,8); cyl(f,x,y+0.02,0.045,0.006,0.16,st2,6); }
      else if(t===3){ B(f,x-0.07,y-0.2,0.03,x+0.07,y+0.06,0.034,st2); B(f,x-0.025,y+0.06,0.03,x+0.025,y+0.12,0.05,dk); }
      else { B(f,x-0.04,y-0.16,0.03,x-0.015,y+0.06,0.05,rd); B(f,x+0.015,y-0.16,0.03,x+0.04,y+0.06,0.05,rd); B(f,x-0.02,y+0.04,0.03,x+0.02,y+0.12,0.05,st2); } } } }
  function toolChest(f,x,z,yaw){ const c=sub(f,x,z,yaw), Rm=f.Rm, rd=pm(Rm,'red'), ch=pm(Rm,'chrome'), dk=pm(Rm,'dark'); B(c,-0.55,0.08,-0.24,0.55,1.0,0.24,rd);
    for(let i=0;i<6;i++){ const y=0.14+i*0.14; B(c,-0.52,y,0.24,0.52,y+0.12,0.25,rd); B(c,-0.3,y+0.08,0.25,0.3,y+0.1,0.27,ch); } B(c,-0.56,1.0,-0.25,0.56,1.03,0.25,dk);
    for(const sx of [-0.48,0.48]) for(const sz of [-0.18,0.18]) cyl(c,sx,0.04,sz,0.04,0.03,dk,10,H2); solid(c,-0.57,-0.26,0.57,0.27); shade(c,-0.6,-0.3,0.6,0.3,0.45,0.1); return c; }
  function whiteboard(f,x,y,w,h,kind,o){ const Rm=f.Rm, ch=pm(Rm,'chrome'); B(f,x-w/2-0.02,y-h/2-0.02,0,x+w/2+0.02,y+h/2+0.02,0.02,ch); poster(f,x,y,0.022,w,h,kind,Object.assign({ppm:240},o||{})); B(f,x-w/2,y-h/2-0.06,0,x+w/2,y-h/2-0.03,0.07,ch); }
  function clock(f,x,y,z,r){ const Rm=f.Rm; cyl(f,x,y,z+0.02,r+0.025,0.04,pm(Rm,'dark'),28,H2);
    lab(f,r*2,r*2,x,y,z+0.042,(c,W,H)=>{ c.fillStyle='#f4f1e8'; c.fillRect(0,0,W,H); c.fillStyle='#222'; c.textAlign='center'; c.textBaseline='middle'; c.font=`700 ${Math.round(W*0.12)}px ${FONT}`;
      for(let i=1;i<=12;i++){ const a=i/12*PI*2; c.fillText(String(i),W/2+Math.sin(a)*W*0.37,H/2-Math.cos(a)*H*0.37); }
      const hand=(a,l,w)=>{ c.strokeStyle='#222'; c.lineWidth=w; c.lineCap='round'; c.beginPath(); c.moveTo(W/2,H/2); c.lineTo(W/2+Math.sin(a)*l,H/2-Math.cos(a)*l); c.stroke(); };
      hand(10.2/12*PI*2,W*0.22,W*0.045); hand(2/12*PI*2,W*0.33,W*0.028); c.fillStyle='#b11'; c.beginPath(); c.arc(W/2,H/2,W*0.03,0,7); c.fill(); },{circle:true,ppm:420}); }
  function tallClock(f,x){ const Rm=f.Rm, wd=pm(Rm,'walnut'), br=pm(Rm,'brass'); B(f,x-0.28,0,0,x+0.28,0.4,0.36,wd); B(f,x-0.22,0.4,0.02,x+0.22,1.55,0.32,wd); B(f,x-0.28,1.55,0,x+0.28,2.15,0.36,wd); B(f,x-0.31,2.15,0,x+0.31,2.24,0.39,wd);
    B(f,x-0.16,0.55,0.32,x+0.16,1.45,0.325,pm(Rm,'glassC')); cyl(f,x,0.8,0.25,0.08,0.012,br,20,H2); cyl(f,x,1.15,0.25,0.006,0.62,br,5); clock(f,x,1.85,0.36,0.2);
    solid(f,x-0.3,0,x+0.3,0.4); shade(f,x-0.32,0,x+0.32,0.45,0.4,0.1); }
  function globe(f,x,z){ const c=sub(f,x,z,0), Rm=f.Rm, wd=pm(Rm,'walnut'), br=pm(Rm,'brass'); for(let i=0;i<3;i++){ const a=sub(c,0,0,i/3*PI*2); const l=B(a,-0.02,0,-0.02,0.02,0.64,0.02,wd); l.position.set(0,0.31,0.14); l.rotation.x=0.25; }
    cyl(c,0,0.62,0,0.2,0.03,wd,20); const ring=st(c,new THREE.Mesh(new THREE.TorusGeometry(0.27,0.012,6,32),br)); ring.position.set(0,0.92,0); ring.rotation.set(0.4,H2,0);
    const s=st(c,new THREE.Mesh(new THREE.SphereGeometry(0.25,24,16),rm(Rm,'globe',{map:T.globe,roughness:0.5}))); s.position.set(0,0.92,0); s.rotation.z=0.41; solid(c,-0.25,-0.25,0.25,0.25); shade(c,-0.3,-0.3,0.3,0.3,0.35,0.12); }
  function fireplace(f,x){ const Rm=f.Rm, sto=pm(Rm,'stone'), br=rm(Rm,'brick',{map:T.brick,roughness:0.9}), so=pm(Rm,'soot'), wd=pm(Rm,'walnut'), ir=pm(Rm,'dark');
    B(f,x-0.78,0,0,x-0.45,1.1,0.34,sto); B(f,x+0.45,0,0,x+0.78,1.1,0.34,sto); B(f,x-0.45,0.8,0,x+0.45,1.1,0.34,sto);
    B(f,x-0.45,0,0,x+0.45,0.8,0.03,br); B(f,x-0.47,0,0.02,x-0.43,0.8,0.3,br); B(f,x+0.43,0,0.02,x+0.47,0.8,0.3,br); B(f,x-0.43,0.72,0.03,x+0.43,0.8,0.32,so);
    B(f,x-0.85,0,0,x+0.85,0.05,0.62,sto); B(f,x-0.86,1.1,0,x+0.86,1.18,0.42,wd);
    const lg=pm(Rm,'oakD'); for(const [a,b,c2,r] of [[-0.12,0.1,0.15,0.2],[0.1,0.1,0.2,-0.25],[0.0,0.2,0.17,0.05]]) cyl(f,x+a,0.05+b,c2,0.055,0.48,lg,8,0,H2+r);
    const fire=basic(Rm,'fire',{color:new THREE.Color('#ff7a1e').multiplyScalar(2.2)}), fire2=basic(Rm,'fire2',{color:new THREE.Color('#ffd27a').multiplyScalar(2.8)});
    B(f,x-0.32,0.05,0.06,x+0.32,0.08,0.28,fire); for(const [a,h2,s] of [[-0.16,0.3,0.08],[0.02,0.4,0.1],[0.17,0.28,0.07]]){ const c=st(f,new THREE.Mesh(new THREE.ConeGeometry(s,h2,8),fire)); c.position.set(x+a,0.12+h2/2,0.16); const c2=st(f,new THREE.Mesh(new THREE.ConeGeometry(s*0.5,h2*0.6,8),fire2)); c2.position.set(x+a,0.12+h2*0.3,0.19); }
    B(f,x-0.55,0.05,0.5,x+0.55,0.1,0.52,ir); for(const s of [-1,1]) B(f,x+s*0.55-0.01,0.05,0.32,x+s*0.55+0.01,0.1,0.52,ir); for(let i=0;i<3;i++) cyl(f,x+0.64+i*0.05,0.36,0.52,0.008,0.62,ir,5);
    solid(f,x-0.86,0,x+0.86,0.62); }
  /* posters, maps, notices: drawn into the room's label atlas */
  function drawPoster(kind,c,W,H,o){ o=o||{}; const r=mulberry(hashStr(kind+(o.seed||''))), T2=(s,x,y,sz,col,wt,al)=>{ c.fillStyle=col||'#111'; c.font=`${wt||800} ${Math.max(6,Math.round(sz))}px ${FONT}`; c.textAlign=al||'center'; c.textBaseline='middle'; c.fillText(s,x,y,W*0.88); };
    if(kind==='rules'){ c.fillStyle='#f4f1e8'; c.fillRect(0,0,W,H); c.fillStyle=o.col||'#b3261e'; c.fillRect(0,0,W,H*0.17); T2(o.title||'총기 안전 수칙',W/2,H*0.085,H*0.072,'#fff',900);
      const L=o.lines||['모든 총은 장전된 것으로 여긴다','쏠 것이 아니면 겨누지 않는다','쏘기 직전까지 방아쇠에서 손을 뗀다','표적과 그 뒤를 늘 확인한다'];
      L.forEach((s,i)=>{ const y=H*(0.29+i*(0.62/L.length)); c.fillStyle=o.col||'#b3261e'; c.beginPath(); c.arc(W*0.1,y,H*0.038,0,7); c.fill(); T2(String(i+1),W*0.1,y,H*0.048,'#fff',900); T2(s,W*0.17,y,H*0.044,'#222',700,'left'); });
      c.fillStyle='rgba(0,0,0,.1)'; c.fillRect(0,H*0.94,W,H*0.06); return; }
    if(kind==='map'){ c.fillStyle='#e8e0c4'; c.fillRect(0,0,W,H); c.strokeStyle='rgba(70,120,170,.35)'; c.lineWidth=1; for(let i=1;i<8;i++){ c.beginPath(); c.moveTo(W*i/8,0); c.lineTo(W*i/8,H); c.stroke(); c.beginPath(); c.moveTo(0,H*i/8); c.lineTo(W,H*i/8); c.stroke(); }
      c.strokeStyle='rgba(120,80,40,.55)'; for(let k=0;k<3;k++){ const cx=W*(0.2+r()*0.6), cy=H*(0.25+r()*0.5); for(let j=1;j<7;j++){ c.lineWidth=j%3?1:2; c.beginPath(); for(let a=0;a<=40;a++){ const t=a/40*PI*2, rr=j*Math.min(W,H)*0.035*(1+0.25*Math.sin(t*3+k)+0.1*Math.sin(t*5+j)); const px=cx+Math.cos(t)*rr*1.3, py=cy+Math.sin(t)*rr; if(a) c.lineTo(px,py); else c.moveTo(px,py); } c.stroke(); } }
      c.strokeStyle='#2f6fb0'; c.lineWidth=3; c.beginPath(); c.moveTo(0,H*0.8); c.bezierCurveTo(W*0.3,H*0.7,W*0.5,H*0.95,W,H*0.75); c.stroke();
      c.strokeStyle='#c22'; c.lineWidth=3; for(let i=0;i<4;i++){ const x=W*(0.15+r()*0.7), y=H*(0.15+r()*0.65), s=W*0.02; c.beginPath(); c.moveTo(x-s,y-s); c.lineTo(x+s,y+s); c.moveTo(x+s,y-s); c.lineTo(x-s,y+s); c.stroke(); }
      c.setLineDash([8,6]); c.beginPath(); c.moveTo(W*0.1,H*0.9); c.quadraticCurveTo(W*0.4,H*0.4,W*0.8,H*0.2); c.stroke(); c.setLineDash([]);
      c.fillStyle='#f7f3e6'; c.fillRect(W*0.58,H*0.84,W*0.39,H*0.13); c.strokeStyle='#333'; c.lineWidth=2; c.strokeRect(W*0.58,H*0.84,W*0.39,H*0.13); T2(o.title||'작전 지도 · 7구역',W*0.775,H*0.905,H*0.05,'#222',800); return; }
    if(kind==='target'){ c.fillStyle='#efe9da'; c.fillRect(0,0,W,H); c.fillStyle='#1d1d1d'; c.beginPath(); c.ellipse(W/2,H*0.24,W*0.14,H*0.1,0,0,7); c.fill();
      c.beginPath(); c.moveTo(W*0.12,H*0.98); c.bezierCurveTo(W*0.12,H*0.5,W*0.3,H*0.36,W/2,H*0.36); c.bezierCurveTo(W*0.7,H*0.36,W*0.88,H*0.5,W*0.88,H*0.98); c.closePath(); c.fill();
      c.strokeStyle='#efe9da'; c.lineWidth=Math.max(1,W*0.012); for(const k of [0.1,0.2,0.3]){ c.beginPath(); c.ellipse(W/2,H*0.64,W*k,H*k*0.7,0,0,7); c.stroke(); } T2('10',W/2,H*0.64,H*0.04,'#efe9da',800);
      c.fillStyle='#efe9da'; for(let i=0;i<9;i++){ c.beginPath(); c.arc(W/2+(r()-0.5)*W*0.3,H*0.62+(r()-0.5)*H*0.25,Math.max(1.5,W*0.012),0,7); c.fill(); } return; }
    if(kind==='flag'){ const bg=o.bg||'#2f3a26'; c.fillStyle=bg; c.fillRect(0,0,W,H); c.fillStyle=o.fg||'#e08a1e'; c.beginPath(); c.moveTo(0,H*0.64); c.lineTo(W,H*0.4); c.lineTo(W,H*0.5); c.lineTo(0,H*0.74); c.fill();
      c.fillStyle='#f1ead2'; c.beginPath(); c.arc(W/2,H*0.4,H*0.2,0,7); c.fill(); c.fillStyle=bg; c.beginPath(); c.arc(W/2,H*0.4,H*0.165,0,7); c.fill();
      c.fillStyle='#f1ead2'; c.beginPath(); for(let i=0;i<5;i++){ const a=-PI/2+i*PI*0.8, R1=H*0.12, px=W/2+Math.cos(a)*R1, py=H*0.4+Math.sin(a)*R1; if(i) c.lineTo(px,py); else c.moveTo(px,py); } c.fill();
      T2(o.title||'CODE-NAME',W/2,H*0.8,H*0.1,'#f1ead2',900); T2(o.sub||'제1 무기 관리대',W/2,H*0.91,H*0.055,'#d8cfae',700); return; }
    if(kind==='painting'){ const g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,o.sky||'#b9a57c'); g.addColorStop(0.55,'#e6d2a6'); g.addColorStop(0.56,'#6d6a3f'); g.addColorStop(1,'#3e3a22'); c.fillStyle=g; c.fillRect(0,0,W,H);
      c.fillStyle='rgba(80,90,70,.75)'; c.beginPath(); c.moveTo(0,H*0.57); for(let i=0;i<=10;i++) c.lineTo(W*i/10,H*(0.4+0.1*Math.sin(i*1.3+r()*2))); c.lineTo(W,H*0.57); c.fill();
      for(let i=0;i<9;i++){ const x=W*r(), y=H*(0.58+r()*0.12), s=H*(0.05+r()*0.08); c.fillStyle=`rgba(${(30+r()*30)|0},${(45+r()*30)|0},25,.9)`; c.beginPath(); c.ellipse(x,y-s,s*0.5,s,0,0,7); c.fill(); }
      c.fillStyle='rgba(255,240,200,.55)'; c.beginPath(); c.arc(W*0.75,H*0.2,H*0.07,0,7); c.fill(); noise(c,W,H,500,0.07); return; }
    if(kind==='notice'){ c.fillStyle='#b27a46'; c.fillRect(0,0,W,H); noise(c,W,H,1200,0.12); c.strokeStyle='#5a3a1e'; c.lineWidth=Math.max(3,W*0.02); c.strokeRect(0,0,W,H);
      const cols=['#fbfaf3','#fff3a8','#ffd6d6','#d9f0ff','#fbfaf3','#fff3a8'], tt=o.notes||['훈련 일정','반납 시간 엄수','청소 당번','탄약 수령','회의 14:00','분실물'];
      for(let i=0;i<6;i++){ const pw=W*(0.24+r()*0.06), ph=H*(0.32+r()*0.08), x=W*(0.04+(i%3)*0.32)+r()*W*0.02, y=H*(0.06+((i/3)|0)*0.48)+r()*H*0.03;
        c.save(); c.translate(x+pw/2,y+ph/2); c.rotate((r()-0.5)*0.14); c.fillStyle=cols[i]; c.fillRect(-pw/2,-ph/2,pw,ph); c.fillStyle='#222'; c.font=`800 ${Math.round(ph*0.13)}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(tt[i],0,-ph*0.3,pw*0.9);
        c.fillStyle='rgba(40,40,40,.55)'; for(let k=0;k<4;k++) c.fillRect(-pw*0.4,-ph*0.12+k*ph*0.14,pw*(0.5+r()*0.3),Math.max(1,ph*0.03)); c.fillStyle=['#c22','#24c','#2a2'][i%3]; c.beginPath(); c.arc(0,-ph*0.44,Math.max(2,W*0.012),0,7); c.fill(); c.restore(); } return; }
    if(kind==='calendar'){ c.fillStyle='#fbfaf6'; c.fillRect(0,0,W,H); c.fillStyle='#b3261e'; c.fillRect(0,0,W,H*0.2); T2(o.title||'11월',W/2,H*0.1,H*0.1,'#fff',900);
      for(let i=0;i<7;i++) T2('일월화수목금토'[i],W*(0.1+i*0.133),H*0.27,H*0.045,i===0?'#c22':'#333',800);
      for(let d=1;d<=30;d++){ const k=d-1, col=k%7, row=(k/7)|0, x=W*(0.1+col*0.133), y=H*(0.37+row*0.125); T2(String(d),x,y,H*0.05,col===0?'#c22':'#333',600); if(d===17||d===25){ c.strokeStyle='#c22'; c.lineWidth=2; c.beginPath(); c.arc(x,y,H*0.042,0,7); c.stroke(); } } return; }
    if(kind==='diagram'){ c.fillStyle='#163a5c'; c.fillRect(0,0,W,H); c.strokeStyle='rgba(255,255,255,.12)'; c.lineWidth=1; for(let x=0;x<W;x+=W/16){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); } for(let y=0;y<H;y+=W/16){ c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
      c.strokeStyle='#e8f1ff'; c.lineWidth=2; for(const [x,y,w,h] of [[0.3,0.32,0.32,0.12],[0.62,0.35,0.3,0.04],[0.05,0.34,0.2,0.1],[0.42,0.56,0.08,0.22],[0.33,0.47,0.05,0.14],[0.34,0.16,0.2,0.07]]) c.strokeRect(W*x,H*y,W*w,H*h);
      c.setLineDash([4,4]); c.strokeStyle='#9ec7ff'; for(const [a,b,cx,cy,t] of [[0.44,0.23,0.44,0.12,'노리쇠'],[0.8,0.35,0.8,0.24,'총열'],[0.15,0.34,0.15,0.24,'개머리판'],[0.46,0.78,0.6,0.86,'탄창'],[0.35,0.61,0.2,0.7,'손잡이']]){ c.beginPath(); c.moveTo(W*a,H*b); c.lineTo(W*cx,H*cy); c.stroke(); T2(t,W*cx,H*cy-H*0.035,H*0.045,'#cfe3ff',800); }
      c.setLineDash([]); T2(o.title||'분해 결합도',W*0.05,H*0.07,H*0.06,'#fff',900,'left'); return; }
    if(kind==='tactics'){ c.fillStyle='#f7f8f6'; c.fillRect(0,0,W,H); c.strokeStyle='#1f4fb0'; c.lineWidth=3; c.strokeRect(W*0.1,H*0.22,W*0.35,H*0.48); c.strokeRect(W*0.55,H*0.3,W*0.3,H*0.4);
      c.strokeStyle='#c22'; c.lineWidth=4; const arrow=(x0,y0,x1,y1)=>{ const mx=(x0+x1)/2, my=(y0+y1)/2-H*0.15; c.beginPath(); c.moveTo(x0,y0); c.quadraticCurveTo(mx,my,x1,y1); c.stroke(); const a=Math.atan2(y1-my,x1-mx), s=W*0.04;
        c.beginPath(); c.moveTo(x1,y1); c.lineTo(x1-Math.cos(a-0.4)*s,y1-Math.sin(a-0.4)*s); c.moveTo(x1,y1); c.lineTo(x1-Math.cos(a+0.4)*s,y1-Math.sin(a+0.4)*s); c.stroke(); };
      arrow(W*0.2,H*0.88,W*0.3,H*0.47); arrow(W*0.4,H*0.88,W*0.66,H*0.52); c.fillStyle='#1f4fb0'; for(const [x,y,t] of [[0.27,0.42,'A'],[0.7,0.45,'B']]){ c.beginPath(); c.arc(W*x,H*y,H*0.05,0,7); c.fill(); T2(t,W*x,H*y,H*0.06,'#fff',900); }
      T2(o.title||'오늘: 돌파 → 엄호 → 집결',W*0.06,H*0.1,H*0.07,'#1b1b1b',800,'left'); T2('14:00 장비 점검',W*0.6,H*0.86,H*0.055,'#c22',700,'left'); return; }
    if(kind==='price'){ c.fillStyle='#14161a'; c.fillRect(0,0,W,H); T2(o.title||'정비 · 수리',W/2,H*0.13,H*0.1,'#ff9a3c',900);
      (o.lines||[['총기 분해 청소','₩30,000'],['조준경 영점','₩20,000'],['각인 서비스','₩15,000'],['방아쇠 조정','₩40,000']]).forEach(([a,b],i)=>{ const y=H*(0.34+i*0.16); T2(a,W*0.08,y,H*0.065,'#e8e8e8',700,'left'); T2(b,W*0.92,y,H*0.065,'#ffd27a',800,'right'); c.fillStyle='rgba(255,255,255,.14)'; c.fillRect(W*0.08,y+H*0.065,W*0.84,1); }); return; }
  }
  const poster=(f,x,y,z,w,h,kind,o)=>lab(f,w,h,x,y,z,(c,W,H)=>drawPoster(kind,c,W,H,o),Object.assign({ppm:360},o||{}));
  /* a frame on a wall with a painting */
  function painting(f,x,y,w,h,o){ const Rm=f.Rm, fr=pm(Rm,(o&&o.k)||'walnut'); B(f,x-w/2-0.06,y-h/2-0.06,0,x+w/2+0.06,y+h/2+0.06,0.04,fr); poster(f,x,y,0.042,w,h,'painting',Object.assign({ppm:260},o||{})); }
  /* upright guns against a wall: a trough at the foot and a notched bar, or (cab) a cabinet with a glass front */
  function uprightRack(f,x0,x1,ids,o){ o=o||{}; const Rm=f.Rm, wd=pm(Rm,o.k||'oak'), dk=pm(Rm,o.k2||'oakD'), D=o.d||0.34, H=o.h||1.75, y0=o.y0||0.1, sp=(o.sp||0.22)/density;
    if(o.cab){ B(f,x0-0.05,0,0,x1+0.05,H,0.03,o.lit?rm(Rm,'nicheGlow',{color:'#f3e7cf',emissive:'#ffe9c8',emissiveIntensity:0.4,roughness:0.9}):dk); B(f,x0-0.07,0,0,x0,H,D,wd); B(f,x1,0,0,x1+0.07,H,D,wd); B(f,x0-0.08,H,0,x1+0.08,H+0.09,D+0.03,wd); B(f,x0-0.07,0,0,x1+0.07,y0,D,wd);
      B(f,x0,y0,D-0.012,x1,H,D-0.004,pm(Rm,'glassC')); B(f,x0+0.05,H-0.06,0.05,x1-0.05,H-0.04,0.12,glow(Rm,'#fff1d8',1.3)); if(x1-x0>1.4) B(f,(x0+x1)/2-0.018,y0,D-0.025,(x0+x1)/2+0.018,H,D+0.005,wd); }
    else { B(f,x0,0,0,x1,y0,D,dk); B(f,x0,y0,D-0.045,x1,y0+0.12,D,wd); B(f,x0,1.04,0,x1,1.09,D*0.75,wd); B(f,x0,0,0,x0+0.05,1.4,D*0.8,wd); B(f,x1-0.05,0,0,x1,1.4,D*0.8,wd); B(f,x0,1.09,0,x1,1.4,0.02,dk); }
    const n=Math.max(1,Math.floor((x1-x0-0.16)/sp)+1), step=n>1?(x1-x0-0.16)/(n-1):0, groups={};
    for(let i=0;i<n;i++){ const id=ids[Math.min(ids.length-1,Math.floor(i*ids.length/n))], s1=gsrc(id,o.hi), x=x0+0.08+i*step; gun(f,id,mul(mT(x,y0+0.01,0.04+half(s1)),mZ(o.cab?0:0.04),mStandW(s1)),o.hi); (groups[id]=groups[id]||[]).push(x); }
    for(const id in groups){ const g=groups[id], cx=(g[0]+g[g.length-1])/2; sign(f,Math.min(0.9,0.16+0.2*g.length),0.075,cx,o.cab?y0*0.5:y0+0.06,D+0.003,[[WPN[id].name+' · '+g.length+'정',0.62,o.cab?'#f3dfb4':'#2a1c0c',800]],{bg:o.cab?'#24140b':'#c7a560'}); }
    solid(f,x0-0.07,0,x1+0.07,D+0.02); shade(f,x0-0.1,0,x1+0.1,D+0.15,0.45,0.12); }
  /* rifles hanging flat on a wall, in a row (pegboard / slatwall) */
  function hangRow(f,x0,x1,y,ids,o){ o=o||{}; const sp=o.sp||0.6, n=Math.max(1,Math.floor((x1-x0)/sp)+1), step=n>1?(x1-x0)/(n-1):0, hk=pm(f.Rm,'chrome');
    for(let i=0;i<n;i++){ if(density<1&&i%3===2) continue; const id=ids[Math.min(ids.length-1,Math.floor(i*ids.length/n))], s1=gsrc(id), x=x0+i*step, tilt=-0.12+((i*7)%5)*0.03;
      gun(f,id,mHang(s1,x,y,0.03+half(s1)+0.02,-1,tilt)); B(f,x-0.06,y-0.03,0.01,x-0.05,y+0.02,0.09,hk); } }
  /* a gun laid flat on a table top at height y, along the frame's x */
  const layGun=(f,id,x,y,z,yaw,hi)=>gun(f,id,mFlat(gsrc(id,hi),x,y,z,yaw||0,-1),hi);
  /* ---------- dressing the rooms: furniture, clutter, things on the walls ---------- */
  function dressHub(Rm){ const f=Rm.f0, w=Rm.w, N=w.n, E=w.e, Wl=w.w;
    /* a safety box painted round the workbench, a rubber mat, a chair and a stool */
    const yl=basic(Rm,'yl2',{color:'#d9ab1c'}); for(const [a,b,c,d] of [[-1.9,-0.5,1.9,-0.42],[-1.9,1.9,1.9,1.98],[-1.9,-0.5,-1.82,1.98],[1.82,-0.5,1.9,1.98]]) plane(f,c-a,d-b,yl,(a+c)/2,0.004,(b+d)/2,0,-H2);
    plane(f,2.4,0.62,rm(Rm,'rmat',{map:T.ribs,roughness:0.95}),0,0.006,1.4,0,-H2,[0,0]); ochair(f,-0.5,1.6,0.25); stool(f,0.8,1.62);
    const bn=sub(f,0,0.4,0); deskLamp(bn,-1.15,0.92,-0.36,0.5); bottle(bn,-1.2,0.92,0.3,'red',0.16); B(bn,-1.05,0.92,0.1,-0.95,0.94,0.42,pm(Rm,'fabricR')); boxes(bn,-1.34,-0.98,0.92,-0.12,0.05,['dark','od'],7,{w:[0.1,0.16],h:[0.04,0.08],d:[0.1,0.15]});
    /* east wall: a coffee corner (north half), a tool wall and a tool chest (south half) */
    coffeeStation(E,-4.9,-2.3); clock(E,-3.6,2.55,0,0.18); cooler(E,-1.65,0.24,0); poster(E,-1.65,1.95,0.01,0.42,0.56,'calendar');
    toolBoard(E,1.5,5.2,1.05,2.45); toolChest(E,2.35,0.27,0); B(E,1.95,1.03,0.08,2.55,1.2,0.38,pm(Rm,'red')); prop(E,'tool_cart',0.95,4.35,0.42,0);
    sign(E,1.6,0.16,3.35,2.6,0.02,[['공구 벽',0.6,'#ffb066',800]],{bg:'#141518'});
    /* west wall south of the door: a worn sofa, a low table, a lamp, the notice board */
    sofa(Wl,-3.25,0.47,PI,2.2,'leather'); const ct=table(Wl,-3.25,1.38,1.0,0.5,0.42,0,'oakD'); mug(ct,-0.3,0.42,0.05,'white'); mug(ct,0.25,0.42,-0.1,'red'); papers(ct,0,0.42,0,3);
    plane(Wl,2.4,1.5,rm(Rm,'rug',{map:T.rug,roughness:1}),-3.25,0.005,1.3,0,-H2); floorLamp(Wl,-1.55,0.3); poster(Wl,-3.25,1.75,0.02,1.6,0.9,'notice',{ppm:300});
    plant(f,-5.35,5.3,1.0); prop(f,'trash_can',0.72,-5.35,-5.35,0);
    /* north wall: fire extinguisher and safety rules by the exit, boxes on the lockers */
    extinguisher(N,-2.35,0.16); poster(N,-2.0,1.65,0.01,0.62,0.86,'rules'); boxes(N,1.65,5.55,2.0,0.04,0.48,['card','card','od','dark'],null,{h:[0.14,0.34]});
    /* pipes under the ceiling */ pipeRun(E,-5.7,5.7,0.22,3.4,0.06,3.6); pipeRun(Wl,-5.7,5.7,0.22,3.4,0.05,3.6,'red');
    whiteboard(N,4.6,2.78,1.0,0.6,'tactics',{ppm:220}); }
  function dressR1(Rm){ const f=Rm.f0, w=Rm.w;
    /* a red runner down the middle aisle, radiators and plants by the door */
    plane(f,1.8,12.2,rm(Rm,'runner',{map:T.runner,roughness:0.95}),0,0.005,-6.5,0,-H2,[0,0]);
    radiator(w.s,2.4,4.2,0.15,0.6); radiator(w.s,-4.2,-2.4,0.15,0.6); plant(f,-1.65,-0.45,1.05); plant(f,1.65,-0.45,1.05);
    /* clerk's desk: a chair, a lamp, papers; a filing cabinet and a coat rack beside it */
    const desk=sub(f,-7.4,-1.3,0); chair(f,-7.4,-2.12,PI,'oakD'); deskLamp(desk,0.55,0.78,-0.18,-0.5); papers(desk,-0.45,0.78,0.05,3); mug(desk,0.3,0.78,0.22);
    filing(f,-9.48,-2.25,H2); coatRack(f,-9.25,-0.55); poster(w.w,-6.0,1.95,0.01,0.62,0.86,'rules'); poster(w.e,6.3,1.95,0.01,0.5,0.66,'calendar');
    /* a glass case of old pistols right of the door */
    const vt=sub(f,6.0,-1.55,0); counter(vt,-1.6,1.6,0,{light:true}); ['c96','tt33','makarov','peace','p1912','revolver'].forEach((id,i)=>{ for(const zz of [-0.15,0.13]) layGun(vt,id,-1.3+i*0.52,0.47,zz,0.25+(zz>0?0.12:0),true); });
    sign(vt,1.4,0.12,0,0.3,0.345,[['옛 권총',0.66,'#fff',800]],{bg:'#1d1e21'});
    /* the cleaning table at the back */
    const ct=table(f,0,-13.3,2.4,0.9,0.86,0,'oakD'); layGun(ct,'mosin',-0.25,0.86,0.08,0.04); layGun(ct,'kar98',0.25,0.86,-0.26,-0.05);
    for(let i=0;i<3;i++) bottle(ct,0.75+i*0.1,0.86,0.28,['glassA','green','red'][i],0.18); B(ct,-1.05,0.86,0.12,-0.75,0.875,0.36,pm(Rm,'paper')); for(let i=0;i<3;i++) cyl(ct,-0.9,0.875,-0.2+i*0.05,0.006,0.6,pm(Rm,'brass'),5,0,H2);
    B(ct,0.65,0.86,-0.38,1.1,1.0,-0.16,pm(Rm,'red')); deskLamp(ct,1.0,0.86,0.1,-0.6); chair(f,-0.55,-12.55,0,'oakD'); stool(f,0.65,-12.62,'leather');
    /* back corners: a bookcase and a filing cabinet, crates, a trunk, a coat rack, two filing cabinets by the dark door */
    shelfUnit(w.n,-9.7,-7.7,0.36,2.2,5,'oakD',(y,i)=>{ if(i===2) boxes(w.n,-9.66,-7.74,y,0.02,0.34,['card','od']); else books(w.n,-9.64,-7.76,y,0.02,0.34); });
    filing(w.n,-7.15,0.33,0,4,'oakD'); trunk(w.n,-5.6,0.32,0); prop(f,'crate_wood',0.55,-8.35,-13.6,0.2); prop(f,'crate_wood2',0.5,-8.35,-13.6,0.6,{y:0.55});
    prop(f,'crate_wood',0.55,-7.4,-14.3,-0.1); coatRack(f,4.7,-15.2); filing(w.n,8.25,0.33,0,4); filing(w.n,8.8,0.33,0,3);
    for(const x of [-1.0,2.85,-6.6]) sconce(w.w,x,2.25); for(const x of [1.0,-2.85,7.0]) sconce(w.e,x,2.25);
    poster(w.n,-8.7,3.0,0.01,1.4,0.9,'map',{title:'옛 보급로 · 1952'}); for(const x of [-1.7,1.7]) poster(f,x,2.3,-8.49,0.48,0.78,'flag',{title:'CODE-NAME',sub:x<0?'제1 보관실':'1952 창설',ppm:260}); }
  function dressR2(Rm){ const f=Rm.f0, w=Rm.w, L=w.w, E=w.e;
    /* a fireplace in the middle of the west wall, a painting over it, two leather armchairs, a side table with a decanter */
    fireplace(L,0); painting(L,0,2.05,1.15,0.8,{sky:'#9fae9c'}); for(const s of [-1,1]){ cyl(L,s*0.62,1.27,0.25,0.04,0.18,pm(Rm,'brass'),10); cyl(L,s*0.62,1.39,0.25,0.012,0.06,glow(Rm,'#ffd9a0',3),6); }
    bottle(L,0.3,1.18,0.22,'glassA',0.24); clock(L,-0.3,1.3,0.12,0.11);
    plane(f,1.7,2.8,rm(Rm,'rug',{map:T.rug,roughness:1}),-4.35,0.005,-7.0,0,-H2);
    sofa(f,-4.2,-5.35,0.65,1.0,'leather'); sofa(f,-4.2,-8.65,2.49,1.0,'leather');
    const st1=roundTable(f,-3.55,-7.0,0.3,0.58,'walnut'); bottle(st1,-0.08,0.58,0.02,'glassA',0.26); cyl(st1,0.1,0.62,0.07,0.035,0.08,pm(Rm,'glassC'),10); cyl(st1,0.03,0.62,-0.12,0.035,0.08,pm(Rm,'glassC'),10); B(st1,-0.22,0.58,-0.2,0.0,0.62,0.0,pm(Rm,'b0'));
    floorLamp(f,-5.0,-4.55); floorLamp(f,-5.0,-9.45);
    /* east wall gap: a tall clock, a globe in front of the drawers */
    tallClock(E,0); globe(f,4.55,-4.9);
    /* things on the drawer tops along both side walls: books, cigar boxes, lamps, cartridge boxes */
    for(const g of [L,E]){ books(g,-5.95,-5.25,0.96,0.08,0.42); B(g,-4.7,0.96,0.14,-4.35,1.02,0.36,pm(Rm,'walnut')); deskLamp(g,-2.2,0.96,0.25,0); boxes(g,-1.6,-1.0,0.96,0.1,0.42,['b0','b3','card'],null,{w:[0.1,0.16],h:[0.05,0.1],d:[0.1,0.2]});
      books(g,1.15,1.9,0.96,0.08,0.42); bottle(g,2.6,0.96,0.3,'glassA',0.24); deskLamp(g,4.2,0.96,0.25,0); books(g,5.3,5.95,0.96,0.08,0.42); }
    /* by the door: plants, the cabinets of long guns on either side of the doorway */
    plant(f,-5.45,-0.45,1.2); plant(f,5.45,-0.45,1.2);
    uprightRack(w.s,1.3,4.9,['heavysr','m24','scout','sv98'],{cab:1,lit:1,k:'walnut',k2:'leatherK',h:2.3,d:0.45,sp:0.24});
    uprightRack(w.s,-4.9,-1.3,['piercesr','lrr','bp1','k14'],{cab:1,lit:1,k:'walnut',k2:'leatherK',h:2.3,d:0.45,sp:0.24});
    for(const x of [-3.1,3.1]) sconce(w.s,x,2.75); }
  function dressR3(Rm){ const f=Rm.f0, w=Rm.w, E=w.e, S=w.s;
    /* in the cage: a sign-out desk by the gate, crates, a generator and fuel cans, flags above the cabinets */
    const dk=table(f,-3.2,-7.3,1.6,0.7,0.76,0,'grey','steel'); monitor(dk,-0.25,0.76,-0.05,PI); papers(dk,0.45,0.76,0.0,4); mug(dk,0.65,0.76,-0.22,'od'); ochair(f,-3.2,-7.95,PI);
    prop(f,'mil_crate',0.55,-8.35,-6.75,0); prop(f,'mil_crate2',0.45,-8.35,-6.75,0.1,{y:0.55}); prop(f,'ammo_box',0.32,-6.9,-6.7,0.3); prop(f,'ammo_box',0.32,-6.4,-6.75,-0.2);
    prop(f,'generator',0.75,8.9,-7.1,H2); prop(f,'jerrycan',0.45,7.9,-6.62,0.2); prop(f,'jerrycan',0.45,7.45,-6.6,-0.15);
    poster(w.n,-4.6,3.1,0.01,1.8,0.95,'flag',{ppm:220}); poster(w.n,4.6,3.1,0.01,1.5,1.0,'rules',{title:'무기 관리 수칙',col:'#3b412c',lines:['반출·반납은 반드시 기록','총기는 탄을 빼고 보관','부품은 작업대에서만','열쇠는 당직자가 보관'],ppm:300});
    pipeRun(w.w,-7.8,7.8,0.3,3.65,0.08,4.0); pipeRun(E,-7.8,7.8,0.3,3.65,0.08,4.0,'od');
    /* the heavy weapons table (front right) */
    const ht=table(f,6.0,-4.0,4.8,1.6,0.8,0,'od','steel'); [['minigun',-1.6,-0.4],['railgun',0,-0.4],['u100',1.6,-0.4],['flamer',-1.6,0.4],['u100',0,0.4],['m249',1.6,0.4]].forEach(([id,x,z])=>layGun(ht,id,x,0.8,z,0));
    sign(ht,1.4,0.1,0,0.72,0.803,[['중화기 · 미니건 · 레일건 · 화염방사기',0.6,'#111',800]],{bg:'#e8e6de'});
    /* east wall, front half: a pegboard of SMGs and grenade launchers, ammo cans under it */
    B(E,2.2,0.95,0,7.6,2.75,0.025,rm(Rm,'peg',{map:T.peg,roughness:0.85})); hangRow(E,2.6,7.3,2.45,['sk61','m10','k7']); hangRow(E,2.6,7.3,1.85,['ap9','wraith','bison']); hangRow(E,2.6,7.3,1.25,['m79','gl6','mps9']);
    sign(E,2.2,0.18,4.9,2.92,0.02,[['기관단총 · 유탄 발사기',0.6,'#ffb066',800]],{bg:'#141518',glow:true});
    const sl=pm(Rm,'steel'); B(E,2.2,0.42,0,7.6,0.46,0.5,sl); for(const x of [2.25,4.9,7.55]) B(E,x-0.03,0,0.02,x+0.03,0.42,0.48,sl); for(let x=2.45;x<7.45;x+=0.33){ ammoCan(E,x,0.46,0.25,H2); ammoCan(E,x,0.0,0.3,H2+0.1); }
    solid(E,2.2,0,7.6,0.52); shade(E,2.1,0,7.7,0.6,0.4,0.1);
    /* west wall, front half: sandbags, the area map; south wall: a radio table, water, an extinguisher, a clock */
    sandbags(w.w,-7.4,-5.3,0.2,3); poster(w.w,-4.4,1.75,0.01,1.6,1.0,'map',{ppm:300}); whiteboard(w.w,-2.6,1.75,1.2,0.75,'tactics');
    const rt=table(S,3.2,0.35,1.6,0.6,0.76,0,'od','steel'); radio(rt,-0.35,0.76,0.02,0); papers(rt,0.3,0.76,0.0,3); mug(rt,0.62,0.76,0.15,'od'); chair(S,3.0,1.0,0,'grey');
    poster(S,3.2,1.75,0.01,1.4,0.85,'map',{title:'통신망 배치도',seed:'r',ppm:300}); cooler(S,-1.9,0.24,0); extinguisher(S,1.72,0.16); clock(S,-2.4,2.55,0,0.18);
  }
  function dressR4(Rm){ const f=Rm.f0, w=Rm.w;
    /* low shelves of cartridge boxes under the slatwalls, a gondola in the back */
    ammoShelf(w.w,-2.6,6.5); ammoShelf(w.e,-6.5,2.6); ammoShelf(w.n,-3.5,5.4); gondola(f,0,-12.3,3.0,0);
    /* counters: a till and a card reader at the door end; stools behind */
    const cl=sub(f,-2.05,-7.6,H2); const reg=sub(cl,-3.0,0,PI,0.96); B(reg,-0.2,0,-0.2,0.2,0.1,0.2,pm(Rm,'dark')); const kb=B(reg,-0.18,0.1,-0.02,0.18,0.15,0.18,pm(Rm,'grey')); kb.rotation.x=0.25;
    B(reg,-0.13,0.1,-0.2,0.13,0.34,-0.15,pm(Rm,'dark')); B(reg,-0.11,0.2,-0.151,0.11,0.31,-0.149,glow(Rm,'#7fffb0',1.1)); B(reg,0.26,0,-0.06,0.36,0.03,0.12,pm(Rm,'dark'));
    stool(f,-3.1,-6.0); stool(f,3.1,-9.2); sign(cl,0.6,0.1,-3.0,0.84,0.345,[['계산대',0.62,'#fff',800]],{bg:'#a01818'});
    /* the front: a bench under the TV, targets, a coat rail, plants, a mat, water, an extinguisher, a hanging sign */
    table(w.s,3.4,0.25,1.8,0.4,0.45,0,'oakD'); for(let i=0;i<3;i++) poster(w.s,-2.7-i*0.95,2.0,0.01,0.5,0.75,'target',{seed:'t'+i,ppm:260});
    clothesRack(f,3.3,-1.55,0,['od','tan','dark','fabric','odD']); plant(f,-5.4,-0.5,1.1); plant(f,5.42,-0.5,1.1);
    plane(f,1.6,0.9,rm(Rm,'dmat',{map:T.doormat,roughness:1}),0,0.006,-0.65,0,-H2); cooler(f,-1.85,-0.38,PI); extinguisher(f,1.6,-0.3);
    poster(w.n,-4.8,1.26,0.03,1.3,0.5,'price',{ppm:300}); prop(f,'storage_cart',0.9,4.75,-12.85,0);
    /* track lights along the walls, a sign hanging over the aisle */
    track(w.n,-3.2,5.2,1.1,3.28,6); track(w.w,-2.4,6.2,1.1,3.28,6); track(w.e,-6.2,2.4,1.1,3.28,6);
    const hs=sub(f,0,-7.6,0); for(const x of [-0.7,0.7]) cyl(hs,x,3.0,0,0.006,0.6,pm(Rm,'chrome'),5); B(hs,-0.85,2.45,-0.03,0.85,2.72,0.03,pm(Rm,'dark'));
    for(const ry of [0,PI]) sign(hs,1.6,0.24,0,2.585,0.032*(ry?-1:1),[['CODE-NAME 총포상',0.5,'#ff9a3c',900],['수입 · 국산 · 중고 매입',0.28,'#e8e8e8',700]],{bg:'#141518',glow:true,ry}); }
  /* ---------- rooms ---------- */
  function buildHub(Rm){ const f=Rm.f0, w=Rm.w;
    shell(Rm,{floor:rm(Rm,'floor',{map:T.epoxy,roughness:0.55,metalness:0.1}),ceil:rm(Rm,'ceil',{color:'#3a3d42',roughness:0.9}),wall:rm(Rm,'wall',{map:T.panels,roughness:0.62,metalness:0.15}),base:rm(Rm,'base',{color:'#2a2c30',roughness:0.6})});
    const lamp=basic(Rm,'lamp',{color:new THREE.Color('#f2f6ff').multiplyScalar(2)}), steel=rm(Rm,'steel',{color:'#40444a',roughness:0.45,metalness:0.7}), top=rm(Rm,'btop',{color:'#2a2c2f',roughness:0.35,metalness:0.8});
    for(const [x,z] of [[-2.4,-2.2],[2.4,-2.2],[-2.4,2.2],[2.4,2.2]]){ B(f,x-2.3,3.52,z-0.09,x+2.3,3.6,z+0.09,steel); B(f,x-2.2,3.5,z-0.06,x+2.2,3.52,z+0.06,lamp); }
    /* hazard stripes at the doorways */
    const hz=basic(Rm,'hz',{map:new THREE.CanvasTexture(canvas(128,16,(x,W,H)=>{ x.fillStyle='#e2b112'; x.fillRect(0,0,W,H); x.fillStyle='#16181a'; for(let i=-2;i<10;i++){ x.beginPath(); x.moveTo(i*16,H); x.lineTo(i*16+8,0); x.lineTo(i*16+16,0); x.lineTo(i*16+8,H); x.fill(); } }))});
    for(const k of ['n','s','e','w']){ const g=w[k]; plane(g,2,0.12,hz,0,0.003,0.32,0,-H2); }
    /* workbench: shows the loadout; use it for the detailed screen */
    const bench=sub(f,0,0.4,0); B(bench,-1.35,0.86,-0.55,1.35,0.92,0.55,top); B(bench,-1.37,0.82,-0.57,1.37,0.86,0.57,steel);
    for(const [x,z] of [[-1.25,-0.45],[1.25,-0.45],[-1.25,0.45],[1.25,0.45]]) B(bench,x-0.04,0,z-0.04,x+0.04,0.82,z+0.04,steel); B(bench,-1.3,0.2,-0.5,1.3,0.24,0.5,steel);
    B(bench,1.0,0.92,-0.5,1.25,1.02,-0.3,steel); B(bench,1.05,1.02,-0.45,1.2,1.08,-0.35,rm(Rm,'vise',{color:'#3d5d8a',roughness:0.4,metalness:0.6}));
    solid(bench,-1.4,-0.6,1.4,0.6); shade(bench,-1.5,-0.7,1.5,0.7,0.55,0.25);
    sign(bench,0.9,0.16,0,0.885,0.577,[['내 로드아웃 · 세부 설정',0.5,'#ffb066',800]],{bg:'#141518'});
    benchG=new THREE.Group(); benchG.userData.keep=1; bench.g.add(benchG);
    picks.push({Rm,kind:'bench',w:mul(Rm.M,bench.S),inv:mul(Rm.M,bench.S).invert(),box:new THREE.Box3(V3(-1.4,0,-0.6),V3(1.4,1.15,0.6)),noHl:true});
    /* exit door on the north wall, lockers beside it */
    const n=w.n, door=rm(Rm,'door',{color:'#525a62',roughness:0.5,metalness:0.6});
    B(n,-4.45,0,0,-3.15,2.3,0.06,door); B(n,-4.55,0,0,-4.45,2.4,0.08,steel); B(n,-3.15,0,0,-3.05,2.4,0.08,steel); B(n,-4.55,2.3,0,-3.05,2.4,0.08,steel); B(n,-3.42,1.0,0.06,-3.3,1.06,0.12,rm(Rm,'chrome',{color:'#c8ccd0',roughness:0.2,metalness:1}));
    sign(n,0.9,0.28,-3.8,2.62,0.01,[['출구 EXIT',0.55,'#eafff0',900]],{bg:'#14833f',glow:true});
    picks.push({Rm,kind:'exit',w:mul(Rm.M,n.S),inv:mul(Rm.M,n.S).invert(),box:new THREE.Box3(V3(-4.5,0,-0.1),V3(-3.1,2.4,0.3)),noHl:true});
    const lk=rm(Rm,'locker',{color:'#5f6f62',roughness:0.55,metalness:0.5});
    for(let i=0;i<5;i++){ const x=1.6+i*0.8; B(n,x,0,0,x+0.76,2.0,0.5,lk); for(let k=0;k<4;k++) B(n,x+0.2,1.6+k*0.05,0.5,x+0.56,1.62+k*0.05,0.51,steel); B(n,x+0.62,0.9,0.5,x+0.66,1.15,0.53,steel); }
    solid(n,1.6,0,5.6,0.5); shade(n,1.5,0,5.7,0.6,0.5,0.12);
    /* perk board (south wall, west half): one patch per perk */
    const s=w.s, cork=rm(Rm,'cork',{map:T.cork,roughness:0.95}); B(s,1.5,0.95,0,5.6,2.45,0.03,cork); B(s,1.45,0.9,0,5.65,0.95,0.05,steel); B(s,1.45,2.45,0,5.65,2.5,0.05,steel);
    sign(s,2.2,0.22,3.55,2.66,0.01,[['퍼크 게시판',0.52,'#ffb066',900],['패치를 누르면 퍼크로 달아요 (2개)',0.3,'#cfd3d8',600]],{bg:'#141518',top:0.36,glow:true});
    PERK_IDS.forEach((id,i)=>{ const col=i%6, row=(i/6)|0, x=5.3-col*0.62, y=2.2-row*0.5; const p=PERKS[id];
      lab(s,0.54,0.4,x,y,0.035,(c,W,H)=>{ c.fillStyle='#2e3426'; c.beginPath(); c.roundRect(4,4,W-8,H-8,18); c.fill(); c.setLineDash([7,5]); c.strokeStyle='#c9b26a'; c.lineWidth=4; c.beginPath(); c.roundRect(12,12,W-24,H-24,12); c.stroke(); c.setLineDash([]);
        c.fillStyle='#f2efe3'; c.textAlign='center'; c.textBaseline='middle'; c.font=`800 ${Math.round(H*0.2)}px ${FONT}`; c.fillText(p.name,W/2,H*0.38,W*0.84); c.fillStyle='#c9c4ae'; c.font=`600 ${Math.round(H*0.1)}px ${FONT}`;
        wrap(c,p.desc,W*0.8,2).forEach((l,k)=>c.fillText(l,W/2,H*(0.6+k*0.14),W*0.86)); },{ppm:420});
      const m=mul(s.S,mT(x,y,0.035)); const wm=mul(Rm.M,m); picks.push({Rm,kind:'perk',id,w:wm,inv:wm.clone().invert(),box:new THREE.Box3(V3(-0.27,-0.2,-0.02),V3(0.27,0.2,0.05)),plate:[0.54,0.4]}); });
    for(let i=0;i<2;i++){ const mk=lab(s,0.2,0.08,0,0,0.04,(c,W,H)=>{ c.fillStyle='#ff8a1f'; c.fillRect(0,0,W,H); c.fillStyle='#111'; c.font=`900 ${Math.round(H*0.7)}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('퍼크 '+(i+1),W/2,H/2); },{glow:true}); mk.userData.st=0; perkMarks.push({m:mk,f:s}); }
    /* supply shelf (south wall, east half): throwables and field devices */
    const sh=sub(s,-3.55,0,0); const shelf=rm(Rm,'shelf',{color:'#5a6068',roughness:0.5,metalness:0.6});
    for(const x of [-2.05,2.05]) B(sh,x-0.03,0,0,x+0.03,2.0,0.48,shelf); for(const y of [0.35,0.95,1.55]) B(sh,-2.05,y-0.03,0,2.05,y,0.48,shelf); solid(sh,-2.1,0,2.1,0.5); shade(sh,-2.1,0,2.1,0.6,0.45,0.1);
    const ths=Object.keys(TH), sps=Object.keys(SP);
    ths.forEach((id,i)=>{ const row=i<5?2:1, col=i%5, s1=gsrc(id), x=-1.6+col*0.8; for(let k=0;k<(id==='rocket'?1:3);k++){ const m=id==='rocket'?mFlat(s1,x,[0.35,0.95,1.55][row],0.24,0.3,-1):mul(mT(x-0.18+k*0.17,[0.35,0.95,1.55][row]-s1.box.min.y,0.22),mY(0.4)); gun(sh,id,m); }
      sign(sh,0.5,0.07,x,[0.35,0.95,1.55][row]-0.065,0.482,[[TH[id].name,0.62,'#111',800]],{bg:'#e8e6de'}); });
    sps.forEach((id,i)=>{ const s1=gsrc(id), x=-1.6+i*0.8; for(let k=0;k<2;k++) gun(sh,id,mul(mT(x-0.12+k*0.24,0.35-s1.box.min.y,0.24),mY(-0.3+k*0.2)));
      sign(sh,0.5,0.07,x,0.285,0.482,[[SP[id].name,0.62,'#111',800]],{bg:'#e8e6de'}); });
    gun(bench,'fists',mul(mT(1.1,0.92,0.12),mY(0.4))); sign(bench,0.3,0.06,1.1,0.885,0.577,[['맨손 (주먹)',0.6,'#ffb066',800]],{bg:'#141518'});
    sign(sh,1.6,0.2,0,2.25,0.03,[['투척 · 특수 장비',0.55,'#ffb066',900]],{bg:'#141518',glow:true});
    /* a plan of the armory (west wall, south of the doorway) and room signs over every doorway */
    lab(w.w,2.2,1.5,3.4,1.65,0.02,(c,W,H)=>drawPlan(c,W,H),{ppm:300});
    const sg=[['n','1','구형 소총 보관실','볼트액션 · 옛 소총 · 옛 기관단총 · 기관총 · 옛 권총'],['e','2','신사의 무기고','저격총 · 지정사수 · 권총 · 나이프 · 조준경'],['s','3','군 무기 보관 케이지','돌격소총 · 기관단총 · 기관총 · 중화기 · 투척 · 부품'],['w','4','총포상','산탄총 · 벽걸이 소총 · 권총 · 특수 화기 · 근접']];
    for(const [k,n1,nm,ct] of sg) sign(w[k],2.6,0.52,0,3.0,0.01,[[n1+'  '+nm,0.42,'#ffffff',900],[ct,0.24,'#ffb066',700]],{bg:'#141518',glow:true,top:0.38});
    dressHub(Rm);
  }
  function drawPlan(c,W,H){ c.fillStyle='#101214'; c.fillRect(0,0,W,H); c.strokeStyle='#ff8a1f'; c.lineWidth=4; c.strokeRect(2,2,W-4,H-4);
    c.fillStyle='#ffb066'; c.font=`900 ${H*0.07}px ${FONT}`; c.textAlign='left'; c.textBaseline='top'; c.fillText('무기고 안내도',W*0.04,H*0.04);
    const s=H*0.0165, ox=W*0.56, oz=H*0.55, R=(x0,z0,x1,z1,t,col)=>{ c.fillStyle=col; c.fillRect(ox+x0*s,oz+z0*s,(x1-x0)*s,(z1-z0)*s); c.strokeStyle='#e9ecef'; c.lineWidth=2; c.strokeRect(ox+x0*s,oz+z0*s,(x1-x0)*s,(z1-z0)*s);
      c.fillStyle='#fff'; c.font=`800 ${H*0.042}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(t,ox+(x0+x1)/2*s,oz+(z0+z1)/2*s); };
    /* the plan is drawn as seen standing in the workshop facing this wall (west): north is to the right */
    const rot=(x,z)=>[-z,x]; const RR=(a,b,cc,dd,t,col)=>{ const p=rot(a,b), q=rot(cc,dd); R(Math.min(p[0],q[0]),Math.min(p[1],q[1]),Math.max(p[0],q[0]),Math.max(p[1],q[1]),t,col); };
    RR(-10,-22,10,-6,'1 구형 소총','#3b3328'); RR(6,-6,20,6,'2 신사','#3a2418'); RR(-10,6,10,22,'3 케이지','#353a2c'); RR(-20,-6,-6,6,'4 총포상','#3d3b35'); RR(-6,-6,6,6,'정비실','#2a2f36');
    const me=rot(-5.9,-3.4); c.fillStyle='#ff8a1f'; c.beginPath(); c.arc(ox+me[0]*s,oz+me[1]*s,H*0.018,0,7); c.fill(); c.fillStyle='#ffb066'; c.font=`700 ${H*0.035}px ${FONT}`; c.fillText('지금 여기',ox+me[0]*s,oz+me[1]*s-H*0.04); }
  function buildR1(Rm){ const f=Rm.f0, w=Rm.w;
    shell(Rm,{floor:rm(Rm,'floor',{map:T.terrazzo,roughness:0.42}),ceil:rm(Rm,'ceil',{map:T.plaster,color:'#e9e6df',roughness:0.95}),wall:rm(Rm,'wall',{map:T.plaster,roughness:0.92}),base:rm(Rm,'base',{color:'#5d5a55',roughness:0.7}),baseH:0.16});
    const lamp=basic(Rm,'lamp',{color:new THREE.Color('#fff7ea').multiplyScalar(1.8)}), fr=rm(Rm,'lampF',{color:'#d8d8d4',roughness:0.6,metalness:0.3});
    for(const x of [-5,5]) for(const z of [-12,-8,-4]){ B(f,x-0.65,4.12,z-0.32,x+0.65,4.2,z+0.32,fr); B(f,x-0.6,4.1,z-0.27,x+0.6,4.12,z+0.27,lamp); }
    /* dado band like an old army building */
    for(const k of ['n','e','w','s']){ const g=w[k], L=(k==='n'||k==='s'?20:16)-2*WT; const band=rm(Rm,'dado',{color:'#8f8b82',roughness:0.85}); if(k==='s'){ B(g,-L/2,0.16,0,-1.1,1.0,0.006,band); B(g,1.1,0.16,0,L/2,1.0,0.006,band); } else B(g,-L/2,0.16,0,L/2,1.0,0.006,band); }
    /* three rows of racks either side of the centre aisle */
    const rows=[[-3.4,['m1','kar98','falcon','mosin']],[-7.0,['ak47','sks','m14','ak74']],[-10.6,['enfield','lever94','pump','autosg']]], segs=[[-8.9,-5.75],[-5.45,-2.3],[2.3,5.45],[5.75,8.9]];
    for(const [z,ids] of rows) ids.forEach((id,i)=>rackA(f,segs[i][0],segs[i][1],z,id));
    /* upright wall racks in the aisles: old SMGs, lever guns, machine guns */
    uprightRack(w.w,-3.9,-1.7,['ppsh','tommy']); uprightRack(w.w,-0.3,1.9,['mp40','sten']); uprightRack(w.w,3.8,7.2,['lever87','ranch14','svd']);
    uprightRack(w.e,1.7,3.9,['mg42','rpd']); uprightRack(w.e,-1.9,0.3,['blunder','sawed']); uprightRack(w.e,-7.2,-3.8,['m14','g3','kar98']);
    for(const x of [-1.7,1.7]){ const col=rm(Rm,'col',{map:T.plaster,roughness:0.9}); B(f,x-0.3,0,-9.1,x+0.3,4.2,-8.5,col); solid(f,x-0.3,-9.1,x+0.3,-8.5); shade(f,x-0.4,-9.2,x+0.4,-8.4,0.4,0.15); }
    /* back wall: a long board of old guns (flintlocks, crossbows, sawed-offs) */
    const n=w.n, board=rm(Rm,'board',{map:T.walnut,color:'#c7a58a',roughness:0.6});
    B(n,-4.2,1.0,0,4.2,2.9,0.05,board); sign(n,2.4,0.24,0,3.15,0.01,[['옛 무기 진열',0.5,'#2a1c0c',900]],{bg:'#c7a560'});
    const fl=gsrc('flintlock'), cb=gsrc('crossbow'), sw=gsrc('sawed');
    for(let r=0;r<2;r++) for(let i=0;i<7;i++) gun(n,'flintlock',mHang(fl,-3.6+i*1.2,2.55-r*0.34,0.05+half(fl)+0.01,-1,-0.12));
    for(let i=0;i<6;i++) gun(n,'crossbow',mFace(cb,-3.4+i*1.36,1.62,0.06,0));
    const bl=gsrc('blunder'); for(let i=0;i<8;i++){ const id=i%2?'blunder':'sawed', s1=i%2?bl:sw; gun(n,id,mHang(s1,-3.7+i*1.06,1.2,0.05+half(s1)+0.01,i%2?1:-1,i%2?0.06:-0.06)); }
    /* a dark door at the back like the photo, a desk with a ledger near the entrance, frames on the walls */
    const dd=rm(Rm,'ddoor',{color:'#2a2622',roughness:0.6}); B(n,6.0,0,0,7.6,2.6,0.05,dd); const dfm=rm(Rm,'dframe',{color:'#d8d4cc',roughness:0.8}); B(n,5.88,0,0,6.0,2.72,0.08,dfm); B(n,7.6,0,0,7.72,2.72,0.08,dfm); B(n,5.88,2.6,0,7.72,2.72,0.08,dfm); B(n,7.3,1.0,0.05,7.36,1.18,0.09,rm(Rm,'knob',{color:'#b89b5e',roughness:0.3,metalness:1}));
    for(const [k,x] of [['w',-2.8],['w',5.5],['e',-5.5],['e',2.8]]){ const g=w[k]; B(g,x-0.6,2.75,0,x+0.6,3.55,0.04,rm(Rm,'frame',{color:'#2a2018',roughness:0.6}));
      lab(g,1.08,0.68,x,3.15,0.045,(c,W,H)=>{ const gr=c.createLinearGradient(0,0,0,H); gr.addColorStop(0,'#cbb896'); gr.addColorStop(1,'#8e7a5c'); c.fillStyle=gr; c.fillRect(0,0,W,H); rnd=mulberry(hashStr(k+x)); for(let i=0;i<14;i++){ c.fillStyle=`rgba(40,30,20,${0.15+rnd()*0.3})`; c.fillRect(rnd()*W,H*0.45+rnd()*H*0.4,W*0.04,H*0.25); } c.fillStyle='rgba(60,45,30,.35)'; c.fillRect(0,H*0.75,W,H*0.25); }); }
    const desk=sub(f,-7.4,-1.3,0), dw=rm(Rm,'desk',{map:T.walnut,color:'#b08a6a',roughness:0.55}); B(desk,-0.8,0.72,-0.4,0.8,0.78,0.4,dw); for(const [x,z] of [[-0.75,-0.35],[0.75,-0.35],[-0.75,0.35],[0.75,0.35]]) B(desk,x-0.03,0,z-0.03,x+0.03,0.72,z+0.03,dw);
    B(desk,-0.2,0.78,-0.15,0.25,0.81,0.15,rm(Rm,'ledger',{color:'#5a1f1a',roughness:0.8})); sign(desk,0.42,0.28,0.02,0.812,0,[['출고 대장',0.2,'#3a2a1a',800],['서명 후 반출',0.13,'#5a4a3a',600]],{bg:'#eee6d2',rx:-H2});
    solid(desk,-0.85,-0.45,0.85,0.45); shade(desk,-0.9,-0.5,0.9,0.5,0.35,0.15);
    sign(w.s,1.8,0.3,0,2.95,0.01,[['◀ 정비실',0.55,'#fff',900]],{bg:'#141518',glow:true});
    dressR1(Rm);
  }
  function buildR2(Rm){ const f=Rm.f0, w=Rm.w;
    const wal=rm(Rm,'wall',{map:T.walnut,roughness:0.55,color:'#e6d2c0'});
    shell(Rm,{floor:rm(Rm,'floor',{map:T.planks,roughness:0.45}),ceil:rm(Rm,'ceil',{map:T.coffer,roughness:0.7}),wall:wal,base:rm(Rm,'base',{color:'#24140b',roughness:0.5}),baseH:0.18,jamb:rm(Rm,'jamb',{map:T.walnut,color:'#c8ad95',roughness:0.5})});
    const rug=rm(Rm,'rug',{map:T.rug,roughness:1}); plane(f,3.6,7.4,rug,0,0.004,-7.6,0,-H2);
    /* chandelier */
    const br=rm(Rm,'brass',{color:'#c9a25a',roughness:0.3,metalness:1}), bulb=basic(Rm,'bulb',{color:new THREE.Color('#ffd9a0').multiplyScalar(4)});
    for(const z of [-5,-10]){ cyl(f,0,3.1,z,0.015,0.6,br,6); const ring=new THREE.Mesh(new THREE.TorusGeometry(0.45,0.025,8,32),br); ring.rotation.x=H2; ring.position.set(0,2.8,z); ring.userData.st=1; f.g.add(ring);
      for(let i=0;i<8;i++){ const a=i/8*PI*2, x=Math.cos(a)*0.45, zz=z+Math.sin(a)*0.45; cyl(f,x,2.86,zz,0.012,0.1,br,6); const b=new THREE.Mesh(new THREE.SphereGeometry(0.03,8,6),bulb); b.position.set(x,2.94,zz); b.userData.st=1; f.g.add(b); } }
    /* back wall (photo): knives | two upright | four rifles across | two upright | knives, drawers under everything */
    const n=w.n; drawers(n,-5.7,5.7);
    niche(n,-5.4,1.15,-4.3,2.85); niche(n,-3.85,1.15,-3.05,2.85); niche(n,-2.6,1.15,2.6,2.85); niche(n,3.05,1.15,3.85,2.85); niche(n,4.3,1.15,5.4,2.85);
    const kn=gsrc('knife',true); for(const side of [-1,1]) for(let c=0;c<2;c++) for(let r=0;r<8;r++){ const x=side*(4.62+c*0.47)+(side<0?0:-0), y=1.32+r*0.2; gun(n,'knife',mHang(kn,x,y,0.05,side<0?-1:1,(side<0?0.18:-0.18)+(c?0.05:-0.05)),true); }
    const long=['bp1','k14','lightsr','m110','g28','mk12']; long.forEach((id,i)=>{ const s1=gsrc(id,true); gun(n,id,mHang(s1,i<3?-1.25:1.25,1.45+(i%3)*0.6,0.04+half(s1),-1,0),true); });
    for(const [x,ids] of [[-3.45,['ou','ou']],[3.45,['mk14','mk14']]]) ids.forEach((id,i)=>{ const s1=gsrc(id,true); gun(n,id,mul(mT(x-0.18+i*0.36,1.22,0.05+half(s1)),mZ(0),mStandW(s1)),true); });
    /* pistols lying in the glass-topped drawer tops along the back */
    const ps=['derr','m500','peace','auto75','viper','derr','peace','auto75','c96','makarov'];
    ps.forEach((id,i)=>{ const s1=gsrc(id,true); gun(n,id,mFlat(s1,-5.2+i*1.15,0.965,0.3,0.3,-1),true); });
    B(n,-5.72,1.02,0.02,5.72,1.03,0.58,rm(Rm,'glass',{color:'#dfeff2',roughness:0.04,transparent:true,opacity:0.12,depthWrite:false,env:2}));
    /* left wall: lit shelves of pistols; right wall: upright rifles and a scope wall */
    const L=w.w, Rw=w.e;
    for(const g of [L,Rw]){ drawers(g,-6.2,-0.9); drawers(g,0.9,6.2); }
    /* L: frame x runs from the door (x=+…) to the back (x=−…) because the west wall frame turns +π/2 */
    niche(L,-6.0,1.15,-3.6,2.85); niche(L,-3.1,1.15,-0.9,2.85); niche(L,0.9,1.15,3.1,2.85); niche(L,3.6,1.15,6.0,2.85);
    const pisRows=[['p17','p18c','usx','s226'],['m9','pk','f57','mark22'],['k5','viper','aps','m500'],['deagle','revolver','p1912','burst9']];
    [-4.8,-2.0,2.0,4.8].forEach((cx,k)=>{ for(let r=0;r<4;r++) for(let c=0;c<4;c++){ const id=pisRows[k][r], s1=gsrc(id,true); gun(L,id,mHang(s1,cx-0.84+c*0.56,1.42+r*0.4,0.04+half(s1),-1,-0.05),true); } });
    niche(Rw,-6.0,1.15,-4.4,2.85); niche(Rw,-3.9,1.15,-0.9,2.85); niche(Rw,0.9,1.15,3.9,2.85); niche(Rw,4.4,1.15,6.0,2.85);
    for(const [cx,id] of [[-5.2,'svu'],[5.2,'vss']]) for(let i=0;i<3;i++){ const s1=gsrc(id,true); gun(Rw,id,mul(mT(cx-0.45+i*0.45,1.22,0.05+half(s1)),mStandW(s1)),true); }
    ['qbu','mk12','m24'].forEach((id,i)=>{ const s1=gsrc(id,true); for(let k=0;k<1;k++) gun(Rw,id,mHang(s1,-2.4,1.5+i*0.5,0.04+half(s1),-1,0),true); });
    /* scope wall: long scopes and suppressors on small lit shelves */
    const shelfM=rm(Rm,'trim',{color:'#3a2214',roughness:0.45,map:T.walnut}); for(const y of [1.45,1.95,2.45]) B(Rw,1.0,y-0.03,0,3.8,y,0.16,shelfM);
    [['scope','x8'],['scope','x6'],['scope','x4']].forEach(([sl,op],r)=>{ const s1=psrc(sl,op); for(let i=0;i<3;i++) part(Rw,sl,op,mul(mT(1.45+i*0.95,[2.45,1.95,1.45][r]-s1.box.min.y,0.08),mY(H2))); });
    [['muzzle','sup'],['muzzle','brake'],['muzzle','sup']].forEach(([sl,op],r)=>{ const s1=psrc(sl,op); for(let i=0;i<2;i++) part(Rw,sl,op,mul(mT(1.85+i*0.95,[2.45,1.95,1.45][r]-s1.box.min.y+0.02,0.08),mY(H2))); });
    sign(Rw,1.6,0.12,2.4,1.27,0.03,[['고배율 조준경 · 소음기',0.62,'#e8cf9a',800]],{bg:'#24140b'});
    /* two tufted benches */
    const tart=rm(Rm,'tartan',{map:T.tartan,roughness:0.95}), leg=rm(Rm,'leg',{color:'#1d120b',roughness:0.5});
    for(const z of [-5.6,-9.6]){ const b=sub(f,0,z,0); const top=new THREE.Mesh(new THREE.RoundedBoxGeometry(1.9,0.2,0.62,3,0.06),tart); top.position.set(0,0.42,0); top.userData.st=1; b.g.add(top);
      for(const [x,zz] of [[-0.85,-0.24],[0.85,-0.24],[-0.85,0.24],[0.85,0.24]]) cyl(b,x,0.16,zz,0.03,0.32,leg,8); solid(b,-0.97,-0.33,0.97,0.33); shade(b,-1.05,-0.4,1.05,0.4,0.5,0.12); }
    sign(w.s,1.8,0.3,0,2.95,0.01,[['◀ 정비실',0.55,'#f3dfb4',900]],{bg:'#24140b',glow:true});
    dressR2(Rm);
  }
  /* upright on a wall (rifles in tall niches): butt down, side to the room */
  function mStandW(s){ const b=s.box, c=b.getCenter(new THREE.Vector3()); return mul(mZ(-H2),mY(H2),mT(-c.x,-c.y,-b.max.z)); }
  function buildR3(Rm){ const f=Rm.f0, w=Rm.w;
    const blk=rm(Rm,'wall',{map:T.block,roughness:0.85,color:'#e8ece4'});
    shell(Rm,{floor:rm(Rm,'floor',Object.assign({color:'#b4b1a8',roughness:0.85},pbrTex('concrete_floor',3))),ceil:rm(Rm,'ceil',{color:'#3c3f42',roughness:0.9}),wall:blk,base:rm(Rm,'base',{color:'#3f4630',roughness:0.7}),baseH:0.9});
    const lamp=basic(Rm,'lamp',{color:new THREE.Color('#eef5ff').multiplyScalar(2)}), steel=rm(Rm,'steel',{color:'#5b6066',roughness:0.45,metalness:0.7});
    for(const x of [-6,0,6]) for(const z of [-12,-7.5,-3]){ B(f,x-1.6,3.88,z-0.1,x+1.6,3.95,z+0.1,steel); B(f,x-1.5,3.86,z-0.05,x+1.5,3.88,z+0.05,lamp); }
    for(const x of [-8,-3,3,8]) B(f,x-0.12,3.6,-16,x+0.12,4.0,0,steel);
    const yl=basic(Rm,'yl',{color:'#d9ab1c'}); plane(f,0.1,15.6,yl,-1.3,0.003,-8,0,-H2); plane(f,0.1,15.6,yl,1.3,0.003,-8,0,-H2);
    /* the cage: chain-link from wall to wall at z = −6.2, a gate in the middle */
    const mesh=rm(Rm,'mesh',{map:T.mesh,alphaMap:null,transparent:false,alphaTest:0.4,side:THREE.DoubleSide,roughness:0.5,metalness:0.6,color:'#ffffff'}); 
    const cz=-6.2; for(const [a,b] of [[-9.88,-1.3],[1.3,9.88]]){ const p=plane(f,b-a,3.0,mesh,(a+b)/2,1.6,cz,0,0,[a,0.1]); for(let x=a;x<=b+0.01;x+=(b-a)/4) B(f,x-0.04,0,cz-0.04,x+0.04,3.1,cz+0.04,steel); B(f,a,3.05,cz-0.03,b,3.12,cz+0.03,steel); B(f,a,0.05,cz-0.03,b,0.1,cz+0.03,steel); solid(f,a,cz-0.05,b,cz+0.05); }
    sign(f,1.6,0.3,0,2.85,cz+0.05,[['보관 구역',0.5,'#111',900],['인가자 외 출입 금지',0.3,'#8a1010',800]],{bg:'#f1d24a',top:0.38});
    /* cabinets along the back and the left wall, two tiers each */
    const n=w.n, back=[['m4','r416'],['m16','k2'],['k1a','scar'],['g36','augur'],['famas','s550'],['l85','qbz'],['f2k','t21'],['ak12','gallant'],['m249'],['m60']];
    back.forEach((ids,i)=>{ cabinet(n,-7.56+i*1.68,0.33,0,1.6,ids,ids.length===1?{sp:0.2}:null); });
    const smg=[['smg9','u45'],['vector','mx7'],['microsmg','px9'],['p50','mps9'],['evo3','bison']];
    smg.forEach((ids,i)=>{ cabinet(w.w,0.2+i*1.5,0.33,0,1.42,ids,{sp:0.12}); });
    /* right wall: riot shields on a rack, rocket launchers standing */
    const E=w.e, sd=gsrc('shield'); B(E,-7.4,0.95,0.02,-2.6,1.0,0.32,steel); for(let i=0;i<7;i++) gun(E,'shield',mul(mT(-7.0+i*0.68,0.5,0.32),mY(PI),mX(-0.12)));
    solid(E,-7.5,0,-2.5,0.55); shade(E,-7.5,0,-2.5,0.7,0.45,0.15);
    const rk=gsrc('rocket'); for(let i=0;i<6;i++) gun(E,'rocket',mStand(rk,-1.8+i*0.32,0.02,0.18,0,0.12,0.4)); B(E,-2.0,0,0,0.0,0.08,0.4,steel); B(E,-2.0,0.9,0,0.0,0.95,0.12,steel); solid(E,-2.0,0,0,0.45);
    sign(E,1.8,0.14,-0.9,1.2,0.13,[['초소형 로켓 · 로켓 발사기',0.6,'#111',800]],{bg:'#e8e6de'});
    /* front half: a table of carbines laid out (photo), crates of grenades, the parts bench */
    const tb=sub(f,0,-4.0,0), tw=rm(Rm,'table',{color:'#4c5240',roughness:0.7,metalness:0.2}); B(tb,-2.2,0.74,-0.5,2.2,0.8,0.5,tw); for(const [x,z] of [[-2.1,-0.4],[2.1,-0.4],[-2.1,0.4],[2.1,0.4]]) B(tb,x-0.04,0,z-0.04,x+0.04,0.74,z+0.04,steel);
    solid(tb,-2.25,-0.55,2.25,0.55); shade(tb,-2.3,-0.6,2.3,0.6,0.45,0.2);
    for(let i=0;i<10;i++){ const id=['m4','k2','m16'][i%3]; gun(tb,id,mFlat(gsrc(id),-1.9+i*0.42,0.8,0,H2+(i%2?0.04:-0.04),i%2?1:-1)); }
    /* steel racks in the middle of the cage */
    for(const [z,ids] of [[-9.4,['arc7','asv','groza','g3']],[-12.6,['rpk','pkm','k3','ng7']]]) [[-7.8,-4.6],[-4.2,-1.4],[1.4,4.2],[4.6,7.8]].forEach(([a,b],i)=>rackA(f,a,b,z,ids[i],{steel:true}));
    /* grenade crates on pallets (left front) */
    const crate=rm(Rm,'crate',{map:T.od,color:'#9aa07a',roughness:0.7}), pal=rm(Rm,'pallet',{map:T.pine,roughness:0.8});
    const thr=['frag','smoke','flash','stun','sticky','repulse','implode','c4','mine'];
    thr.forEach((id,i)=>{ const col=i%3, row=(i/3)|0, x=-8.6+col*1.0, z=-2.0-row*1.25, c=sub(f,x,z,0), s1=gsrc(id);
      B(c,-0.45,0,-0.5,0.45,0.12,0.5,pal); B(c,-0.42,0.12,-0.4,0.42,0.42,0.4,crate); B(c,-0.4,0.42,-0.38,0.4,0.425,0.38,rm(Rm,'crateIn',{color:'#2a2c22',roughness:0.9}));
      const nx=id==='mine'||id==='c4'?3:4, nz=id==='mine'?3:id==='c4'?4:5; for(let a=0;a<nx;a++) for(let b=0;b<nz;b++) gun(c,id,mul(mT(-0.3+a*0.6/(nx-1),0.425-s1.box.min.y,-0.28+b*0.56/(nz-1)),mY(0.3)));
      sign(c,0.6,0.1,0,0.3,0.403,[[TH[id].name,0.62,'#f1f1e6',800]],{bg:'#2c3021'}); solid(c,-0.47,-0.52,0.47,0.52); shade(c,-0.5,-0.55,0.5,0.55,0.45,0.1); });
    /* field devices on a steel shelf (left front wall) */
    const sh=sub(w.s,6.6,0,0); for(const x of [-1.55,1.55]) B(sh,x-0.03,0,0,x+0.03,1.9,0.46,steel); for(const y of [0.4,1.0,1.6]) B(sh,-1.55,y-0.03,0,1.55,y,0.46,steel); solid(sh,-1.6,0,1.6,0.5); shade(sh,-1.6,0,1.6,0.6,0.4,0.1);
    Object.keys(SP).forEach((id,i)=>{ const s1=gsrc(id), row=i<3?0:1, col=i<3?i:i-3, y=[1.6,1.0][row]; for(let k=0;k<3;k++) gun(sh,id,mul(mT(-1.2+col*1.0-0.22+k*0.22,y-s1.box.min.y,0.24),mY(-0.2))); sign(sh,0.6,0.08,-1.2+col*1.0,y-0.07,0.462,[[SP[id].name,0.62,'#111',800]],{bg:'#e8e6de'}); });
    /* parts bench with a pegboard (right front wall) */
    const pb=sub(w.s,-5.4,0,0), peg=rm(Rm,'peg',{map:T.peg,roughness:0.85}); B(pb,-2.4,1.0,0,2.4,2.4,0.03,peg); B(pb,-2.4,0.86,0,2.4,0.92,0.7,rm(Rm,'btop',{color:'#6b5034',map:T.pine,roughness:0.7}));
    for(const x of [-2.3,2.3]) B(pb,x-0.04,0,0.05,x+0.04,0.86,0.65,steel); solid(pb,-2.45,0,2.45,0.72); shade(pb,-2.5,0,2.5,0.8,0.45,0.15);
    sign(pb,2.4,0.2,0,2.6,0.02,[['부품 작업대 · 들고 있는 총에 바로 달아요',0.48,'#ffb066',800]],{bg:'#141518',glow:true});
    const pegRows=[['grip',['vert','angled','half','thumb','laser','bipod']],['stock',['std','light','heavy','cheek','loops']],['barrel',['std','long','short','heavy']]];
    pegRows.forEach(([sl,ops],r)=>{ const y=2.15-r*0.42; ops.forEach((op,i)=>{ const s1=psrc(sl,op), x=-2.0+i*(4.0/(ops.length-1||1)); part(pb,sl,op,sl==='barrel'?mul(mT(x,y,0.06),mY(H2)):mul(mT(x,y-(s1.box.max.y+s1.box.min.y)/2,0.07),mY(H2)));
      lab(pb,0.5,0.06,x,y-0.15,0.035,(c,W,H)=>{ c.fillStyle='#f4f1e8'; c.fillRect(0,0,W,H); c.fillStyle='#222'; c.font=`800 ${Math.round(H*0.66)}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(ATT[sl][op].name,W/2,H/2,W*0.94); }); }); });
    const mags=['std','ext','quick','extq','drum']; mags.forEach((op,i)=>{ const s1=psrc('mag',op); for(let k=0;k<3;k++) part(pb,'mag',op,mul(mT(-2.0+i*0.82-0.15+k*0.15,0.92-s1.box.min.y,0.38),mY(0.15)));
      lab(pb,0.6,0.07,-2.0+i*0.82,0.89,0.701,(c,W,H)=>{ c.fillStyle='#f4f1e8'; c.fillRect(0,0,W,H); c.fillStyle='#222'; c.font=`800 ${Math.round(H*0.66)}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(ATT.mag[op].name,W/2,H/2,W*0.94); }); });
    /* the tool box: takes every part off the gun in your hands */
    const tbx=rm(Rm,'tbox',{color:'#a3261c',roughness:0.45,metalness:0.4}); B(pb,1.82,0.92,0.2,2.34,1.12,0.5,tbx); B(pb,1.96,1.12,0.33,2.2,1.16,0.37,steel); lab(pb,0.5,0.07,2.08,0.89,0.701,(c,W,H)=>{ c.fillStyle='#a3261c'; c.fillRect(0,0,W,H); c.fillStyle='#fff'; c.font=`800 ${Math.round(H*0.66)}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('공구함 · 부품 떼기',W/2,H/2,W*0.94); });
    picks.push({Rm,kind:'strip',w:mul(Rm.M,pb.S),inv:mul(Rm.M,pb.S).invert(),box:new THREE.Box3(V3(1.8,0.9,0.18),V3(2.36,1.18,0.52)),noHl:true});
    sign(w.s,1.8,0.3,0,2.95,0.01,[['◀ 정비실',0.55,'#fff',900]],{bg:'#141518',glow:true});
    dressR3(Rm);
  }
  function buildR4(Rm){ const f=Rm.f0, w=Rm.w;
    const slat=rm(Rm,'slat',{map:T.slat,roughness:0.6}), wain=rm(Rm,'wain',{color:'#3b3d40',roughness:0.6});
    shell(Rm,{floor:rm(Rm,'floor',{map:T.vinyl,roughness:0.5}),ceil:rm(Rm,'ceil',{map:T.tiles,roughness:0.95}),wall:rm(Rm,'wall',{color:'#e7e2d6',roughness:0.85}),base:wain,baseH:0.9});
    const panel=basic(Rm,'panel',{color:new THREE.Color('#ffffff').multiplyScalar(1.7)}); for(const x of [-3,3]) for(const z of [-11,-7,-3]) B(f,x-0.6,3.285,z-0.6,x+0.6,3.3,z+0.6,panel);
    /* slatwall above the wainscot on three walls, rifles hanging in rows, a white price tag under each */
    const tagM=rm(Rm,'tag',{map:new THREE.CanvasTexture(canvas(64,32,(x,W,H)=>{ x.fillStyle='#f7f7f2'; x.fillRect(0,0,W,H); x.fillStyle='#333'; x.fillRect(8,9,W-22,3); x.fillRect(8,18,W-30,3); x.fillStyle='#b11'; x.fillRect(8,24,20,3); })),roughness:0.9});
    tagM.map.colorSpace=THREE.SRGBColorSpace;
    const walls=[['n',-3.6,5.6],['w',-2.8,6.6],['e',-6.6,2.8]];
    const rowsW={n:[['s90','sps12','ax12','ks14','usas'],['m16','k2','ak74','r416','scar'],['mk14','ranch14','sks','m1','lightsr']],
      w:[['striker','slug','db12','pump','autosg'],['m10','k7','ap9','sk61','wraith'],['ak47','m4','falcon','g36','famas']],
      e:[['ou','lever87','s90','ax12','usas'],['smg9','p50','microsmg','u45','mx7'],['scout','m24','svd','mk12','m110']]};
    let k=0;
    for(const [side,a,b] of walls){ const g=w[side]; B(g,a-0.15,0.9,0,b+0.15,3.05,0.02,slat); B(g,a-0.15,3.05,0,b+0.15,3.1,0.04,wain); B(g,a-0.15,0.86,0,b+0.15,0.92,0.05,wain);
      const n=Math.floor((b-a)/0.62)+1, sp=(b-a)/(n-1);
      for(let r=0;r<3;r++){ const list=rowsW[side][r]; for(let i=0;i<n;i++){ if(density<1&&i%3===2) continue; const id=list[Math.min(list.length-1,Math.floor(i*list.length/n))], s1=gsrc(id), x=a+i*sp, y=1.36+r*0.62, tilt=-0.2+((i*7+r*3)%5)*0.03;
        gun(g,id,mHang(s1,x,y,0.03+half(s1)+0.02,-1,tilt)); B(g,x-0.06,y-0.03,0.02,x-0.05,y+0.02,0.09,rm(Rm,'hook',{color:'#9aa0a6',roughness:0.3,metalness:1})); const t=plane(g,0.07,0.035,tagM,x+0.02,y-0.17,0.035,0,0); t.rotation.z=0.1; } }
      k++; }
    /* signs: rentals board with the three coloured bars, a red rule sign, a TV */
    const W_=w.n; B(W_,-5.75,0.9,0,-3.85,3.05,0.02,slat); lab(W_,1.6,0.95,-4.8,2.1,0.03,(c,W,H)=>{ c.fillStyle='#f7f6f1'; c.fillRect(0,0,W,H); c.fillStyle='#111'; c.font=`900 ${H*0.2}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('RIFLE RENTALS',W/2,H*0.16,W*0.92);
      c.font=`700 ${H*0.09}px ${FONT}`; c.fillText('소총 대여 · 사격장 이용',W/2,H*0.31);
      [['#c62020','1시간  ₩20,000'],['#e9c218','30분  ₩15,000'],['#1f8a3a','10발  ₩10,000']].forEach(([col,t],i)=>{ c.fillStyle=col; c.fillRect(W*0.08,H*(0.42+i*0.18),W*0.84,H*0.14); c.fillStyle=i===1?'#111':'#fff'; c.font=`900 ${H*0.1}px ${FONT}`; c.fillText(t,W/2,H*(0.49+i*0.18)); }); });
    sign(w.n,1.3,0.3,4.3,3.28-0.2,0.03,[['모든 총은 장전된 것으로 여기세요',0.34,'#fff',800]],{bg:'#a01818'});
    const tv=B(w.s,2.6,1.9,0,4.2,2.7,0.06,rm(Rm,'tvb',{color:'#0c0c0d',roughness:0.3,metalness:0.4})); lab(w.s,1.52,0.72,3.4,2.3,0.062,(c,W,H)=>{ const g=c.createLinearGradient(0,0,W,H); g.addColorStop(0,'#1a2433'); g.addColorStop(1,'#0b0e14'); c.fillStyle=g; c.fillRect(0,0,W,H);
      c.fillStyle='#ff8a1f'; c.font=`900 ${H*0.2}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('CODE-NAME',W/2,H*0.42); c.fillStyle='#cfd6e0'; c.font=`700 ${H*0.1}px ${FONT}`; c.fillText('총포상 · 오늘의 추천: 부품 세트',W/2,H*0.64); },{glow:true});
    /* glass counters: pistols on the left, optics and muzzle parts on the right */
    const cl=sub(f,-2.05,-7.6,H2), cr=sub(f,2.05,-7.6,-H2);
    counter(cl,-3.4,3.4,0); counter(cr,-3.4,3.4,0,{light:true});
    const pisF=['p17','p18c','usx','s226','m9','pk','makarov','tt33','f57','c96','mark22','k5'], pisB=['aps','peace','viper','m500','derr','deagle','revolver','p1912','burst9','auto75','p17','m9'];
    for(const [list,zz] of [[pisF,0.15],[pisB,-0.15]]) list.forEach((id,i)=>layGun(cl,id,-2.75+i*0.5,0.47,zz,0.25+(zz>0?0.1:0),true));
    const sc=['reddot','holo','x2','x3','x4','x6','x8','iron'], mz=['comp','flash','sup','brake','choke'];
    const card=(f2,x,z,t)=>lab(f2,0.26,0.05,x,0.473,z,(c,W,H)=>{ c.fillStyle='#fbfaf5'; c.fillRect(0,0,W,H); c.fillStyle='#1b1b1b'; c.font=`800 ${Math.round(H*0.62)}px ${FONT}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(t,W/2,H/2,W*0.94); },{rx:-H2+0.25});
    sc.forEach((op,i)=>{ const s1=psrc('scope',op), x=-3.05+i*0.62; for(const zz of [-0.2,-0.02]) part(cr,'scope',op,mul(mT(x,0.47-s1.box.min.y,zz),mY(H2+0.2))); card(cr,x,0.1,ATT.scope[op].name); });
    mz.forEach((op,i)=>{ const s1=psrc('muzzle',op), x=-2.8+i*1.2; for(const xx of [-0.12,0.12]) part(cr,'muzzle',op,mul(mT(x+xx,0.47+0.02,0.2),mY(0.3))); card(cr,x,0.29,ATT.muzzle[op].name); });
    sign(cl,1.2,0.12,0,0.3,0.345,[['권총',0.66,'#fff',800]],{bg:'#1d1e21'}); sign(cr,1.6,0.12,0,0.3,0.345,[['조준경 · 총구 부품',0.66,'#fff',800]],{bg:'#1d1e21'});
    /* melee pegboard by the door (left wall), a locked case of oddities (right) */
    const pg=sub(w.w,-4.6,0,0); B(pg,-1.0,1.0,0,1.0,2.6,0.025,rm(Rm,'peg',{map:T.peg,roughness:0.85}));
    const ax=gsrc('axe'), kn=gsrc('knife',true); for(let i=0;i<4;i++) gun(pg,'axe',mHang(ax,-0.75+i*0.5,2.05,0.03+half(ax),-1,-H2)); for(let i=0;i<8;i++) gun(pg,'knife',mHang(kn,-0.7+i*0.2,1.3,0.04,-1,H2),true);
    sign(pg,1.4,0.12,0,2.75,0.03,[['근접 무기',0.66,'#111',800]],{bg:'#f4f1e8'});
    const cs=sub(w.e,4.4,0,0), gl=rm(Rm,'glass',{color:'#dfeff2',roughness:0.06,transparent:true,opacity:0.08,depthWrite:false,env:0.7}), dk=rm(Rm,'ctr',{color:'#1d1e21',roughness:0.4,metalness:0.4});
    B(cs,-1.0,0,0,1.0,0.9,0.55,dk); B(cs,-1.0,0.9,0,1.0,2.4,0.02,dk); B(cs,-1.0,0.9,0.53,1.0,2.4,0.55,gl); B(cs,-1.0,2.4,0,1.0,2.46,0.55,dk); for(const x of [-1,1]) B(cs,x-0.02,0.9,0,x+0.02,2.4,0.55,dk);
    B(cs,-0.98,2.36,0.05,0.98,2.38,0.2,basic(Rm,'strip',{color:new THREE.Color('#fff4e0').multiplyScalar(0.95)})); for(const y of [1.45,1.95]) B(cs,-0.98,y-0.02,0.02,0.98,y,0.5,gl);
    gun(cs,'mrl',mHang(gsrc('mrl',true),-0.45,2.2,0.25,-1,0),true); gun(cs,'snowcan',mHang(gsrc('snowcan',true),0.45,2.2,0.25,-1,0),true);
    ['flare','taser','nail','paint'].forEach((id,i)=>layGun(cs,id,-0.72+i*0.48,1.95,0.27,0.3,true));
    const cbw=gsrc('crossbow',true); gun(cs,'crossbow',mul(mT(-0.5,1.45-cbw.box.min.y,0.27),mY(0.3)),true); layGun(cs,'harpoon',0.38,1.45,0.27,0,true);
    const shu=gsrc('shuriken',true); for(let i=0;i<4;i++) gun(cs,'shuriken',mul(mT(-0.75+i*0.16,0.92-shu.box.min.y,0.3),mY(i)),true); layGun(cs,'cbow',0.42,0.92,0.27,0,true);
    solid(cs,-1.05,0,1.05,0.6); shade(cs,-1.05,0,1.05,0.7,0.45,0.12); sign(cs,1.4,0.14,0,2.6,0.03,[['특수 화기',0.66,'#fff',800]],{bg:'#141518',glow:true});
    sign(w.s,1.8,0.3,0,2.85,0.01,[['◀ 정비실',0.55,'#fff',900]],{bg:'#141518',glow:true});
    dressR4(Rm);
  }
  /* ---------- finishing a room: instances, merged furniture, floor shade ---------- */
  function finish(Rm){
    /* label atlases */
    for(const [A,M] of [[Rm.labA,Rm.labM],[Rm.glowA,Rm.glowM]]){ const t=new THREE.CanvasTexture(packAtlas(A)); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; M.map=t; M.needsUpdate=true; }
    /* floor shade: walls darken the floor edge, furniture leaves soft patches */
    const d=Rm.d, W=d.x1-d.x0, D=d.z1-d.z0, ppm=24, c=canvas(Math.ceil(W*ppm),Math.ceil(D*ppm),(x,cw,ch)=>{ x.clearRect(0,0,cw,ch);
      const e=0.55*ppm, edge=(a,b,c2,d2,rx,ry,rw,rh)=>{ const g=x.createLinearGradient(a,b,c2,d2); g.addColorStop(0,'rgba(0,0,0,.42)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(rx,ry,rw,rh); };
      edge(0,0,0,e,0,0,cw,e); edge(0,ch,0,ch-e,0,ch-e,cw,e); edge(0,0,e,0,0,0,e,ch); edge(cw,0,cw-e,0,cw-e,0,e,ch);
      for(const s of Rm.shades){ const blur=Math.max(1,s[5]*ppm); try{ x.filter=`blur(${blur}px)`; }catch(_){} x.fillStyle=`rgba(0,0,0,${s[4]})`; x.fillRect((s[0]-d.x0)*ppm,(s[1]-d.z0)*ppm,(s[2]-s[0])*ppm,(s[3]-s[1])*ppm); } try{ x.filter='none'; }catch(_){} });
    const st=new THREE.CanvasTexture(c); const sm=new THREE.MeshBasicMaterial({color:'#000',map:st,transparent:true,depthWrite:false}); const sp=new THREE.Mesh(new THREE.PlaneGeometry(W,D),sm); sp.rotation.x=-H2; sp.position.set((d.x0+d.x1)/2,0.006,(d.z0+d.z1)/2); sp.renderOrder=1; Rm.g.add(sp);
    /* merge every static mesh of the room by material */
    Rm.g.updateMatrixWorld(true); const inv=Rm.g.matrixWorld.clone().invert(), by=new Map(), dead=[];
    Rm.g.traverse(o=>{ if(!o.isMesh||!o.userData.st||o.isInstancedMesh) return; let g=o.geometry.clone(); g.applyMatrix4(_m.multiplyMatrices(inv,o.matrixWorld)); if(g.index) g=g.toNonIndexed();
      for(const k of Object.keys(g.attributes)) if(!['position','normal','uv'].includes(k)) g.deleteAttribute(k); if(!g.attributes.uv) g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      if(!by.has(o.material)) by.set(o.material,[]); by.get(o.material).push(g); dead.push(o); });
    for(const o of dead){ o.parent.remove(o); o.geometry.dispose(); }
    for(const [mat,list] of by){ const m=new THREE.Mesh(list.length>1?THREE.mergeGeometries(list,false):list[0],mat); if(list.length>1) list.forEach(g=>g.dispose()); m.matrixAutoUpdate=false; if(mat.transparent) m.renderOrder=2; Rm.g.add(m); }
    /* one instanced mesh per (model, sub-mesh) in this room */
    const groups=new Map(); for(const p of PL) if(p.Rm===Rm){ if(!groups.has(p.s)) groups.set(p.s,[]); groups.get(p.s).push(p.m); }
    for(const [s,ms] of groups){ for(const sm2 of s.meshes){ const mat=instMat(Rm,sm2.mat); const im=new THREE.InstancedMesh(sm2.geo,mat,ms.length); ms.forEach((m,i)=>im.setMatrixAt(i,_m.multiplyMatrices(m,sm2.rel))); im.instanceMatrix.needsUpdate=true; im.computeBoundingSphere(); im.computeBoundingBox&&im.computeBoundingBox(); Rm.g.add(im); Rm.count+=ms.length; } }
    /* pieces for portal culling (world boxes; the room never moves) */
    Rm.g.updateMatrixWorld(true); Rm.parts=[]; for(const o of Rm.g.children){ if(!o.isMesh) continue; let b;
      if(o.isInstancedMesh){ if(!o.boundingBox) o.computeBoundingBox(); b=o.boundingBox.clone(); } else { if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b=o.geometry.boundingBox.clone(); }
      b.applyMatrix4(o.matrixWorld); const sz=b.getSize(_v); Rm.parts.push({o,box:b,big:Math.max(sz.x,sz.z)>8&&sz.y>2}); }
    /* cleanup of empty frame groups */
    const empty=[]; Rm.g.traverse(o=>{ if(o.isGroup&&o!==Rm.g&&!o.children.length&&!o.userData.keep) empty.push(o); }); empty.forEach(o=>o.parent&&o.parent.remove(o));
  }
  function instMat(Rm,src){ const k='inst|'+src.uuid; if(Rm.mats.has(k)) return Rm.mats.get(k); let m;
    if(src.vertexColors){ m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.46,metalness:0.42}); } else { m=src.clone(); }
    m.envMap=Rm.env; m.envMapIntensity=(src.vertexColors?1.15:1)*(Rm.d.genv||1); Rm.mats.set(k,m); return m; }
  /* ---------- build everything once ---------- */
  async function build(){ T=makeTex(); density=QUALITY.lite?0.6:1;
    scene=new THREE.Scene(); scene.background=new THREE.Color('#0b0c0e'); cam=new THREE.PerspectiveCamera(72,1,0.03,80); cam.rotation.order='YXZ';
    vmScene=new THREE.Scene(); vmCam=new THREE.PerspectiveCamera(56,1,0.01,10); vmScene.add(vmCam);
    vmScene.add(new THREE.HemisphereLight('#ffffff','#40362e',0.8)); const vl=new THREE.DirectionalLight('#ffffff',1.4); vl.position.set(0.4,1,0.5); vmScene.add(vl);
    dirLight=new THREE.DirectionalLight('#fff8ee',0.95); dirLight.position.set(3,10,2); scene.add(dirLight); scene.add(dirLight.target); scene.add(new THREE.HemisphereLight('#ffffff','#4a4038',0.28));
    hl=new THREE.Group(); scene.add(hl);
    rooms=[]; RM={}; solids=[]; picks=[]; PL.length=0; perkMarks=[]; await loadProps();
    let i=0; for(const d of DEF){ UI.loadPct(8+i*14); await new Promise(r=>setTimeout(r,0)); i++;
      const Rm={id:d.id,d,name:d.name,sub:d.sub,mats:new Map(),shades:[],count:0}; Rm.env=makeEnv(d);
      Rm.g=new THREE.Group(); Rm.g.position.set(d.ox,0,d.oz); Rm.g.rotation.y=d.rot; scene.add(Rm.g); Rm.g.updateMatrix(); Rm.M=Rm.g.matrix.clone();
      Rm.labA=atlas(); Rm.glowA=atlas(); Rm.labM=new THREE.MeshStandardMaterial({roughness:0.7,transparent:false}); Rm.labM.envMap=Rm.env; Rm.glowM=new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.6,1.6)});
      Rm.f0=F(Rm,0,0,0); Rm.w={}; rooms.push(Rm); RM[d.id]=Rm;
      ({hub:buildHub,r1:buildR1,r2:buildR2,r3:buildR3,r4:buildR4})[d.id](Rm);
      if(QUALITY.lights>0){ const L=new THREE.PointLight(d.light,d.li,Math.max(d.x1-d.x0,d.z1-d.z0)*0.95,1.2); const c=wpt(Rm,(d.x0+d.x1)/2,(d.z0+d.z1)/2); L.position.set(c[0],d.h-1.1,c[1]); scene.add(L); }
      /* world rectangle of the room, the doorway box (for "can I see into it") */
      const a=wpt(Rm,d.x0,d.z0), b=wpt(Rm,d.x1,d.z1); Rm.box={x0:Math.min(a[0],b[0]),z0:Math.min(a[1],b[1]),x1:Math.max(a[0],b[0]),z1:Math.max(a[1],b[1])};
      if(d.id!=='hub'){ const p=wpt(Rm,-1.1,-0.3), q=wpt(Rm,1.1,0.3); Rm.door=new THREE.Box3(V3(Math.min(p[0],q[0]),0,Math.min(p[1],q[1])),V3(Math.max(p[0],q[0]),2.7,Math.max(p[1],q[1]))); } }
    UI.loadPct(82); await new Promise(r=>setTimeout(r,0));
    for(const Rm of rooms) finish(Rm);
    UI.loadPct(92); await new Promise(r=>setTimeout(r,0));
    try{ const rt=new THREE.WebGLRenderTarget(4,4); const prev=R.renderer.getRenderTarget(); R.renderer.setRenderTarget(rt); if(R.renderer.compileAsync) await R.renderer.compileAsync(scene,cam); R.renderer.setRenderTarget(prev); rt.dispose(); }catch(e){}
    built=true; }
  /* ---------- the loadout shown on the workbench ---------- */
  function syncBench(){ if(!benchG) return; const L=prefs.loadout, k=[L.main,attKey(gunAtt(L.main)),L.side,attKey(gunAtt(L.side)),L.melee,L.thr,L.spec].join('|'); if(k===benchKey) return; benchKey=k;
    for(const o of benchG.children.slice()){ benchG.remove(o); }
    const env=RM.hub.env, add=(g,m)=>{ g.traverse(o=>{ if(o.isMesh){ o.material=instMat(RM.hub,o.material); } }); g.matrixAutoUpdate=false; g.matrix.copy(m); benchG.add(g); };
    const lay=(id,att,x,z,yaw)=>{ if(!id||!(WPN[id]||TH[id]||SP[id])) return; const g=id==='fists'?gloves():Guns.tp(id,att,true); const b=new THREE.Box3().setFromObject(g); add(g,mFlat({box:b},x,0.92,z,yaw,-1)); };
    lay(L.main,gunAtt(L.main),-0.2,-0.18,0); lay(L.side,gunAtt(L.side),-0.55,0.24,0.1); lay(L.melee,null,0.35,0.26,-0.2);
    for(const [id,x] of [[L.thr,0.75],[L.spec,0.95]]){ if(!id) continue; const g=Guns.tp(id,null,true), b=new THREE.Box3().setFromObject(g); add(g,mul(mT(x,0.92-b.min.y,0.3),mY(0.4))); }
    for(let i=0;i<2;i++){ const id=L.perks[i], P2=perkMarks[i], pk=picks.find(p=>p.kind==='perk'&&p.id===id); if(!P2) continue; if(pk){ const e=new THREE.Matrix4().multiplyMatrices(RM.hub.M.clone().invert(),pk.w); P2.m.matrixAutoUpdate=false; P2.m.matrix.copy(e).multiply(mT(0.17,0.17,0.02)); P2.m.visible=true; if(P2.m.parent!==RM.hub.g){ P2.m.parent&&P2.m.parent.remove(P2.m); RM.hub.g.add(P2.m); } } else P2.m.visible=false; } }
  const gunAtt=id=>attClean(id,prefs.gunAtt[id]);
  /* ---------- first-person hands ---------- */
  function heldId(){ const L=prefs.loadout; return hand==='melee'?L.melee:L[hand]; }
  function setVM(force){ const id=heldId(), att=hand==='melee'?null:gunAtt(id), look=prefs.char?1:0, k=id+'|'+attKey(att)+'|'+look; if(k===vmKey&&!force) return; vmKey=k;
    if(vm){ vmCam.remove(vm.group); vm.group.traverse(o=>{ if(o.isMesh) o.geometry.dispose(); }); vm=null; }
    try{ vm=Guns.viewmodel(id,att,look); vmCam.add(vm.group); vm.group.position.set(Guns.HIP.x,Guns.HIP.y-0.3,Guns.HIP.z); raise=1; }catch(e){ console.warn(e); } }
  /* ---------- picking what the crosshair is on ---------- */
  function roomAt(x,z){ for(const Rm of rooms){ if(Rm.id==='hub') continue; const b=Rm.box; if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1) return Rm; } return RM.hub; }
  function findAim(){ cam.getWorldDirection(_v2); const o=cam.position; let best=null, bd=REACH;
    for(const p of picks){ if(p.Rm.id!==cur) continue; _ray.origin.copy(o); _ray.direction.copy(_v2); _ray.applyMatrix4(p.inv); const hit=_ray.intersectBox(p.box,_v); if(!hit) continue;
      const d=_v.applyMatrix4(p.w).distanceTo(o); if(d<bd){ bd=d; best=p; } }
    if(best!==aim){ aim=best; setHL(); } }
  const hlMat=new THREE.MeshBasicMaterial({color:'#ff9a3c',transparent:true,opacity:0.32,depthWrite:false,blending:THREE.AdditiveBlending});
  function setHL(){ while(hl.children.length) hl.remove(hl.children[0]); if(!aim||aim.noHl) return;
    if(aim.kind==='perk'){ const m=new THREE.Mesh(new THREE.PlaneGeometry(aim.plate[0]+0.04,aim.plate[1]+0.04),hlMat); m.matrixAutoUpdate=false; m.matrix.copy(aim.w).multiply(mT(0,0,0.006)); hl.add(m); return; }
    for(const sm of aim.s.meshes){ const m=new THREE.Mesh(sm.geo,hlMat); m.matrixAutoUpdate=false; m.matrix.multiplyMatrices(aim.w,sm.rel); hl.add(m); } }
  /* what pressing use on it would do (prompt) */
  function promptOf(p){ const L=prefs.loadout; if(!p) return '';
    switch(p.kind){
      case 'gun':{ const slot=hand==='side'?'side':'main', w=WPN[p.id]; if(L[slot]===p.id) return `${w.name} · 이미 ${slot==='main'?'1번':'2번'} 총기예요`; return `${w.name} 들기 → ${slot==='main'?'1번':'2번'} 총기`; }
      case 'melee': return L.melee===p.id?`${WPN[p.id].name} · 이미 근접 무기예요`:`${WPN[p.id].name} 들기 → 근접 무기`;
      case 'thr': return L.thr===p.id?`${TH[p.id].name} · 이미 투척 무기예요`:`${TH[p.id].name} 챙기기 → 투척`;
      case 'spec': return L.spec===p.id?`${SP[p.id].name} · 이미 특수 장비예요`:`${SP[p.id].name} 챙기기 → 특수 장비`;
      case 'part':{ const id=heldId(), w=WPN[id], nm=ATT[p.slot][p.opt].name; if(hand==='melee'||!w||!w.att) return `${nm} · 총을 들어야 달 수 있어요`;
        if(!(w.att[p.slot]||[]).includes(p.opt)) return `${nm} · ${w.name}에는 안 맞아요`; return gunAtt(id)[p.slot]===p.opt?`${nm} · 이미 달려 있어요`:`${nm} 달기 → ${w.name}`; }
      case 'perk': return L.perks.includes(p.id)?`${PERKS[p.id].name} · 이미 단 퍼크예요`:`${PERKS[p.id].name} 달기 → 퍼크 ${L.perks.indexOf(oldPerk())+1}번 자리`;
      case 'bench': return '세부 설정 화면 열기 (퍼크 · 부품 목록)';
      case 'strip':{ const id=heldId(), w=WPN[id]; return w&&w.att&&hand!=='melee'?`공구함: ${w.name}의 부품 모두 떼기`:'공구함: 총을 들고 오세요'; }
      case 'exit': return '무기고 나가기';
    } return ''; }
  let perkAge=[0,0];
  const oldPerk=()=>{ const L=prefs.loadout; return L.perks[perkAge[0]<=perkAge[1]?0:1]; };
  function use(p){ const L=prefs.loadout; if(!p) return; let msg=null, ok=true;
    switch(p.kind){
      case 'gun':{ const slot=hand==='side'?'side':'main', other=slot==='main'?'side':'main'; if(L[slot]===p.id){ ok=false; break; } const was=L[slot];
        if(L[other]===p.id){ L[other]=was; msg=`${WPN[p.id].name} ↔ ${WPN[was].name} 자리 바꿈`; } else msg=`${slot==='main'?'1번':'2번'} 총기: ${WPN[was]?WPN[was].name:'-'} → ${WPN[p.id].name}`;
        L[slot]=p.id; hand=slot; Sfx.play(WPN[p.id].cat==='pistol'?'reload_pistol':'reload_rifle',{vol:0.6}); break; }
      case 'melee': if(L.melee===p.id){ ok=false; break; } msg=`근접 무기: ${WPN[L.melee]?WPN[L.melee].name:'-'} → ${WPN[p.id].name}`; L.melee=p.id; hand='melee'; Sfx.play('switch_02',{vol:0.6}); break;
      case 'thr': if(L.thr===p.id){ ok=false; break; } msg=`투척: ${TH[L.thr]?TH[L.thr].name:'-'} → ${TH[p.id].name}`; L.thr=p.id; Sfx.play('metal_04',{vol:0.5}); break;
      case 'spec': if(L.spec===p.id){ ok=false; break; } msg=`특수 장비: ${SP[L.spec]?SP[L.spec].name:'-'} → ${SP[p.id].name}`; L.spec=p.id; Sfx.play('tools_03',{vol:0.5}); break;
      case 'part':{ const id=heldId(), w=WPN[id]; if(hand==='melee'||!w||!w.att){ ok=false; msg='총을 손에 들어야 부품을 달 수 있어요'; break; }
        if(!(w.att[p.slot]||[]).includes(p.opt)){ ok=false; msg=`${ATT[p.slot][p.opt].name}은(는) ${w.name}에 안 맞아요`; break; }
        const A=gunAtt(id); if(A[p.slot]===p.opt){ ok=false; break; } A[p.slot]=p.opt; prefs.gunAtt[id]=A; msg=`${w.name}: ${ATT_SLOT_NAMES[p.slot]} → ${ATT[p.slot][p.opt].name}`; Sfx.play('reload_rifle',{vol:0.45,rate:1.3}); break; }
      case 'perk':{ if(L.perks.includes(p.id)){ ok=false; break; } const i=perkAge[0]<=perkAge[1]?0:1; msg=`퍼크 ${i+1}: ${PERKS[L.perks[i]]?PERKS[L.perks[i]].name:'-'} → ${PERKS[p.id].name}`; L.perks[i]=p.id; perkAge[i]=Math.max(perkAge[0],perkAge[1])+1; Sfx.play('collect',{vol:0.5}); break; }
      case 'bench': openClassic(); return;
      case 'strip':{ const id=heldId(), w=WPN[id]; if(hand==='melee'||!w||!w.att){ ok=false; msg='총을 손에 들고 오세요'; break; } delete prefs.gunAtt[id]; msg=`${w.name}: 부품을 모두 떼고 기본형으로`; Sfx.play('tools_03',{vol:0.6}); break; }
      case 'exit': exit(); return;
    }
    if(!ok){ Sfx.play('deny',{vol:0.4}); if(msg) toast(msg); return; } savePrefs(); toast(msg); setVM(); syncBench(); renderLoad(); setHL(); }
  /* ---------- HUD ---------- */
  const H={}; let hudBound=false;
  function bindHud(){ if(hudBound) return; hudBound=true; for(const k of ['arRoom','arPrompt','arInfo','arLoad','arToast','arMenu','arHelp','arClickHint']) H[k]=$(k);
    $('arGo').onclick=()=>{ Sfx.unlock(); closeMenu(); }; $('arClassic').onclick=()=>openClassic(); $('arExit').onclick=()=>exit(); $('arMenuBtn').onclick=()=>openMenu();
    document.querySelectorAll('#arSlots button').forEach(b=>b.onclick=()=>{ hand=b.dataset.h; setVM(); renderLoad(); });
    const ub=$('arUse'); ub.addEventListener('touchstart',e=>{ e.preventDefault(); use(aim); },{passive:false}); ub.onclick=()=>use(aim);
    /* touch: left half moves (floating stick), right half looks */
    const zone=$('arTouch'); let jid=null, lid=null, jx=0, jy=0, lx=0, ly=0; const joy=$('arJoy'), kn=joy.querySelector('i');
    zone.addEventListener('touchstart',e=>{ if(menuOn) return; for(const t of e.changedTouches){ if(t.target.closest('button')) continue; e.preventDefault();
      if(t.clientX<innerWidth*0.45&&jid==null){ jid=t.identifier; jx=t.clientX; jy=t.clientY; joy.style.left=(jx-60)+'px'; joy.style.top=(jy-60)+'px'; joy.classList.add('on'); } else if(lid==null){ lid=t.identifier; lx=t.clientX; ly=t.clientY; } } },{passive:false});
    zone.addEventListener('touchmove',e=>{ for(const t of e.changedTouches){ if(t.identifier===jid){ let dx=(t.clientX-jx)/55, dy=(t.clientY-jy)/55; const l=Math.hypot(dx,dy); if(l>1){ dx/=l; dy/=l; } TC.mx=dx; TC.mz=dy; kn.style.transform=`translate(${dx*36}px,${dy*36}px)`; }
      else if(t.identifier===lid){ TC.lx+=(t.clientX-lx)*0.0055*(prefs.sens||1); TC.ly+=(t.clientY-ly)*0.0055*(prefs.sens||1)*(prefs.invertY?-1:1); lx=t.clientX; ly=t.clientY; } } e.preventDefault(); },{passive:false});
    const end=e=>{ for(const t of e.changedTouches){ if(t.identifier===jid){ jid=null; TC.mx=TC.mz=0; kn.style.transform=''; joy.classList.remove('on'); } if(t.identifier===lid) lid=null; } };
    zone.addEventListener('touchend',end); zone.addEventListener('touchcancel',end);
    /* a click on the bare view captures the mouse */
    $('scr-armory').addEventListener('mousedown',e=>{ if(!on||menuOn||touchMode()||Input.locked) return; if(e.target.closest('button')) return; Input.requestLock(); });
    Bus.on('lock',locked=>{ if(!on) return; if(locked){ closeMenu(true); } else if(!menuOn&&!touchMode()) openMenu(); });
    Bus.on('binds',()=>{ if(on) helpText(); }); }
  const TC={mx:0,mz:0,lx:0,ly:0};
  const touchMode=()=>document.body.classList.contains('touch');
  function helpText(){ const k=Input.keyLabel; H.arHelp.innerHTML=touchMode()?
    `<span><b>왼쪽 끌기</b> 걷기</span><span><b>오른쪽 끌기</b> 둘러보기</span><span><b>집기</b> 무기·부품 고르기</span><span><b>1 2 3</b> 손에 들 칸</span>`:
    `<span><b>${esc(k('fwd'))}${esc(k('left'))}${esc(k('back'))}${esc(k('right'))}</b> 걷기</span><span><b>${esc(k('use'))} · 좌클릭</b> 집기 · 달기</span><span><b>${esc(k('w1'))} ${esc(k('w2'))} ${esc(k('w3'))}</b> 손에 들 칸</span><span><b>${esc(k('inspect'))}</b> 살펴보기</span><span><b>Esc</b> 메뉴</span>`; }
  function openMenu(){ menuOn=true; H.arMenu.classList.add('on'); Input.exitLock(); helpText(); }
  function closeMenu(fromLock){ if(!menuOn&&fromLock) return; menuOn=false; H.arMenu.classList.remove('on'); $('arGo').textContent='계속 둘러보기'; if(!fromLock&&!touchMode()) Input.requestLock(); }
  function toast(m){ if(!m) return; H.arToast.textContent=m; H.arToast.classList.add('on'); toastT=2.4; }
  function renderLoad(){ const L=prefs.loadout, n=id=>WPN[id]?WPN[id].name:'-', A=id=>{ const a=gunAtt(id); if(!a) return ''; const list=ATT_SLOTS.filter(k=>WPN[id].att[k]&&a[k]!==WPN[id].att[k][0]).map(k=>ATT[k][a[k]].name); return list.length?`<em>${esc(list.join(' · '))}</em>`:''; };
    H.arLoad.innerHTML=`<div class="${hand==='main'?'on':''}"><small>1번</small><b>${esc(n(L.main))}</b>${A(L.main)}</div><div class="${hand==='side'?'on':''}"><small>2번</small><b>${esc(n(L.side))}</b>${A(L.side)}</div><div class="${hand==='melee'?'on':''}"><small>근접</small><b>${esc(n(L.melee))}</b></div>`+
      `<div><small>투척</small><b>${esc(TH[L.thr]?TH[L.thr].name:'-')}</b></div><div><small>특수</small><b>${esc(SP[L.spec]?SP[L.spec].name:'-')}</b></div><div><small>퍼크</small><b>${esc(L.perks.map(p=>PERKS[p]?PERKS[p].name:'-').join(' · '))}</b></div>`;
    document.querySelectorAll('#arSlots button').forEach(b=>b.classList.toggle('on',b.dataset.h===hand)); }
  function bar(n,v,t){ return `<div class="st"><span>${n}<b>${t}</b></span><i><b style="width:${Math.round(clamp(v,0,1)*100)}%"></b></i></div>`; }
  function infoOf(p){ if(!p) return ''; let h='';
    if(p.kind==='gun'||p.kind==='melee'){ const w=p.kind==='gun'?wpnWith(p.id,gunAtt(p.id)):WPN[p.id]; if(!w) return ''; h=`<h3>${esc(w.name)}</h3><p>${esc(CATS[w.cat]||'')} · ${esc(w.desc||'')}</p>`;
      if(w.mode==='melee') h+=bar('피해',w.dmg/100,w.dmg)+bar('공격 속도',0.4/w.rate,(1/w.rate).toFixed(1)+'/초');
      else h+=bar('피해',w.dmg*w.pellets/110,w.dmg+(w.pellets>1?'×'+w.pellets:''))+bar('연사력',w.rpm/1250,w.rpm+' RPM')+bar('사거리',w.far/150,Math.round(w.range)+'~'+Math.round(w.far)+'m')+bar('탄창',w.mag/100,w.mag+'발');
      if(p.kind==='gun'&&gunAtt(p.id)&&ATT_SLOTS.some(k=>gunAtt(p.id)[k]!==w.att[k][0])) h+=`<p class="note">내가 단 부품이 반영된 수치예요</p>`; }
    else if(p.kind==='part'){ const a=ATT[p.slot][p.opt], id=heldId(), w=WPN[id]; h=`<h3>${esc(a.name)}</h3><p>${esc(ATT_SLOT_NAMES[p.slot])} · ${esc(a.desc)}</p>`;
      if(hand!=='melee'&&w&&w.att) h+=(w.att[p.slot]||[]).includes(p.opt)?`<p class="ok">${esc(w.name)}에 달 수 있어요</p>`:`<p class="no">${esc(w.name)}에는 안 맞아요</p>`; }
    else if(p.kind==='thr') h=`<h3>${esc(TH[p.id].name)}</h3><p>투척 · ${TH[p.id].count}개 · ${esc(TH[p.id].desc)}</p>`;
    else if(p.kind==='spec') h=`<h3>${esc(SP[p.id].name)}</h3><p>특수 장비 · ${esc(SP[p.id].desc)}</p>`;
    else if(p.kind==='perk') h=`<h3>${esc(PERKS[p.id].name)}</h3><p>퍼크 · ${esc(PERKS[p.id].desc)}</p>`;
    return h; }
  let lastAimKey=null;
  function hud(dt){ const Rm=RM[cur]; if(H.arRoom.dataset.r!==cur){ H.arRoom.dataset.r=cur; H.arRoom.innerHTML=`<small>무기고</small><b>${esc(Rm.name)}</b><span>${esc(Rm.sub)}</span>`; }
    const key=aim?aim.kind+(aim.id||'')+(aim.slot||'')+(aim.opt||'')+'|'+hand+'|'+benchKey+'|'+JSON.stringify(prefs.loadout.perks):'';
    if(key!==lastAimKey){ lastAimKey=key; const t=promptOf(aim); H.arPrompt.innerHTML=t?`<kbd>${touchMode()?'집기':esc(Input.keyLabel('use'))}</kbd>${esc(t)}`:''; H.arPrompt.classList.toggle('on',!!t); const inf=infoOf(aim); H.arInfo.innerHTML=inf; H.arInfo.classList.toggle('on',!!inf); }
    if(toastT>0){ toastT-=dt; if(toastT<=0) H.arToast.classList.remove('on'); } }
  /* ---------- moving ---------- */
  function collide(){ for(let it=0;it<2;it++) for(const s of solids){ if(P.x+RAD<s.x0||P.x-RAD>s.x1||P.z+RAD<s.z0||P.z-RAD>s.z1) continue;
      const cx=clamp(P.x,s.x0,s.x1), cz=clamp(P.z,s.z0,s.z1); let dx=P.x-cx, dz=P.z-cz, d=Math.hypot(dx,dz);
      if(d<1e-6){ const l=P.x-s.x0, r=s.x1-P.x, t=P.z-s.z0, b=s.z1-P.z, m=Math.min(l,r,t,b); if(m===l) P.x=s.x0-RAD; else if(m===r) P.x=s.x1+RAD; else if(m===t) P.z=s.z0-RAD; else P.z=s.z1+RAD; continue; }
      if(d<RAD){ P.x=cx+dx/d*RAD; P.z=cz+dz/d*RAD; } } }
  function step(dt,I){ const mx=clamp(I.mx+TC.mx,-1,1), mz=clamp(I.mz+TC.mz,-1,1);
    P.yaw-=I.lookX+TC.lx; P.pitch=clamp(P.pitch-I.lookY-TC.ly,-1.45,1.45); TC.lx=TC.ly=0;
    const sp=(I.walk?1.9:4.2), s=Math.sin(P.yaw), c=Math.cos(P.yaw); const tx=(mx*c+mz*s)*sp, tz=(-mx*s+mz*c)*sp; const k=Math.min(1,dt*10); P.vx+= (tx-P.vx)*k; P.vz+=(tz-P.vz)*k;
    P.x+=P.vx*dt; P.z+=P.vz*dt; collide(); const v=Math.hypot(P.vx,P.vz); P.bob+=dt*v*1.6;
    if(v>1){ P.step-=dt*v; if(P.step<0){ P.step=1.6; Sfx.play('step'+(1+((Math.random()*6)|0)),{vol:0.18,rate:1+Math.random()*0.1}); } }
    const Rm=roomAt(P.x,P.z); if(Rm.id!==cur){ cur=Rm.id; vmScene.environment=Rm.env; } }
  function updVM(dt,I){ if(!vm) return; const g=vm.group, HP=Guns.HIP; raise=Math.max(0,raise-dt*3.2); insp=lerp(insp,I&&I.inspectHeld?1:0,Math.min(1,dt*6));
    const v=Math.hypot(P.vx,P.vz), bob=Math.sin(P.bob*2)*0.008*Math.min(1,v/4), bx=Math.cos(P.bob)*0.006*Math.min(1,v/4);
    const tx=HP.x+0.03+bx-insp*0.06, ty=HP.y-0.035+bob-raise*raise*0.25+insp*0.03, tz=HP.z-0.06+insp*0.05; g.position.x=lerp(g.position.x,tx,Math.min(1,dt*14)); g.position.y=lerp(g.position.y,ty,Math.min(1,dt*14)); g.position.z=lerp(g.position.z,tz,Math.min(1,dt*14));
    g.rotation.set(lerp(g.rotation.x,raise*0.6+insp*0.25,Math.min(1,dt*10)),lerp(g.rotation.y,(HP.ry||0)+insp*0.9,Math.min(1,dt*10)),lerp(g.rotation.z,insp*0.35,Math.min(1,dt*10))); }
  /* rooms you cannot see into are not drawn */
  /* portal culling: a room seen through a doorway draws only the pieces that show through that doorway (screen rectangles) */
  const _p4=new THREE.Vector4(), FULL=[-1,-1,1,1];
  function rectOf(b){ let x0=2,y0=2,x1=-2,y1=-2,behind=0; for(let i=0;i<8;i++){ _p4.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z,1).applyMatrix4(cam.matrixWorldInverse);
      if(_p4.z>-cam.near){ behind++; continue; } _p4.applyMatrix4(cam.projectionMatrix); const x=_p4.x/_p4.w, y=_p4.y/_p4.w; if(x<x0) x0=x; if(x>x1) x1=x; if(y<y0) y0=y; if(y>y1) y1=y; }
    if(behind===8) return null; if(behind) return FULL; if(x1<-1||x0>1||y1<-1||y0>1) return null; return [Math.max(x0,-1),Math.max(y0,-1),Math.min(x1,1),Math.min(y1,1)]; }
  const isect=(a,b)=>{ if(!a||!b) return null; const r=[Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])]; return r[0]<r[2]&&r[1]<r[3]?r:null; };
  function cullRoom(Rm,win){ if(!Rm.parts) return; if(!win){ if(Rm.culled){ for(const p of Rm.parts) p.o.visible=true; Rm.culled=false; } return; } Rm.culled=true;
    for(const p of Rm.parts) p.o.visible=p.big||!!isect(rectOf(p.box),win); }
  function vis(){ cam.updateMatrixWorld(); _fr.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
    const c=RM[cur], dr={}; for(const Rm of rooms) if(Rm.door) dr[Rm.id]=_fr.intersectsBox(Rm.door)?rectOf(Rm.door):null;
    for(const Rm of rooms){ let win=null;
      if(Rm===c) win=FULL; else if(c.id==='hub') win=dr[Rm.id]; else if(Rm.id==='hub') win=dr[c.id]; else win=isect(dr[c.id],dr[Rm.id]);
      Rm.g.visible=!!win; if(win) cullRoom(Rm,Rm===c?null:win); } }
  /* ---------- drawing ---------- */
  function composer(){ const s=R.renderer.getDrawingBufferSize(new THREE.Vector2()), k=s.x+'x'+s.y; if(comp&&k===lastSize) return; if(comp) comp.dispose(); comp=null; lastSize=k; if(!QUALITY.post&&QUALITY.lite) return;
    const rt=new THREE.WebGLRenderTarget(s.x,s.y,{type:THREE.HalfFloatType,samples:QUALITY.lite?0:4}); comp=new THREE.EffectComposer(R.renderer,rt); comp.setPixelRatio(1); comp.setSize(s.x,s.y);
    comp.addPass(new THREE.RenderPass(scene,cam)); const vp=new THREE.RenderPass(vmScene,vmCam); vp.clear=false; vp.clearDepth=true; comp.addPass(vp);
    if(QUALITY.bloom&&prefs.glow!==0){ const b=new THREE.UnrealBloomPass(new THREE.Vector2(s.x>>1,s.y>>1),0.2,0.3,0.97); const bs=b.setSize.bind(b); b.setSize=(w,h)=>bs(Math.max(1,w>>1),Math.max(1,h>>1)); comp.addPass(b); }
    comp.addPass(new THREE.OutputPass()); }
  function draw(){ const cv=R.renderer.domElement, sk=cv.clientWidth+'x'+cv.clientHeight; if(sk!==szKey){ szKey=sk; R.resize(); } composer();
    const W=cv.clientWidth||innerWidth, Hh=cv.clientHeight||innerHeight; if(Math.abs(cam.aspect-W/Hh)>1e-3){ cam.aspect=W/Hh; cam.updateProjectionMatrix(); vmCam.aspect=W/Hh; vmCam.updateProjectionMatrix(); }
    const fov=Math.min(80,2*Math.atan(Math.tan((prefs.hfov||100)*PI/360)/Math.max(0.5,W/Hh))*180/PI)*0.92; if(Math.abs(cam.fov-fov)>0.01){ cam.fov=fov; cam.updateProjectionMatrix(); }
    cam.position.set(P.x,EYE+Math.sin(P.bob*2)*0.02*Math.min(1,Math.hypot(P.vx,P.vz)/4),P.z); cam.rotation.set(P.pitch,P.yaw,0);
    vis(); hlMat.opacity=0.22+Math.sin(performance.now()/180)*0.08;
    const r=R.renderer, ex=r.toneMappingExposure, sh=r.shadowMap.enabled; r.toneMappingExposure=1.0; r.shadowMap.enabled=false;
    if(comp) comp.render(); else { r.autoClear=true; r.render(scene,cam); r.autoClear=false; r.clearDepth(); r.render(vmScene,vmCam); r.autoClear=true; }
    r.toneMappingExposure=ex; r.shadowMap.enabled=sh; }
  function frame(now){ raf=0; if(!on) return; raf=requestAnimationFrame(frame); const dt=Math.min(0.05,Math.max(0.001,(now-last)/1000)); last=now; if(document.hidden) return;
    const I=Input.sample(); const active=!menuOn;
    if(active){ step(dt,I); findAim();
      const fire=!!I.fire; if((I.useHit||(fire&&!firePrev))&&aim) use(aim); firePrev=fire;
      if(I.w1){ hand='main'; setVM(); renderLoad(); } if(I.w2){ hand='side'; setVM(); renderLoad(); } if(I.w3){ hand='melee'; setVM(); renderLoad(); }
      if(I.swap){ hand=hand==='main'?'side':'main'; setVM(); renderLoad(); } if(I.wheel){ const o=['main','side','melee']; hand=o[(o.indexOf(hand)+I.wheel+3)%3]; setVM(); renderLoad(); }
      if(I.inspect) insp2=!insp2; }
    updVM(dt,{inspectHeld:insp2}); hud(dt); draw(); }
  let insp2=false;
  /* ---------- open / close ---------- */
  async function open(){ if(on) return; on=true; document.body.classList.add('armoryview'); bindHud();
    if(!built){ if(!building){ building=(async()=>{ UI.showLoading(true,'무기고 여는 중…'); UI.loadPct(4); try{ await build(); } finally{ UI.showLoading(false); building=null; } })(); }
      try{ await building; }catch(e){ console.error('armory',e); on=false; document.body.classList.remove('armoryview'); UI.toast('무기고를 열 수 없어서 목록 화면으로 열어요'); UI.show('loadout',false); return; } }
    if(!on) return;
    Input.setEnabled(true); hand=hand||'main'; cur=roomAt(P.x,P.z).id; vmScene.environment=RM[cur].env; setVM(true); syncBench(); renderLoad(); helpText(); lastAimKey=null;
    menuOn=false; if(touchMode()){ H.arMenu.classList.remove('on'); } else openMenu();
    last=performance.now(); if(!raf) raf=requestAnimationFrame(frame); }
  function close(){ if(!on) return; on=false; cancelAnimationFrame(raf); raf=0; Input.exitLock(); Input.setEnabled(false); document.body.classList.remove('armoryview'); if(comp){ comp.dispose(); comp=null; lastSize=''; } szKey=''; menuOn=false; if(H.arMenu) H.arMenu.classList.remove('on'); }
  function openClassic(){ Input.exitLock(); UI.show('loadout'); }
  function exit(){ Input.exitLock(); UI.show('main',false); }
  /* frees the GPU memory (a match is starting); the next visit builds it again */
  function free(){ if(!built||on) return; hl.clear(); if(benchG) benchG.clear(); for(const P2 of perkMarks) P2.m.geometry.dispose(); scene.traverse(o=>{ if(o.geometry&&!o.isInstancedMesh) o.geometry.dispose(); if(o.material){ const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>{ for(const k of ['map','alphaMap']) if(m[k]&&m[k].isCanvasTexture) m[k].dispose(); m.dispose(); }); } });
    for(const Rm of rooms){ Rm.env.dispose(); } for(const s of SRC.values()) if(s.key.startsWith('p|')) {} SRC.clear(); if(vm){ vm.group.traverse(o=>{ if(o.isMesh) o.geometry.dispose(); }); vm=null; vmKey=''; } benchKey=''; benchG=null; built=false; scene=null; }
  return {open,close,free,get on(){return on;},get built(){return built;},
    /* tests */ _st:()=>({P,cur,aim:aim&&{kind:aim.kind,id:aim.id,slot:aim.slot,opt:aim.opt},hand,rooms:rooms.map(r=>[r.id,r.count,r.g.visible]),picks:picks.length,solids:solids.length}),
    _tp:(x,z,yaw,pitch)=>{ P.x=x; P.z=z; P.vx=P.vz=0; if(yaw!=null) P.yaw=yaw; if(pitch!=null) P.pitch=pitch; const Rm=roomAt(x,z); cur=Rm.id; if(vmScene) vmScene.environment=Rm.env; }, _use:()=>use(aim), _menu:v=>v?openMenu():closeMenu(true),
    _sim:(mx,mz,secs,yaw)=>{ if(yaw!=null) P.yaw=yaw; for(let t=0;t<secs;t+=1/60) step(1/60,{mx,mz,lookX:0,lookY:0,walk:false}); return {x:+P.x.toFixed(2),z:+P.z.toFixed(2),cur}; },
    _aimAt:(kind,id,n,dist)=>{ const list=picks.filter(p=>p.kind===kind&&(id==null||p.id===id||p.opt===id)); const p=list[Math.min(list.length-1,n||0)]; if(!p) return null;
      const c=p.box.getCenter(new THREE.Vector3()).applyMatrix4(p.w), rc=new THREE.Vector3((p.Rm.box.x0+p.Rm.box.x1)/2,0,(p.Rm.box.z0+p.Rm.box.z1)/2); const d=new THREE.Vector3(rc.x-c.x,0,rc.z-c.z).normalize();
      /* step back from the thing along the way into its room, keep out of furniture */ P.x=c.x+d.x*(dist||1.3); P.z=c.z+d.z*(dist||1.3); collide(); cur=roomAt(P.x,P.z).id; vmScene.environment=RM[cur].env;
      P.yaw=Math.atan2(-(c.x-P.x),-(c.z-P.z)); P.pitch=Math.atan2(c.y-EYE,Math.hypot(c.x-P.x,c.z-P.z)); P.vx=P.vz=0; return [c.x,c.y,c.z,P.x,P.z]; }};
})();
