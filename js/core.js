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
function navPath(a,b){
  if(!a||!b) return null; if(a===b) return [];
  const N=NODES.length, g=new Float32Array(N).fill(Infinity), prev=new Int32Array(N).fill(-1), via=new Array(N), closed=new Uint8Array(N);
  const heap=[]; const push=(i,f)=>{ heap.push([f,i]); let k=heap.length-1; while(k>0){ const p=(k-1)>>1; if(heap[p][0]<=heap[k][0]) break; [heap[p],heap[k]]=[heap[k],heap[p]]; k=p; } };
  const pop=()=>{ const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let k=0; for(;;){ const l=2*k+1,r=l+1; let m=k; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===k) break; [heap[m],heap[k]]=[heap[k],heap[m]]; k=m; } } return top; };
  const hf=n=>Math.hypot(n.x-b.x,n.z-b.z)+Math.abs(n.h-b.h);
  g[a.i]=0; push(a.i,hf(a)); let found=false, it=0;
  while(heap.length&&it++<14000){ const [,ci]=pop(); if(closed[ci]) continue; closed[ci]=1; if(ci===b.i){ found=true; break; }
    const cn=NODES[ci];
    for(const e of cn.e){ const nn=NODES[e.n]; if(closed[e.n]) continue; if(nn.oid&&!objAlive(nn.oid)) continue;
      const cost=g[ci]+NS*(e.jump?1.6:1)+(e.ladder?3:0)+Math.max(0,nn.h-cn.h)*0.5;
      if(cost<g[e.n]){ g[e.n]=cost; prev[e.n]=ci; via[e.n]=e; push(e.n,cost+hf(nn)); } } }
  if(!found) return null; const out=[]; let c=b.i;
  while(c!==a.i){ const n=NODES[c], e=via[c]; out.push({x:n.x,z:n.z,h:n.h,jump:!!(e&&e.jump),ladder:e&&e.ladder||null,i:c}); c=prev[c]; }
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
