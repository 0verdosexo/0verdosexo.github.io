/* core.js — map-independent engine: cell grid (cliffs/outer walls with heights), boxes and ramps (buildings, props),
   destructible objects, runtime deployables, ladders, smoke, 3D collision & rays, and a multi-level nav graph (2 m grid).
   setMapData(def,{mode}) installs a map; everything else reads the globals below. */
'use strict';
const CELL=4, NS=2;                       // map cell size (m), navigation sample size (m)
const RAD=0.42, PH=1.75, PH_SLIDE=0.85, STEP=0.55, GRAV=24, JUMP_V=7.7, CLIMB_V=4.5;
let MAP=null, W=0, H=0, G=new Uint8Array(0), WH=new Float32Array(0), LOWB=[], RAMPS=[], BOXES=[], ZONES=[], FLOORPAINT=[], DOOR=null, PORTALS=[],
    SPAWN_RUN=null, SPAWN_SEEK=null, ORBC=null, SOL=[], CS=[], NODES=[], CELLN=[], NW=0, NH=0, MAP_WARNINGS=[], BATTLE={}, LADDERS=[], GEN=null, MAP_MODE=null;
const OBJS=new Map();
let PK=null;                     // destructible objects by id
const SMOKES=[];
let OBJ_SEQ=1;

/* ---------- auto-fill: dress the empty outdoor ground with themed cover (containers, vehicles, stacks...) ----------
   Deterministic per map (seeded), so every client builds the same layout. Each cluster keeps a free ring around it,
   so nothing can ever seal a path; entrances, spawns, objectives, orbs, ladders and ramps are kept clear. */
const AF_TYPES={ // footprint length (x) × depth (z), collision height, and sub-boxes for stacks
  cont:{l:6.1,d:2.5,h:2.6}, cont2:{l:6.1,d:2.5,h:5.2}, contL:{l:6.1,d:5.6,h:2.6},
  sedan:{l:4.5,d:1.9,h:1.45}, van:{l:5.2,d:2.1,h:2.2}, pickup:{l:5.2,d:2.0,h:1.75}, truck:{l:7.4,d:2.5,h:3.1},
  pipes:{l:2.6,d:2.9,h:2.3}, bags:{l:1.3,d:1.1,h:1.3}, bags2:{l:2.9,d:1.1,h:1.3}, spool:{l:1.9,d:1.2,h:1.9}, dumpster:{l:2.4,d:1.4,h:1.5},
  jersey:{l:6.2,d:0.7,h:1.05}, crates:{l:2.2,d:2.2,h:2.1}, sandbag:{l:3.6,d:0.8,h:1.2}, sandbagL:{l:3.6,d:3.0,h:1.2}, hesco:{l:4.0,d:1.3,h:1.4},
  gcar:{l:4.4,d:1.8,h:1.4}, cement:{l:1.3,d:1.1,h:1.05}, tyres:{l:1.4,d:0.7,h:0.7}, drums:{l:1.4,d:1.4,h:0.93}, ibc:{l:2.4,d:1.5,h:1.0}, milc:{l:1.3,d:1.1,h:0.92},
  tank:{l:4.6,d:2.0,h:2.4}, shelter:{l:4.2,d:1.6,h:2.6,thin:true}, bench:{l:2.0,d:0.7,h:0.9}, kiosk:{l:2.6,d:2.0,h:2.7}, bollards:{l:4.4,d:0.4,h:0.95}
};
const AF_KITS={
  factory:[['cont',9],['cont2',9],['contL',6],['van',3],['pickup',3],['truck',5],['gcar',4],['pipes',3],['cement',3],['spool',2],['dumpster',2],['jersey',3],['crates',2],['tank',2],['tyres',2],['drums',3],['milc',1]],
  desert:[['sandbag',4],['sandbagL',5],['hesco',6],['crates',5],['pickup',3],['truck',3],['cont',4],['cont2',2],['contL',2],['jersey',2],['bags2',1],['pipes',1]],
  plaza:[['sedan',12],['van',5],['pickup',3],['truck',2],['shelter',3],['bench',1],['kiosk',3],['bollards',2],['dumpster',1],['jersey',2],['crates',1]]
};
const AF_COLORS={cont:['#8a3a28','#2f5f7a','#6a6a32','#406a3a','#a07a28','#7a7d82','#3c4a6a'],car:['#b9bcc2','#23262b','#7a1f1c','#1f3d6b','#d6d2c4','#3d4a3a','#8a8d92','#c9a23a'],
  desert:['#6b6a48','#8a7a56','#4f5a3c','#9a8a6a'],bag:['#b3962e','#a9a598','#35598a'],dump:['#2f5a3a','#2f4f7a','#5a5d62']};
