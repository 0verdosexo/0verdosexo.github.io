/* core.js — map-independent engine: grid, 3D collision, navigation graph.
   The current map is installed with setMapData(def); every other file reads the globals below. */
const CELL=4;
let MAP=null, W=0, H=0, G=new Uint8Array(0), LOWB=[], RAMPS=[], BOXES=[], ZONES=[], FLOORPAINT=[], DOOR=null, PORTALS=[],
    SPAWN_RUN=null, SPAWN_SEEK=null, ORBC=null, SOL=[], CS=[], NODES=[], CELLN=[], MAP_WARNINGS=[];
const RAD=0.42, PH=1.75, PH_SLIDE=0.85, STEP=0.55, GRAV=24, JUMP_V=7.7;

function setMapData(def){
  MAP=def; [W,H]=def.size;
  LOWB=def.lowBuildings||[]; RAMPS=def.ramps||[]; ZONES=def.zones||[]; FLOORPAINT=def.floorPaint||[]; DOOR=def.door; PORTALS=def.portals||[];
  SPAWN_RUN=def.spawns.runner; SPAWN_SEEK=def.spawns.seeker; ORBC=def.orbs;
  BOXES=(def.boxes||[]).concat((def.crates||[]).map(([x,z,h])=>({x0:x-1,x1:x+1,z0:z-1,z1:z+1,y0:0,y1:h,k:'crate'})));
  for(const p of (def.planters||[])){ const [x,z,w,d,tree,y0]=p, b=y0||0;
    BOXES.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:b,y1:b+0.9,k:'planter',tree:tree||null});
    if(tree) BOXES.push({x0:x-0.3,x1:x+0.3,z0:z-0.3,z1:z+0.3,y0:b+0.9,y1:b+6,k:'trunk'}); }
  G=new Uint8Array(W*H);
  for(const[a,b,c,d] of def.floor) for(let y=b;y<d;y++)for(let x=a;x<c;x++) if(inB(x,y)) G[y*W+x]=1;
  for(const[a,b,c,d] of (def.holes||[])) for(let y=b;y<d;y++)for(let x=a;x<c;x++) if(inB(x,y)) G[y*W+x]=0;
  for(const L of LOWB) for(let y=L.r0;y<L.r1;y++)for(let x=L.c0;x<L.c1;x++) G[y*W+x]=3;
  for(let x=DOOR.c0;x<DOOR.c1;x++) G[DOOR.r0*W+x]=2;
  SOL=[];
  for(const L of LOWB) SOL.push({t:'b',x0:L.c0*CELL,x1:L.c1*CELL,z0:L.r0*CELL,z1:L.r1*CELL,y0:0,y1:L.h,k:'low'});
  for(const b of BOXES) SOL.push(Object.assign({t:'b'},b));
  for(const r of RAMPS) SOL.push(Object.assign({t:'r',y0:0,y1:r.h,k:'ramp'},r));
  CS=Array.from({length:W*H},()=>[]);
  SOL.forEach(s=>{ const m=1.2;
    for(let r=Math.max(0,Math.floor((s.z0-m)/CELL));r<=Math.min(H-1,Math.floor((s.z1+m)/CELL));r++)
    for(let c=Math.max(0,Math.floor((s.x0-m)/CELL));c<=Math.min(W-1,Math.floor((s.x1+m)/CELL));c++) CS[r*W+c].push(s); });
  buildNav(); MAP_WARNINGS=validateMap();
  if(MAP_WARNINGS.length) console.warn('[맵 검사] '+def.id+'\n- '+MAP_WARNINGS.join('\n- '));
}

