/* world.js — builds the 3D scene for the current map (MAP). Everything goes into mapRoot so maps can be swapped.
   Static pieces are merged per material at the end (mergeStatic) to keep draw calls low. */
let mapRoot=new THREE.Group(); scene.add(mapRoot);
const addM=o=>{ mapRoot.add(o); return o; };
const SPX=16;
const M_={}; // materials built per map (reset in rebuildWorld)
function mats(){
  const neo=isNeo(), T=THEME;
  M_.white=MAT({color:'#f2f4f5',roughness:.42,normalMap:PBR.whiteN,normalScale:.35});
  M_.gray=MAT({color:'#9aa3ab',roughness:.55,metalness:.15});
  M_.dark=MAT({color:'#2b3036',roughness:.5,metalness:.4});
  M_.steel=MAT({color:'#7d848b',roughness:.38,metalness:.75});
  M_.glass=MAT({color:neo?'#2f63d6':'#3a4b5c',roughness:.06,metalness:.92,envMapIntensity:1.7,emissive:'#ffcf8a',emissiveIntensity:T.win});
  windowMats.push(M_.glass);
  M_.glassRail=MAT({color:'#5b8cff',roughness:.05,metalness:.6,transparent:true,opacity:.38,envMapIntensity:1.4,depthWrite:false});
  M_.turf=MAT({map:repeatTex(PBR.turfC,1,1),normalMap:repeatTex(PBR.turfN,1,1),normalScale:.8,roughness:.95});
  M_.orange=MAT({color:'#d9774c',roughness:.5,metalness:.3});
  M_.yellow=MAT({color:'#f2c81c',roughness:.45,metalness:.2});
  M_.trunk=MAT({color:'#6b4a32',roughness:.9});
  M_.leafDark=MAT({color:'#2f6b3a',roughness:.85,flatShading:true});
  M_.leafLight=MAT({color:'#7cc25a',roughness:.85,flatShading:true});
  M_.rock=MAT({color:'#7a7f85',roughness:.95,normalMap:PBR.rockN,normalScale:1.2,flatShading:true});
  M_.sail=MAT({color:'#2f5fd0',roughness:.55,side:THREE.DoubleSide});
  M_.stair=MAT({color:'#f4f6f7',roughness:.5});
  M_.nosing=MAT({color:'#2f5fd0',roughness:.4,metalness:.2});
  M_.tread=MAT({color:'#a9afb5',roughness:.45,metalness:.7,normalMap:repeatTex(PBR.treadN,1,1),normalScale:.9});
}
/* ---------- floor: detailed ground + transparent layout overlay (zones, paint) + lawns ---------- */
function buildFloor(){
  const neo=isNeo(), gw=W*CELL, gh=H*CELL, size=1600, tile=neo?8:10;
  const tint=MAP.palette&&MAP.palette.sand&&!neo?`rgb(${MAP.palette.sand.map(v=>Math.min(255,v+28)).join(',')})`:'#ffffff';
  const g=new THREE.Mesh(new THREE.PlaneGeometry(size,size),MAT({map:repeatTex(neo?PBR.concC:PBR.sandC,size/tile,size/tile),normalMap:repeatTex(neo?PBR.concN:PBR.sandN,size/tile,size/tile),normalScale:neo?.55:.9,roughness:neo?.8:.96,color:tint}));
  g.rotation.x=-Math.PI/2; g.position.set(gw/2,0,gh/2); g.userData.dynamic=true; g.receiveShadow=GQ.shadow>0; addM(g);
  const ov=cvTex(W*SPX,H*SPX,(x)=>{
    x.clearRect(0,0,W*SPX,H*SPX);
    for(let r=0;r<H;r++)for(let c=0;c<W;c++) if(G[r*W+c]===2){ x.fillStyle='rgba(70,76,84,.9)'; x.fillRect(c*SPX,r*SPX,SPX,SPX); }
    for(const f of FLOORPAINT) if(!neo){ x.fillStyle=f.color||'#b98483'; x.fillRect(f.c0*SPX,f.r0*SPX,(f.c1-f.c0)*SPX,(f.r1-f.r0)*SPX);
      x.strokeStyle='rgba(60,30,30,.35)'; for(let i=f.c0*SPX;i<f.c1*SPX;i+=5){ x.beginPath(); x.moveTo(i,f.r0*SPX); x.lineTo(i,f.r1*SPX); x.stroke(); } }
    for(const q of ZONES){
      for(let r=q.r0;r<q.r1;r++)for(let c=q.c0;c<q.c1;c++){ if(G[r*W+c]!==1) continue; x.fillStyle='rgba(246,206,40,.42)'; x.fillRect(c*SPX,r*SPX,SPX,SPX); }
      x.save(); x.strokeStyle='rgba(246,200,28,.95)'; x.lineWidth=3; x.setLineDash([7,5]); x.strokeRect(q.c0*SPX+2,q.r0*SPX+2,(q.c1-q.c0)*SPX-4,(q.r1-q.r0)*SPX-4); x.restore();
      x.fillStyle='rgba(120,90,10,.55)'; x.font=`bold ${SPX*1.6}px sans-serif`; x.textAlign='center'; x.textBaseline='middle'; x.fillText(q.n,(q.c0+q.c1)/2*SPX,(q.r0+0.7)*SPX);
    }
    for(const b of BOXES) if(b.k==='slide'){ x.fillStyle='rgba(242,200,28,.85)'; const cx=(b.x0+b.x1)/2/CELL*SPX, cz=(b.z0+b.z1)/2/CELL*SPX, wide=(b.x1-b.x0)>(b.z1-b.z0);
      x.fillRect(cx-(wide?SPX/2:3),cz-(wide?3:SPX/2),wide?SPX:6,wide?6:SPX); }
  });
  const o=new THREE.Mesh(new THREE.PlaneGeometry(gw,gh),MAT({map:ov,transparent:true,depthWrite:false,roughness:.9,polygonOffset:true,polygonOffsetFactor:-2}));
  o.rotation.x=-Math.PI/2; o.position.set(gw/2,0.02,gh/2); o.userData.dynamic=true; o.receiveShadow=GQ.shadow>0; addM(o);
  if(neo) for(const f of FLOORPAINT){ // lawns with a white curb, then grass tufts
    const w=(f.c1-f.c0)*CELL, d=(f.r1-f.r0)*CELL, cx=f.c0*CELL+w/2, cz=f.r0*CELL+d/2;
    const t=MAT({map:repeatTex(PBR.turfC,w/6,d/6),normalMap:repeatTex(PBR.turfN,w/6,d/6),normalScale:.8,roughness:.95});
    const lawn=new THREE.Mesh(new THREE.PlaneGeometry(w-.6,d-.6),t); lawn.rotation.x=-Math.PI/2; lawn.position.set(cx,0.04,cz); lawn.receiveShadow=GQ.shadow>0; addM(lawn);
    for(const [bw,bd,ox,oz] of [[w,.3,0,-d/2+.15],[w,.3,0,d/2-.15],[.3,d,-w/2+.15,0],[.3,d,w/2-.15,0]]) addM(shadowed(new THREE.Mesh(new THREE.BoxGeometry(bw,.14,bd),M_.white),false,true)).position.set(cx+ox,.07,cz+oz);
    scatterGrass(f.c0*CELL+.5,f.r0*CELL+.5,w-1,d-1,0.05);
  }
}
let grassBatch=[];
function scatterGrass(x0,z0,w,d,y){ if(!GQ.grass) return; const n=Math.floor(w*d*0.55*GQ.grass), R=mulberry((x0*13+z0*7)|0); for(let i=0;i<n;i++) grassBatch.push([x0+R()*w,y,z0+R()*d,0.6+R()*0.7,R()*Math.PI]); }
function flushGrass(){
  if(!grassBatch.length) return;
  const tex=cvTex(64,64,(x)=>{ x.clearRect(0,0,64,64); for(let i=0;i<14;i++){ const bx=8+i*3.4, h=30+((i*37)%28); const g=x.createLinearGradient(0,64,0,64-h); g.addColorStop(0,'#2f6b2a'); g.addColorStop(1,'#a8e07a');
    x.strokeStyle=g; x.lineWidth=2.4; x.beginPath(); x.moveTo(bx,64); x.quadraticCurveTo(bx+((i%3)-1)*6,64-h*.6,bx+((i%5)-2)*5,64-h); x.stroke(); } });
  const a=new THREE.PlaneGeometry(.7,.55); a.translate(0,.275,0); const b=a.clone(); b.rotateY(Math.PI/2);
  const geo=THREE.BufferGeometryUtils&&THREE.BufferGeometryUtils.mergeBufferGeometries?THREE.BufferGeometryUtils.mergeBufferGeometries([a,b]):a;
  const mat=MAT({map:tex,alphaTest:.45,side:THREE.DoubleSide,roughness:1,color:'#ffffff'});
  const im=new THREE.InstancedMesh(geo,mat,grassBatch.length), dm=new THREE.Object3D();
  grassBatch.forEach(([x,y,z,s,r],i)=>{ dm.position.set(x,y,z); dm.rotation.set(0,r,0); dm.scale.set(s,s,s); dm.updateMatrix(); im.setMatrixAt(i,dm.matrix); });
  im.instanceMatrix.needsUpdate=true; im.receiveShadow=GQ.shadow>0; addM(im); grassBatch=[];
}
/* ---------- boundary walls ---------- */
function rockGeo(seed){
  const g=new THREE.BoxGeometry(1,1,1,4,5,4), p=g.attributes.position, R=mulberry(seed), map=new Map();
  for(let i=0;i<p.count;i++){ const x=p.getX(i),y=p.getY(i),z=p.getZ(i), k=x.toFixed(3)+','+y.toFixed(3)+','+z.toFixed(3);
    let j=map.get(k); if(!j){ j=[(R()-.5)*.2,y<-.49?0:(R()-.5)*.08,(R()-.5)*.2]; map.set(k,j); }
    const sh=1-(y+.5)*.18, ledge=Math.sin((y+.5)*14+seed)*.035; p.setXYZ(i,x*(sh+ledge)+j[0],y+j[1],z*(sh+ledge)+j[2]); }
  const ng=g.toNonIndexed(); ng.computeVertexNormals();
  const pos=ng.attributes.position, col=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i+=3){ const y=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3+.5; let v=.82+.14*Math.sin(y*19+seed)+(R()-.5)*.06; if(y<.12) v*=.8; v=Math.min(1,v);
    for(let k=0;k<3;k++){ col[(i+k)*3]=v; col[(i+k)*3+1]=v*.96; col[(i+k)*3+2]=v*.93; } }
  ng.setAttribute('color',new THREE.BufferAttribute(col,3)); return ng;
}
function isBuilding(c,r){ return (MAP.buildingWalls||[]).some(([a,b,cc,d])=>c>=a&&c<cc&&r>=b&&r<d); }
function instanced(geo,mat,list,cast){ if(!list.length) return null; const im=new THREE.InstancedMesh(geo,mat,list.length), dm=new THREE.Object3D();
  list.forEach((o,i)=>{ dm.position.set(o.x,o.y,o.z); dm.rotation.set(0,o.ry||0,0); dm.scale.set(o.sx||1,o.sy||1,o.sz||1); dm.updateMatrix(); im.setMatrixAt(i,dm.matrix); if(o.c) im.setColorAt(i,o.c); });
  im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true; im.castShadow=cast!==false&&GQ.shadow>0; im.receiveShadow=GQ.shadow>0; return addM(im); }
