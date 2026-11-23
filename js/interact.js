/* interact.js — things on the map a player can use.
   · 보급 지점 (supply point, battle only): stand on it and hold E — refills ammo and throwables and heals 50. Each player can use each point once every 30 s.
   · 점프 패드 (jump pad): launches you up onto the container / low roof next to it. No fall damage for a few seconds afterwards.
   Positions come only from the map and its navigation grid, so every client places them identically. Neither is solid, so paths and bots are unaffected. */
'use strict';
const Interact=(()=>{
  let SUP=[], PAD=[], grp=null, M=null;
  const SUP_CD=30, SUP_HOLD=0.8;
  function place(){ SUP=[]; PAD=[]; if(!MAP||!NODES.length||MAP_MODE==='pk'||MAP.interact===false) return;
    const B=MAP.battle||{}, keep=[SPAWN_RUN,SPAWN_SEEK,MAP.jail].concat(B.spawnsA||[],B.spawnsB||[],B.points||[],B.hardpoints||[],B.sites||[],B.flags||[]).filter(Boolean);
    const far=(x,z,d)=>keep.every(p=>Math.hypot(p.x-x,p.z-z)>=d);
    const sky=(x,z)=>{ const c=cellOf(x), r=cellOf(z); if(G[r*W+c]!==1) return false; for(const s of (cellSolids(x,z)||[])) if(overl(s,x,z,0.9)) return false; return true; };
    const open=(n,rr)=>{ if(n.oid||n.h>0.05||!NREACH.has(n.i)||!sky(n.x,n.z)) return false; rr=rr||1.7; for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; if(blockedAt(n.x+Math.cos(a)*rr,n.z+Math.sin(a)*rr,n.h,PH,false)) return false; } return true; };
    const cx=W*CELL/2, cz=H*CELL/2, edge=n=>n.x>18&&n.z>18&&n.x<W*CELL-18&&n.z<H*CELL-18, cand=NODES.filter(n=>open(n)&&edge(n)&&far(n.x,n.z,12));
    /* spread points out: start nearest the middle, then always take the candidate farthest from everything chosen so far */
    const spread=(list,n,minD,first)=>{ const out=[]; if(!list.length) return out; let c=first||list.reduce((b,q)=>Math.hypot(q.x-cx,q.z-cz)<Math.hypot(b.x-cx,b.z-cz)?q:b); out.push(c);
      while(out.length<n){ let best=null, bd=minD; for(const q of list){ let d=1e9; for(const o of out){ const e=Math.hypot(q.x-o.x,q.z-o.z); if(e<d) d=e; } if(d>bd){ bd=d; best=q; } } if(!best) break; out.push(best); } return out; };
    SUP=spread(cand,5,24).map((n,i)=>({i,x:n.x,y:n.h,z:n.z}));
    /* jump pads: on open ground right next to something 2-6 m tall with a flat top to land on (container, low roof, upper floor).
       The jump is simulated with the same gravity and air drag as the game, and a pad is kept only if the arc clears everything and lands on top. */
    const flight=(px,pz,dx,dz,v,k,top)=>{ const e={x:px,z:pz,y:0,vy:v,kx:dx*k,kz:dz*k}; const dt=1/60;
      for(let i=0;i<240;i++){ const mx=e.kx*dt, mz=e.kz*dt; e.kx*=1-dt*1.5; e.kz*=1-dt*1.5; const n=Math.max(1,Math.ceil(Math.hypot(mx,mz)/0.45));
        for(let j=0;j<n;j++){ if(!blockedAt(e.x+mx/n,e.z,e.y,PH,false)) e.x+=mx/n; if(!blockedAt(e.x,e.z+mz/n,e.y,PH,false)) e.z+=mz/n; }
        e.vy-=GRAV*dt; let ny=e.y+e.vy*dt;
        if(e.vy>0){ if(ny+PH>ceilingAt(e.x,e.z,e.y)) return false; }
        else { const g=groundAt(e.x,e.z,e.y); if(ny<=g) return Math.abs(g-top)<0.08&&!blockedAt(e.x,e.z,g,PH,false)&&Math.hypot(e.kx,e.kz)<6?{x:e.x,z:e.z}:false; }
        e.y=ny; } return false; };
    const pc=[]; for(const s of SOL){ if(!live(s)||s.t!=='b'||s.oid||s.destr) continue; const top=s.y1, w=s.x1-s.x0, d=s.z1-s.z0;
      if(top<2||top>6||Math.min(w,d)<2.2||(s.y0>0.3&&s.k!=='slab'&&s.k!=='roof')) continue;
      const mx=(s.x0+s.x1)/2, mz=(s.z0+s.z1)/2;
      for(const [px,pz,dx,dz] of [[s.x0-1.9,mz,1,0],[s.x1+1.9,mz,-1,0],[mx,s.z0-1.9,0,1],[mx,s.z1+1.9,0,-1]]){ const n=nearestNode(px,0,pz,true); if(!n||Math.hypot(n.x-px,n.z-pz)>1.5||!open(n,0.75)||!far(px,pz,9)) continue;
        if(SUP.some(q=>Math.hypot(q.x-px,q.z-pz)<6)) continue; const v=Math.sqrt(2*GRAV*(top+1.1));
        for(const k of [3.4,4.2,5,6,7]){ const L=flight(n.x,n.z,dx,dz,v,k,top); if(L){ pc.push({x:n.x,y:0,z:n.z,dx,dz,v,k,top}); break; } } } }
    PAD=spread(pc,4,26).map((p,i)=>Object.assign({i},p)); }
  function mats(){ if(M) return M; M={ base:new THREE.MeshStandardMaterial({color:'#24272c',roughness:0.55,metalness:0.6}), crate:new THREE.MeshStandardMaterial({color:'#4a5a34',roughness:0.7}),
    g:new THREE.MeshBasicMaterial({color:'#4dff8a'}), off:new THREE.MeshBasicMaterial({color:'#4a4f57'}), o:new THREE.MeshBasicMaterial({color:'#ff8a1f'}), w:new THREE.MeshBasicMaterial({color:'#f2f4f6'}),
    ch:new THREE.MeshBasicMaterial({color:'#ffb04d',transparent:true,opacity:0.85,depthWrite:false,side:THREE.DoubleSide}) }; return M; }
  /* every piece of one marker merged into a single mesh with its colours in the vertices, so each marker costs one draw call */
  function bakeCol(parts){ const L=[]; for(const [geo,col,m] of parts){ const g=(geo.index?geo.toNonIndexed():geo).clone(); if(m) g.applyMatrix4(m); for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal') g.deleteAttribute(k);
      const c=new THREE.Color(col), n=g.attributes.position.count, a=new Float32Array(n*3); for(let q=0;q<n;q++){ a[q*3]=c.r; a[q*3+1]=c.g; a[q*3+2]=c.b; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); L.push(g); }
    return THREE.mergeGeometries(L,false); }
  const mx=(x,y,z,ry,rx)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,0,'YXZ')),new THREE.Vector3(1,1,1));
  function build(){ clear(); if(!SUP.length&&!PAD.length) return; mats(); grp=new THREE.Group(); grp.name='interact';
    const baseG=[], padRing=[];
    const iconGeo=bakeCol([[new THREE.BoxGeometry(0.46,0.3,0.3),'#4a5a34'],[new THREE.BoxGeometry(0.48,0.03,0.32),'#2a2d31',mx(0,0.16,0)],
      [new THREE.BoxGeometry(0.2,0.06,0.006),'#f2f4f6',mx(0,0,0.153)],[new THREE.BoxGeometry(0.06,0.2,0.006),'#f2f4f6',mx(0,0,0.153)],
      [new THREE.BoxGeometry(0.2,0.06,0.006),'#f2f4f6',mx(0,0,-0.153)],[new THREE.BoxGeometry(0.06,0.2,0.006),'#f2f4f6',mx(0,0,-0.153)]]);
    const iconMat=new THREE.MeshLambertMaterial({vertexColors:true}); M.icon=iconMat;
    for(const s of SUP){ const g=new THREE.CylinderGeometry(0.72,0.84,0.07,20); g.translate(s.x,s.y+0.035,s.z); baseG.push(g);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.7,0.035,6,28),M.g); ring.rotation.x=Math.PI/2; ring.position.set(s.x,s.y+0.085,s.z); grp.add(ring); s.ring=ring; s.ready=true;
      const ic=new THREE.Mesh(iconGeo,iconMat); ic.position.set(s.x,s.y+0.95,s.z); grp.add(ic); s.icon=ic; }
    /* chevrons that rise from the pad: three arrows merged into one mesh */
    const sh=new THREE.Shape(); sh.moveTo(-0.34,0); sh.lineTo(0,0.2); sh.lineTo(0.34,0); sh.lineTo(0.34,0.1); sh.lineTo(0,0.3); sh.lineTo(-0.34,0.1); sh.closePath();
    const chG=[0,1,2].map(k=>{ const g=new THREE.ShapeGeometry(sh); g.translate(0,k*0.34,0); return g; }), chevGeo=THREE.mergeGeometries(chG,false);
    for(const p of PAD){ const g=new THREE.CylinderGeometry(0.92,1.0,0.06,24); g.translate(p.x,p.y+0.03,p.z); baseG.push(g);
      const r=new THREE.TorusGeometry(0.86,0.04,6,32); r.rotateX(Math.PI/2); r.translate(p.x,p.y+0.075,p.z); padRing.push(r);
      const ch=new THREE.Mesh(chevGeo,M.ch); ch.position.set(p.x,p.y+0.12,p.z); ch.rotation.y=Math.atan2(p.dx,p.dz)+Math.PI/2; grp.add(ch); p.ch=ch; }
    if(baseG.length){ const m=new THREE.Mesh(THREE.mergeGeometries(baseG,false),M.base); m.receiveShadow=true; grp.add(m); }
    if(padRing.length) grp.add(new THREE.Mesh(THREE.mergeGeometries(padRing,false),M.o));
    grp.traverse(o=>{ if(o.isMesh) o.castShadow=false; }); R.scene.add(grp); }
  function clear(){ if(grp){ R.scene.remove(grp); const seen=new Set(); grp.traverse(o=>{ if(o.isMesh&&!seen.has(o.geometry)){ seen.add(o.geometry); o.geometry.dispose(); } }); grp=null; } }
  const battle=()=>Game.kind==='battle'&&Game.mode!=='gg'&&Game.mode!=='pk';
  function nearSup(a){ if(!battle()||!a.alive) return null; for(const s of SUP) if(Math.abs(a.y-s.y)<0.6&&Math.hypot(a.x-s.x,a.z-s.z)<1.25&&!(a.supCd&&a.supCd[s.i]>Game.t)) return s; return null; }
  /* text for the "hold E" prompt, or null */
  function promptFor(a){ return nearSup(a)?'E 길게: 보급 받기':null; }
  function give(a,s){ for(const sl of a.slots){ const w=sl.w||WPN[sl.id]; if(w&&w.mag){ sl.mag=sl.max; if(w.res) sl.res=Math.max(sl.res,w.res); } }
    const th=a.load&&TH[a.load.thr]; if(th) a.thrLeft=Math.max(a.thrLeft,th.count); a.hp=Math.min(a.maxHp,a.hp+50); (a.supCd=a.supCd||{})[s.i]=Game.t+SUP_CD; a.supHold=0;
    if(a===Game.me){ Bus.emit('hold',null); Sfx.play('reload_rifle',{vol:0.8}); HUD.toast('보급 완료: 탄약 가득 · 체력 +50'); FX.ring(s.x,s.y+0.3,s.z,'#4dff8a',1.2); } }
  function update(dt,I){ if(!grp) return; const me=Game.me, t=Game.t;
    for(const s of SUP){ s.icon.rotation.y=t*1.1+s.i; s.icon.position.y=s.y+0.95+Math.sin(t*2+s.i)*0.06; const ready=!(me&&me.supCd&&me.supCd[s.i]>t); if(ready!==s.ready){ s.ready=ready; s.ring.material=ready?M.g:M.off; s.icon.visible=ready; } }
    for(const p of PAD){ const k=(t*0.9+p.i*0.37)%1; p.ch.position.y=p.y+0.1+k*0.5; p.ch.scale.setScalar(0.85+k*0.3); }
    M.ch.opacity=0.55+Math.sin(t*5)*0.25;
    /* jump pads: human players only — a bot could land somewhere the navigation grid has no way down from */
    for(const a of Game.actors){ if(!a.local||a.bot||!a.alive||!a.gr||a.padCd>t) continue;
      for(const p of PAD) if(Math.abs(a.y-p.y)<0.45&&Math.hypot(a.x-p.x,a.z-p.z)<0.9){ a.vy=p.v; a.gr=false; a.vx=a.vz=0; a.kx=p.dx*p.k; a.kz=p.dz*p.k; a.padCd=t+0.8; a.padT=t+6; Sfx.play('spring_03',{x:a.x,y:a.y,z:a.z,vol:0.9,dist:40}); FX.ring(p.x,p.y+0.15,p.z,'#ff8a1f',1.4); break; } }
    /* supply points: hold E */
    if(!me||me.bot) return; const s=nearSup(me);
    if(s&&I&&I.use){ me.supHold=(me.supHold||0)+dt; Bus.emit('hold',{p:me.supHold/SUP_HOLD,label:'보급 받는 중'}); if(me.supHold>=SUP_HOLD) give(me,s); }
    else if(me.supHold){ me.supHold=0; Bus.emit('hold',null); } }
  return {place,build,clear,update,promptFor,get supplies(){return SUP;},get pads(){return PAD;}};
})();
