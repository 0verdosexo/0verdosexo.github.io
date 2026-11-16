/* world.js — turns a map definition (after setMapData) into three.js meshes.
   Static geometry is merged per material; destructible objects get their own meshes so they can break. */
'use strict';
const World=(()=>{
  let root=null, TH=null, mapDef=null; const objMeshes=new Map(); const anims=[]; let lightBudget=0; const lampLights=[];
  /* ---------- material registry ---------- */
  const MAT={};
  function mat(key){ if(MAT[key]) return MAT[key]; let m;
    const [ns,a,b]=key.split(':');
    if(ns==='st'){ const S=STYLES[a]||STYLES.concrete; m=Assets.pbr(key,S[b]||S.ext); }
    else if(ns==='th'){ m=Assets.pbr(key+':'+TH.hdri,TH[a]); }
    else if(ns==='pbr'){ m=Assets.pbr(key,JSON.parse(decodeURIComponent(a))); }
    else if(ns==='c'){ m=new THREE.MeshStandardMaterial({color:a,roughness:b?+b:0.6,metalness:0.1}); }
    else if(ns==='e'){ m=new THREE.MeshStandardMaterial({color:'#000',emissive:a,emissiveIntensity:b?+b:2,roughness:1}); }
    else m=SPECIAL[key]?SPECIAL[key]():new THREE.MeshStandardMaterial({color:'#f0f'});
    MAT[key]=m; return m; }
  const P=o=>'pbr:'+encodeURIComponent(JSON.stringify(o));
  const SPECIAL={
    metalDark:()=>Assets.pbr('metalDark',{tex:'metal_panel',tile:1.5,color:'#55585e',rough:0.45,metal:0.7}),
    rustBeam:()=>Assets.pbr('rustBeam',{tex:'rust_metal',tile:1.5,metalMap:true}),
    grate:()=>{ const m=Assets.pbr('grate',{tex:'grate',tile:1.2,metalMap:true,color:'#a9adb2'}); return m; },
    glass:()=>new THREE.MeshPhysicalMaterial({color:'#9fd0ff',roughness:0.05,metalness:0,transmission:0,transparent:true,opacity:0.28,envMapIntensity:1.5,depthWrite:false}),
    glassDark:()=>new THREE.MeshStandardMaterial({color:'#0c1626',roughness:0.08,metalness:0.6,envMapIntensity:1.4}),
    water:()=>{ const m=new THREE.MeshStandardMaterial({color:'#1f6fa8',roughness:0.04,metalness:0.1,envMapIntensity:1.6,transparent:true,opacity:0.86});
      const n=Assets.texSet('plaza_tiles').normalMap.clone(); return m; },
    wood:()=>{ const t=Assets.canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#8a6034'; g.fillRect(0,0,w,h); const R=mulberry(7);
        for(let i=0;i<8;i++){ const y=i*h/8; g.fillStyle=`hsl(28,${40+R()*15}%,${26+R()*12}%)`; g.fillRect(0,y+2,w,h/8-4);
          for(let k=0;k<30;k++){ g.fillStyle='rgba(40,20,5,0.18)'; g.fillRect(R()*w,y+3+R()*(h/8-8),20+R()*60,1); } }
        g.strokeStyle='#3a2410'; g.lineWidth=10; g.strokeRect(5,5,w-10,h-10); g.beginPath(); g.moveTo(10,10); g.lineTo(w-10,h-10); g.stroke(); },true);
      return new THREE.MeshStandardMaterial({map:t,roughness:0.85}); },
    hazard:()=>{ const t=Assets.canvasTex(128,32,(g,w,h)=>{ g.fillStyle='#f2c418'; g.fillRect(0,0,w,h); g.fillStyle='#161616'; for(let x=-h;x<w+h;x+=32){ g.beginPath(); g.moveTo(x,0); g.lineTo(x+16,0); g.lineTo(x+16-h,h); g.lineTo(x-h,h); g.fill(); } },true);
      t.repeat.set(1,1); return new THREE.MeshStandardMaterial({map:t,roughness:0.6,metalness:0.2}); },
    redBarrel:()=>{ const t=Assets.canvasTex(256,128,(g,w,h)=>{ g.fillStyle='#b8231c'; g.fillRect(0,0,w,h); g.fillStyle='rgba(0,0,0,0.25)'; for(let i=0;i<300;i++) g.fillRect(Math.random()*w,Math.random()*h,2,2);
        g.fillStyle='#f2c418'; g.beginPath(); g.moveTo(64,30); g.lineTo(96,90); g.lineTo(32,90); g.closePath(); g.fill(); g.fillStyle='#111'; g.font='bold 44px sans-serif'; g.textAlign='center'; g.fillText('!',64,86);
        g.fillStyle='#f2c418'; g.beginPath(); g.moveTo(192,30); g.lineTo(224,90); g.lineTo(160,90); g.closePath(); g.fill(); g.fillStyle='#111'; g.fillText('!',192,86); },true);
      return new THREE.MeshStandardMaterial({map:t,roughness:0.45,metalness:0.55}); },
    soil:()=>new THREE.MeshStandardMaterial({color:'#3b2a1c',roughness:1}),
    leaf:()=>new THREE.MeshStandardMaterial({color:'#4f7a32',roughness:0.85,flatShading:true}),
    leaf2:()=>new THREE.MeshStandardMaterial({color:'#2f6a3a',roughness:0.85,flatShading:true}),
    bark:()=>new THREE.MeshStandardMaterial({color:'#5a4130',roughness:1}),
    lamp:()=>new THREE.MeshStandardMaterial({color:'#fff',emissive:'#fff4dc',emissiveIntensity:2.2,roughness:1}),
    sail:()=>new THREE.MeshStandardMaterial({color:'#ffffff',roughness:0.9,side:THREE.DoubleSide}),
    sailBlue:()=>new THREE.MeshStandardMaterial({color:'#2f7fe0',roughness:0.8,side:THREE.DoubleSide}),
    tire:()=>new THREE.MeshStandardMaterial({color:'#151515',roughness:0.9}),
    chrome:()=>new THREE.MeshStandardMaterial({color:'#ddd',roughness:0.15,metalness:1}),
    pkPlat:()=>new THREE.MeshStandardMaterial({color:'#2b2f3a',roughness:0.4,metalness:0.4}),
    voidDark:()=>new THREE.MeshBasicMaterial({color:TH.void}),
  };
  /* ---------- merged geometry buckets ---------- */
  class Bucket{ constructor(key,shadow){ this.key=key; this.p=[]; this.n=[]; this.uv=[]; this.i=[]; this.shadow=shadow!==false; }
    quad(a,b,c,d,n,ua,ub,uc,ud){ const k=this.p.length/3; this.p.push(...a,...b,...c,...d); for(let j=0;j<4;j++) this.n.push(...n); this.uv.push(...ua,...ub,...uc,...ud); this.i.push(k,k+1,k+2,k,k+2,k+3); }
    tri(a,b,c,n,ua,ub,uc){ const k=this.p.length/3; this.p.push(...a,...b,...c); for(let j=0;j<3;j++) this.n.push(...n); this.uv.push(...ua,...ub,...uc); this.i.push(k,k+1,k+2); }
    geo(){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2)); g.setIndex(this.i); g.computeBoundingSphere(); return g; } }
  let B={};
  const bk=(key,shadow)=>B[key+'|'+(shadow===false?0:1)]||(B[key+'|'+(shadow===false?0:1)]=new Bucket(key,shadow));
  /* box with per-face materials: f={px,nx,py,ny,pz,nz,all}. null = skip face */
  function box(x0,y0,z0,x1,y1,z1,f,shadow){
    const g=k=>f[k]!==undefined?f[k]:f.all;
    let m;
    if((m=g('px'))) bk(m,shadow).quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0],[-z1,y0],[-z0,y0],[-z0,y1],[-z1,y1]);
    if((m=g('nx'))) bk(m,shadow).quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],[z0,y0],[z1,y0],[z1,y1],[z0,y1]);
    if((m=g('pz'))) bk(m,shadow).quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],[x0,y0],[x1,y0],[x1,y1],[x0,y1]);
    if((m=g('nz'))) bk(m,shadow).quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1],[-x1,y0],[-x0,y0],[-x0,y1],[-x1,y1]);
    if((m=g('py'))) bk(m,shadow).quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0],[x0,-z1],[x1,-z1],[x1,-z0],[x0,-z0]);
    if((m=g('ny'))) bk(m,shadow).quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],[x0,z0],[x1,z0],[x1,z1],[x0,z1]);
  }
  const all=m=>({all:m});
  /* break up texture tiling on large surfaces: world-space low-frequency brightness variation */
  function macro(m,amt,scale){ if(m.userData.macro) return m; m.userData.macro=true; const prev=m.onBeforeCompile;
    m.onBeforeCompile=(sh)=>{ if(prev) prev(sh); sh.uniforms.uMacro={value:new THREE.Vector2(amt,scale)};
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWPm;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWPm=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vWPm; uniform vec2 uMacro;
        float mhash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float mnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mhash(i),mhash(i+vec2(1,0)),f.x),mix(mhash(i+vec2(0,1)),mhash(i+vec2(1,1)),f.x),f.y); }`)
        .replace('#include <map_fragment>',`#include <map_fragment>
        { vec2 q=vWPm.xz*uMacro.y+vWPm.y*0.07; float n=mnoise(q)*0.6+mnoise(q*2.7+3.1)*0.3+mnoise(q*7.3)*0.1; diffuseColor.rgb*=mix(1.0-uMacro.x,1.0+uMacro.x*0.6,n); }`); };
    m.customProgramCacheKey=()=>'macro'+amt+'_'+scale; m.needsUpdate=true; return m; }
  function flush(parent){ for(const k in B){ const b=B[k]; if(!b.i.length) continue; const mm=mat(b.key); if(b.key==='th:ground'||b.key==='th:cliff') macro(mm,b.key==='th:ground'?0.32:0.28,b.key==='th:ground'?0.045:0.06);
      const mesh=new THREE.Mesh(b.geo(),mm); mesh.castShadow=b.shadow&&QUALITY.shadow>0; mesh.receiveShadow=true; mesh.matrixAutoUpdate=false; mesh.updateMatrix(); parent.add(mesh); } B={}; }
  /* a separate mesh (for destructibles) built from the same box helper */
  function boxMesh(fn){ const save=B; B={}; fn(); const g=new THREE.Group(); flush(g); B=save; return g; }
  const rnd=mulberry(12345);
  /* ---------- noise (for cliffs) ---------- */
  function hash3(x,y,z){ let h=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return h-Math.floor(h); }
  function vnoise(x,y,z){ const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi; const s=t=>t*t*(3-2*t); const u=s(xf),v=s(yf),w=s(zf);
    const L=(a,b,t)=>a+(b-a)*t; const h=(i,j,k)=>hash3(xi+i,yi+j,zi+k);
    return L(L(L(h(0,0,0),h(1,0,0),u),L(h(0,1,0),h(1,1,0),u),v),L(L(h(0,0,1),h(1,0,1),u),L(h(0,1,1),h(1,1,1),u),v),w); }
  const fbm=(x,y,z)=>vnoise(x*0.15,y*0.15,z*0.15)*0.6+vnoise(x*0.4,y*0.4,z*0.4)*0.3+vnoise(x*1.1,y*1.1,z*1.1)*0.1;

  /* ================= BUILD ================= */
  async function build(def,theme){
    clear(); mapDef=def; TH=theme; root=new THREE.Group(); root.name='world'; R.scene.add(root);
    lightBudget=QUALITY.lights;
    buildGround(); buildCliffs(); buildVoid(); buildSolids(); buildBuildingsExtra(); buildBands(); buildLadders();
    flush(root);
    await Promise.all([buildProps(),buildDecor(),scatter()]);
    buildZones();
    if(TH.rain) addRain(); if(TH.dust) addDust();
    return root;
  }
  function clear(){ if(root){ R.scene.remove(root); root.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); } objMeshes.clear(); anims.length=0; lampLights.length=0; B={}; }

  /* ground: merge runs of walkable cells into rectangles */
  function buildGround(){
    const gk='th:ground', done=new Uint8Array(W*H);
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){ const i=r*W+c; if(done[i]||!(G[i]===1||G[i]===2||G[i]===3)) continue;
      let c1=c; while(c1<W&&!done[r*W+c1]&&(G[r*W+c1]===1||G[r*W+c1]===2||G[r*W+c1]===3)) c1++;
      let r1=r+1; outer: for(;r1<H;r1++){ for(let x=c;x<c1;x++){ const j=r1*W+x; if(done[j]||!(G[j]===1||G[j]===2||G[j]===3)) break outer; } }
      for(let y=r;y<r1;y++) for(let x=c;x<c1;x++) done[y*W+x]=1;
      box(c*CELL,-0.5,r*CELL,c1*CELL,0,r1*CELL,{py:gk});
    }
  }
  /* cliffs / perimeter façades on every wall-cell edge facing open space */
  function buildCliffs(){
    const kind=TH.cliffKind, ck='th:cliff';
    const open=(c,r)=>inB(c,r)&&G[r*W+c]!==0;
    const segs=[]; // {x0,z0,x1,z1,nx,nz,h}
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){ if(G[r*W+c]!==0) continue; const h=WH[r*W+c];
      const x0=c*CELL,x1=x0+CELL,z0=r*CELL,z1=z0+CELL;
      if(open(c,r-1)) segs.push({ax:x1,az:z0,bx:x0,bz:z0,nx:0,nz:-1,h,c,r});
      if(open(c,r+1)) segs.push({ax:x0,az:z1,bx:x1,bz:z1,nx:0,nz:1,h,c,r});
      if(open(c-1,r)) segs.push({ax:x0,az:z0,bx:x0,bz:z1,nx:-1,nz:0,h,c,r});
      if(open(c+1,r)) segs.push({ax:x1,az:z1,bx:x1,bz:z0,nx:1,nz:0,h,c,r});
      /* caps */
      if(h<12) box(x0,0,z0,x1,h,z1,{py:kind==='rock'?ck:'st:concrete:roof'});
    }
    if(kind==='rock'){
      /* displaced rock faces: subdivide each 4m edge into 1m columns x 1m rows, push vertices along the normal by fbm noise */
      const b=bk(ck);
      for(const s of segs){ const hTop=s.h>=12?s.h+4+fbm(s.ax,0,s.az)*6:s.h; const nyS=Math.ceil((hTop+1)/1.3), nxS=4;
        const P=(u,v)=>{ const x=s.ax+(s.bx-s.ax)*u, z=s.az+(s.bz-s.az)*u, y=-1+(hTop+1)*v; const ed=(u<0.02||u>0.98)?0.25:1;
          const d=(fbm(x,y,z)-0.45)*3.2*ed*(y<0.2?0.3:1)+Math.max(0,(y-hTop+3))*0.25*(fbm(z,y,x)-0.2); return [x+s.nx*d*0.9, y, z+s.nz*d*0.9]; };
        for(let j=0;j<nyS;j++) for(let i=0;i<nxS;i++){ const u0=i/nxS,u1=(i+1)/nxS,v0=j/nyS,v1=(j+1)/nyS;
          const a=P(u0,v0),bb=P(u1,v0),cc=P(u1,v1),d=P(u0,v1); const n=[s.nx,0,s.nz];
          const along=v=>(s.nx!==0?(s.nx>0?-v[2]:v[2]):(s.nz>0?v[0]:-v[0]));
          b.quad(a,bb,cc,d,n,[along(a),a[1]],[along(bb),bb[1]],[along(cc),cc[1]],[along(d),d[1]]); }
        if(s.h>=12) box(Math.min(s.ax,s.bx)-(s.nx<0?0:0),hTop-0.5,Math.min(s.az,s.bz),Math.max(s.ax,s.bx),hTop,Math.max(s.az,s.bz),{py:ck});
      }
      /* fill cliff tops so nothing looks hollow from rooftops */
      for(let r=0;r<H;r++) for(let c=0;c<W;c++){ if(G[r*W+c]!==0||WH[r*W+c]<12) continue; const h=WH[r*W+c]+3+fbm(c*4,0,r*4)*5; box(c*CELL,h-1,r*CELL,(c+1)*CELL,h,(r+1)*CELL,{py:ck},false); }
    } else {
      /* façades: building fronts with floors, windows, roof edges. Heights vary per segment for a skyline */
      const fl=kind==='facade_city'?3.6:kind==='wall_factory'?4.5:4;
      for(const s of segs){ const len=Math.hypot(s.bx-s.ax,s.bz-s.az), seed=hash3(s.c,s.r,1);
        const extra=kind==='facade_city'?8+seed*40:kind==='facade_white'?2+seed*10:0; const hTop=(s.h>=12?s.h:s.h)+extra;
        const x0=Math.min(s.ax,s.bx), x1=Math.max(s.ax,s.bx), z0=Math.min(s.az,s.bz), z1=Math.max(s.az,s.bz);
        const fx0=x0-(s.nx===0?0:(s.nx>0?1:0)*0), T=0.01;
        // main face
        const face={}; const fk=s.nx>0?'px':s.nx<0?'nx':s.nz>0?'pz':'nz'; face[fk]=ck;
        box(x0-(s.nx===0?0:0),-0.5,z0,x1,hTop,z1,face);
        if(kind==='wall_factory'){ // pilasters + top ledge
          const pk=s.nx!==0?'z':'x'; const out=0.35;
          const px=(a,b)=>{ if(s.nx!==0){ const X=s.nx>0?x1:x0; box(Math.min(X,X+s.nx*out),0,a,Math.max(X,X+s.nx*out),hTop,b,all('st:factory:trim')); } else { const Z=s.nz>0?z1:z0; box(a,0,Math.min(Z,Z+s.nz*out),b,hTop,Math.max(Z,Z+s.nz*out),all('st:factory:trim')); } };
          if(((s.c+s.r)%2)===0){ if(s.nx!==0) px(z0,z0+0.6); else px(x0,x0+0.6); }
          continue; }
        // windows on each floor
        const nW=Math.max(1,Math.floor(len/2)); const wk=kind==='facade_city'?null:'glassDark';
        for(let f=1;f*fl+2.2<hTop;f++){ const y0=f*fl+0.7, y1=y0+(kind==='facade_city'?1.7:2.0);
          for(let k=0;k<nW;k++){ const u0=(k+0.18)/nW, u1=(k+0.82)/nW; const lit=hash3(s.c*7+k,f,s.r*3);
            let key=wk; if(kind==='facade_city') key=lit>0.62?(lit>0.9?'e:#7fd8ff:1.4':lit>0.78?'e:#ffb36b:1.2':'e:#ffe3b0:0.9'):'glassDark';
            const out=0.04;
            if(s.nx!==0){ const X=s.nx>0?x1:x0; box(Math.min(X,X+s.nx*out),y0,z0+(z1-z0)*u0,Math.max(X,X+s.nx*out),y1,z0+(z1-z0)*u1,{px:s.nx>0?key:null,nx:s.nx<0?key:null},false); }
            else { const Z=s.nz>0?z1:z0; box(x0+(x1-x0)*u0,y0,Math.min(Z,Z+s.nz*out),x0+(x1-x0)*u1,y1,Math.max(Z,Z+s.nz*out),{pz:s.nz>0?key:null,nz:s.nz<0?key:null},false); } } }
        box(x0,hTop-0.3,z0,x1,hTop,z1,{py:'st:concrete:roof'},false);
      }
      for(let r=0;r<H;r++) for(let c=0;c<W;c++){ if(G[r*W+c]!==0||WH[r*W+c]<12) continue; box(c*CELL,WH[r*W+c]-0.4,r*CELL,(c+1)*CELL,WH[r*W+c],(r+1)*CELL,{py:'st:concrete:roof'},false); }
    }
  }
  /* voids: rock walls going down and a dark floor far below */
  function buildVoid(){
    let any=false; const ck=TH.cliffKind==='rock'?'th:cliff':'st:concrete:ext';
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){ if(G[r*W+c]!==4) continue; any=true; const x0=c*CELL,x1=x0+CELL,z0=r*CELL,z1=z0+CELL;
      const nb=(cc,rr)=>inB(cc,rr)&&G[rr*W+cc]!==4&&G[rr*W+cc]!==0;
      if(nb(c,r-1)) box(x0,-40,z0,x1,0,z0+0.01,{pz:ck}); if(nb(c,r+1)) box(x0,-40,z1-0.01,x1,0,z1,{nz:ck});
      if(nb(c-1,r)) box(x0,-40,z0,x0+0.01,0,z1,{px:ck}); if(nb(c+1,r)) box(x1-0.01,-40,z0,x1,0,z1,{nx:ck});
      box(x0,-40,z0,x1,-39.9,z1,{py:'voidDark'},false); }
    if(any){ const g=new THREE.Mesh(new THREE.PlaneGeometry(W*CELL*3,H*CELL*3),new THREE.MeshBasicMaterial({color:TH.void,fog:false})); g.rotation.x=-Math.PI/2; g.position.set(W*CELL/2,-41,H*CELL/2); root.add(g); }
  }
  /* ---------- solids ---------- */
  const sideOut={n:'nz',s:'pz',w:'nx',e:'px'}, sideIn={n:'pz',s:'nz',w:'px',e:'nx'};
  function buildSolids(){
    const bmeta={}; for(const m of GEN.meta) if(m.t==='bld') bmeta[m.id]=m;
    for(const s of SOL){
      if(s.t==='r'){ buildRamp(s); continue; }
      const st=s.style||'concrete', S='st:'+st;
      if(s.oid){ buildObj(s); continue; }
      switch(s.k){
        case 'wall':{ if(s.inner){ box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:S+':int',py:S+':trim',ny:S+':trim'}); break; }
          const f={all:S+':ext',py:S+':trim',ny:S+':trim'}; f[sideIn[s.side]]=S+':int'; box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,f); break; }
        case 'slab': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:S+':trim',py:S+':floor',ny:S+':ceil'}); break;
        case 'roof':{ const bm=bmeta[s.bid]; box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:S+':ext',py:bm&&bm.garden?'th:ground':S+':roof',ny:S+':ceil'});
          if(bm&&bm.garden&&mapDef.theme==='plaza') box(s.x0+1.5,s.y1,s.z0+1.5,s.x1-1.5,s.y1+0.02,s.z1-1.5,{py:P({tex:'grass',tile:3})},false); break; }
        case 'parapet': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:S+':ext',py:S+':trim'}); break;
        case 'rail': buildRail(s); break;
        case 'pillar': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,all(S+':trim')); break;
        case 'container': buildContainer(s); break;
        case 'cover': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:P({tex:'concrete_worn',tile:1.5,color:'#d8d2c6'})}); break;
        case 'planter': buildPlanter(s); break;
        case 'trunk': break;
        case 'bridge': if(mapDef.theme==='plaza') box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'st:neo:trim',py:'st:neo:floor'}); else box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'rustBeam',py:'grate'}); break;
        case 'track': box(s.x0,s.y0-0.6,s.z0,s.x1,s.y1,s.z1,{all:P({tex:'concrete_worn',tile:3,color:'#9a98a0'})});
          for(const z of [s.z0+1.2,s.z1-1.2]) box(s.x0,s.y1,z-0.08,s.x1,s.y1+0.12,z+0.08,all('chrome'),false); break;
        case 'pool': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'st:neo:trim',py:null}); box(s.x0+0.4,s.y1-0.12,s.z0+0.4,s.x1-0.4,s.y1-0.1,s.z1-0.4,{py:'water'},false);
          box(s.x0+0.4,s.y0+0.05,s.z0+0.4,s.x1-0.4,s.y0+0.08,s.z1-0.4,{py:P({tex:'plaza_tiles',tile:1,color:'#7fc8ff'})},false);
          box(s.x0,s.y1-0.02,s.z0,s.x1,s.y1,s.z0+0.4,{py:'st:neo:ext'}); box(s.x0,s.y1-0.02,s.z1-0.4,s.x1,s.y1,s.z1,{py:'st:neo:ext'}); box(s.x0,s.y1-0.02,s.z0,s.x0+0.4,s.y1,s.z1,{py:'st:neo:ext'}); box(s.x1-0.4,s.y1-0.02,s.z0,s.x1,s.y1,s.z1,{py:'st:neo:ext'}); break;
        case 'car': buildCar(s); break;
        case 'vending': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'c:#2a2a33:0.4'}); { const w=s.x1-s.x0<s.z1-s.z0; // emissive front facing the longer open side
            const e='e:'+(s.c||'#2de1ff')+':2.2'; if(w) box(s.x0-0.02,s.y0+0.5,s.z0+0.1,s.x0,s.y1-0.2,s.z1-0.1,{nx:e},false); else box(s.x0+0.1,s.y0+0.5,s.z1,s.x1-0.1,s.y1-0.2,s.z1+0.02,{pz:e},false); } break;
        case 'silo': buildSilo(s); break;
        case 'catwalk': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'rustBeam',py:P({tex:'tread_plate',tile:1.5,metalMap:true})}); break;
        case 'dock': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:P({tex:'concrete_worn',tile:2,color:'#b0aca4'}),py:P({tex:'tread_plate',tile:2,metalMap:true})}); box(s.x0,s.y1,s.z0,s.x1,s.y1+0.01,s.z0+0.25,{py:'hazard'},false); break;
        case 'truck': box(s.x0,s.y0+0.6,s.z0,s.x1,s.y1,s.z1,{all:'c:'+(s.c||'#777')+':0.5'}); for(const x of [s.x0+1,s.x1-1]) for(const z of [s.z0+0.3,s.z1-0.3]) wheel(x,z,0.55,0.4,s.z1-s.z0<s.x1-s.x0?'z':'x'); break;
        case 'machine': box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:P({tex:'metal_panel',tile:1.5,color:'#8fa08a',rough:0.55,metal:0.3})});
          box(s.x0+0.3,s.y1,s.z0+0.3,s.x0+1.2,s.y1+0.8,s.z0+1.2,all('rustBeam')); box(s.x1-0.5,s.y0+0.6,s.z0-0.05,s.x1-0.2,s.y0+0.9,s.z0,{nz:'e:#ff3b2d:2'},false); break;
        case 'conveyor': box(s.x0,s.y0,s.z0,s.x1,s.y1-0.1,s.z1,all(P({tex:'metal_panel',tile:1.5,color:'#6a6f74',rough:0.5,metal:0.4}))); box(s.x0,s.y1-0.1,s.z0+0.1,s.x1,s.y1,s.z1-0.1,{py:'c:#222:0.8'}); break;
        case 'slide': box(s.x0,s.y0,s.z0,s.x1,s.y0+0.5,s.z1,{all:'hazard'}); box(s.x0,s.y0+0.5,s.z0+0.1,s.x1,s.y1,s.z1-0.1,all(P({tex:'metal_panel',tile:1.5,metalMap:true,color:'#666'}))); break;
        case 'pk': { const e=s.pk==='cp'?'e:#ffcc33:2.5':s.pk==='finish'?'e:#33ff88:2.5':s.pk==='start'?'e:#33aaff:2':'e:#ff3df0:2';
          box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'pkPlat'}); const t=0.06; box(s.x0,s.y1,s.z0,s.x1,s.y1+0.02,s.z0+t,{py:e},false); box(s.x0,s.y1,s.z1-t,s.x1,s.y1+0.02,s.z1,{py:e},false);
          box(s.x0,s.y1,s.z0,s.x0+t,s.y1+0.02,s.z1,{py:e},false); box(s.x1-t,s.y1,s.z0,s.x1,s.y1+0.02,s.z1,{py:e},false); break; }
        case 'low': box(s.x0,0,s.z0,s.x1,s.y1,s.z1,all('st:concrete:ext')); break;
        case 'prop': break;
        default: box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,all(S+':ext'));
      }
    }
  }
  function buildRail(s){
    const glass=(s.style==='neo'); const along=(s.x1-s.x0)>(s.z1-s.z0); const L=along?s.x1-s.x0:s.z1-s.z0;
    if(glass){ box(s.x0,s.y0,s.z0,s.x1,s.y1-0.06,s.z1,all('glass'),false); box(s.x0,s.y1-0.06,s.z0,s.x1,s.y1,s.z1,all('chrome')); return; }
    const mk='metalDark', t=0.05, cz=(s.z0+s.z1)/2, cx=(s.x0+s.x1)/2;
    if(along){ box(s.x0,s.y1-0.06,cz-t,s.x1,s.y1,cz+t,all(mk)); box(s.x0,s.y0+0.45,cz-0.025,s.x1,s.y0+0.5,cz+0.025,all(mk),false);
      for(let x=s.x0;x<=s.x1+0.01;x+=Math.max(0.9,L/Math.ceil(L/1.4))) box(Math.min(x,s.x1-0.06),s.y0,cz-t,Math.min(x,s.x1-0.06)+0.06,s.y1,cz+t,all(mk),false); }
    else { box(cx-t,s.y1-0.06,s.z0,cx+t,s.y1,s.z1,all(mk)); box(cx-0.025,s.y0+0.45,s.z0,cx+0.025,s.y0+0.5,s.z1,all(mk),false);
      for(let z=s.z0;z<=s.z1+0.01;z+=Math.max(0.9,L/Math.ceil(L/1.4))) box(cx-t,s.y0,Math.min(z,s.z1-0.06),cx+t,s.y1,Math.min(z,s.z1-0.06)+0.06,all(mk),false); }
  }
  /* ramps: stairs become real steps, other ramps sloped slabs */
  function buildRamp(s){
    const st=s.style||(mapDef.theme==='plaza'?'neo':mapDef.theme==='cyber'?'neon':mapDef.theme==='factory'?'factory':'concrete'), S='st:'+st;
    const base=s.base||0, h=s.h, rise=h-base, along=s.hi==='z0'||s.hi==='z1';
    if(s.stair||s.k==='stairs'){
      const n=Math.max(2,Math.round(rise/0.22)), len=along?s.z1-s.z0:s.x1-s.x0, run=len/n;
      for(let i=0;i<n;i++){ const y1=base+rise*(i+1)/n, yb=Math.max(base-0.25,y1-0.6);
        let x0=s.x0,x1=s.x1,z0=s.z0,z1=s.z1;
        if(s.hi==='z0'){ z1=s.z1-run*i; z0=z1-run; } else if(s.hi==='z1'){ z0=s.z0+run*i; z1=z0+run; }
        else if(s.hi==='x0'){ x1=s.x1-run*i; x0=x1-run; } else { x0=s.x0+run*i; x1=x0+run; }
        box(x0,base===0?0:yb,z0,x1,y1,z1,{all:S+':ext',py:S+':floor'}); }
      if(base>0) slope(s,base-0.35,h-0.35,S+':ceil',true);
      return; }
    slope(s,base,h,s.k==='catwalk'?'grate':S+':floor',false);
    if(s.k==='catwalk') slope(s,base-0.15,h-0.15,'rustBeam',true);
  }
  function slope(s,ya,yb,key,under){
    // corner heights
    const H=(x,z)=>{ let t; if(s.hi==='z0') t=(s.z1-z)/(s.z1-s.z0); else if(s.hi==='z1') t=(z-s.z0)/(s.z1-s.z0); else if(s.hi==='x0') t=(s.x1-x)/(s.x1-s.x0); else t=(x-s.x0)/(s.x1-s.x0); return ya+(yb-ya)*t; };
    const a=[s.x0,H(s.x0,s.z1),s.z1], b=[s.x1,H(s.x1,s.z1),s.z1], c=[s.x1,H(s.x1,s.z0),s.z0], d=[s.x0,H(s.x0,s.z0),s.z0];
    const bkt=bk(key); const along=s.hi==='z0'||s.hi==='z1';
    const uv=p=>along?[p[0],-p[2]*Math.hypot(1,(yb-ya)/(s.z1-s.z0))]:[p[0]*Math.hypot(1,(yb-ya)/(s.x1-s.x0)),-p[2]];
    const n=new THREE.Vector3().crossVectors(new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),new THREE.Vector3(...c).sub(new THREE.Vector3(...a))).normalize();
    if(!under) bkt.quad(a,b,c,d,[n.x,n.y,n.z],uv(a),uv(b),uv(c),uv(d)); else bkt.quad(d,c,b,a,[-n.x,-n.y,-n.z],uv(d),uv(c),uv(b),uv(a));
    if(!under&&!s.base){ // side walls down to the ground
      const sk=key==='grate'?'rustBeam':key.replace(':floor',':trim'); const sb=bk(sk);
      const side=(p,q,nrm)=>{ const p0=[p[0],0,p[2]], q0=[q[0],0,q[2]]; const u=v=>nrm[0]!==0?[v[2]*-nrm[0],v[1]]:[v[0]*nrm[2],v[1]]; sb.quad(p0,q0,q,p,nrm,u(p0),u(q0),u(q),u(p)); };
      if(along){ side(d,a,[-1,0,0]); side(b,c,[1,0,0]); } else { side(a,b,[0,0,1]); side(c,d,[0,0,-1]); }
      if(s.hi==='z0') side(c,d,[0,0,-1]); else if(s.hi==='z1') side(a,b,[0,0,1]); else if(s.hi==='x0') side(d,a,[-1,0,0]); else side(b,c,[1,0,0]);
    }
  }
  function buildContainer(s){ const c=s.c||'#a34a34';
    box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:P({tex:'corrugated',tile:2.6,metalMap:true,color:c}),py:P({tex:'rust_sheet',tile:2,metalMap:true,color:c})});
    const along=(s.x1-s.x0)>(s.z1-s.z0), t=0.06;
    // frame
    const fk=P({tex:'rust_metal',tile:1,metalMap:true,color:c});
    if(along){ for(const x of [s.x0,s.x1-0.15]) box(x,s.y0,s.z0-t,x+0.15,s.y1,s.z1+t,all(fk),false); }
    else { for(const z of [s.z0,s.z1-0.15]) box(s.x0-t,s.y0,z,s.x1+t,s.y1,z+0.15,all(fk),false); }
  }
  function wheel(x,z,r,w,axis){ const g=new THREE.CylinderGeometry(r,r,w,14); g.rotateZ(Math.PI/2); if(axis==='z') g.rotateY(Math.PI/2); const m=new THREE.Mesh(g,mat('tire')); m.position.set(x,r,z); m.castShadow=QUALITY.propShadow; root.add(m); }
  function buildCar(s){
    const along=(s.z1-s.z0)>(s.x1-s.x0), c=s.c||'#333', body=P({tex:'metal_panel',tile:1,metalMap:true,color:c,rough:0.35});
    const y0=s.y0;
    box(s.x0,y0+0.35,s.z0,s.x1,y0+0.95,s.z1,all(body));
    const L=along?s.z1-s.z0:s.x1-s.x0, inset=0.18;
    if(along) box(s.x0+inset,y0+0.95,s.z0+L*0.28,s.x1-inset,y0+1.5,s.z0+L*0.72,{all:'glassDark',py:body});
    else box(s.x0+L*0.28,y0+0.95,s.z0+inset,s.x0+L*0.72,y0+1.5,s.z1-inset,{all:'glassDark',py:body});
    for(const a of [0.18,0.82]) for(const b of [0,1]){ if(along) wheel(b?s.x1-0.1:s.x0+0.1,s.z0+L*a,0.36,0.26,'x'); else wheel(s.x0+L*a,b?s.z1-0.1:s.z0+0.1,0.36,0.26,'z'); }
    const hl='e:#fff2d0:3', tl='e:#ff1830:3';
    if(along){ box(s.x0+0.15,y0+0.6,s.z1,s.x0+0.55,y0+0.78,s.z1+0.02,{pz:hl},false); box(s.x1-0.55,y0+0.6,s.z1,s.x1-0.15,y0+0.78,s.z1+0.02,{pz:hl},false);
      box(s.x0+0.1,y0+0.6,s.z0-0.02,s.x1-0.1,y0+0.72,s.z0,{nz:tl},false); }
    else { box(s.x1,y0+0.6,s.z0+0.15,s.x1+0.02,y0+0.78,s.z0+0.55,{px:hl},false); box(s.x1,y0+0.6,s.z1-0.55,s.x1+0.02,y0+0.78,s.z1-0.15,{px:hl},false);
      box(s.x0-0.02,y0+0.6,s.z0+0.1,s.x0,y0+0.72,s.z1-0.1,{nx:tl},false); }
  }
  function buildSilo(s){ const r=(s.x1-s.x0)/2, cx=(s.x0+s.x1)/2, cz=(s.z0+s.z1)/2, h=s.y1-s.y0;
    const m=new THREE.Mesh(new THREE.CylinderGeometry(r*1.02,r*1.02,h,28,1),mat(P({tex:'rust_sheet',tile:3,metalMap:true,color:'#c8c0b4'})));
    // cylinder UVs in metres
    const uv=m.geometry.attributes.uv; for(let i=0;i<uv.count;i++){ uv.setXY(i,uv.getX(i)*Math.PI*2*r/3,uv.getY(i)*h/3); }
    m.position.set(cx,s.y0+h/2,cz); m.castShadow=QUALITY.shadow>0; m.receiveShadow=true; root.add(m);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(r*0.3,r*1.03,1.2,28),mat('rustBeam')); cap.position.set(cx,s.y1+0.6-0.6,cz); cap.scale.y=0.01; root.add(cap);
    for(const y of [2,6,10]){ const ring=new THREE.Mesh(new THREE.TorusGeometry(r*1.03,0.06,6,32),mat('rustBeam')); ring.rotation.x=Math.PI/2; ring.position.set(cx,s.y0+y,cz); root.add(ring); }
    box(s.x0+0.4,s.y1-0.02,s.z0+0.4,s.x1-0.4,s.y1,s.z1-0.4,{py:'grate'},false);
  }
  function buildPlanter(s){
    box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:mapDef.theme==='plaza'?'st:neo:ext':P({tex:'concrete_worn',tile:1.5}),py:null});
    box(s.x0+0.12,s.y1-0.15,s.z0+0.12,s.x1-0.12,s.y1-0.1,s.z1-0.12,{py:'soil'},false);
    if(s.tree){ const cx=(s.x0+s.x1)/2, cz=(s.z0+s.z1)/2, R2=mulberry(hashStr(cx+','+cz)); tree(cx,s.y1-0.1,cz,s.tree,R2); }
    else { Assets.model('shrub').then(m=>{ if(!m) return; const o=m.scene.clone(); const sc=PROP_DEF.shrub.s; o.scale.setScalar(sc*(s.x1-s.x0)/2); o.position.set((s.x0+s.x1)/2,s.y1-0.1,(s.z0+s.z1)/2); root.add(o); }); }
  }
  function tree(x,y,z,kind,Rn){
    const g=new THREE.Group(); g.position.set(x,y,z);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.2,kind==='cone'?3:2.4,7),mat('bark')); trunk.position.y=kind==='cone'?1.5:1.2; trunk.castShadow=true; g.add(trunk);
    if(kind==='cone'){ for(let i=0;i<3;i++){ const c=new THREE.Mesh(new THREE.ConeGeometry(1.5-i*0.38,1.9,8),mat('leaf2')); c.position.y=2.2+i*1.05; c.rotation.y=Rn()*3; c.castShadow=true; g.add(c); } }
    else { for(let i=0;i<5;i++){ const c=new THREE.Mesh(new THREE.IcosahedronGeometry(0.9+Rn()*0.5,0),mat(i%2?'leaf':'leaf2')); c.position.set((Rn()-0.5)*1.4,2.6+Rn()*1.1,(Rn()-0.5)*1.4); c.rotation.set(Rn()*3,Rn()*3,0); c.castShadow=true; g.add(c); } }
    root.add(g);
  }
  /* destructibles: own mesh so they can be removed */
  function buildObj(s){
    let m;
    if(s.k==='crate') m=boxMesh(()=>box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,all(s.destr?'wood':'metalDark')));
    else if(s.k==='xbarrel'){ m=new THREE.Group(); const c=new THREE.Mesh(new THREE.CylinderGeometry(0.44,0.44,1.2,16),mat('redBarrel')); c.position.y=0.6; c.castShadow=true; m.add(c);
      for(const y of [0.25,0.95]){ const r=new THREE.Mesh(new THREE.TorusGeometry(0.445,0.025,4,20),mat('metalDark')); r.rotation.x=Math.PI/2; r.position.y=y; m.add(r); }
      m.position.set((s.x0+s.x1)/2,s.y0,(s.z0+s.z1)/2); }
    else if(s.k==='bridge') m=boxMesh(()=>{ box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'rustBeam',py:P({tex:'rust_sheet',tile:1.5,metalMap:true,color:'#d0c0a8'})});
      for(let x=s.x0+1;x<s.x1;x+=2) box(x,s.y0-0.5,s.z0,x+0.2,s.y0,s.z1,all('rustBeam')); });
    else if(s.k==='prop'){ m=new THREE.Group(); placeProp(s.prop,m,true); }
    else if(s.k==='wallDep') m=boxMesh(()=>box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:P({tex:'metal_panel',tile:1,metalMap:true,color:'#8fa6b8'}),py:'hazard'}));
    else m=boxMesh(()=>box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,all('st:concrete:ext')));
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=QUALITY.propShadow||s.k==='bridge'; o.receiveShadow=true; } });
    root.add(m); objMeshes.set(s.oid,{mesh:m,s});
  }
  /* windows / doors frames, building signs, interior lights */
  function buildBuildingsExtra(){
    const bm={}; for(const m of GEN.meta) if(m.t==='bld') bm[m.id]=m;
    for(const m of GEN.meta){
      if(m.t==='win'||m.t==='door'){ const b=bm[m.bid]; if(!b) continue; const S='st:'+(b.style||'concrete');
        const fk=STYLES[b.style]&&STYLES[b.style].neon?'metalDark':S+':trim', d=0.42, t=0.09;
        const y0=m.t==='win'?m.y0:m.floor*b.fh, y1=m.t==='win'?m.y1:m.floor*b.fh+2.6, a=m.c-m.w/2, c=m.c+m.w/2;
        const frame=(ax,az,bx,bz,yy0,yy1)=>box(ax,yy0,az,bx,yy1,bz,all(fk),false);
        if(m.side==='n'||m.side==='s'){ const zc=m.side==='n'?b.z0+0.15:b.z1-0.15;
          frame(a-t,zc-d/2,a,zc+d/2,y0,y1); frame(c,zc-d/2,c+t,zc+d/2,y0,y1); frame(a-t,zc-d/2,c+t,zc+d/2,y1,y1+t);
          if(m.t==='win'){ frame(a-t,zc-d/2-0.08,c+t,zc+d/2+0.08,y0-0.05,y0); if(b.style==='neo'||b.style==='neon') frame((a+c)/2-0.03,zc-0.03,(a+c)/2+0.03,zc+0.03,y0,y1); } }
        else { const xc=m.side==='w'?b.x0+0.15:b.x1-0.15;
          frame(xc-d/2,a-t,xc+d/2,a,y0,y1); frame(xc-d/2,c,xc+d/2,c+t,y0,y1); frame(xc-d/2,a-t,xc+d/2,c+t,y1,y1+t);
          if(m.t==='win'){ frame(xc-d/2-0.08,a-t,xc+d/2+0.08,c+t,y0-0.05,y0); if(b.style==='neo'||b.style==='neon') frame(xc-0.03,(a+c)/2-0.03,xc+0.03,(a+c)/2+0.03,y0,y1); } }
      }
      if(m.t==='light'){ const b=bm[m.bid]; if(!b) continue; const neon=STYLES[b.style]&&STYLES[b.style].neon;
        const key=neon?'e:'+STYLES[b.style].accent+':2.4':'lamp';
        const nx=Math.max(1,Math.round((b.x1-b.x0)/7)), nz=Math.max(1,Math.round((b.z1-b.z0)/7));
        for(let i=0;i<nx;i++) for(let j=0;j<nz;j++){ const x=b.x0+(i+0.5)*(b.x1-b.x0)/nx, z=b.z0+(j+0.5)*(b.z1-b.z0)/nz;
          if(!slabAbove(x,z,m.y)) continue; box(x-0.6,m.y-0.05,z-0.15,x+0.6,m.y,z+0.15,{ny:key},false); }
        if(lightBudget>0&&(b.x1-b.x0)*(b.z1-b.z0)>150){ lightBudget--; const L=new THREE.PointLight(neon?STYLES[b.style].accent:'#ffe8c8',neon?18:14,Math.max(b.x1-b.x0,b.z1-b.z0)*0.8,1.6);
          L.position.set(m.x,m.y-0.6,m.z); root.add(L); }
      }
      if(m.t==='bld'&&m.sign){ sign(m); }
      if(m.t==='bld'){ const S='st:'+m.style; box(m.x0+0.3,0,m.z0+0.3,m.x1-0.3,0.02,m.z1-0.3,{py:S+':floor'},true);
        if(m.server){ for(let x=m.x0+12;x<m.x0+26;x+=2.2) box(x,0,m.z0+1,x+1.2,2.2,m.z0+2.2,{all:'metalDark',pz:'e:#3dff8a:0.8'}); } }
    }
  }
  function slabAbove(x,z,y){ const L=cellSolids(x,z); if(!L) return false; return L.some(s=>(s.k==='slab'||s.k==='roof')&&x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&Math.abs(s.y0-y)<0.1); }
  function textTex(txt,color,w,h,neon){ return Assets.canvasTex(w,h,(g,W2,H2)=>{ g.clearRect(0,0,W2,H2); if(!neon){ g.fillStyle='#1c2430'; g.fillRect(0,0,W2,H2); }
      g.font=`900 ${Math.floor(H2*0.62)}px "Pretendard","Noto Sans KR",sans-serif`; g.textAlign='center'; g.textBaseline='middle';
      if(neon){ g.shadowColor=color; g.shadowBlur=H2*0.18; g.strokeStyle=color; g.lineWidth=H2*0.05; g.strokeText(txt,W2/2,H2/2); g.fillStyle='#fff'; g.fillText(txt,W2/2,H2/2); }
      else { g.fillStyle=color; g.fillText(txt,W2/2,H2/2); } },true); }
  function sign(b){ const neon=STYLES[b.style]&&STYLES[b.style].neon, col=neon?STYLES[b.style].accent:'#ffffff';
    const w=Math.min(10,(b.x1-b.x0)*0.5), h=w*0.22; const t=textTex(b.sign,col,512,112,neon);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:!!neon,emissive:neon?'#ffffff':'#000',emissiveMap:neon?t:null,emissiveIntensity:neon?2.2:0,roughness:0.6}));
    m.position.set((b.x0+b.x1)/2,b.floors*b.fh-1.2,b.z1+0.2); root.add(m);
    if(neon&&lightBudget>0){ lightBudget--; const L=new THREE.PointLight(col,10,14,1.8); L.position.set(m.position.x,m.position.y,m.position.z+1.2); root.add(L); }
  }
  function buildLadders(){
    for(const L of LADDERS){ const f=FACE[L.face]; const off=0.25; const x=L.x-f[0]*off, z=L.z-f[1]*off; const half=0.32;
      const k='metalDark';
      if(f[0]===0){ for(const dx of [-half,half]) box(x+dx-0.04,L.y0,z-0.04,x+dx+0.04,L.y1+1,z+0.04,all(k),false);
        for(let y=L.y0+0.3;y<L.y1;y+=0.35) box(x-half,y,z-0.025,x+half,y+0.05,z+0.025,all(k),false); }
      else { for(const dz of [-half,half]) box(x-0.04,L.y0,z+dz-0.04,x+0.04,L.y1+1,z+dz+0.04,all(k),false);
        for(let y=L.y0+0.3;y<L.y1;y+=0.35) box(x-0.025,y,z-half,x+0.025,y+0.05,z+half,all(k),false); }
    }
  }
  /* horizontal bands at each floor line and a cornice at the roof: breaks up flat façades */
  function buildBands(){ for(const b of GEN.meta){ if(b.t!=='bld') continue; const S='st:'+b.style, o=0.09;
      for(let f=1;f<=b.floors;f++){ const y=f*b.fh, h=f===b.floors?0.32:0.16, y0=f===b.floors?y-0.12:y-0.2;
        box(b.x0-o,y0,b.z0-o,b.x1+o,y0+h,b.z0,{all:S+':trim',pz:null},false); box(b.x0-o,y0,b.z1,b.x1+o,y0+h,b.z1+o,{all:S+':trim',nz:null},false);
        box(b.x0-o,y0,b.z0,b.x0,y0+h,b.z1,{all:S+':trim',px:null},false); box(b.x1,y0,b.z0,b.x1+o,y0+h,b.z1,{all:S+':trim',nx:null},false); } } }
  /* instanced boulders along cliff feet and loose rocks on open ground */
  async function scatter(){
    const kind=TH.cliffKind; const want=kind==='rock'?['boulder_a','boulder_b']:kind==='wall_factory'?['barrel_rust','cardboard']:[];
    const pts=[]; const R2=mulberry(hashStr(mapDef.id));
    if(kind==='rock'){ for(let r=1;r<H-1;r++) for(let c=1;c<W-1;c++){ if(G[r*W+c]!==1) continue; const nb=[[0,-1],[0,1],[-1,0],[1,0]].filter(([dx,dz])=>G[(r+dz)*W+c+dx]===0&&WH[(r+dz)*W+c+dx]>=8);
        for(const [dx,dz] of nb){ if(R2()>0.22||pts.length>=40) continue; const x=c*CELL+CELL/2+dx*1.85+(dz?rand(-1.4,1.4):0), z=r*CELL+CELL/2+dz*1.85+(dx?rand(-1.4,1.4):0);
          if(SOL.some(s2=>s2.t==='b'&&x>s2.x0-1&&x<s2.x1+1&&z>s2.z0-1&&z<s2.z1+1)) continue; if(Math.hypot(x-SPAWN_RUN.x,z-SPAWN_RUN.z)<4) continue; pts.push({x,z,s:0.3+R2()*0.32,r:R2()*6.28,m:want[(R2()*want.length)|0]}); } } }
    const byM={}; for(const p of pts) (byM[p.m]=byM[p.m]||[]).push(p);
    for(const m in byM){ const md=await Assets.model(m); if(!md) continue; const list=byM[m]; const meshes=[]; md.scene.updateMatrixWorld(true); md.scene.traverse(o=>{ if(o.isMesh) meshes.push(o); });
      const sc=(PROP_DEF[m]||{}).s||1; const o3=new THREE.Object3D();
      for(const src of meshes){ const im=new THREE.InstancedMesh(src.geometry,src.material,list.length); im.castShadow=false; im.receiveShadow=true;
        list.forEach((p,i)=>{ o3.position.set(p.x,-md.box.min.y*sc*p.s-0.35*p.s,p.z); o3.rotation.set(0,p.r,0); o3.scale.setScalar(sc*p.s); o3.updateMatrix(); im.setMatrixAt(i,new THREE.Matrix4().multiplyMatrices(o3.matrix,src.matrixWorld)); });
        root.add(im); } }
  }
  /* ---------- GLB props ---------- */
  async function placeProp(pr,parent,isObj){
    const m=await Assets.model(pr.m); if(!m) { const s=pr.solid||[0.8,0.8,1]; parent.add(boxMesh(()=>box(pr.x-s[0]/2,pr.y||0,pr.z-s[1]/2,pr.x+s[0]/2,(pr.y||0)+s[2],pr.z+s[1]/2,all('metalDark')))); return; }
    const o=m.scene.clone(true); const sc=(pr.s||(PROP_DEF[pr.m]||{}).s||1); o.scale.setScalar(sc); o.rotation.y=pr.rot||0;
    o.position.set(pr.x,(pr.y||0)-m.box.min.y*sc,pr.z);
    o.traverse(c=>{ if(c.isMesh){ c.castShadow=QUALITY.propShadow; c.receiveShadow=true; } });
    parent.add(o);
    const d=PROP_DEF[pr.m]; if(d&&d.light&&lightBudget>0&&QUALITY.lights>3){ lightBudget--; const L=new THREE.PointLight(d.light,mapDef.theme==='cyber'?14:8,16,1.8); L.position.set(pr.x,(pr.y||0)+(d.ly||1.5),pr.z); parent.add(L); }
  }
  function buildProps(){ const ps=[]; for(const pr of (mapDef.props||[])){ if(pr.destr) continue; ps.push(placeProp(pr,root)); } return Promise.all(ps); }
  /* ---------- decor (outside the play area) ---------- */
  async function buildDecor(){
    for(const d of (mapDef.decor||[])){
      if(d.t==='tower'){ const g=boxMesh(()=>{ const w=d.w||8, h=d.h||40; box(d.x-w/2,0,d.z-w/2,d.x+w/2,h,d.z+w/2,{all:P({tex:'concrete_worn',tile:4,color:'#d8d0c0'})});
          box(d.x-w/2-1,h,d.z-w/2-1,d.x+w/2+1,h+1.2,d.z+w/2+1,all('rustBeam')); for(let y=6;y<h;y+=6) box(d.x-w/2-0.05,y,d.z-w/2-0.05,d.x+w/2+0.05,y+0.5,d.z+w/2+0.05,all('st:metal:trim')); }); root.add(g); }
      else if(d.t==='dish'){ const g=new THREE.Group(); const dish=new THREE.Mesh(new THREE.SphereGeometry(d.r,32,12,0,Math.PI*2,0,0.75),new THREE.MeshStandardMaterial({color:'#ece8e0',roughness:0.5,metalness:0.2,side:THREE.DoubleSide}));
        dish.rotation.x=Math.PI*0.62; dish.position.y=d.r*1.25; g.add(dish); const post=new THREE.Mesh(new THREE.CylinderGeometry(1.2,2,d.r*1.1,10),mat('st:white:ext')); post.position.y=d.r*0.55; g.add(post);
        const horn=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,d.r*0.9,6),mat('chrome')); horn.position.set(0,d.r*1.25,0); horn.rotation.x=Math.PI*0.12; g.add(horn);
        g.position.set(d.x,0,d.z); g.rotation.y=d.rot||0; g.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); root.add(g); }
      else if(d.t==='facade'){ const g=boxMesh(()=>{ const w=d.w, h=d.h; const hor=Math.abs(Math.sin(d.rot||0))<0.5;
          const x0=hor?d.x-w/2:d.x-6, x1=hor?d.x+w/2:d.x+6, z0=hor?d.z-6:d.z-w/2, z1=hor?d.z+6:d.z+w/2;
          box(x0,0,z0,x1,h,z1,{all:'st:white:ext',py:'st:white:roof'});
          for(let y=4;y<h-2;y+=4){ if(hor) box(x0+1,y,z0-0.05,x1-1,y+1.6,z1+0.05,{pz:'glassDark',nz:'glassDark'},false); else box(x0-0.05,y,z0+1,x1+0.05,y+1.6,z1-1,{px:'glassDark',nx:'glassDark'},false); } }); root.add(g); }
      else if(d.t==='pipe'){ const L=Math.hypot(d.x1-d.x0,d.z1-d.z0); const p=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,L,10),mat('rustBeam'));
        p.position.set((d.x0+d.x1)/2,d.y,(d.z0+d.z1)/2); p.rotation.z=Math.PI/2; p.rotation.y=-Math.atan2(d.z1-d.z0,d.x1-d.x0); p.castShadow=true; root.add(p); }
      else if(d.t==='sign'){ const t=textTex(d.txt,'#e8eef8',512,96,false); const m=new THREE.Mesh(new THREE.PlaneGeometry(d.w,d.w*0.19),new THREE.MeshStandardMaterial({map:t,roughness:0.7}));
        m.position.set(d.x,d.y,d.z); root.add(m); }
      else if(d.t==='neon'){ const t=textTex(d.txt,d.c,512,128,true); const m=new THREE.Mesh(new THREE.PlaneGeometry(d.w,d.h),new THREE.MeshBasicMaterial({map:t,transparent:true,color:new THREE.Color(d.c).multiplyScalar(0.35).addScalar(1.2),fog:true,depthWrite:false}));
        m.position.set(d.x,d.y,d.z); m.rotation.y=d.rot||0; root.add(m); anims.push({t:'flicker',m,base:1,seed:Math.random()*10});
        if(lightBudget>0){ lightBudget--; const L=new THREE.PointLight(d.c,12,16,1.8); const dir=new THREE.Vector3(Math.sin(d.rot||0),0,Math.cos(d.rot||0)); L.position.set(d.x+dir.x*1.5,d.y,d.z+dir.z*1.5); root.add(L); } }
      else if(d.t==='billboard'){ const t=Assets.canvasTex(512,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,d.c); gr.addColorStop(1,'#120a2a'); g.fillStyle=gr; g.fillRect(0,0,w,h);
          g.fillStyle='rgba(255,255,255,0.9)'; g.font='900 64px sans-serif'; g.fillText('NEO//KORP',30,110); g.font='600 30px sans-serif'; g.fillText('미래는 이미 도착했다',34,170); g.strokeStyle='#fff'; g.lineWidth=6; g.strokeRect(12,12,w-24,h-24); },true);
        const m=new THREE.Mesh(new THREE.PlaneGeometry(d.w,d.h),new THREE.MeshBasicMaterial({map:t,color:'#c8c8c8'})); m.position.set(d.x,d.y,d.z); m.rotation.y=d.rot||0; root.add(m); }
      else if(d.t==='holo'){ const m=new THREE.Mesh(new THREE.IcosahedronGeometry(d.s,1),new THREE.MeshBasicMaterial({color:d.c,wireframe:true,transparent:true,opacity:0.55,blending:THREE.AdditiveBlending,depthWrite:false}));
        m.position.set(d.x,d.y,d.z); root.add(m); anims.push({t:'spin',m}); }
      else if(d.t==='cables'){ for(let i=0;i<4;i++){ const pts=[]; const y=d.y+i*0.6; for(let x=0;x<=W*CELL;x+=8) pts.push(new THREE.Vector3(x,y-Math.sin((x%32)/32*Math.PI)*1.2,d.z+i*0.7));
          const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#111'})); root.add(ln); } }
      else if(d.t==='steam'){ anims.push({t:'steam',x:d.x,z:d.z,acc:0}); }
      else if(d.t==='sail'){ const g=new THREE.Group(); const geo=new THREE.BufferGeometry(); const v=new Float32Array([-6,6,-3, 6,5.2,-3, 0,4.4,4, -6,6,-3]);
        geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-6,6.2,-3, 6,5.4,-2.5, 0.5,4.6,4]),3)); geo.computeVertexNormals();
        const s=new THREE.Mesh(geo,mat(Math.random()<0.5?'sail':'sailBlue')); s.castShadow=true; g.add(s);
        for(const p of [[-6,-3],[6,-2.5],[0.5,4]]){ const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,6.4,6),mat('chrome')); pole.position.set(p[0],3.2,p[1]); g.add(pole); }
        g.position.set(d.x,0,d.z); g.rotation.y=d.rot||0; root.add(g); }
      else if(d.t==='chimney'){ const m=new THREE.Mesh(new THREE.CylinderGeometry(d.r*0.8,d.r,d.h,16),mat(P({tex:'factory_brick',tile:3}))); m.position.set(d.x,d.h/2,d.z); root.add(m);
        anims.push({t:'smokestack',x:d.x,y:d.h,z:d.z,acc:0}); }
      else if(d.t==='crane'){ const g=boxMesh(()=>{ const h=d.h, sp=d.span; for(const z of [d.z-sp/2,d.z+sp/2]) for(const x of [d.x-4,d.x+4]) box(x-0.3,0,z-0.3,x+0.3,h,z+0.3,all('hazard'));
          for(const x of [d.x-4,d.x+4]) box(x-0.4,h,d.z-sp/2-1,x+0.4,h+1,d.z+sp/2+1,all(P({tex:'rust_metal',tile:2,metalMap:true,color:'#e0b030'})));
          box(d.x-4.5,h-0.6,d.z-1.5,d.x+4.5,h+1.4,d.z+1.5,all('metalDark')); }); root.add(g); }
      else if(d.t==='skyline'){ skyline(d.theme); }
    }
  }
  /* distant buildings ring (instanced boxes) to give each theme a horizon */
  function skyline(th){
    const n=th==='cyber'?90:th==='plaza'?50:30, cx=W*CELL/2, cz=H*CELL/2, R0=Math.max(W,H)*CELL*0.75;
    const geo=new THREE.BoxGeometry(1,1,1); geo.translate(0,0.5,0);
    const m=th==='cyber'?new THREE.MeshStandardMaterial({color:'#15131f',roughness:0.4,metalness:0.6,emissive:'#2a1a4a',emissiveIntensity:0.25})
      :th==='plaza'?new THREE.MeshStandardMaterial({color:'#e8eef6',roughness:0.5,metalness:0.1}):new THREE.MeshStandardMaterial({color:'#6a645c',roughness:0.9});
    const im=new THREE.InstancedMesh(geo,m,n); const R2=mulberry(99); const o=new THREE.Object3D();
    for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+R2()*0.05, r=R0+R2()*120, w=12+R2()*26, h=(th==='cyber'?60:th==='plaza'?24:18)+R2()*(th==='cyber'?140:th==='plaza'?60:26);
      o.position.set(cx+Math.cos(a)*r,-2,cz+Math.sin(a)*r); o.scale.set(w,h,w*(0.6+R2()*0.8)); o.rotation.y=R2()*3; o.updateMatrix(); im.setMatrixAt(i,o.matrix); }
    root.add(im);
    if(th==='cyber'){ // lit window strips
      const wm=new THREE.MeshBasicMaterial({color:'#ffb36b'}); const wm2=new THREE.MeshBasicMaterial({color:'#6fd8ff'}); const g2=new THREE.PlaneGeometry(1,1);
      const ia=new THREE.InstancedMesh(g2,wm,300), ib=new THREE.InstancedMesh(g2,wm2,300);
      for(let i=0;i<600;i++){ const a=R2()*Math.PI*2, r=R0-6+R2()*100; o.position.set(cx+Math.cos(a)*r,10+R2()*120,cz+Math.sin(a)*r); o.lookAt(cx,o.position.y,cz); o.scale.set(2+R2()*6,0.8,1); o.updateMatrix(); (i%2?ia:ib).setMatrixAt(i>>1,o.matrix); }
      root.add(ia,ib); }
  }
  /* tag zones: translucent yellow floor + glowing edge */
  function buildZones(){
    for(const z of ZONES){ const x0=z.c0*CELL,x1=z.c1*CELL,z0=z.r0*CELL,z1=z.r1*CELL;
      const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),new THREE.MeshBasicMaterial({color:'#ffd21f',transparent:true,opacity:0.12,depthWrite:false}));
      m.rotation.x=-Math.PI/2; m.position.set((x0+x1)/2,0.04,(z0+z1)/2); m.renderOrder=1; m.userData.zone=true; root.add(m);
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(x1-x0,z1-z0)),new THREE.LineBasicMaterial({color:'#ffd21f'})); e.rotation.x=-Math.PI/2; e.position.copy(m.position); e.userData.zone=true; root.add(e); }
  }
  /* weather */
  let rain=null, dust=null;
  function addRain(){ const N=QUALITY.particles>=1?2600:1200; const g=new THREE.BufferGeometry(); const p=new Float32Array(N*6);
    for(let i=0;i<N;i++){ const x=(Math.random()-0.5)*60, y=Math.random()*30, z=(Math.random()-0.5)*60; p.set([x,y,z,x+0.03,y-0.7,z+0.02],i*6); }
    g.setAttribute('position',new THREE.BufferAttribute(p,3)); rain=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#8fa8d8',transparent:true,opacity:0.32,depthWrite:false}));
    rain.frustumCulled=false; root.add(rain); }
  function addDust(){ const N=900; const g=new THREE.BufferGeometry(); const p=new Float32Array(N*3); for(let i=0;i<N*3;i++) p[i]=(Math.random()-0.5)*50;
    g.setAttribute('position',new THREE.BufferAttribute(p,3)); dust=new THREE.Points(g,new THREE.PointsMaterial({color:'#e8dcc0',size:0.05,transparent:true,opacity:0.45,depthWrite:false})); dust.frustumCulled=false; root.add(dust); }
  /* per-frame */
  function update(dt,t){
    const cam=R.camera.position;
    if(rain&&rain.parent){ rain.position.set(cam.x,cam.y-12,cam.z); const p=rain.geometry.attributes.position.array; for(let i=0;i<p.length;i+=6){ p[i+1]-=dt*26; p[i+4]-=dt*26; if(p[i+4]<0){ p[i+1]+=30; p[i+4]+=30; } } rain.geometry.attributes.position.needsUpdate=true; }
    if(dust&&dust.parent){ dust.position.set(cam.x,cam.y,cam.z); dust.rotation.y+=dt*0.02; }
    for(const a of anims){
      if(a.t==='flicker'){ const f=Math.sin(t*17+a.seed)>0.985?0.25:1; a.m.material.opacity=f; }
      else if(a.t==='spin'){ a.m.rotation.y+=dt*0.6; a.m.rotation.x+=dt*0.25; }
      else if((a.t==='steam'||a.t==='smokestack')&&typeof FX!=='undefined'){ a.acc+=dt; if(a.acc>(a.t==='steam'?0.18:0.35)){ a.acc=0;
        if(a.t==='steam') FX.puff(a.x+(Math.random()-0.5)*0.6,0.2,a.z+(Math.random()-0.5)*0.6,{vy:2.2,size:1.6,life:2.2,color:[0.85,0.85,0.9],alpha:0.25,grow:2});
        else FX.puff(a.x,a.y,a.z,{vy:3,vx:1.5,size:5,life:6,color:[0.45,0.43,0.4],alpha:0.35,grow:3}); } }
    }
  }
  /* destructible removal with debris */
  function breakObj(oid){ const o=objMeshes.get(oid); if(!o) return; o.mesh.visible=false; const s=o.s;
    if(typeof FX!=='undefined') FX.debris((s.x0+s.x1)/2,(s.y0+s.y1)/2,(s.z0+s.z1)/2,s.k==='crate'?'wood':s.k==='xbarrel'?'metal':s.k==='bridge'?'metal':'concrete',s.k==='bridge'?40:12); }
  function restoreObj(oid){ const o=objMeshes.get(oid); if(o) o.mesh.visible=true; }
  function addDynObj(s){ buildObj(s); }
  function removeDyn(oid){ const o=objMeshes.get(oid); if(o){ root.remove(o.mesh); objMeshes.delete(oid); } }
  function setZonesVisible(v){ if(root) root.traverse(o=>{ if(o.userData.zone) o.visible=v; }); }
  function resetMats(){ for(const k in MAT) delete MAT[k]; }
  return {resetMats,build,update,breakObj,restoreObj,addDynObj,removeDyn,setZonesVisible,mat,box,boxMesh,flush,get root(){return root;}};
})();