function autoFill(def){
  const R=mulberry(hashStr('af:'+def.id)), GW=W*CELL, GH=H*CELL, occ=new Uint8Array(GW*GH);
  const mark=(x0,z0,x1,z1,m)=>{ const a=Math.max(0,Math.floor(x0-m)), b=Math.min(GW,Math.ceil(x1+m)), c=Math.max(0,Math.floor(z0-m)), d=Math.min(GH,Math.ceil(z1+m)); for(let z=c;z<d;z++) for(let x=a;x<b;x++) occ[z*GW+x]=1; };
  const free=(x0,z0,x1,z1)=>{ const a=Math.floor(x0), b=Math.ceil(x1), c=Math.floor(z0), d=Math.ceil(z1); if(a<0||c<0||b>GW||d>GH) return false; for(let z=c;z<d;z++) for(let x=a;x<b;x++) if(occ[z*GW+x]) return false; return true; };
  const pt=(x,z,r)=>{ if(x!=null) mark(x,z,x,z,r); };
  for(let r=0;r<H;r++) for(let c=0;c<W;c++) if(G[r*W+c]!==1) mark(c*CELL,r*CELL,(c+1)*CELL,(r+1)*CELL,0);
  for(const b of (def.buildings||[])) mark(b.x,b.z,b.x+b.w,b.z+b.d,1.6);
  for(const b of BOXES) if(b.y0<3.2) mark(b.x0,b.z0,b.x1,b.z1,0.6);
  for(const r of RAMPS) mark(r.x0,r.z0,r.x1,r.z1,3);
  for(const l of LADDERS) pt(l.x,l.z,3);
  pt(SPAWN_RUN.x,SPAWN_RUN.z,8); pt(SPAWN_SEEK.x,SPAWN_SEEK.z,8); if(def.jail) pt(def.jail.x,def.jail.z,8);
  for(const p of PORTALS){ pt(p.x,p.z,5); pt(p.ex,p.ez,5); }
  if(DOOR) mark(DOOR.c0*CELL,DOOR.r0*CELL,DOOR.c1*CELL,(DOOR.r0+1)*CELL,10);
  const B=def.battle||{}; for(const k of ['spawnsA','spawnsB']) for(const p of (B[k]||[])) pt(p.x,p.z,4);
  for(const k of ['points','hardpoints','sites','flags']) for(const p of (B[k]||[])) pt(p.x,p.z,5);
  if(B.upload){ pt(B.upload.drive.x,B.upload.drive.z,5); for(const g of B.upload.goals) pt(g.x,g.z,5); }
  const O=def.orbs||{}; for(const c of (O.ground||[])) pt((c[0]+0.5)*CELL,(c[1]+0.5)*CELL,3); for(const zl of (O.zones||[])) for(const c of zl) pt((c[0]+0.5)*CELL,(c[1]+0.5)*CELL,3);
  for(const z of ZONES) mark(z.c0*CELL,z.r0*CELL,z.c1*CELL,z.r1*CELL,0); // tag hide zones stay as designed
  for(const f of FLOORPAINT) if(f.x0!=null) mark(f.x0,f.z0,f.x1,f.z1,0);
  for(const r of (def.roads||[])) mark(r.x0,r.z0,r.x1,r.z1,0); // roads stay drivable lanes
  let open=0; for(let i=0;i<occ.length;i++) if(!occ[i]) open++;
  const kit=AF_KITS[def.theme], tot=kit.reduce((a,k)=>a+k[1],0), want=Math.min(80,Math.round(open/(def.afDensity||95))), RING=2.3; let placed=0;
  for(let tries=0;tries<want*140&&placed<want;tries++){
    let r=R()*tot, type=kit[0][0]; for(const k of kit){ r-=k[1]; if(r<=0){ type=k[0]; break; } }
    const T=AF_TYPES[type], rot=R()<0.5?0:1, l=rot?T.d:T.l, d=rot?T.l:T.d;
    const x0=Math.round((3+R()*(GW-6-l))*2)/2, z0=Math.round((3+R()*(GH-6-d))*2)/2;
    if(!free(x0-RING,z0-RING,x0+l+RING,z0+d+RING)) continue;
    const pick=a=>a[(R()*a.length)|0];
    const col=type.startsWith('cont')?pick(AF_COLORS.cont):['sedan','van','pickup','truck'].includes(type)?pick(def.theme==='desert'?AF_COLORS.desert:AF_COLORS.car):type.startsWith('bags')?pick(AF_COLORS.bag):type==='dumpster'?pick(AF_COLORS.dump):type==='tank'?pick(['#8f9498','#72846e','#9a8c74']):type==='kiosk'?pick(['#b9b5aa','#8fa3b8','#b8a08a']):'#ffffff';
    const af={type,rot,flip:R()<0.5,c:col,c2:pick(AF_COLORS.cont),seed:(R()*1e6)|0};
    const add=(bx0,bz0,bx1,bz1,h,first)=>BOXES.push({x0:bx0,x1:bx1,z0:bz0,z1:bz1,y0:0,y1:h,k:'af',af:first?af:null});
    if(type==='contL'||type==='sandbagL'){ // L shape: one long arm + one short arm, the inside corner stays open as a nook
      const w=type==='contL'?2.5:0.8; if(rot){ add(x0,z0,x0+w,z0+d,T.h,true); add(x0,z0,x0+l,z0+w,T.h,false); } else { add(x0,z0,x0+l,z0+w,T.h,true); add(x0,z0,x0+w,z0+d,T.h,false); } }
    else if(T.thin){ if(rot) add(x0,z0,x0+0.25,z0+d,T.h,true); else add(x0,z0,x0+l,z0+0.25,T.h,true); af.fx=x0; af.fz=z0; af.fl=l; af.fd=d; }
    else add(x0,z0,x0+l,z0+d,T.h,true);
    af.x0=x0; af.z0=z0; af.l=l; af.d=d; mark(x0,z0,x0+l,z0+d,0.4); placed++;
  }
}
function setMapData(def,opts){
  opts=opts||{}; MAP=def; MAP_MODE=opts.mode||null; [W,H]=def.size;
  LOWB=def.lowBuildings||[]; ZONES=def.zones||[]; FLOORPAINT=def.floorPaint||[]; DOOR=def.door||null; PORTALS=def.portals||[];
  SPAWN_RUN=def.spawns.runner; SPAWN_SEEK=def.spawns.seeker; ORBC=def.orbs||{ground:[]}; BATTLE=def.battle||{};
  GEN=genBuildings(def);
  RAMPS=(def.ramps||[]).concat(GEN.ramps);
  LADDERS=(def.ladders||[]).concat(GEN.ladders);
  BOXES=(def.boxes||[]).concat(GEN.boxes);
  for(const c of (def.crates||[])){ const [x,z,h,kind]=c; BOXES.push({x0:x-1,x1:x+1,z0:z-1,z1:z+1,y0:0,y1:h,k:'crate',destr:kind!=='steel'}); }
  for(const b of (def.barrels||[])){ const [x,z]=b; BOXES.push({x0:x-0.45,x1:x+0.45,z0:z-0.45,z1:z+0.45,y0:0,y1:1.2,k:'xbarrel',destr:true,explosive:true}); }
  for(const p of (def.planters||[])){ const [x,z,w,d,tree,y0]=p, b=y0||0;
    BOXES.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:b,y1:b+0.9,k:'planter',tree:tree||null});
    if(tree) BOXES.push({x0:x-0.3,x1:x+0.3,z0:z-0.3,z1:z+0.3,y0:b+0.9,y1:b+6,k:'trunk'}); }
  for(const pr of (def.props||[])) if(pr.solid){ const s=pr.solid; BOXES.push({x0:pr.x-s[0]/2,x1:pr.x+s[0]/2,z0:pr.z-s[1]/2,z1:pr.z+s[1]/2,y0:pr.y||0,y1:(pr.y||0)+s[2],k:'prop',destr:!!pr.destr,explosive:!!pr.explosive,prop:pr}); }
  PK=null;
  G=new Uint8Array(W*H); WH=new Float32Array(W*H).fill(Infinity);
  if(def.grid){ def.grid.forEach((row,r)=>{ for(let c=0;c<W;c++){ const ch=row[c]||'#'; const i=r*W+c;
      if(ch==='#'){ G[i]=0; WH[i]=def.rockH||16; } else if(ch==='~'){ G[i]=4; } else if(ch==='D'){ G[i]=2; } else if(ch>='1'&&ch<='9'){ G[i]=0; WH[i]=+ch; } else G[i]=1; } }); }
  for(const[a,b,c,d] of (def.floor||[])) fillG(a,b,c,d,1);
  for(const[a,b,c,d] of (def.voids||[])) fillG(a,b,c,d,4);
  for(const[a,b,c,d] of (def.holes||[])){ fillG(a,b,c,d,0); for(let y=b;y<d;y++)for(let x=a;x<c;x++) if(inB(x,y)) WH[y*W+x]=def.rockH||16; }
  for(const w of (def.walls||[])) for(let y=w.r0;y<w.r1;y++)for(let x=w.c0;x<w.c1;x++) if(inB(x,y)){ G[y*W+x]=0; WH[y*W+x]=w.h; }
  for(const L of LOWB) fillG(L.c0,L.r0,L.c1,L.r1,3);
  if(DOOR){ for(let x=DOOR.c0;x<DOOR.c1;x++) G[DOOR.r0*W+x]=2; } else { for(let i=0;i<G.length;i++) if(G[i]===2){ const c=i%W,r=(i/W)|0; if(!DOOR) DOOR={c0:c,r0:r,c1:c+1,name:def.doorName||'탈출문'}; else if(r===DOOR.r0) DOOR.c1=Math.max(DOOR.c1,c+1); } }
  if(MAP_MODE!=='pk'&&def.autoFill!==false&&AF_KITS[def.theme]) autoFill(def);
  OBJS.clear(); OBJ_SEQ=1; SOL=[];
  for(const L of LOWB) SOL.push({t:'b',x0:L.c0*CELL,x1:L.c1*CELL,z0:L.r0*CELL,z1:L.r1*CELL,y0:0,y1:L.h,k:'low'});
  for(const b of BOXES){ const s=Object.assign({t:'b'},b); SOL.push(s); if(s.destr) registerObj(s); }
  for(const r of RAMPS) SOL.push(Object.assign({t:'r',y0:(r.base||0)>0?r.base-0.3:0,y1:r.h,k:'ramp'},r));
  HW=W*CELL/HS; HH=H*CELL/HS; CS=Array.from({length:HW*HH},()=>[]);
  for(const s of SOL) indexSolid(s);
  if(MAP_MODE==='pk'&&BATTLE.parkour){
    const test=b=>{ for(let x=b.x0;x<=b.x1;x+=0.6) for(let z=b.z0;z<=b.z1;z+=0.6){ const c=cellOf(x),r=cellOf(z); if(!inB(c,r)||G[r*W+c]!==1) return true;
        for(const s of cellSolids(x,z)) if(overl(s,x,z,0.3)&&s.y0<b.y1+2.2&&topAt(s,x,z)>b.y0-0.3) return true; } return false; };
    PK=genParkour(BATTLE.parkour,test);
    if(PK) for(const b of PK.boxes){ const s=Object.assign({t:'b'},b); BOXES.push(b); SOL.push(s); indexSolid(s); }
  }
  SMOKES.length=0;
  if(opts.noNav){ NODES=[]; CELLN=[]; NREACH=new Set(); MAP_WARNINGS=[]; return; }
  buildNav(); NREACH=new Set(); NREACH=reachSet(nearestNode(SPAWN_RUN.x,0,SPAWN_RUN.z)); MAP_WARNINGS=validateMap();
  if(MAP_WARNINGS.length) console.warn('[맵 검사] '+def.id+'\n- '+MAP_WARNINGS.join('\n- '));
}
function registerObj(s){ const id=s.oid||('o'+(OBJ_SEQ++)); s.oid=id; const hp=s.hp||(s.k==='xbarrel'?40:s.k==='wallDep'?400:s.k==='bridge'?600:s.k==='crate'?120:150);
  OBJS.set(id,{id,s,hp,max:hp,alive:true,kind:s.k,explosive:!!s.explosive}); s.alive=true; return id; }