const inB=(c,r)=>c>=0&&r>=0&&c<W&&r<H;
const cellOf=v=>Math.floor(v/CELL);
const ctr=(c,r)=>({x:c*CELL+CELL/2,z:r*CELL+CELL/2});
function wallCell(c,r,door){ if(!inB(c,r)) return true; const v=G[r*W+c]; return v===0||(v===2&&!door); }
function rampH(s,x,z){
  const cx=Math.min(s.x1,Math.max(s.x0,x)), cz=Math.min(s.z1,Math.max(s.z0,z)); let t;
  if(s.hi==='z0') t=(s.z1-cz)/(s.z1-s.z0); else if(s.hi==='z1') t=(cz-s.z0)/(s.z1-s.z0);
  else if(s.hi==='x0') t=(s.x1-cx)/(s.x1-s.x0); else t=(cx-s.x0)/(s.x1-s.x0);
  const b=s.base||0; return b+(s.h-b)*t;
}
const topAt=(s,x,z)=>s.t==='r'?rampH(s,x,z):s.y1;
const overl=(s,x,z,r)=>x+r>s.x0&&x-r<s.x1&&z+r>s.z0&&z-r<s.z1;
function cellSolids(x,z){ const c=cellOf(x),r=cellOf(z); return inB(c,r)?CS[r*W+c]:null; }
function blockedAt(x,z,feet,ph,door,r){
  r=r||RAD; const c0=cellOf(x-r),c1=cellOf(x+r),r0=cellOf(z-r),r1=cellOf(z+r);
  for(let rr=r0;rr<=r1;rr++)for(let cc=c0;cc<=c1;cc++) if(wallCell(cc,rr,door)) return true;
  const L=cellSolids(x,z); if(!L) return true;
  for(const s of L){ if(!overl(s,x,z,r)||s.y0>=feet+ph-0.02) continue; if(topAt(s,x,z)>feet+STEP) return true; }
  return false;
}
function groundAt(x,z,feet,r){ r=r||RAD; let g=0; const L=cellSolids(x,z); if(!L) return 0;
  for(const s of L){ if(!overl(s,x,z,r)) continue; const t=topAt(s,x,z); if(t<=feet+STEP+0.01&&t>g) g=t; } return g; }
function ceilingAt(x,z,feet,r){ r=r||RAD; let c=1e9; const L=cellSolids(x,z); if(!L) return c;
  for(const s of L){ if(!overl(s,x,z,r)) continue; if(s.y0>feet+0.3&&s.y0<c) c=s.y0; } return c; }
/* entity: {x,y,z,vy,gr,ph} — returns landing speed (0 if no landing) */
function physStep(e,dx,dz,dt,door){
  if(dx&&!blockedAt(e.x+dx,e.z,e.y,e.ph,door)) e.x+=dx;
  if(dz&&!blockedAt(e.x,e.z+dz,e.y,e.ph,door)) e.z+=dz;
  let landed=0;
  if(e.gr){ const g=groundAt(e.x,e.z,e.y); if(g>=e.y-0.38) e.y=g; else { e.gr=false; e.vy=0; } }
  if(!e.gr){
    e.vy-=GRAV*dt; let ny=e.y+e.vy*dt;
    if(e.vy>0){ const c=ceilingAt(e.x,e.z,e.y); if(ny+e.ph>c){ ny=c-e.ph; e.vy=0; } }
    else { const g=groundAt(e.x,e.z,e.y); if(ny<=g){ landed=-e.vy; ny=g; e.vy=0; e.gr=true; } }
    e.y=ny;
  }
  return landed;
}
function headroom(e,ph){ return ceilingAt(e.x,e.z,e.y)>=e.y+ph; }
function pointSolid(x,y,z){ const c=cellOf(x),r=cellOf(z); if(wallCell(c,r,false)) return true;
  for(const s of CS[r*W+c]) if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&y>=s.y0&&y<=topAt(s,x,z)) return true; return false; }
function los3(ax,ay,az,bx,by,bz){ const d=Math.hypot(bx-ax,by-ay,bz-az), n=Math.ceil(d/0.45);
  for(let i=1;i<n;i++){ const t=i/n; if(pointSolid(ax+(bx-ax)*t,ay+(by-ay)*t,az+(bz-az)*t)) return false; } return true; }
function inZone(x,z){ const c=cellOf(x),r=cellOf(z); return ZONES.some(q=>c>=q.c0&&c<q.c1&&r>=q.r0&&r<q.r1); }
function inDoor(x,z){ const c=cellOf(x),r=cellOf(z); return r===DOOR.r0&&c>=DOOR.c0&&c<DOOR.c1; }
function doorFront(){ return {x:(DOOR.c0+DOOR.c1)/2*CELL, y:0, z:(DOOR.r0+1.5)*CELL}; }
function mulberry(a){ return function(){ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296; }; }
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }

/* ---------- navigation graph (multi-level) ---------- */
function buildNav(){
  NODES=[]; CELLN=Array.from({length:W*H},()=>[]);
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){
    const v=G[r*W+c]; if(v===0||v===2) continue;
    const p=ctr(c,r), hs=new Set(); if(v===1) hs.add(0);
    for(const s of CS[r*W+c]) if(s.k!=='rail'&&s.k!=='slide'&&s.k!=='pillar'&&s.k!=='trunk'&&p.x>=s.x0&&p.x<=s.x1&&p.z>=s.z0&&p.z<=s.z1) hs.add(+topAt(s,p.x,p.z).toFixed(3));
    for(const h of hs){ if(blockedAt(p.x,p.z,h,PH,false)||Math.abs(groundAt(p.x,p.z,h)-h)>0.05) continue;
      const n={i:NODES.length,c,r,x:p.x,z:p.z,h,e:[]}; NODES.push(n); CELLN[r*W+c].push(n); }
  }
  for(const a of NODES) for(const[dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nc=a.c+dx,nr=a.r+dy; if(!inB(nc,nr)) continue;
    for(const b of CELLN[nr*W+nc]){ const j=traverse(a.x,a.h,a.z,b.x,b.z); if(j&&Math.abs(j.y-b.h)<0.3) a.e.push({n:b.i,jump:j.jump}); }
  }
}
function traverse(ax,ay,az,bx,bz){
  const d=Math.hypot(bx-ax,bz-az), n=Math.max(1,Math.ceil(d/0.3)); let y=ay, jump=false;
  for(let i=1;i<=n;i++){ const t=i/n, x=ax+(bx-ax)*t, z=az+(bz-az)*t;
    if(blockedAt(x,z,y,PH,false)){ let ok=false;
      for(const hy of [y+0.5,y+0.8,y+1.1]){ if(!blockedAt(x,z,hy,PH,false)){ const g=groundAt(x,z,hy); if(g>y+STEP-0.01&&g<=y+1.15){ y=g; jump=true; ok=true; } break; } }
      if(!ok) return null; continue; }
    y=groundAt(x,z,y); }
  return {y,jump};
}
function nearestNode(x,y,z){ const c=cellOf(x),r=cellOf(z); let best=null,bd=1e9;
  for(let rad=0;rad<=2&&!best;rad++) for(let rr=r-rad;rr<=r+rad;rr++)for(let cc=c-rad;cc<=c+rad;cc++){ if(!inB(cc,rr)) continue;
    for(const n of CELLN[rr*W+cc]){ const d=Math.hypot(n.x-x,n.z-z)+Math.abs(n.h-y)*3; if(d<bd){bd=d;best=n;} } }
  return best; }
function navPath(a,b){
  if(!a||!b) return null; const prev=new Int32Array(NODES.length).fill(-1); prev[a.i]=a.i; const q=[a.i]; let h=0;
  while(h<q.length){ const cur=q[h++]; if(cur===b.i) break; for(const e of NODES[cur].e){ if(prev[e.n]!==-1) continue; prev[e.n]=cur; q.push(e.n); } }
  if(prev[b.i]===-1) return null; const out=[]; let c=b.i; while(c!==a.i){ out.push(NODES[c]); c=prev[c]; } out.reverse(); return out;
}
function reachSet(from){ const seen=new Set(); if(!from) return seen; seen.add(from.i); const q=[from.i];
  while(q.length){ const c=q.pop(); for(const e of NODES[c].e) if(!seen.has(e.n)){ seen.add(e.n); q.push(e.n); } } return seen; }
function surfaceY(c,r,up){ if(!inB(c,r)) return null; const L=CELLN[r*W+c]; if(!L.length) return null; let best=L[0];
  for(const n of L) if(up?n.h>best.h:n.h<best.h) best=n; if(up&&best.h<1) return null; if(!up&&best.h>0.01) return null; return best.h; }