function buildWalls(){
  const neo=isNeo(), rock=[], bld=[];
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){ if(G[r*W+c]) continue; let adj=false;
    for(let dy=-1;dy<=1&&!adj;dy++)for(let dx=-1;dx<=1;dx++){ const nc=c+dx,nr=r+dy; if(inB(nc,nr)&&G[nr*W+nc]){ adj=true; break; } }
    if(adj) (neo||isBuilding(c,r)?bld:rock).push([c,r]); }
  if(rock.length){
    const pal=((MAP.palette&&MAP.palette.rock)||['#cf6a43','#d9774c','#c45f3c','#e0855a','#d06d48']).map(h=>lin(h));
    const mat=MAT({vertexColors:true,roughness:.95,normalMap:PBR.rockN,normalScale:1.3}); const bk=[[],[],[]];
    rock.forEach(([c,r],i)=>{ const h=rnd2(c*91+r*7), p=ctr(c,r);
      bk[i%3].push({x:p.x+(rnd2(i+3)-.5)*.8,z:p.z+(rnd2(i+5)-.5)*.8,sx:CELL*1.28,sz:CELL*1.28,sy:8+h*7,ry:rnd2(i)*.6,c:pal[(i*7)%pal.length]});
      if(h>.3) bk[(i+1)%3].push({x:p.x+(rnd2(i+9)-.5)*1.2,z:p.z+(rnd2(i+2)-.5)*1.2,sx:CELL,sz:CELL,sy:3+h*4,y0:7+h*6,ry:rnd2(i+1)*3,c:pal[(i*3)%pal.length]}); });
    const geos=[rockGeo(3),rockGeo(11),rockGeo(29)];
    bk.forEach((b,k)=>instanced(geos[k],mat,b.map(o=>Object.assign(o,{y:(o.y0||0)+o.sy/2})))); 
  }
  if(!bld.length) return;
  const body=[], band=[], stripe=[], cap=[], units=[];
  bld.forEach(([c,r],i)=>{ const p=ctr(c,r), hh=neo?14+Math.round(rnd2(Math.floor(c/3)*13+Math.floor(r/3)*31)*4)*2.5:10+Math.round(rnd2(c*13+r*31)*2)*2.5;
    body.push({x:p.x,y:hh/2,z:p.z,sy:hh});
    for(let f=0;f*4.5+3<hh;f++){ band.push({x:p.x,y:f*4.5+2.5,z:p.z}); stripe.push({x:p.x,y:f*4.5+0.8,z:p.z}); }
    cap.push({x:p.x,y:hh+.2,z:p.z});
    if(rnd2(c*7+r*3)>.78) units.push({x:p.x+(rnd2(c+r)-.5)*1.5,y:hh+.4+.6,z:p.z+(rnd2(c*2+r)-.5)*1.5}); });
  const wallMat=neo?M_.white:MAT({map:repeatTex(PBR.panelC,1,3),normalMap:repeatTex(PBR.panelN,1,3),normalScale:.8,roughness:.55,metalness:.25});
  instanced(new THREE.BoxGeometry(CELL,1,CELL),wallMat,body);
  instanced(new THREE.BoxGeometry(CELL+.12,2.1,CELL+.12),M_.glass,band,false);
  instanced(new THREE.BoxGeometry(CELL+.16,.45,CELL+.16),neo?M_.gray:M_.dark,stripe,false);
  instanced(new THREE.BoxGeometry(CELL+.1,.4,CELL+.1),neo?M_.turf:M_.gray,cap,false);
  instanced(new THREE.CylinderGeometry(.75,.8,1.2,16),M_.steel,units);
}
/* ---------- two/three-storey buildings ---------- */
function buildLowBuildings(){
  const neo=isNeo();
  for(const L of LOWB){
    // a taller block standing on a lower one is inset slightly so their shared faces don't flicker
    const ins=LOWB.some(o=>o!==L&&o.h<L.h&&o.c0<L.c1&&L.c0<o.c1&&o.r0<L.r1&&L.r0<o.r1)?0.12:0;
    const w=(L.c1-L.c0)*CELL-ins, d=(L.r1-L.r0)*CELL-ins, cx=L.c0*CELL+(w+ins)/2, cz=L.r0*CELL+(d+ins)/2, h=L.h, floors=Math.max(1,Math.round(h/4.5));
    const bodyMat=neo?M_.white:MAT({map:repeatTex(PBR.panelC,Math.max(w,d)/6,h/4.5),normalMap:repeatTex(PBR.panelN,Math.max(w,d)/6,h/4.5),normalScale:.8,roughness:.55,metalness:.25});
    addM(shadowed(new THREE.Mesh(rbox(w,h-.4,d,.45,3),bodyMat))).position.set(cx,(h-.4)/2,cz);
    for(let f=0;f<floors;f++){ const y0=f*4.5;
      addM(new THREE.Mesh(rbox(w+.14,neo?2.1:1.1,d+.14,.3,2),M_.glass)).position.set(cx,y0+(neo?2.5:2.6),cz);
      addM(new THREE.Mesh(rbox(w+.18,.5,d+.18,.22,2),neo?M_.gray:M_.dark)).position.set(cx,y0+.75,cz);
      if(neo){ const per=2.6, sides=[[w,0,-d/2-.1,0],[w,0,d/2+.1,0],[d,-w/2-.1,0,Math.PI/2],[d,w/2+.1,0,Math.PI/2]];
        for(const [len,ox,oz,ry] of sides){ const n=Math.max(1,Math.floor(len/per)); for(let k=1;k<n;k++){ const t=-len/2+k*len/n;
          const m=addM(new THREE.Mesh(new THREE.BoxGeometry(.14,2.15,.16),M_.white)); m.rotation.y=ry; m.position.set(cx+ox+(ry?0:t),y0+2.5,cz+oz+(ry?t:0)); } } }
    }
    addM(shadowed(new THREE.Mesh(rbox(w+.5,.42,d+.5,.18,2),neo?M_.white:M_.steel))).position.set(cx,h-.21,cz);
    const roof=new THREE.Mesh(new THREE.PlaneGeometry(w-.4,d-.4),neo?MAT({map:repeatTex(PBR.turfC,w/6,d/6),normalMap:repeatTex(PBR.turfN,w/6,d/6),normalScale:.8,roughness:.95})
      :MAT({color:'#8e959c',normalMap:repeatTex(PBR.treadN,w/3,d/3),roughness:.5,metalness:.6}));
    roof.rotation.x=-Math.PI/2; roof.position.set(cx,h+.01,cz); roof.receiveShadow=GQ.shadow>0; addM(roof);
    if(!neo) for(const [tw,td,ox,oz] of [[w,.25,0,-d/2+.125],[w,.25,0,d/2-.125],[.25,d,-w/2+.125,0],[.25,d,w/2-.125,0]]) addM(new THREE.Mesh(new THREE.BoxGeometry(tw,.08,td),M_.yellow)).position.set(cx+ox,h+.04,cz+oz);
    if(L.name){ const lbl=textSprite(L.name,'#fff7ec','rgba(20,16,14,.5)',0.75); lbl.position.set(cx,h+1.5,cz); addM(lbl); }
  }
}
/* ---------- ramps: real steps in the neo style, tread-plate slopes in the desert style ---------- */
function rampGeo(s){
  const P=[[s.x0,s.z0],[s.x1,s.z0],[s.x1,s.z1],[s.x0,s.z1]].map(([x,z])=>[x,rampH(s,x,z),z]);
  const pos=[],uv=[]; const tri=(a,b,c,ua,ub,uc)=>{ pos.push(...a,...b,...c); uv.push(...ua,...ub,...uc); };
  const T=P, B=P.map(p=>[p[0],0,p[2]]), along=(s.hi==='z0'||s.hi==='z1');
  const tu=p=>along?[(p[0]-s.x0)/2,(p[2]-s.z0)/2]:[(p[2]-s.z0)/2,(p[0]-s.x0)/2];
  tri(T[0],T[3],T[2],tu(T[0]),tu(T[3]),tu(T[2])); tri(T[0],T[2],T[1],tu(T[0]),tu(T[2]),tu(T[1]));
  const side=(i,j)=>{ const a=B[i],b=B[j],c=T[j],d=T[i]; const L=Math.hypot(b[0]-a[0],b[2]-a[2])/4; tri(a,b,c,[0,0],[L,0],[L,c[1]/4]); tri(a,c,d,[0,0],[L,c[1]/4],[0,d[1]/4]); };
  side(0,1); side(1,2); side(2,3); side(3,0);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.computeVertexNormals(); return g;
}
function buildStairs(s){
  const along=s.hi[0]==='z', len=along?s.z1-s.z0:s.x1-s.x0, wid=along?s.x1-s.x0:s.z1-s.z0, base=s.base||0, n=Math.max(2,Math.ceil(len/.34)), dl=len/n;
  for(let i=0;i<n;i++){ // step i counted from the low end
    const top=base+(s.h-base)*(i+1)/n, y0=base>0?base-.02:0, hgt=top-y0;
    const lowAtMin=(s.hi==='x1'||s.hi==='z1'), a=lowAtMin?i*dl:len-(i+1)*dl, mid=a+dl/2;
    const cx=along?(s.x0+s.x1)/2:s.x0+mid, cz=along?s.z0+mid:(s.z0+s.z1)/2;
    addM(shadowed(new THREE.Mesh(new THREE.BoxGeometry(along?wid:dl,hgt,along?dl:wid),M_.stair))).position.set(cx,y0+hgt/2,cz);
    const ne=lowAtMin?-dl/2+.04:dl/2-.04; addM(new THREE.Mesh(new THREE.BoxGeometry(along?wid-.1:.08,.04,along?.08:wid-.1),M_.nosing)).position.set(cx+(along?0:ne),top+.02,cz+(along?ne:0));
  }
}
function buildRampSlope(s){
  const m=addM(shadowed(new THREE.Mesh(rampGeo(s),M_.tread))); m.material.side=THREE.DoubleSide;
  const along=s.hi[0]==='z';
  for(const side of [0,1]){ // pipe handrails along both long edges
    const ex=along?(side?s.x1-.08:s.x0+.08):null, ez=along?null:(side?s.z1-.08:s.z0+.08), L=along?s.z1-s.z0:s.x1-s.x0, n=Math.max(2,Math.round(L/2.5));
    for(let k=0;k<=n;k++){ const t=k/n, x=along?ex:s.x0+(s.x1-s.x0)*t, z=along?s.z0+(s.z1-s.z0)*t:ez, y=rampH(s,x,z);
      addM(new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1,8),M_.orange)).position.set(x,y+.5,z); }
    const A=new THREE.Vector3(along?ex:s.x0,0,along?s.z0:ez), B=new THREE.Vector3(along?ex:s.x1,0,along?s.z1:ez); A.y=rampH(s,A.x,A.z)+1; B.y=rampH(s,B.x,B.z)+1;
    const dir=B.clone().sub(A), bar=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,dir.length(),8),M_.orange);
    bar.position.copy(A).addScaledVector(dir,.5); bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()); addM(bar);
  }
}
function buildStructures(){
  const neo=isNeo();
  for(const s of RAMPS){ if(neo) buildStairs(s); else buildRampSlope(s); }
  const add=(geo,mat,x,y,z)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); addM(m); return m; };
  const crate=MAT({map:texCrate,roughness:.6,metalness:.3});
  for(const b of BOXES){
    const w=b.x1-b.x0, d=b.z1-b.z0, h=b.y1-b.y0, cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2, long=w>d;
    if(b.k==='bridge'){
      shadowed(add(rbox(w,h,d,.06,2),neo?MAT({color:'#d5dbe0',roughness:.5,normalMap:repeatTex(PBR.concN,w/4,d/4),normalScale:.4}):M_.tread,cx,(b.y0+b.y1)/2,cz));
      for(const off of [-0.32,0.32]) shadowed(add(new THREE.BoxGeometry(long?w:.3,.55,long?.3:d),neo?M_.gray:M_.steel,cx+(long?0:off*d),b.y0-.27,cz+(long?off*d:0)));
      const lbl=textSprite('구름다리','#fff7ec','rgba(20,16,14,.45)',0.65); lbl.position.set(cx,b.y1+2.3,cz); addM(lbl);
    } else if(b.k==='rail'){
      if(neo){ add(new THREE.BoxGeometry(w,h,d),M_.glassRail,cx,(b.y0+b.y1)/2,cz).renderOrder=2; add(new THREE.BoxGeometry(w+.06,.08,d+.06),M_.white,cx,b.y1,cz); continue; }
      add(new THREE.CylinderGeometry(.06,.06,long?w:d,8),M_.orange,cx,b.y1-.06,cz).rotation[long?'z':'x']=Math.PI/2;
      const n=Math.max(2,Math.round((long?w:d)/2)); for(let i=0;i<=n;i++){ const t=i/n; add(new THREE.CylinderGeometry(.045,.045,h,8),M_.steel,long?b.x0+w*t:cx,(b.y0+b.y1)/2,long?cz:b.z0+d*t); }
    } else if(b.k==='deck'){ shadowed(add(rbox(w,h,d,.08,2),M_.tread,cx,(b.y0+b.y1)/2,cz));
    } else if(b.k==='pillar'){ shadowed(add(new THREE.BoxGeometry(w,h,d),M_.steel,cx,(b.y0+b.y1)/2,cz));
    } else if(b.k==='slide'){
      const t=texStripe.clone(); PER_MAP_TEX.add(t); t.needsUpdate=true; t.repeat.set(Math.max(w,d)/2,h/2);
      shadowed(add(rbox(w,h,d,.08,2),MAT({map:t,roughness:.6,metalness:.2}),cx,(b.y0+b.y1)/2,cz));
      shadowed(add(new THREE.BoxGeometry(long?w+.2:w+.25,.18,long?d+.25:d+.2),M_.dark,cx,b.y0-.09,cz));
      const lbl=textSprite('슬라이딩','#2b211c','rgba(242,200,28,.92)',0.6); lbl.position.set(cx,b.y1+0.8,cz); addM(lbl);
    } else if(b.k==='crate'){ for(let k=0;k<b.y1;k++) shadowed(add(rbox(w,1,d,.06,2),crate,cx,k+.5,cz));
    } else if(b.k==='planter'){ addPlanter(b); }
  }
}
function addPlanter(b){
  const w=b.x1-b.x0, d=b.z1-b.z0, cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2, h=b.y1-b.y0, long=w>d;
  addM(shadowed(new THREE.Mesh(rbox(w,h,d,.12,2),M_.white))).position.set(cx,b.y0+h/2,cz);
  addM(new THREE.Mesh(rbox(long?w*.8:w+.02,h*.5,long?d+.02:d*.8,.05,1),M_.gray)).position.set(cx,b.y0+h*.48,cz);
  addM(new THREE.Mesh(new THREE.BoxGeometry(w-.24,.06,d-.24),M_.turf)).position.set(cx,b.y1+.02,cz);
  if(b.tree) addTree(cx,b.y1,cz,b.tree,1); else scatterGrass(b.x0+.2,b.z0+.2,w-.4,d-.4,b.y1+.04);
}
function jitterGeo(geo,amt,R,ys){ // move shared corners together so faceted shapes never crack open
  const p=geo.attributes.position, seen=new Map();
  for(let i=0;i<p.count;i++){ const k=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3); let j=seen.get(k); if(j===undefined){ j=1+(R()-.5)*amt; seen.set(k,j); }
    p.setXYZ(i,p.getX(i)*j,p.getY(i)*j*(ys||1),p.getZ(i)*j); }
  geo.computeVertexNormals(); return geo; }