const HS=2; let HW=0, HH=0;            // collision hash: 2 m cells, solids padded by 0.6 m
function indexSolid(s){ const m=0.6;
  for(let r=Math.max(0,Math.floor((s.z0-m)/HS));r<=Math.min(HH-1,Math.floor((s.z1+m)/HS));r++)
  for(let c=Math.max(0,Math.floor((s.x0-m)/HS));c<=Math.min(HW-1,Math.floor((s.x1+m)/HS));c++) CS[r*HW+c].push(s); }
function unindexSolid(s){ for(const L of CS){ const i=L.indexOf(s); if(i>=0) L.splice(i,1); } }
/* runtime solid (deployable wall, etc.) */
function addDynSolid(b){ const s=Object.assign({t:'b',alive:true},b); SOL.push(s); indexSolid(s); if(s.destr) registerObj(s); return s; }
function removeDynSolid(s){ s.alive=false; unindexSolid(s); const i=SOL.indexOf(s); if(i>=0) SOL.splice(i,1); }
function fillG(a,b,c,d,v){ for(let y=b;y<d;y++)for(let x=a;x<c;x++) if(inB(x,y)){ G[y*W+x]=v; if(v) WH[y*W+x]=Infinity; } }
const isVoid=(x,z)=>{ const c=cellOf(x),r=cellOf(z); return inB(c,r)&&G[r*W+c]===4; };
const inB=(c,r)=>c>=0&&r>=0&&c<W&&r<H;
const cellOf=v=>Math.floor(v/CELL);
const ctr=(c,r)=>({x:c*CELL+CELL/2,z:r*CELL+CELL/2});
const wallTop=(c,r)=>inB(c,r)&&G[r*W+c]===0?WH[r*W+c]:-1;
const live=s=>s.alive!==false;
function wallBlocks(c,r,door,feet){ if(!inB(c,r)) return true; const v=G[r*W+c]; if(v===2) return !door; if(v!==0) return false; return feet+STEP<WH[r*W+c]; }
function rampH(s,x,z){
  const cx=Math.min(s.x1,Math.max(s.x0,x)), cz=Math.min(s.z1,Math.max(s.z0,z)); let t;
  if(s.hi==='z0') t=(s.z1-cz)/(s.z1-s.z0); else if(s.hi==='z1') t=(cz-s.z0)/(s.z1-s.z0);
  else if(s.hi==='x0') t=(s.x1-cx)/(s.x1-s.x0); else t=(cx-s.x0)/(s.x1-s.x0);
  const b=s.base||0; return b+(s.h-b)*t;
}
const topAt=(s,x,z)=>s.t==='r'?rampH(s,x,z):s.y1;
const overl=(s,x,z,r)=>x+r>s.x0&&x-r<s.x1&&z+r>s.z0&&z-r<s.z1;
function cellSolids(x,z){ const c=Math.floor(x/HS),r=Math.floor(z/HS); return c>=0&&r>=0&&c<HW&&r<HH?CS[r*HW+c]:null; }
function blockedAt(x,z,feet,ph,door,r){
  r=r||RAD; const c0=cellOf(x-r),c1=cellOf(x+r),r0=cellOf(z-r),r1=cellOf(z+r);
  for(let rr=r0;rr<=r1;rr++)for(let cc=c0;cc<=c1;cc++) if(wallBlocks(cc,rr,door,feet)) return true;
  const L=cellSolids(x,z); if(!L) return true;
  for(const s of L){ if(!live(s)||!overl(s,x,z,r)||s.y0>=feet+ph-0.02) continue; if(topAt(s,x,z)>feet+STEP) return true; }
  return false;
}
function groundAt(x,z,feet,r){ r=r||RAD; let g=isVoid(x,z)?-60:0;
  const c0=cellOf(x-r),c1=cellOf(x+r),r0=cellOf(z-r),r1=cellOf(z+r);
  for(let rr=r0;rr<=r1;rr++)for(let cc=c0;cc<=c1;cc++){ const t=wallTop(cc,rr); if(t>g&&t<=feet+STEP+0.01) g=t; }
  const L=cellSolids(x,z); if(!L) return g;
  for(const s of L){ if(!live(s)||!overl(s,x,z,r)) continue; const t=topAt(s,x,z); if(t<=feet+STEP+0.01&&t>g) g=t; }
  return g; }