function pickOrbs(seed,count){
  const R=mulberry(seed), sc=cellOf(SPAWN_RUN.x), sr=cellOf(SPAWN_RUN.z);
  const sh=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=(R()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
  const mk=(list,up)=>(list||[]).map(([c,r])=>{ const y=surfaceY(c,r,up); return y===null?null:Object.assign({c,r,y},ctr(c,r)); }).filter(Boolean);
  const res=[]; for(const zl of (ORBC.zones||[])){ const z=sh(mk(zl,false)); if(z[0]&&res.length<count) res.push(z[0]); }
  const U=sh(mk(ORBC.up,true)), O=sh(mk(ORBC.ground,false)), upN=U.length?Math.max(1,Math.round(count*0.25)):0;
  const far=(p,minD)=>res.every(q=>Math.hypot(q.c-p.c,q.r-p.r)>=minD)&&Math.hypot(p.c-sc,p.r-sr)>=5;
  for(const minD of [4,3,0]) for(const p of U){ if(res.filter(q=>q.y>0).length>=upN||res.length>=count) break; if(!res.includes(p)&&far(p,minD)) res.push(p); }
  for(const minD of [5,4,3,2,0]){ for(const p of O){ if(res.length>=count) break; if(!res.includes(p)&&far(p,minD)) res.push(p); } if(res.length>=count) break; }
  return res.slice(0,count);
}
/* map sanity checks — printed to the console and shown in the menu for map authors */
function validateMap(){
  const w=[]; const run=nearestNode(SPAWN_RUN.x,0,SPAWN_RUN.z), seek=nearestNode(SPAWN_SEEK.x,0,SPAWN_SEEK.z);
  if(!run) w.push('도망자 스폰 위치가 걸을 수 있는 칸이 아니에요'); if(!seek) w.push('술래 스폰 위치가 걸을 수 있는 칸이 아니에요');
  if(!run||!seek) return w;
  const R=reachSet(run), Sk=reachSet(seek);
  const df=doorFront(), dn=nearestNode(df.x,0,df.z); if(!dn||!R.has(dn.i)) w.push('도망자가 탈출문 앞까지 갈 수 없어요');
  if(!R.has(seek.i)) w.push('도망자 스폰에서 술래 스폰까지 길이 없어요');
  const chk=(list,up,label)=>(list||[]).forEach(([c,r])=>{ const y=surfaceY(c,r,up); if(y===null){ w.push(`${label} 구슬 후보 (${c},${r})에 ${up?'위층':'바닥'} 발판이 없어요`); return; }
    const n=CELLN[r*W+c].find(n=>Math.abs(n.h-y)<0.01); if(!R.has(n.i)) w.push(`${label} 구슬 후보 (${c},${r})에 도망자가 갈 수 없어요`); if(!Sk.has(n.i)) w.push(`${label} 구슬 후보 (${c},${r})에 술래가 갈 수 없어요`); });
  (ORBC.zones||[]).forEach((zl,i)=>chk(zl,false,(ZONES[i]&&ZONES[i].n||i)+'구역')); chk(ORBC.up,true,'위층'); chk(ORBC.ground,false,'바닥');
  if(PORTALS.length&&PORTALS.length!==2) w.push('텔레포트 문은 0개나 2개여야 해요');
  PORTALS.forEach((p,i)=>{ if(blockedAt(p.ex,p.ez,0,PH,false)) w.push(`텔레포트 ${i+1}번 출구가 막혀 있어요`); });
  const total=(ORBC.ground||[]).length+(ORBC.up||[]).length+(ORBC.zones||[]).reduce((a,z)=>a+z.length,0); if(total<15) w.push(`구슬 후보가 ${total}개뿐이에요. 방 설정 최대치(15개)를 위해 15개 이상 넣어 주세요`);
  return w;
}

/* distance along a ray to the first wall/solid (for gunshots) */
function rayDist(ox,oy,oz,dx,dy,dz,maxD){ for(let t=0.3;t<maxD;t+=0.15){ if(pointSolid(ox+dx*t,oy+dy*t,oz+dz*t)) return t; } return maxD; }
/* ray vs standing player (vertical cylinder) — returns distance or -1 */
function rayPlayer(ox,oy,oz,dx,dy,dz,px,py,pz,ph,rad){
  rad=rad||0.5; const fx=ox-px, fz=oz-pz, a=dx*dx+dz*dz; if(a<1e-6) return -1;
  const b=2*(fx*dx+fz*dz), c=fx*fx+fz*fz-rad*rad, disc=b*b-4*a*c; if(disc<0) return -1;
  const sq=Math.sqrt(disc);
  for(const t of [(-b-sq)/(2*a),(-b+sq)/(2*a)]){ if(t<0) continue; const y=oy+dy*t; if(y>=py&&y<=py+ph) return t; }
  return -1;
}