function addTree(x,y,z,kind,s){
  s=s||1; const R=mulberry((x*31+z*17)|0), g=new THREE.Group(); g.position.set(x,y,z); g.scale.set(s,s,s); g.rotation.y=R()*6;
  g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.1,.2,2.4,8),M_.trunk))); g.children[0].position.y=1.2;
  const blob=(r,mat,px,py,pz)=>{ const geo=jitterGeo(new THREE.IcosahedronGeometry(r,1),.28,R); const m=shadowed(new THREE.Mesh(geo,mat)); m.position.set(px,py,pz); g.add(m); };
  if(kind==='cone'){ for(let i=0;i<4;i++){ const c=shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.35-i*.27,1.7,9),M_.leafDark)); c.position.y=2.1+i*.95; c.rotation.y=R()*3; g.add(c); } }
  else { blob(1.25,M_.leafLight,0,3.3,0); blob(.9,M_.leafLight,.75,2.8,.35); blob(.95,M_.leafDark,-.65,2.9,-.3); blob(.8,M_.leafLight,.1,4.1,.15); blob(.7,M_.leafDark,.3,3.2,-.85); }
  addM(g);
}
function addRock(x,y,z,s){ const geo=jitterGeo(new THREE.IcosahedronGeometry(s||1,1),.35,mulberry((x*7+z*3)|0),.7);
  const m=addM(shadowed(new THREE.Mesh(geo,M_.rock))); m.position.set(x,y+(s||1)*.45,z); m.rotation.y=x; }