function ceilingAt(x,z,feet,r){ r=r||RAD; let c=1e9; const L=cellSolids(x,z); if(!L) return c;
  for(const s of L){ if(!live(s)||!overl(s,x,z,r)) continue; if(s.y0>feet+0.3&&s.y0<c) c=s.y0; } return c; }
const FACE={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
function ladderAt(e){
  for(const L of LADDERS){ const f=FACE[L.face]; let inX,inZ;
    if(f[0]===0){ inX=Math.abs(e.x-L.x)<0.7; inZ=f[1]<0?(e.z>=L.z-0.1&&e.z<=L.z+1.0):(e.z<=L.z+0.1&&e.z>=L.z-1.0); }
    else { inZ=Math.abs(e.z-L.z)<0.7; inX=f[0]>0?(e.x<=L.x+0.1&&e.x>=L.x-1.0):(e.x>=L.x-0.1&&e.x<=L.x+1.0); }
    if(inX&&inZ&&e.y>=L.y0-0.3&&e.y<L.y1-0.05) return L; }
  return null;
}
/* entity: {x,y,z,vy,gr,ph, kx,kz knockback, climbing}. dx,dz = intended displacement this step. Returns landing speed. */
function physStep(e,dx,dz,dt,door){
  if(e.kx||e.kz){ dx+=e.kx*dt; dz+=e.kz*dt; const f=Math.max(0,1-dt*(e.gr?6:1.5)); e.kx*=f; e.kz*=f; if(Math.abs(e.kx)+Math.abs(e.kz)<0.05){ e.kx=0; e.kz=0; } }
  const L=LADDERS.length?ladderAt(e):null; e.climbing=false;
  if(L){ const f=FACE[L.face], push=(dx*f[0]+dz*f[1])/Math.max(dt,1e-4);
    if(push>0.8){ e.climbing=true; e.vy=0; e.gr=false; e.y+=CLIMB_V*dt;
      if(e.y>=L.y1-0.12){ e.y=L.y1; e.x=L.x+f[0]*0.9; e.z=L.z+f[1]*0.9; e.gr=true; e.vy=0; e.climbing=false; }
      return 0; } }
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.45)); const sx=dx/steps, sz=dz/steps;
  for(let i=0;i<steps;i++){ if(sx&&!blockedAt(e.x+sx,e.z,e.y,e.ph,door)) e.x+=sx; if(sz&&!blockedAt(e.x,e.z+sz,e.y,e.ph,door)) e.z+=sz; }
  let landed=0;
  if(e.gr){ const g=groundAt(e.x,e.z,e.y); if(g>=e.y-0.38) e.y=g; else { e.gr=false; e.vy=0; } }
  if(!e.gr){
    e.vy-=GRAV*dt; let ny=e.y+e.vy*dt;
    if(e.vy>0){ const c=ceilingAt(e.x,e.z,e.y); if(ny+e.ph>c){ ny=c-e.ph; e.vy=0; } }
    else { const g=groundAt(e.x,e.z,e.y); if(ny<=g){ landed=-e.vy; ny=g; e.vy=0; e.gr=true; } }
    e.y=ny;
  }
  if(e.y<-14) e.fell=true;
  if(e.y<-60){ e.y=-60; e.vy=0; }
  return landed;
}
function headroom(e,ph){ return ceilingAt(e.x,e.z,e.y)>=e.y+ph; }
/* point & ray tests. pointSolid returns false/true, pointObj returns the solid hit (for destructibles) */
function pointHit(x,y,z){ const c=cellOf(x),r=cellOf(z); if(!inB(c,r)) return true; const v=G[r*W+c]; if(y<0&&v!==4) return true;
  if(v===0&&y<=WH[r*W+c]) return true; if(v===2&&y<8) return true;
  for(const s of cellSolids(x,z)){ if(!live(s)) continue; if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&y>=s.y0&&y<=topAt(s,x,z)) return s; }
  return false; }
const pointSolid=(x,y,z)=>!!pointHit(x,y,z);
function rayCast(ox,oy,oz,dx,dy,dz,maxD,pierceThin){
  let t=0.25; const st=0.12;
  while(t<maxD){ const h=pointHit(ox+dx*t,oy+dy*t,oz+dz*t);
    if(h){ return {t,s:h===true?null:h}; } t+=st; }
  return {t:maxD,s:null};
}
function rayDist(ox,oy,oz,dx,dy,dz,maxD){ return rayCast(ox,oy,oz,dx,dy,dz,maxD).t; }
function rayPlayer(ox,oy,oz,dx,dy,dz,px,py,pz,ph,rad){
  rad=rad||0.45; const fx=ox-px, fz=oz-pz, a=dx*dx+dz*dz; if(a<1e-6) return -1;
  const b=2*(fx*dx+fz*dz), c=fx*fx+fz*fz-rad*rad, disc=b*b-4*a*c; if(disc<0) return -1; const sq=Math.sqrt(disc);
  for(const t of [(-b-sq)/(2*a),(-b+sq)/(2*a)]){ if(t<0) continue; const y=oy+dy*t; if(y>=py&&y<=py+ph) return t; } return -1; }
function los3(ax,ay,az,bx,by,bz){ const d=Math.hypot(bx-ax,by-ay,bz-az), n=Math.ceil(d/0.26);
  for(let i=1;i<n;i++){ const t=i/n; if(pointSolid(ax+(bx-ax)*t,ay+(by-ay)*t,az+(bz-az)*t)) return false; } return true; }