function addSail(x,z,rot){
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=rot||0;
  g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.6,.15,24),M_.white),false)); g.children[0].position.y=.075;
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,.17,24),M_.gray); ring.position.y=.08; g.add(ring);
  for(const [px,ph] of [[-1.1,6.5],[1.1,5]]){ const p=shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,ph,10),M_.steel)); p.position.set(px,ph/2,0); p.rotation.z=px<0?.08:-.06; g.add(p); }
  const geo=new THREE.PlaneGeometry(2.3,5,8,14), pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){ const u=pos.getX(i), v=pos.getY(i); pos.setZ(i,Math.sin((v+2.5)/5*Math.PI)*0.8-Math.cos(u)*0.2); pos.setX(i,u*(1-(v+2.5)/5*.35)); }
  geo.computeVertexNormals(); const sail=shadowed(new THREE.Mesh(geo,M_.sail)); sail.position.set(0,3.6,0); sail.rotation.z=-.08; g.add(sail);
  addM(g);
}
function addTower(cx,cz,h,w){
  const tt=cvTex(128,512,(x)=>{ x.fillStyle='#e7e8e9'; x.fillRect(0,0,128,512);
    for(let i=0;i<4;i++){ const gx=10+i*30, g=x.createLinearGradient(gx,0,gx+18,0); g.addColorStop(0,'#f2c35a'); g.addColorStop(.5,'#ffe6a0'); g.addColorStop(1,'#d9a03c');
      x.fillStyle=g; x.fillRect(gx,20,18,470); x.fillStyle='rgba(120,110,100,.5)'; for(let y=20;y<490;y+=36) x.fillRect(gx,y,18,3); }
    x.fillStyle='#a7adb3'; x.fillRect(0,0,128,14); x.fillRect(0,494,128,18); });
  const em=cvTex(128,512,(x)=>{ x.fillStyle='#000'; x.fillRect(0,0,128,512); for(let i=0;i<4;i++){ x.fillStyle='#ffcf7a'; x.fillRect(10+i*30,20,18,470); } });
  const mat=MAT({map:tt,emissiveMap:em,emissive:'#ffffff',emissiveIntensity:THEME.win+.15,roughness:.35,metalness:.3}); windowMats.push(mat);
  const g=new THREE.Group();
  const body=shadowed(new THREE.Mesh(rbox(w,h,w,.5,3),mat)); body.position.y=h/2; g.add(body);
  const cap=shadowed(new THREE.Mesh(rbox(w*1.18,1.4,w*1.18,.3,2),M_.steel)); cap.position.y=h+.7; g.add(cap);
  const ring=shadowed(new THREE.Mesh(rbox(w*1.3,1,w*1.3,.3,2),M_.white)); ring.position.y=h*.62; g.add(ring);
  const gm=new THREE.SpriteMaterial({map:haloTex(),color:0xffd27a,transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending}); gm.userData.perMap=true; glowMats.push(gm);
  const glow=new THREE.Sprite(gm); glow.scale.set(w*3,h*1.2,1); glow.position.y=h*.5; g.add(glow);
  g.position.set(cx,0,cz); addM(g);
}
function addDish(cx,cz,rad,rotY){
  const dt=cvTex(256,256,(x)=>{ x.fillStyle='#c3c6ca'; x.fillRect(0,0,256,256); x.strokeStyle='rgba(80,85,92,.5)'; x.lineWidth=1.5;
    for(let i=0;i<28;i++){ const a=i/28*Math.PI*2; x.beginPath(); x.moveTo(128,128); x.lineTo(128+Math.cos(a)*128,128+Math.sin(a)*128); x.stroke(); }
    for(const rr of [40,80,118]){ x.beginPath(); x.arc(128,128,rr,0,7); x.stroke(); }
    const R=mulberry(5); for(let i=0;i<40;i++){ x.fillStyle=`rgba(222,160,80,${.25+R()*.3})`; x.beginPath(); x.ellipse(60+R()*140,150+R()*100,10+R()*30,6+R()*14,R()*3,0,7); x.fill(); } });
  const face=MAT({map:dt,roughness:.4,metalness:.55}), g=new THREE.Group();
  const disc=shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,.6,48,1),[M_.steel,face,face])); disc.rotation.x=Math.PI/2-0.28; disc.position.y=rad*.92; g.add(disc);
  const arm=shadowed(new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,rad*.9,10),M_.steel)); arm.position.set(0,rad*.92+.4,rad*.5); arm.rotation.x=Math.PI/2-0.28; g.add(arm);
  g.rotation.y=rotY; g.position.set(cx,0,cz); addM(g);
}
function addWarehouse(px,pz){
  const g=new THREE.Group();
  const b=shadowed(new THREE.Mesh(rbox(30,16,16,.6,3),MAT({map:repeatTex(PBR.panelC,6,3),normalMap:repeatTex(PBR.panelN,6,3),normalScale:.8,roughness:.55,metalness:.25}))); b.position.y=8; g.add(b);
  const roof=shadowed(new THREE.Mesh(rbox(34,1.2,22,.3,2),M_.white)); roof.position.set(0,16.4,2); roof.rotation.x=-.12; g.add(roof);
  const win=new THREE.Mesh(rbox(30.2,1.6,16.2,.3,2),M_.glass); win.position.y=11; g.add(win);
  const pipe=shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1,1,16,16),M_.steel)); pipe.position.set(-10,8,9); g.add(pipe);
  g.position.set(px,0,pz); addM(g);
}
/* ---------- distant backdrop so the world doesn't end at the walls ---------- */
function buildBackdrop(){
  const neo=isNeo(), cx=W*CELL/2, cz=H*CELL/2, R=mulberry(neo?88:44), base=Math.hypot(W*CELL,H*CELL)/2+60;
  const mk=(hex,haze)=>{ const m=new THREE.MeshLambertMaterial({color:hex,fog:false}); backdropMats.push({m,base:hex,haze}); return m; };
  if(neo){
    const near=mk('#e9edf1',.45), far=mk('#cfd8e2',.7), glassFar=mk('#6f8fd6',.6), list=[];
    for(let i=0;i<110;i++){ const a=R()*Math.PI*2, r=base+40+R()*420, w=12+R()*26, h=25+R()*(r<base+200?90:150);
      list.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r,w,h,R()*Math.PI,r<base+220?near:far]); }
    for(const [x,z,w,h,ry,m] of list){ const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,w*(.6+R()*.6)),m); b.position.set(x,h/2,z); b.rotation.y=ry; addM(b);
      const band=new THREE.Mesh(new THREE.BoxGeometry(w+.4,h*.18,w*(.6+.6)+.4),glassFar); band.position.set(x,h*(.45+R()*.3),z); band.rotation.y=ry; band.scale.z=.55; addM(band); }
  } else {
    const m1=mk('#c9774c',.5), m2=mk('#b8684a',.72);
    for(let i=0;i<70;i++){ const a=R()*Math.PI*2, r=base+60+R()*480, rad=20+R()*45, h=18+R()*60;
      const geo=new THREE.CylinderGeometry(rad*(.55+R()*.25),rad,h,7+((R()*4)|0),3); const p=geo.attributes.position;
      for(let k=0;k<p.count;k++){ const j=1+(R()-.5)*.18; p.setX(k,p.getX(k)*j); p.setZ(k,p.getZ(k)*j); }
      geo.computeVertexNormals(); const m=new THREE.Mesh(geo,r<base+260?m1:m2); m.position.set(cx+Math.cos(a)*r,h/2-1,cz+Math.sin(a)*r); m.rotation.y=R()*6; addM(m); }
  }
  backdropMats.forEach(b=>{ b.m.color.copy(lin(b.base)).lerp(lin(THEME.hor),b.haze); });
}
/* ---------- door & portals (animated, never merged) ---------- */
let doorGate, doorLight;
function buildDoor(){
  const x0=DOOR.c0*CELL, x1=DOOR.c1*CELL, z=DOOR.r0*CELL+CELL*.5;
  const p1=shadowed(new THREE.Mesh(rbox(1.1,8,1.6,.15,2),M_.steel)); p1.position.set(x0+.2,4,z); const p2=p1.clone(); p2.position.x=x1-.2;
  const top=shadowed(new THREE.Mesh(rbox(x1-x0+1.2,1.3,1.8,.2,2),M_.steel)); top.position.set((x0+x1)/2,8,z);
  doorGate=shadowed(new THREE.Mesh(rbox(x1-x0-1,7.2,.5,.08,2),MAT({map:repeatTex(PBR.panelC,2,2),normalMap:repeatTex(PBR.panelN,2,2),roughness:.5,metalness:.3}))); doorGate.position.set((x0+x1)/2,3.6,z);
  doorLight=new THREE.Mesh(new THREE.BoxGeometry(x1-x0-1.2,.35,.3),new THREE.MeshBasicMaterial({color:0xff4a3d,toneMapped:false})); doorLight.position.set((x0+x1)/2,7.25,z+.95);
  for(const o of [p1,p2,top,doorGate,doorLight]){ o.userData.dynamic=true; addM(o); }
  const lbl=textSprite(doorName()+' (탈출구)','#fff7ec','rgba(20,16,14,.5)',0.8); lbl.position.set((x0+x1)/2,9.8,z); addM(lbl);
}
function setDoor(open){ setCol(doorLight.material.color,open?'#5fd38a':'#ff4a3d'); doorGate.userData.target=open?10.5:3.6; }
let portalMeshes=[];
function buildPortals(){
  portalMeshes=[];
  PORTALS.forEach((p)=>{
    const g=new THREE.Group(); g.position.set(p.x,0,p.z); g.rotation.y=p.yaw; g.userData.dynamic=true;
    const ring=shadowed(new THREE.Mesh(new THREE.TorusGeometry(1.55,.17,16,48),MAT({color:'#a06bff',emissive:'#7a3dff',emissiveIntensity:1.6,roughness:.25,metalness:.6}))); ring.position.y=1.85; g.add(ring);
    const frame=shadowed(new THREE.Mesh(new THREE.TorusGeometry(1.72,.07,10,48),M_.steel)); frame.position.y=1.85; g.add(frame);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(1.42,48),new THREE.MeshBasicMaterial({map:texSwirl,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    disc.position.y=1.85; g.add(disc);
    const pad=new THREE.Mesh(new THREE.RingGeometry(1.1,1.6,48),new THREE.MeshBasicMaterial({color:0xa06bff,transparent:true,opacity:.7,toneMapped:false})); pad.rotation.x=-Math.PI/2; pad.position.y=.04; g.add(pad);
    const lbl=textSprite('텔레포트 (도망자 전용)','#fff7ec','rgba(110,60,200,.7)',0.75); lbl.position.y=4.2; g.add(lbl);
    addM(g); portalMeshes.push({g,disc,ring});
  });
}
const doorName=()=>(MAP&&MAP.door&&MAP.door.name)||'탈출문';
/* ---------- merge static meshes per material to cut draw calls ---------- */
function mergeStatic(root){
  const BU=THREE.BufferGeometryUtils; if(!BU||!BU.mergeBufferGeometries) return;
  root.updateMatrixWorld(true);
  const groups=new Map();
  root.traverse(o=>{ if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)) return;
    for(let p=o;p&&p!==root;p=p.parent) if(p.userData.dynamic) return;
    const key=o.material.uuid+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0);
    if(!groups.has(key)) groups.set(key,{mat:o.material,cast:o.castShadow,recv:o.receiveShadow,list:[]});
    groups.get(key).list.push(o); });
  for(const v of groups.values()){
    if(v.list.length<2) continue;
    try{
      const geos=v.list.map(o=>{ let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
        for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') g.deleteAttribute(k);
        if(!g.attributes.normal) g.computeVertexNormals();
        if(!g.attributes.uv) g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
        g.clearGroups(); return g; });
      const merged=BU.mergeBufferGeometries(geos,false); if(!merged) continue;
      for(const o of v.list) o.parent.remove(o);
      const m=new THREE.Mesh(merged,v.mat); m.castShadow=v.cast; m.receiveShadow=v.recv; root.add(m);
    }catch(err){ console.warn('merge skipped',err); }
  }
}
function disposeWorld(){
  mapRoot.traverse(o=>{ if(o.geometry&&!o.isSprite) o.geometry.dispose();
    const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];
    ms.forEach(m=>{ for(const k of ['map','normalMap','emissiveMap']) if(m[k]&&PER_MAP_TEX.has(m[k])) m[k].dispose(); m.dispose(); }); });
  scene.remove(mapRoot); mapRoot=new THREE.Group(); scene.add(mapRoot);
  for(let i=glowMats.length-1;i>=0;i--) if(glowMats[i].userData.perMap) glowMats.splice(i,1);
  windowMats.length=0; backdropMats.length=0; grassBatch=[];
}
function rebuildWorld(){
  disposeWorld(); buildingMap=true;
  try{
    mats(); buildFloor(); buildWalls(); buildLowBuildings(); buildStructures(); buildDoor(); buildPortals();
    for(const d of (MAP.decor||[])){
      if(d.t==='tower') addTower(d.x,d.z,d.h||30,d.w||6); else if(d.t==='dish') addDish(d.x,d.z,d.r||6,d.rot||0); else if(d.t==='warehouse') addWarehouse(d.x,d.z);
      else if(d.t==='tree') addTree(d.x,d.y||0,d.z,d.kind||'round',d.s||1); else if(d.t==='rock') addRock(d.x,d.y||0,d.z,d.s||1); else if(d.t==='sail') addSail(d.x,d.z,d.rot||0);
    }
    if(!isNeo()) scatterDesertScrub();
    flushGrass(); buildBackdrop(); mergeStatic(mapRoot);
  } finally { buildingMap=false; }
  buildMapImage();
}
function scatterDesertScrub(){ // dry tufts and pebbles along the cliff bases
  if(!GQ.grass) return; const R=mulberry(9);
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){ if(G[r*W+c]!==1) continue; const wall=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>inB(c+dx,r+dy)&&G[(r+dy)*W+c+dx]===0); if(!wall||R()>.35) continue;
    const p=ctr(c,r); grassBatch.push([p.x+(R()-.5)*3,0.02,p.z+(R()-.5)*3,0.5+R()*.6,R()*6]); if(R()<.25) addRock(p.x+(R()-.5)*3,0,p.z+(R()-.5)*3,.25+R()*.35); }
}