function smokeBlocks(ax,ay,az,bx,by,bz){ for(const s of SMOKES){ const dx=bx-ax,dy=by-ay,dz=bz-az, L2=dx*dx+dy*dy+dz*dz||1; let t=((s.x-ax)*dx+(s.y-ay)*dy+(s.z-az)*dz)/L2; t=Math.max(0,Math.min(1,t));
    if(Math.hypot(ax+dx*t-s.x,ay+dy*t-s.y,az+dz*t-s.z)<s.r*0.85) return true; } return false; }
function losSight(ax,ay,az,bx,by,bz){ return los3(ax,ay,az,bx,by,bz)&&!smokeBlocks(ax,ay,az,bx,by,bz); }
function inZone(x,z){ const c=cellOf(x),r=cellOf(z); return ZONES.some(q=>c>=q.c0&&c<q.c1&&r>=q.r0&&r<q.r1); }
function inDoor(x,z){ if(!DOOR) return false; const c=cellOf(x),r=cellOf(z); return r===DOOR.r0&&c>=DOOR.c0&&c<DOOR.c1; }
function doorFront(){ return {x:(DOOR.c0+DOOR.c1)/2*CELL, y:0, z:(DOOR.r0+1.5)*CELL}; }

/* ---------- navigation graph: 2 m samples, several levels per sample ---------- */
function buildNav(){
  NW=Math.round(W*CELL/NS); NH=Math.round(H*CELL/NS);
  NODES=[]; CELLN=Array.from({length:NW*NH},()=>[]);
  const skipK={rail:1,slide:1,pillar:1,trunk:1,wall:1,parapet:1};
  for(let j=0;j<NH;j++)for(let i=0;i<NW;i++){
    const x=i*NS+NS/2, z=j*NS+NS/2, c=cellOf(x), r=cellOf(z), v=G[r*W+c]; if(v===2) continue;
    const hs=new Map(); if(v===1) hs.set(0,null); if(v===0&&WH[r*W+c]<7.5) hs.set(WH[r*W+c],null);
    for(const s of cellSolids(x,z)) if(!skipK[s.k]&&x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1){ const h=+topAt(s,x,z).toFixed(3); if(!hs.has(h)||s.oid) hs.set(h,s.oid||hs.get(h)||null); }
    for(const [h,oid] of hs){ if(blockedAt(x,z,h,PH,false)||Math.abs(groundAt(x,z,h)-h)>0.05) continue;
      const n={i:NODES.length,gi:i,gj:j,x,z,h,e:[],oid}; NODES.push(n); CELLN[j*NW+i].push(n); }
  }
  for(const a of NODES) for(const[dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const ni=a.gi+dx,nj=a.gj+dy; if(ni<0||nj<0||ni>=NW||nj>=NH) continue;
    for(const b of CELLN[nj*NW+ni]){ const j=traverse(a.x,a.h,a.z,b.x,b.z); if(j&&Math.abs(j.y-b.h)<0.3) a.e.push({n:b.i,jump:j.jump}); }
  }
  for(const L of LADDERS){ const f=FACE[L.face]; const bx=L.x-f[0]*0.7, bz=L.z-f[1]*0.7, tx=L.x+f[0]*1.2, tz=L.z+f[1]*1.2;
    const a=nearestNode(bx,L.y0,bz,true), b=nearestNode(tx,L.y1,tz,true);
    if(a&&b&&Math.abs(b.h-L.y1)<0.6&&Math.abs(a.h-L.y0)<0.6) a.e.push({n:b.i,ladder:L}); }
}
function traverse(ax,ay,az,bx,bz){
  const d=Math.hypot(bx-ax,bz-az), n=Math.max(1,Math.ceil(d/0.4)); let y=ay, jump=false;
  for(let i=1;i<=n;i++){ const t=i/n, x=ax+(bx-ax)*t, z=az+(bz-az)*t;
    if(blockedAt(x,z,y,PH,false)){ let ok=false;
      for(const hy of [y+0.5,y+0.8,y+1.1]){ if(!blockedAt(x,z,hy,PH,false)){ const g=groundAt(x,z,hy); if(g>y+STEP-0.01&&g<=y+1.15){ y=g; jump=true; ok=true; } break; } }
      if(!ok) return null; continue; }
    y=groundAt(x,z,y); }
  return {y,jump};
}
function nearestNode(x,y,z,strictH,reach){ const i0=Math.floor(x/NS), j0=Math.floor(z/NS); let best=null,bd=1e9;
  for(let rad=0;rad<=(reach?7:4)&&!best;rad++) for(let j=j0-rad;j<=j0+rad;j++)for(let i=i0-rad;i<=i0+rad;i++){ if(i<0||j<0||i>=NW||j>=NH) continue;
    for(const n of CELLN[j*NW+i]){ if(n.oid&&!objAlive(n.oid)) continue; if(strictH&&Math.abs(n.h-y)>1.2) continue; if(reach&&NREACH.size&&!NREACH.has(n.i)) continue; const d=Math.hypot(n.x-x,n.z-z)+Math.abs(n.h-y)*3; if(d<bd){bd=d;best=n;} } }
  return best; }
const objAlive=oid=>{ const o=OBJS.get(oid); return !o||o.alive; };
/* A* over the node graph; returns [{x,z,h,jump,ladder}] excluding the start node */
let _npN=0,_npG=null,_npPrev=null,_npVia=null,_npSeen=null,_npClosed=null,_npGen=0,_npHf=new Float64Array(2048),_npHi=new Int32Array(2048);
function navPath(a,b){
  if(!a||!b) return null; if(a===b) return [];
  const N=NODES.length;
  if(N>_npN){ _npN=N; _npG=new Float32Array(N); _npPrev=new Int32Array(N); _npVia=new Array(N); _npSeen=new Uint32Array(N); _npClosed=new Uint32Array(N); }
  const gen=++_npGen; let hn=0;
  const push=(i,f)=>{ if(hn>=_npHi.length){ const nf=new Float64Array(_npHf.length*2); nf.set(_npHf); _npHf=nf; const ni=new Int32Array(_npHi.length*2); ni.set(_npHi); _npHi=ni; }
    let k=hn++; while(k>0){ const p=(k-1)>>1; if(_npHf[p]<=f) break; _npHf[k]=_npHf[p]; _npHi[k]=_npHi[p]; k=p; } _npHf[k]=f; _npHi[k]=i; };
  const pop=()=>{ const top=_npHi[0]; hn--; if(hn>0){ const f=_npHf[hn], i=_npHi[hn]; let k=0;
      for(;;){ const l=2*k+1; if(l>=hn) break; let m=l; if(l+1<hn&&_npHf[l+1]<_npHf[l]) m=l+1; if(_npHf[m]>=f) break; _npHf[k]=_npHf[m]; _npHi[k]=_npHi[m]; k=m; } _npHf[k]=f; _npHi[k]=i; } return top; };
  const bx=b.x,bz=b.z,bh=b.h, hf=n=>Math.hypot(n.x-bx,n.z-bz)+Math.abs(n.h-bh);
  _npSeen[a.i]=gen; _npG[a.i]=0; push(a.i,hf(a)); let found=false, it=0;
  while(hn&&it++<14000){ const ci=pop(); if(_npClosed[ci]===gen) continue; _npClosed[ci]=gen; if(ci===b.i){ found=true; break; }
    const cn=NODES[ci], gc=_npG[ci];
    for(const e of cn.e){ const ni=e.n; if(_npClosed[ni]===gen) continue; const nn=NODES[ni]; if(nn.oid&&!objAlive(nn.oid)) continue;
      const cost=gc+NS*(e.jump?1.6:1)+(e.ladder?3:0)+Math.max(0,nn.h-cn.h)*0.5;
      if(_npSeen[ni]!==gen||cost<_npG[ni]){ _npSeen[ni]=gen; _npG[ni]=cost; _npPrev[ni]=ci; _npVia[ni]=e; push(ni,cost+hf(nn)); } } }
  if(!found) return null; const out=[]; let c=b.i;
  while(c!==a.i){ const n=NODES[c], e=_npVia[c]; out.push({x:n.x,z:n.z,h:n.h,jump:!!(e&&e.jump),ladder:e&&e.ladder||null,i:c}); c=_npPrev[c]; }
  out.reverse(); return out;
}
function reachSet(from){ const seen=new Set(); if(!from) return seen; seen.add(from.i); const q=[from.i];
  while(q.length){ const c=q.pop(); for(const e of NODES[c].e) if(!seen.has(e.n)){ seen.add(e.n); q.push(e.n); } } return seen; }
let NREACH=new Set();
function surfaceY(c,r,up){ const x=c*CELL+CELL/2, z=r*CELL+CELL/2, i=Math.floor(x/NS), j=Math.floor(z/NS); if(i<0||j<0||i>=NW||j>=NH) return null;
  let L=CELLN[j*NW+i]; if(NREACH.size){ const k=L.filter(n=>NREACH.has(n.i)); if(k.length) L=k; } if(!L.length) return null; let best=L[0];
  for(const n of L) if(up?n.h>best.h:n.h<best.h) best=n; if(up&&best.h<1) return null; if(!up&&best.h>0.01) return null; return best.h; }
function randomNode(R,minH,maxH){ for(let i=0;i<80;i++){ const n=NODES[(R()*NODES.length)|0]; if(n&&n.h>=(minH||0)&&n.h<=(maxH==null?99:maxH)) return n; } return NODES[0]; }
function pickOrbs(seed,count){
  const R=mulberry(seed), sc=cellOf(SPAWN_RUN.x), sr=cellOf(SPAWN_RUN.z);
  const sh=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=(R()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
  const mk=(list,up)=>(list||[]).map(([c,r])=>{ const y=surfaceY(c,r,up); return y===null?null:Object.assign({c,r,y},ctr(c,r)); }).filter(Boolean);
  const res=[]; for(const zl of (ORBC.zones||[])){ const z=sh(mk(zl,false)); if(z[0]&&res.length<count) res.push(z[0]); }
  const U=sh(mk(ORBC.up,true)), O=sh(mk(ORBC.ground,false)), upN=U.length?Math.max(1,Math.round(count*0.3)):0;
  const far=(p,minD)=>res.every(q=>Math.hypot(q.c-p.c,q.r-p.r)>=minD)&&Math.hypot(p.c-sc,p.r-sr)>=5;
  for(const minD of [4,3,0]) for(const p of U){ if(res.filter(q=>q.y>0).length>=upN||res.length>=count) break; if(!res.includes(p)&&far(p,minD)) res.push(p); }
  for(const minD of [5,4,3,2,0]){ for(const p of O){ if(res.length>=count) break; if(!res.includes(p)&&far(p,minD)) res.push(p); } if(res.length>=count) break; }
  return res.slice(0,count);
}
/* map checks — printed to the console and shown in the menu for map authors */
function validateMap(){
  const w=[]; const run=nearestNode(SPAWN_RUN.x,0,SPAWN_RUN.z), seek=nearestNode(SPAWN_SEEK.x,0,SPAWN_SEEK.z);
  if(!run) w.push('도망자 스폰 위치가 걸을 수 있는 칸이 아니에요'); if(!seek) w.push('술래 스폰 위치가 걸을 수 있는 칸이 아니에요');
  if(!run||!seek) return w;
  const R=reachSet(run), Sk=reachSet(seek);
  if(DOOR){ const df=doorFront(), dn=nearestNode(df.x,0,df.z); if(!dn||!R.has(dn.i)) w.push('도망자가 탈출문 앞까지 갈 수 없어요'); }
  if(!R.has(seek.i)) w.push('도망자 스폰에서 술래 스폰까지 길이 없어요');
  const chk=(list,up,label)=>(list||[]).forEach(([c,r])=>{ const y=surfaceY(c,r,up); if(y===null){ w.push(`${label} 구슬 후보 (${c},${r})에 ${up?'위층':'바닥'} 발판이 없어요`); return; }
    const x=c*CELL+CELL/2, z=r*CELL+CELL/2, n=CELLN[Math.floor(z/NS)*NW+Math.floor(x/NS)].find(n=>Math.abs(n.h-y)<0.01);
    if(!R.has(n.i)) w.push(`${label} 구슬 후보 (${c},${r})에 도망자가 갈 수 없어요`); if(!Sk.has(n.i)) w.push(`${label} 구슬 후보 (${c},${r})에 술래가 갈 수 없어요`); });
  (ORBC.zones||[]).forEach((zl,i)=>chk(zl,false,(ZONES[i]&&ZONES[i].n||i)+'구역')); chk(ORBC.up,true,'위층'); chk(ORBC.ground,false,'바닥');
  const pts=[]; const B=BATTLE||{};
  (B.spawnsA||[]).forEach((p,i)=>pts.push(['A팀 스폰'+(i+1),p])); (B.spawnsB||[]).forEach((p,i)=>pts.push(['B팀 스폰'+(i+1),p]));
  (B.points||[]).forEach(p=>pts.push(['점령지 '+p.n,p])); (B.hardpoints||[]).forEach((p,i)=>pts.push(['하드포인트'+(i+1),p]));
  (B.sites||[]).forEach(p=>pts.push(['폭탄 지점 '+p.n,p])); if(B.flags) B.flags.forEach((p,i)=>pts.push([(i?'B':'A')+'팀 깃발',p]));
  if(B.upload){ pts.push(['업로드 드라이브',B.upload.drive]); B.upload.goals.forEach((p,i)=>pts.push(['업로드 기지'+(i?'B':'A'),p])); }
  for(const [lbl,p] of pts){ const n=nearestNode(p.x,p.y||0,p.z); if(!n||Math.hypot(n.x-p.x,n.z-p.z)>4||Math.abs(n.h-(p.y||0))>1||!R.has(n.i)) w.push(lbl+' 위치에 갈 수 없어요'); }
  if(PORTALS.length&&PORTALS.length!==2) w.push('텔레포트 문은 0개나 2개여야 해요');
  return w;
}
