/* world.js — turns a map definition (after setMapData) into three.js meshes.
   Static geometry is merged per material; destructible objects get their own meshes so they can break. */
'use strict';
const World=(()=>{
  let root=null, TH=null, mapDef=null; const objMeshes=new Map(); const anims=[]; let lightBudget=0; const lampLights=[];
  /* lamp lights: every lamp in the map is a candidate, but only a small fixed pool of real PointLights exists and it follows the camera.
     Each light costs every lit pixel on screen, so this keeps phones fast while nearby lamps still light the scene. */
  const LAMPS=[]; let pool=[], poolT=0;
  function lamp(col,int,dist,decay,x,y,z){ if(!(QUALITY.lights>0)) return; LAMPS.push({col:new THREE.Color(col),int:int*0.7,dist,decay,x,y,z}); }
  function makePool(){ pool=[]; const K=Math.min(QUALITY.pool!=null?QUALITY.pool:3,LAMPS.length); for(let i=0;i<K;i++){ const L=new THREE.PointLight('#fff',0,10,1.8); L.userData={lamp:null,next:null,a:0}; root.add(L); pool.push(L); } poolT=0; }
  function updatePool(dt){ if(!pool.length) return; const want=QUALITY.lights>0; if(pool[0].visible!==want) for(const L of pool) L.visible=want; if(!want) return;
    poolT-=dt; if(poolT<=0){ poolT=0.3; const c=R.camera.position; const near=LAMPS.map(l=>[l,(l.x-c.x)**2+(l.y-c.y)**2*0.5+(l.z-c.z)**2]).sort((a,b)=>a[1]-b[1]).slice(0,pool.length).map(x=>x[0]);
      const keep=new Set(); for(const L of pool) if(near.includes(L.userData.lamp)&&L.userData.next===L.userData.lamp) keep.add(L.userData.lamp);
      const free=near.filter(l=>!keep.has(l)); for(const L of pool){ const u=L.userData; if(u.lamp&&keep.has(u.lamp)&&u.next===u.lamp) continue; u.next=free.shift()||null; } }
    for(const L of pool){ const u=L.userData;
      if(u.next!==u.lamp){ u.a-=dt*5; if(u.a<=0||!u.lamp){ u.a=0; u.lamp=u.next; if(u.lamp){ const l=u.lamp; L.position.set(l.x,l.y,l.z); L.color.copy(l.col); L.distance=l.dist; L.decay=l.decay; } } }
      else if(u.lamp&&u.a<1) u.a=Math.min(1,u.a+dt*4);
      L.intensity=u.lamp?u.lamp.int*u.a:0; } }
  /* ---------- material registry ---------- */
  const MAT={};
  function mat(key){ if(MAT[key]) return MAT[key]; let m;
    const [ns,a,b]=key.split(':');
    if(ns==='st'){ const S=STYLES[a]||STYLES.concrete; m=Assets.pbr(key,S[b]||S.ext); }
    else if(ns==='th'){ m=Assets.pbr(key+':'+TH.hdri,TH[a]); }
    else if(ns==='pbr'){ m=Assets.pbr(key,JSON.parse(decodeURIComponent(a))); }
    else if(ns==='c'){ m=new THREE.MeshStandardMaterial({color:a,roughness:b?+b:0.6,metalness:0.1}); }
    else if(ns==='e'){ m=new THREE.MeshStandardMaterial({color:'#000',emissive:a,emissiveIntensity:(b?+b:2)*0.62,roughness:1}); }
    else m=SPECIAL[key]?SPECIAL[key]():new THREE.MeshStandardMaterial({color:'#f0f'});
    MAT[key]=m; return m; }
  const P=o=>'pbr:'+encodeURIComponent(JSON.stringify(o));
  const SPECIAL={
    metalDark:()=>Assets.pbr('metalDark',{tex:'metal_panel',tile:1.5,color:'#55585e',rough:0.45,metal:0.7}),
    rustBeam:()=>Assets.pbr('rustBeam',{tex:'rust_metal',tile:1.5,metalMap:true}),
    grate:()=>{ const m=Assets.pbr('grate',{tex:'grate',tile:1.2,metalMap:true,color:'#a9adb2'}); return m; },
    glass:()=>new THREE.MeshPhysicalMaterial({color:'#9fd0ff',roughness:0.05,metalness:0,transmission:0,transparent:true,opacity:0.28,envMapIntensity:1.5,depthWrite:false}),
    glassDark:()=>new THREE.MeshStandardMaterial({color:'#0c1626',roughness:0.08,metalness:0.6,envMapIntensity:1.4}),
    water:()=>{ const m=new THREE.MeshStandardMaterial({color:'#1f6fa8',roughness:0.04,metalness:0.1,envMapIntensity:1.6,transparent:true,opacity:0.86}); return m; },
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
    lamp:()=>new THREE.MeshStandardMaterial({color:'#fff',emissive:'#fff4dc',emissiveIntensity:1.3,roughness:1}),
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
  function macro(m,amt,scale,rock){ if(m.userData.macro) return m; m.userData.macro=true; const prev=m.onBeforeCompile;
    m.onBeforeCompile=(sh)=>{ if(prev) prev(sh); sh.uniforms.uMacro={value:new THREE.Vector2(amt,scale)};
      sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWPm;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWPm=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vWPm; uniform vec2 uMacro;
        float mhash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float mnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mhash(i),mhash(i+vec2(1,0)),f.x),mix(mhash(i+vec2(0,1)),mhash(i+vec2(1,1)),f.x),f.y); }`)
        .replace('#include <map_fragment>',`#include <map_fragment>
        { vec2 q=vWPm.xz*uMacro.y+vWPm.y*0.07; float n=mnoise(q)*0.6+mnoise(q*2.7+3.1)*0.3+mnoise(q*7.3)*0.1; diffuseColor.rgb*=mix(1.0-uMacro.x,1.0+uMacro.x*0.6,n);
          `+(rock?`float sy=vWPm.y*0.3+mnoise(vWPm.xz*0.05)*2.0; float band=smoothstep(0.35,0.5,fract(sy))*(1.0-smoothstep(0.8,0.98,fract(sy)));
          diffuseColor.rgb*=mix(0.84,1.06,band)*mix(vec3(0.94,0.97,1.0),vec3(1.08,0.98,0.9),mnoise(vec2(sy*0.7,3.0)));
          diffuseColor.rgb*=mix(0.55,1.0,smoothstep(-0.5,3.0,vWPm.y));`:'')+` }`); };
    m.customProgramCacheKey=()=>'macro'+amt+'_'+scale+(rock?'r':''); m.needsUpdate=true; return m; }
  function flush(parent){ for(const k in B){ const b=B[k]; if(!b.i.length) continue; const mm=mat(b.key); if(b.key==='th:ground'||b.key==='th:cliff') macro(mm,b.key==='th:ground'?0.32:0.28,b.key==='th:ground'?0.045:0.06,b.key==='th:cliff'&&TH.cliffKind==='rock');
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


  /* ================= AUTO-FILL PROPS (instanced) =================
     Every prop type is built once as 1–3 merged geometries (paint / detail / glass) and drawn with InstancedMesh,
     so 60 containers, cars and stacks cost a handful of draw calls. Paint is tinted per instance; grime is baked into vertex colours. */
  const AF=(()=>{
    let items={}, cache={}, M=null;
    const V=new THREE.Vector3(), C=new THREE.Color();
    const mats=()=>M||(M={
      paint:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.5,metalness:0.35}),
      detail:new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.7,metalness:0.2}),
      cloth:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0}),
      glass:new THREE.MeshStandardMaterial({color:'#0b1420',roughness:0.08,metalness:0.7,envMapIntensity:1.5}),
      conc:mat(P({tex:'concrete_worn',tile:1,color:'#b9b5ad'})), wood:mat('wood'),
      cont:(()=>{ const m=Assets.pbr('af_container',{tex:'container',tile:1,rough:0.6,metal:0.3,nor:1.6}).clone(); m.vertexColors=true; return m; })(),
      glow:new THREE.MeshStandardMaterial({color:'#000',emissive:'#bfe4ff',emissiveIntensity:0.9,roughness:1}) });
    /* geometry helpers: everything non-indexed with position/normal/uv/color so parts can be merged */
    const fin=(g,col,grime)=>{ g=g.index?g.toNonIndexed():g; if(!g.attributes.uv) g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      const p=g.attributes.position, c=new Float32Array(p.count*3); C.set(col||'#ffffff');
      for(let i=0;i<p.count;i++){ const y=p.getY(i); let k=1; if(grime){ k=(0.55+0.45*Math.min(1,Math.max(0,y)/0.8))*(0.9+0.2*hash3(p.getX(i)*3.1,y*3.7,p.getZ(i)*2.9)); } c[i*3]=C.r*k; c[i*3+1]=C.g*k; c[i*3+2]=C.b*k; }
      g.setAttribute('color',new THREE.BufferAttribute(c,3)); for(const k of Object.keys(g.attributes)) if(!['position','normal','uv','color'].includes(k)) g.deleteAttribute(k); return g; };
    const bx=(w,h,d,x,y,z,col,grime,ry,rz)=>{ const g=new THREE.BoxGeometry(w,h,d); if(rz) g.rotateZ(rz); if(ry) g.rotateY(ry); g.translate(x,y,z); return fin(g,col,grime); };
    const cyl=(r,len,axis,x,y,z,col,seg,grime,r2)=>{ const g=new THREE.CylinderGeometry(r2!=null?r2:r,r,len,seg||12); if(axis==='x') g.rotateZ(Math.PI/2); else if(axis==='z') g.rotateX(Math.PI/2); g.translate(x,y,z); return fin(g,col,grime); };
    const rb=(w,h,d,x,y,z,col,ry)=>{ const g=new THREE.SphereGeometry(0.5,6,4); g.scale(w*1.12,h*1.25,d*1.12); if(ry) g.rotateY(ry); g.translate(x,y,z); return fin(g,col,true); };  // plump low-poly bag
    const ext=(pts,depth,col,grime,bevel)=>{ const sh=new THREE.Shape(); pts.forEach((q,i)=>sh[i?'lineTo':'moveTo'](q[0],q[1])); sh.closePath();
      const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:!!bevel,bevelSize:bevel||0,bevelThickness:bevel||0,bevelSegments:1,steps:1}); g.translate(0,0,-depth/2); return fin(g,col,grime); };
    const quad=(a,b,c,d,col)=>{ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3)); g.computeVertexNormals(); return fin(g,col,false); };
    const merge=l=>THREE.mergeGeometries(l,false);
    const wheels=(D,xs,zHalf,r,w)=>{ for(const x of xs) for(const sz of [-1,1]){ D.push(cyl(r,w,'z',x,r,sz*(zHalf-w/2+0.03),'#141416',10)); D.push(cyl(r*0.55,0.02,'z',x,r,sz*(zHalf+0.035),'#8d9096',8)); } };
    function container(L){ const P_=[], D=[], H=2.59, Wd=2.44;
      const body=new THREE.BoxGeometry(L-0.04,H-0.06,Wd-0.04); { const uv=body.attributes.uv, n=body.attributes.normal; for(let i=0;i<uv.count;i++){ const long=Math.abs(n.getX(i))<0.5; uv.setXY(i,uv.getX(i)*(long?L/2.5:1),uv.getY(i)); } } body.translate(0,H/2,0); P_.push(fin(body,'#ffffff',true));
      const F=[]; for(const sx of [-1,1]) for(const sz of [-1,1]) F.push(bx(0.16,H,0.16,sx*(L/2-0.08),H/2,sz*(Wd/2-0.08),'#8d8f93',true));
      for(const y of [0.08,H-0.08]) for(const sz of [-1,1]) F.push(bx(L,0.16,0.14,0,y,sz*(Wd/2-0.07),'#8d8f93',true));
      for(const y of [0.08,H-0.08]) for(const sx of [-1,1]) F.push(bx(0.14,0.16,Wd,sx*(L/2-0.07),y,0,'#8d8f93',true));
      for(const sz of [-0.6,-0.25,0.25,0.6]) D.push(cyl(0.022,H-0.5,'y',L/2+0.03,H/2,sz*Wd/2,'#b9bcc2',6));
      D.push(bx(0.02,H-0.3,0.03,L/2+0.01,H/2,0,'#2a2a2c')); for(const sz of [-0.42,0.42]) D.push(bx(0.05,0.1,0.3,L/2+0.045,1.15,sz,'#b9bcc2'));
      return [{g:merge(P_),m:'cont',tint:true},{g:merge(F),m:'paint',tint:true},{g:merge(D),m:'detail'}]; }
    function vehicle(o){ const P_=[], D=[], Gl=[], w=o.w, hw=w/2;
      P_.push(ext(o.body,w-0.12,'#ffffff',true,0.06));
      if(o.cargo){ const c=o.cargo; P_.push(bx(c[1]-c[0],c[3]-c[2],w,(c[0]+c[1])/2,(c[2]+c[3])/2,0,'#f2f2f2',true)); for(let i=0;i<5;i++) D.push(bx(0.05,c[3]-c[2]-0.2,w+0.04,c[0]+0.4+i*(c[1]-c[0]-0.8)/4,(c[2]+c[3])/2,0,'#b9bcc0')); }
      D.push(bx(o.L-0.5,0.3,w-0.35,0,0.42,0,'#111113'));                                   // underbody
      D.push(bx(0.16,0.26,w+0.02,o.L/2-0.05,0.52,0,'#1b1c1f')); D.push(bx(0.16,0.26,w+0.02,-o.L/2+0.05,0.52,0,'#1b1c1f'));  // bumpers
      for(const sz of [-1,1]){ D.push(bx(0.06,0.14,0.34,o.L/2+0.01,o.lightY,sz*(hw-0.32),'#f4f1dc')); D.push(bx(0.06,0.12,0.3,-o.L/2-0.01,o.lightY+0.04,sz*(hw-0.3),'#a0141a')); }
      D.push(bx(0.05,0.2,w*0.5,o.L/2+0.012,o.lightY-0.02,0,'#0e0e10'));                    // grille
      wheels(D,o.wheels,hw,o.r||0.36,0.26);
      for(const win of (o.side||[])) for(const sz of [-1,1]){ const g=ext(win,0.02,'#ffffff'); g.translate(0,0,sz*(hw+0.006)); Gl.push(g); }
      for(const q of (o.shield||[])){ const [x0,y0,x1,y1]=q, zi=hw-0.16, e=0.012, nx=(y1-y0), ny=-(x1-x0), nl=Math.hypot(nx,ny)||1, ox=nx/nl*e*Math.sign(x1+x0||1), oy=Math.abs(ny/nl)*e;
        Gl.push(quad([x0+ox,y0+oy,zi],[x1+ox,y1+oy,zi],[x1+ox,y1+oy,-zi],[x0+ox,y0+oy,-zi])); Gl.push(quad([x0+ox,y0+oy,-zi],[x1+ox,y1+oy,-zi],[x1+ox,y1+oy,zi],[x0+ox,y0+oy,zi])); }
      return [{g:merge(P_),m:'paint',tint:true},{g:merge(D),m:'detail'},{g:merge(Gl),m:'glass'}]; }
    const VEH={
      sedan:{L:4.5,w:1.86,lightY:0.72,wheels:[-1.4,1.42],body:[[-2.2,0.34],[2.2,0.34],[2.25,0.62],[2.12,0.86],[1.15,0.98],[0.55,1.42],[-0.85,1.42],[-1.4,1.0],[-2.0,0.96],[-2.25,0.84],[-2.25,0.5]],
        side:[[[-0.8,1.36],[0.5,1.36],[1.0,1.02],[-1.25,1.02]]],shield:[[0.62,1.38,1.1,1.02],[-0.92,1.38,-1.34,1.04]]},
      van:{L:5.2,w:2.06,lightY:0.8,r:0.38,wheels:[-1.7,1.75],body:[[-2.55,0.36],[2.55,0.36],[2.6,0.7],[2.5,1.12],[2.0,1.3],[1.35,2.14],[-2.42,2.14],[-2.6,2.02],[-2.6,0.5]],
        side:[[[1.1,2.0],[1.3,2.0],[1.8,1.36],[0.7,1.36],[0.7,2.0]]],shield:[[1.42,2.06,1.96,1.36]]},
      pickup:{L:5.2,w:1.96,lightY:0.82,r:0.4,wheels:[-1.65,1.7],body:[[-2.55,0.4],[2.55,0.4],[2.6,0.72],[2.48,1.04],[1.3,1.15],[0.75,1.76],[-0.5,1.76],[-0.62,1.7],[-0.62,1.16],[-2.6,1.16],[-2.6,0.5]],
        side:[[[-0.48,1.7],[0.7,1.7],[1.15,1.2],[-0.48,1.2]]],shield:[[0.82,1.72,1.26,1.2]]},
      truck:{L:7.4,w:2.44,lightY:0.9,r:0.48,wheels:[-2.9,-1.9,2.75],cargo:[-3.7,1.75,0.82,3.1],body:[[1.85,0.5],[3.65,0.5],[3.7,0.9],[3.62,1.5],[3.4,1.62],[2.98,2.42],[1.95,2.42],[1.85,2.3]],
        side:[[[2.05,2.28],[2.9,2.28],[3.25,1.66],[2.05,1.66]]],shield:[[3.04,2.34,3.4,1.68]]} };
    function build(type){ const m=mats(); let r;
      if(type==='cont') r=container(6.06); else if(type==='contS') r=container(3.0);
      else if(VEH[type]) r=vehicle(VEH[type]);
      else if(type==='pallet'){ const D=[]; for(const z of [-0.42,0,0.42]) D.push(bx(1.25,0.1,0.12,0,0.05,z,'#8a6a44')); for(let i=0;i<5;i++) D.push(bx(0.2,0.04,1.05,-0.52+i*0.26,0.12,0,'#9a7a50')); r=[{g:merge(D),m:'detail'}]; }
      else if(type==='pipes'){ const G=[], D=[]; for(const [y,z] of [[0.6,-0.63],[0.6,0.63],[1.66,0]]){ G.push(cyl(0.6,2.4,'x',0,y,z,'#ffffff',14,true)); for(const sx of [-1,1]) D.push(cyl(0.47,0.02,'x',sx*1.205,y,z,'#17181a',14)); }
        for(const sz of [-1,1]) D.push(bx(2.2,0.14,0.2,0,0.07,sz*1.28,'#7a5a36')); r=[{g:merge(G),m:'conc'},{g:merge(D),m:'detail'}]; }
      else if(type==='bags'){ const Cl=[], D=[]; for(const z of [-0.42,0,0.42]) D.push(bx(1.25,0.1,0.12,0,0.05,z,'#8a6a44')); for(let i=0;i<5;i++) D.push(bx(0.2,0.04,1.05,-0.52+i*0.26,0.12,0,'#9a7a50'));
        for(let l=0;l<4;l++) for(let a=0;a<2;a++) for(let b=0;b<2;b++){ const t=l%2; Cl.push(rb(t?0.5:0.6,0.27,t?0.6:0.5,(t?(a-0.5)*0.56:(a-0.5)*0.62)+(hash3(l,a,b)-0.5)*0.05,0.28+l*0.255,(t?(b-0.5)*0.5:(b-0.5)*0.52),'#ffffff',(hash3(b,l,a)-0.5)*0.12)); }
        r=[{g:merge(Cl),m:'cloth',tint:true},{g:merge(D),m:'detail'}]; }
      else if(type==='spool'){ const D=[]; for(const sz of [-1,1]){ D.push(cyl(0.95,0.09,'z',0,0.95,sz*0.52,'#9a7a50',18)); D.push(cyl(0.2,0.02,'z',0,0.95,sz*0.57,'#4a4d52',10)); } D.push(cyl(0.7,0.92,'z',0,0.95,0,'#1c1d20',16)); for(const sx of [-1,1]) D.push(bx(0.25,0.16,1.1,sx*0.6,0.08,0,'#7a5a36')); r=[{g:merge(D),m:'detail'}]; }
      else if(type==='dumpster'){ const P_=[], D=[]; const g=ext([[-0.62,0.16],[0.62,0.16],[0.7,1.22],[-0.7,1.22]],2.3,'#ffffff',true); g.rotateY(Math.PI/2); P_.push(g);
        for(const x of [-0.85,0,0.85]) P_.push(bx(0.08,1.0,1.44,x,0.7,0,'#dddddd',true));
        for(const sx of [-1,1]) D.push(bx(1.12,0.07,1.42,sx*0.58,1.3,0,'#1d1f22',false,0,sx*0.07)); for(const sx of [-1,1]) for(const sz of [-1,1]) D.push(cyl(0.09,0.07,'z',sx*0.95,0.09,sz*0.55,'#111',8));
        r=[{g:merge(P_),m:'paint',tint:true},{g:merge(D),m:'detail'}]; }
      else if(type==='jersey'){ const G=[]; for(let i=0;i<3;i++){ const g=ext([[-0.32,0],[0.32,0],[0.32,0.2],[0.11,0.52],[0.08,1.02],[-0.08,1.02],[-0.11,0.52],[-0.32,0.2]],1.98,'#ffffff',true); g.rotateY(Math.PI/2); g.translate(-2.07+i*2.07,0,0); G.push(g); } r=[{g:merge(G),m:'conc'}]; }
      else if(type==='crates'){ const G=[]; const cr=(sz,x,y,z,ry)=>G.push(bx(sz,sz,sz,x,y+sz/2,z,'#ffffff',true,ry)); cr(1.05,-0.55,0,-0.55,0); cr(1.05,0.55,0,-0.55,0.04); cr(1.05,-0.55,0,0.55,-0.05); cr(0.95,-0.5,1.05,-0.5,0.35); cr(0.7,0.6,0,0.62,0.5); r=[{g:merge(G),m:'wood'}]; }
      else if(type==='sandbag'||type==='sandbagS'){ const Cl=[], L=type==='sandbag'?3.6:2.2, n=Math.round(L/0.6); for(let row=0;row<3;row++) for(let i=0;i<n-(row%2);i++){ const x=-L/2+0.3+(row%2)*0.3+i*0.6; Cl.push(rb(0.58,0.36,0.5+(row===0?0.2:0),x,0.19+row*0.36,(hash3(i,row,7)-0.5)*0.08,row%2?'#85755a':'#917f62',(hash3(row,i,3)-0.5)*0.16)); } r=[{g:merge(Cl),m:'cloth'}]; }
      else if(type==='hesco'){ const Cl=[], D=[]; for(let i=0;i<3;i++){ const x=-1.34+i*1.34; Cl.push(bx(1.24,1.36,1.24,x,0.68,0,'#8a7858',true)); Cl.push(bx(1.1,0.06,1.1,x,1.39,0,'#6b5c42'));
          for(const sx of [-1,1]) for(const sz of [-1,1]) D.push(bx(0.04,1.38,0.04,x+sx*0.63,0.69,sz*0.63,'#5a5d60')); for(const y of [0.46,0.92,1.37]) for(const sz of [-1,1]){ D.push(bx(1.28,0.03,0.03,x,y,sz*0.635,'#5a5d60')); D.push(bx(0.03,0.03,1.28,x+sz*0.635,y,0,'#5a5d60')); } }
        r=[{g:merge(Cl),m:'cloth'},{g:merge(D),m:'detail'}]; }
      else if(type==='tank'){ const P_=[], D=[]; const g=new THREE.CapsuleGeometry(0.98,2.5,5,16); g.rotateZ(Math.PI/2); g.translate(0,1.4,0); P_.push(fin(g,'#ffffff',false));
        for(const x of [-1.2,1.2]){ D.push(bx(0.35,0.7,1.7,x,0.35,0,'#8d8f92')); D.push(cyl(1.0,0.12,'x',x,1.4,0,'#a0241c',16)); } D.push(cyl(0.12,0.3,'y',0.3,2.48,0,'#7b7e84',8)); D.push(cyl(0.05,2.3,'y',1.9,1.15,0.75,'#c9a23a',6));
        r=[{g:merge(P_),m:'paint',tint:true},{g:merge(D),m:'detail'}]; }
      else if(type==='shelter'){ const D=[], Gl=[], E=[]; for(const x of [-2.0,2.0]) for(const z of [-0.7,0.7]) D.push(bx(0.08,2.5,0.08,x,1.25,z,'#3a3d42')); D.push(bx(4.2,0.08,1.6,0,2.54,0,'#2b2e33'));
        D.push(bx(2.6,0.06,0.42,-0.4,0.5,-0.4,'#8a6a44')); for(const x of [-1.5,0.7]) D.push(bx(0.06,0.5,0.4,x,0.25,-0.4,'#3a3d42'));
        Gl.push(bx(2.9,1.9,0.04,-0.5,1.35,-0.68,'#ffffff')); E.push(bx(1.1,1.8,0.1,1.42,1.3,-0.66,'#ffffff')); r=[{g:merge(D),m:'detail'},{g:merge(Gl),m:'glass'},{g:merge(E),m:'glow'}]; }
      else if(type==='bench'){ const D=[]; for(let i=0;i<3;i++) D.push(bx(2.0,0.05,0.14,0,0.46,-0.17+i*0.17,'#8a6a44')); for(let i=0;i<2;i++) D.push(bx(2.0,0.12,0.04,0,0.66+i*0.16,0.3,'#8a6a44')); for(const x of [-0.8,0.8]){ D.push(bx(0.06,0.46,0.5,x,0.23,0,'#2f3237')); D.push(bx(0.06,0.5,0.05,x,0.68,0.32,'#2f3237')); } r=[{g:merge(D),m:'detail'}]; }
      else if(type==='kiosk'){ const P_=[], D=[], E=[]; P_.push(bx(2.6,2.3,2.0,0,1.15,0,'#f2f2f2',true)); D.push(bx(2.8,0.1,2.3,0,2.38,0.1,'#2b2e33')); D.push(bx(1.9,0.9,0.06,0,1.5,1.0,'#0e1014')); D.push(bx(2.1,0.06,0.4,0,1.02,1.15,'#8d9096'));
        D.push(bx(2.7,0.5,0.5,0,2.05,1.2,'#c0392b',false,0,0)); E.push(bx(1.8,0.26,0.05,0,2.62,1.02,'#ffffff')); r=[{g:merge(P_),m:'paint',tint:true},{g:merge(D),m:'detail'},{g:merge(E),m:'glow'}]; }
      else if(type==='ibcU'){ const P_=[], D=[]; P_.push(bx(1.06,0.9,0.9,0,0.67,0,'#ffffff',true)); D.push(bx(1.16,0.16,1.0,0,0.08,0,'#3d4045'));
        for(const sx of [-1,1]) for(const sz of [-1,1]) D.push(bx(0.035,1.02,0.035,sx*0.56,0.66,sz*0.47,'#9a9da2'));
        for(const y of [0.36,0.72,1.13]) for(const s2 of [-1,1]){ D.push(bx(1.15,0.028,0.028,0,y,s2*0.47,'#9a9da2')); D.push(bx(0.028,0.028,0.97,s2*0.56,y,0,'#9a9da2')); }
        for(const x of [-0.28,0,0.28]) D.push(bx(0.026,0.95,0.03,x,0.66,0.475,'#9a9da2')); D.push(cyl(0.15,0.07,'y',0,1.15,0,'#2a5aa0',12)); D.push(cyl(0.07,0.14,'z',0,0.3,0.5,'#1b1c1f',8));
        r=[{g:merge(P_),m:'paint',tint:true},{g:merge(D),m:'detail'}]; }
      else if(type==='bollards'){ const D=[]; for(let i=0;i<5;i++){ const x=-2.0+i; D.push(cyl(0.11,0.9,'y',x,0.45,0,'#4a4d52',10)); D.push(cyl(0.115,0.06,'y',x,0.8,0,'#e9c84a',10)); } r=[{g:merge(D),m:'detail'}]; }
      else r=[{g:bx(1,1,1,0,0.5,0,'#888'),m:'detail'}];
      for(const q of r) q.mat=m[q.m]; return r; }
    const _o=new THREE.Object3D();
    const put=(type,x,z,rotY,col,y,rx,sc)=>{ _o.position.set(x,y||0,z); _o.rotation.set(rx||0,rotY||0,0,'YXZ'); _o.scale.setScalar(sc||1); _o.updateMatrix(); (items[type]||(items[type]=[])).push({m:_o.matrix.clone(),c:col}); };
    const rotXZ=(dx,dz,ry)=>[dx*Math.cos(ry)+dz*Math.sin(ry),-dx*Math.sin(ry)+dz*Math.cos(ry)];
    function place(a){ const T=AF_TYPES[a.type], cx=a.x0+a.l/2, cz=a.z0+a.d/2, base=a.rot?Math.PI/2:0, ry=base+(a.flip?Math.PI:0);
      if(a.type==='cont') put('cont',cx,cz,ry,a.c);
      else if(a.type==='cont2'){ put('cont',cx,cz,ry,a.c); put('cont',cx,cz,ry+((a.seed%3)-1)*0.03,a.c2,2.6); }
      else if(a.type==='contL'){ if(a.rot){ put('cont',a.x0+1.25,a.z0+3.05,Math.PI/2,a.c); put('contS',a.x0+4.05,a.z0+1.25,0,a.c2); } else { put('cont',a.x0+3.05,a.z0+1.25,0,a.c); put('contS',a.x0+1.25,a.z0+4.05,Math.PI/2,a.c2); } }
      else if(a.type==='sandbagL'){ if(a.rot){ put('sandbag',a.x0+0.4,a.z0+1.8,Math.PI/2); put('sandbagS',a.x0+1.9,a.z0+0.4,0); } else { put('sandbag',a.x0+1.8,a.z0+0.4,0); put('sandbagS',a.x0+0.4,a.z0+1.9,Math.PI/2); } }
      else if(a.type==='bags2'){ const dx=a.rot?0:0.8, dz=a.rot?0.8:0; put('bags',cx-dx,cz-dz,base,a.c); put('bags',cx+dx,cz+dz,base+0.08,a.c2&&a.seed%2?'#e6e2d6':a.c); }
      else if(a.type==='shelter') put('shelter',cx,cz,base,a.c);
      else if(a.type==='gcar') put('m:covered_car',cx,cz,ry+Math.PI/2);
      else if(a.type==='cement'){ put('pallet',cx,cz,base); for(let l=0;l<4;l++) for(let k=0;k<2;k++){ const t=l%2, [dx,dz]=rotXZ(t?0:(k-0.5)*0.48,t?(k-0.5)*0.48:0,base); put('m:cement_bag',cx+dx,cz+dz,base+(t?Math.PI/2:0)+(hash3(a.seed,l,k)-0.5)*0.12,null,0.14+l*0.175); } }
      else if(a.type==='tyres'){ for(let k=0;k<2;k++){ const [dx,dz]=rotXZ((k-0.5)*0.68,0,base), n=2+((a.seed>>k)&1)+k; for(let i=0;i<n;i++) put('m:tyre',cx+dx+(hash3(a.seed,i,k)-0.5)*0.05,cz+dz,hash3(a.seed,k,i)*3,null,0.085+i*0.172,Math.PI/2); } }
      else if(a.type==='drums'){ for(const [ox,oz] of [[-0.36,-0.34],[0.34,-0.3],[-0.02,0.36]]){ const [dx,dz]=rotXZ(ox,oz,base); put('m:barrel3',cx+dx,cz+dz,hash3(a.seed,ox,oz)*6); } }
      else if(a.type==='ibc'){ for(const k of [-1,1]){ const [dx,dz]=rotXZ(k*0.6,0,base); put('ibcU',cx+dx,cz+dz,base,a.c&&a.c!=='#ffffff'?a.c:(a.seed%2?'#e9e5d6':'#dfe3e6')); } }
      else if(a.type==='milc'){ for(const [oz,oy,rr] of [[-0.28,0,0],[0.28,0,0.04],[0,0.46,-0.12]]){ const [dx,dz]=rotXZ(0,oz,base); put('m:mil_crate2',cx+dx,cz+dz,base+rr,null,oy); } }
      else put(a.type,cx,cz,ry,a.c); }
    function flush(){ const myRoot=root, mm=new THREE.Matrix4();
      for(const type in items){ const list=items[type];
        if(type.startsWith('m:')){ // photoreal GLB prop: one InstancedMesh per sub-mesh
          Assets.model(type.slice(2)).then(md=>{ if(!md||root!==myRoot) return; md.scene.updateMatrixWorld(true);
            md.scene.traverse(o=>{ if(!o.isMesh) return; const im=new THREE.InstancedMesh(o.geometry,o.material,list.length);
              list.forEach((it,i)=>{ mm.multiplyMatrices(it.m,o.matrixWorld); im.setMatrixAt(i,mm); }); im.instanceMatrix.needsUpdate=true;
              im.castShadow=QUALITY.shadow>0&&QUALITY.propShadow; im.receiveShadow=true; im.frustumCulled=false; myRoot.add(im); }); });
          continue; }
        const parts=cache[type]||(cache[type]=build(type));
        for(const q of parts){ const im=new THREE.InstancedMesh(q.g,q.mat,list.length);
          list.forEach((it,i)=>{ im.setMatrixAt(i,it.m); if(q.tint) im.setColorAt(i,C.set(it.c||'#ffffff')); });
          im.instanceMatrix.needsUpdate=true; if(im.instanceColor) im.instanceColor.needsUpdate=true;
          im.castShadow=QUALITY.shadow>0&&q.m!=='glass'&&q.m!=='glow'&&(QUALITY.propShadow||q.m==='paint'||q.m==='conc'||q.m==='cont'); im.receiveShadow=true; im.frustumCulled=false; root.add(im); } }
      items={}; }
    function reset(){ items={}; for(const t in cache) for(const q of cache[t]) q.g.dispose(); cache={}; M=null; }
    return {place,flush,reset};
  })();
  /* ================= BUILD ================= */
  async function build(def,theme){
    clear(); mapDef=def; TH=theme; root=new THREE.Group(); root.name='world'; R.scene.add(root);
    lightBudget=QUALITY.lights;
    buildGround(); buildCliffs(); buildVoid(); buildSolids(); buildBuildingsExtra(); buildBands(); buildLadders();
    flush(root); AF.flush();
    await Promise.all([buildProps(),buildDecor(),scatter()]);
    makePool();
    buildZones(); buildContact(); buildYard(); buildPaint(); buildPuddles();
    if(TH.rain) addRain(); if(TH.dust) addDust();
    return root;
  }
  function clear(){ if(root){ R.scene.remove(root); root.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); } objMeshes.clear(); anims.length=0; lampLights.length=0; LAMPS.length=0; pool=[]; B={}; AF.reset(); }

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
      for(const s of segs){ const hTop=s.h>=12?s.h+4+fbm(s.ax,0,s.az)*6:s.h; const nyS=Math.ceil((hTop+1)/1.3), nxS=4, hSame=true;
        /* does the same face continue past each end? (wall cell next door with the same open side) */
        const tx=Math.sign(s.bx-s.ax), tz=Math.sign(s.bz-s.az), wall=(c,r)=>inB(c,r)&&G[r*W+c]===0&&WH[r*W+c]>=12===(s.h>=12);
        const cont=dir=>wall(s.c+tx*dir,s.r+tz*dir)&&open(s.c+tx*dir+s.nx,s.r+tz*dir+s.nz);
        const e0=cont(-1), e1=cont(1);
        const P=(u,v)=>{ const x=s.ax+(s.bx-s.ax)*u, z=s.az+(s.bz-s.az)*u, y=-1+(hTop+1)*v;
          const pin=Math.min(e0?1:Math.min(1,u/0.3),e1?1:Math.min(1,(1-u)/0.3));  // 0 at a corner -> 1 away from it
          const flute=(fbm(x*1.1,y*0.25,z*1.1)-0.45)*2.4;
          const st=y*0.3+vnoise(x*0.05,0,z*0.05)*2.0, fr=st-Math.floor(st);
          const ledge=(Math.min(1,fr/0.4)*(1-Math.max(0,(fr-0.85)/0.15)))*0.8-0.3;
          const d=((flute+ledge)*Math.min(1,0.3+Math.max(0,y)*0.3)+(fbm(x*2.7,y*2.7,z*2.7)-0.5)*0.3)*pin*pin*(3-2*pin);
          return [x+s.nx*d, y, z+s.nz*d]; };
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
            else if(TH.dusk) key=lit>0.5?(lit>0.93?'e:#bfe4ff:1.1':lit>0.72?'e:#ffc98a:1.5':'e:#ffe6bd:1.1'):'glassDark';
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
        case 'machine':{ /* industrial machine: plinth, painted body with a hazard band, dark lid, glowing control panels on the long faces, motor and exhaust on top */
          const M=P({tex:'white_panel',tile:1,color:'#9fb79a',rough:1,metal:0,nor:0.8,env:0.6}), lx=(s.x1-s.x0)>=(s.z1-s.z0), y0=s.y0;
          box(s.x0-0.12,y0,s.z0-0.12,s.x1+0.12,y0+0.18,s.z1+0.12,all('metalDark')); box(s.x0,y0+0.18,s.z0,s.x1,s.y1-0.22,s.z1,{all:M});
          box(s.x0+0.08,s.y1-0.22,s.z0+0.08,s.x1-0.08,s.y1,s.z1-0.08,all('metalDark'));
          box(s.x0-0.012,y0+0.2,s.z0-0.012,s.x1+0.012,y0+0.44,s.z1+0.012,{px:'hazard',nx:'hazard',pz:'hazard',nz:'hazard'},false);
          for(const sd of [-1,1]){ if(lx){ const z=sd<0?s.z0:s.z1, o=sd<0?-0.14:0, f=sd<0?'nz':'pz';
              box(s.x0+0.45,y0+0.95,z+o,s.x0+1.75,y0+1.75,z+o+0.14,all('metalDark'),false); box(s.x0+0.58,y0+1.12,sd<0?z-0.152:z+0.14,s.x0+1.62,y0+1.6,sd<0?z-0.14:z+0.152,{[f]:'e:#5fd8ff:1.5'},false);
              box(s.x1-0.75,y0+1.1,sd<0?z-0.06:z,s.x1-0.55,y0+1.3,sd<0?z:z+0.06,{[f]:'e:#ff3b2d:2'},false); box(s.x1-0.45,y0+1.1,sd<0?z-0.06:z,s.x1-0.25,y0+1.3,sd<0?z:z+0.06,{[f]:'e:#3dff6a:2'},false); }
            else { const x=sd<0?s.x0:s.x1, o=sd<0?-0.14:0, f=sd<0?'nx':'px';
              box(x+o,y0+0.95,s.z0+0.45,x+o+0.14,y0+1.75,s.z0+1.75,all('metalDark'),false); box(sd<0?x-0.152:x+0.14,y0+1.12,s.z0+0.58,sd<0?x-0.14:x+0.152,y0+1.6,s.z0+1.62,{[f]:'e:#5fd8ff:1.5'},false);
              box(sd<0?x-0.06:x,y0+1.1,s.z1-0.75,sd<0?x:x+0.06,y0+1.3,s.z1-0.55,{[f]:'e:#ff3b2d:2'},false); box(sd<0?x-0.06:x,y0+1.1,s.z1-0.45,sd<0?x:x+0.06,y0+1.3,s.z1-0.25,{[f]:'e:#3dff6a:2'},false); } }
          box(s.x0+0.3,s.y1,s.z0+0.3,s.x0+1.3,s.y1+0.8,s.z0+1.3,all('rustBeam')); box(s.x0+0.45,s.y1+0.8,s.z0+0.45,s.x0+1.15,s.y1+0.95,s.z0+1.15,all('metalDark'),false);
          box(s.x1-0.65,s.y1,s.z1-0.65,s.x1-0.35,s.y1+1.7,s.z1-0.35,all('rustBeam'),false); box(s.x1-1.6,s.y1,s.z1-0.6,s.x1-0.6,s.y1+0.3,s.z1-0.35,all('metalDark'),false); break; }
        case 'conveyor': box(s.x0,s.y0,s.z0,s.x1,s.y1-0.1,s.z1,all(P({tex:'metal_panel',tile:1.5,color:'#6a6f74',rough:0.5,metal:0.4}))); box(s.x0,s.y1-0.1,s.z0+0.1,s.x1,s.y1,s.z1-0.1,{py:'c:#222:0.8'}); break;
        case 'slide': box(s.x0,s.y0,s.z0,s.x1,s.y0+0.5,s.z1,{all:'hazard'}); box(s.x0,s.y0+0.5,s.z0+0.1,s.x1,s.y1,s.z1-0.1,all(P({tex:'metal_panel',tile:1.5,metalMap:true,color:'#666'}))); break;
        case 'pk': { const e=s.pk==='cp'?'e:#ffcc33:2.5':s.pk==='finish'?'e:#33ff88:2.5':s.pk==='start'?'e:#33aaff:2':'e:#ff3df0:2';
          box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:'pkPlat'}); const t=0.06; box(s.x0,s.y1,s.z0,s.x1,s.y1+0.02,s.z0+t,{py:e},false); box(s.x0,s.y1,s.z1-t,s.x1,s.y1+0.02,s.z1,{py:e},false);
          box(s.x0,s.y1,s.z0,s.x0+t,s.y1+0.02,s.z1,{py:e},false); box(s.x1-t,s.y1,s.z0,s.x1,s.y1+0.02,s.z1,{py:e},false); break; }
        case 'low': box(s.x0,0,s.z0,s.x1,s.y1,s.z1,all('st:concrete:ext')); break;
        case 'prop': break;
        case 'af': if(s.af) AF.place(s.af); break;
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
    box(s.x0,s.y0,s.z0,s.x1,s.y1,s.z1,{all:P({tex:'container',tile:2.55,rough:0.6,metal:0.3,nor:1.6,color:c}),py:P({tex:'rust_sheet',tile:2,metalMap:true,color:c})});
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
  let leafMat=null, barkMat=null;
  function tree(x,y,z,kind,Rn){
    if(!leafMat){ leafMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.9}); barkMat=new THREE.MeshStandardMaterial({color:'#4a372a',roughness:1}); }
    const parts=[], col=new THREE.Color(), tmp=new THREE.Vector3();
    const blob=(geo,px,py,pz,sx,sy,sz,hue,lit)=>{ const g=geo.index?geo.toNonIndexed():geo; const p=g.attributes.position, c=new Float32Array(p.count*3);
      for(let i=0;i<p.count;i++){ tmp.fromBufferAttribute(p,i); const n=1+(vnoise(tmp.x*2.3+px,tmp.y*2.3+py,tmp.z*2.3+pz)-0.5)*0.5; tmp.multiplyScalar(n); tmp.set(tmp.x*sx+px,tmp.y*sy+py,tmp.z*sz+pz); p.setXYZ(i,tmp.x,tmp.y,tmp.z);
        const k=0.55+0.5*Math.min(1,Math.max(0,(tmp.y-py)/(sy*1.2)+0.5)); col.setHSL(hue+(vnoise(tmp.x*1.7,tmp.y*1.7,tmp.z*1.7)-0.5)*0.05,0.4,lit*k); c[i*3]=col.r; c[i*3+1]=col.g; c[i*3+2]=col.b; }
      g.setAttribute('color',new THREE.BufferAttribute(c,3)); g.deleteAttribute('uv'); parts.push(g); };
    const h=kind==='cone'?3.2:2.6;
    if(kind==='cone'){ for(let i=0;i<7;i++){ const r=1.6-i*0.21; blob(new THREE.ConeGeometry(1,1,12,3),0,1.5+i*0.62,0,r,1.25,r,0.37,0.17+i*0.012); } }
    else { blob(new THREE.IcosahedronGeometry(1,2),0,3.5,0,1.5,1.25,1.5,0.27+Rn()*0.03,0.24);
      for(let i=0;i<6;i++){ const a=i/6*6.283+Rn(), r=0.9+Rn()*0.5; blob(new THREE.IcosahedronGeometry(1,1),Math.cos(a)*r,2.8+Rn()*1.1,Math.sin(a)*r,0.85+Rn()*0.4,0.75+Rn()*0.3,0.85+Rn()*0.4,0.26+Rn()*0.05,0.2+Rn()*0.06); } }
    let lg=THREE.mergeGeometries(parts,false); lg.deleteAttribute('normal'); lg=THREE.mergeVertices(lg,1e-3); lg.computeVertexNormals(); const leaves=new THREE.Mesh(lg,leafMat); leaves.castShadow=true; leaves.receiveShadow=true;
    const tg=new THREE.CylinderGeometry(0.1,0.22,h,7); tg.translate(0,h/2,0); const trunk=new THREE.Mesh(tg,barkMat); trunk.castShadow=true;
    const g=new THREE.Group(); g.position.set(x,y,z); g.rotation.y=Rn()*6.28; g.add(trunk,leaves); root.add(g);
    if(TH.dusk||TH.night){ const up=new THREE.Mesh(new THREE.CircleGeometry(0.16,10),mat('lamp')); up.rotation.x=-Math.PI/2; up.position.set(x+0.55,y+0.03,z); root.add(up); lamp('#ffd9a0',9,9,1.8,x+0.5,y+1.2,z); }
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
        if((b.x1-b.x0)*(b.z1-b.z0)>150) lamp(neon?STYLES[b.style].accent:'#ffe8c8',neon?18:14,Math.max(b.x1-b.x0,b.z1-b.z0)*0.8,1.6,m.x,m.y-0.6,m.z);
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
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:!!neon,emissive:neon?'#ffffff':'#000',emissiveMap:neon?t:null,emissiveIntensity:neon?1.3:0,roughness:0.6}));
    m.position.set((b.x0+b.x1)/2,b.floors*b.fh-1.2,b.z1+0.2); root.add(m);
    if(neon) lamp(col,10,14,1.8,m.position.x,m.position.y,m.position.z+1.2);
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
    const d=PROP_DEF[pr.m]; if(d&&d.light) lamp(d.light,mapDef.theme==='cyber'?14:8,16,1.8,pr.x,(pr.y||0)+(d.ly||1.5),pr.z);
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
        { const dir=new THREE.Vector3(Math.sin(d.rot||0),0,Math.cos(d.rot||0)); lamp(d.c,12,16,1.8,d.x+dir.x*1.5,d.y,d.z+dir.z*1.5); } }
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
    if(TH.mist) return; // the haze is the backdrop
    if(TH.yard){ const cx=W*CELL/2, cz=H*CELL/2, R0=Math.max(W,H)*CELL*0.62, R2=mulberry(31), o=new THREE.Object3D();
      const shed=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1).translate(0,0.5,0),mat(P({tex:'rusty_corr',tile:6,metalMap:true,color:'#b9aca4'})),22);
      const tankG=new THREE.CylinderGeometry(1,1,1,20).translate(0,0.5,0), tank=new THREE.InstancedMesh(tankG,new THREE.MeshStandardMaterial({color:'#d9d6cf',roughness:0.7,metalness:0.2}),14), band=new THREE.InstancedMesh(tankG,new THREE.MeshStandardMaterial({color:'#9a2a20',roughness:0.7}),14);
      for(let i=0;i<22;i++){ const a=i/22*6.283+R2()*0.2, r=R0+20+R2()*70; o.position.set(cx+Math.cos(a)*r,-1,cz+Math.sin(a)*r); o.rotation.set(0,Math.round(R2()*2)*Math.PI/2,0); o.scale.set(26+R2()*30,10+R2()*12,18+R2()*20); o.updateMatrix(); shed.setMatrixAt(i,o.matrix); }
      for(let i=0;i<14;i++){ const a=R2()*6.283, r=R0+14+R2()*60, rad=5+R2()*7, h=12+R2()*16; o.rotation.set(0,0,0); o.position.set(cx+Math.cos(a)*r,-1,cz+Math.sin(a)*r); o.scale.set(rad,h,rad); o.updateMatrix(); tank.setMatrixAt(i,o.matrix);
        o.position.y=h*0.78; o.scale.set(rad*1.01,h*0.08,rad*1.01); o.updateMatrix(); band.setMatrixAt(i,o.matrix); }
      root.add(shed,tank,band); return; }
    const dark=th==='cyber'||TH.dusk, mist=false;
    const n=th==='cyber'?90:th==='plaza'?60:26, cx=W*CELL/2, cz=H*CELL/2, R0=Math.max(W,H)*CELL*0.75;
    const geo=new THREE.BoxGeometry(1,1,1); geo.translate(0,0.5,0);
    const m=th==='cyber'?new THREE.MeshStandardMaterial({color:'#15131f',roughness:0.4,metalness:0.6,emissive:'#2a1a4a',emissiveIntensity:0.25})
      :TH.dusk?new THREE.MeshStandardMaterial({color:'#2a2c44',roughness:0.35,metalness:0.5,emissive:'#3a2a55',emissiveIntensity:0.18})
      :mist?new THREE.MeshStandardMaterial({color:'#6f7478',roughness:1})
      :new THREE.MeshStandardMaterial({color:'#8a6a52',roughness:1});
    const im=new THREE.InstancedMesh(geo,m,n); const R2=mulberry(99); const o=new THREE.Object3D();
    for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+R2()*0.05, r=R0+R2()*120, w=mist?6+R2()*16:12+R2()*26, h=(th==='cyber'?60:th==='plaza'?30:mist?22:18)+R2()*(th==='cyber'?140:th==='plaza'?80:mist?38:26);
      o.position.set(cx+Math.cos(a)*r,-2,cz+Math.sin(a)*r); o.scale.set(w,h,mist?w:w*(0.6+R2()*0.8)); o.rotation.y=R2()*3; o.updateMatrix(); im.setMatrixAt(i,o.matrix); }
    root.add(im);
    if(dark){ // lit window strips
      const wm=new THREE.MeshBasicMaterial({color:TH.dusk?'#ffc98a':'#ffb36b'}); const wm2=new THREE.MeshBasicMaterial({color:TH.dusk?'#cfe6ff':'#6fd8ff'}); const g2=new THREE.PlaneGeometry(1,1);
      const N=TH.dusk?360:600, ia=new THREE.InstancedMesh(g2,wm,N/2), ib=new THREE.InstancedMesh(g2,wm2,N/2);
      for(let i=0;i<N;i++){ const a=R2()*Math.PI*2, r=R0-6+R2()*100; o.position.set(cx+Math.cos(a)*r,10+R2()*(TH.dusk?70:120),cz+Math.sin(a)*r); o.lookAt(cx,o.position.y,cz); o.scale.set(2+R2()*6,0.8,1); o.updateMatrix(); (i%2?ia:ib).setMatrixAt(i>>1,o.matrix); }
      root.add(ia,ib); }
  }
  /* yard dressing (maps with def.roads): asphalt strips with painted lines, stains, pipe racks, utility poles — all merged, no collision */
  function buildYard(){
    const roads=mapDef.roads||[]; if(!roads.length&&!TH.yard) return;
    const save=B; B={};
    const line='c:#d9d6cc:0.8', yel='c:#c9a62a:0.8';
    for(const r of roads){ const along=(r.x1-r.x0)>=(r.z1-r.z0), y=0.012;
      box(r.x0,0,r.z0,r.x1,y,r.z1,{py:'th:road'},false);
      if(along){ const zc=(r.z0+r.z1)/2; for(let x=r.x0+2;x<r.x1-3;x+=6) box(x,y,zc-0.08,x+3,y+0.004,zc+0.08,{py:line},false);
        for(const z of [r.z0+0.25,r.z1-0.4]) box(r.x0,y,z,r.x1,y+0.004,z+0.15,{py:yel},false); }
      else { const xc=(r.x0+r.x1)/2; for(let z=r.z0+2;z<r.z1-3;z+=6) box(xc-0.08,y,z,xc+0.08,y+0.004,z+3,{py:line},false);
        for(const x of [r.x0+0.25,r.x1-0.4]) box(x,y,r.z0,x+0.15,y+0.004,r.z1,{py:yel},false); } }
    /* pipe racks: steel trestles carrying three pipes */
    for(const d of (mapDef.decor||[])){ if(d.t!=='piperack') continue; const along=Math.abs(d.x1-d.x0)>=Math.abs(d.z1-d.z0), L=along?Math.abs(d.x1-d.x0):Math.abs(d.z1-d.z0), y=d.y||6.5, n=Math.max(2,Math.round(L/9)+1);
      const X=t=>d.x0+(d.x1-d.x0)*t, Z=t=>d.z0+(d.z1-d.z0)*t;
      for(let i=0;i<n;i++){ const t=i/(n-1), x=X(t), z=Z(t); for(const s2 of [-1,1]){ const ox=along?0:s2*1.1, oz=along?s2*1.1:0; box(x+ox-0.09,0,z+oz-0.09,x+ox+0.09,y,z+oz+0.09,all('rustBeam')); }
        if(along) box(x-0.08,y-0.14,z-1.3,x+0.08,y,z+1.3,all('rustBeam')); else box(x-1.3,y-0.14,z-0.08,x+1.3,y,z+0.08,all('rustBeam'));
        if(along) box(x-0.05,y*0.45,z-1.1,x+0.05,y*0.45+0.1,z+1.1,all('rustBeam')); else box(x-1.1,y*0.45,z-0.05,x+1.1,y*0.45+0.1,z+0.05,all('rustBeam')); }
      const pm=[mat(P({tex:'metal_panel',tile:1.2,color:'#6d6f72',rough:0.5,metal:0.6})),mat(P({tex:'rust_metal',tile:1.5,metalMap:true,color:'#9a8f86'})),mat('c:#c9c7c0:0.5')];
      [[-0.75,0.36],[0.1,0.3],[0.8,0.22]].forEach(([off,r],k)=>{ const g=new THREE.CylinderGeometry(r,r,L,12,1,true); const m=new THREE.Mesh(g,pm[k]); if(along){ m.rotation.z=Math.PI/2; m.position.set((d.x0+d.x1)/2,y+r,d.z0+off); } else { m.rotation.x=Math.PI/2; m.position.set(d.x0+off,y+r,(d.z0+d.z1)/2); } m.castShadow=QUALITY.shadow>0; m.receiveShadow=true; root.add(m); }); }
    flush(root); B=save;
    /* utility poles with sagging wires */
    const poles=(mapDef.decor||[]).filter(d=>d.t==='pole');
    if(poles.length){ const pg=[], wood=new THREE.MeshStandardMaterial({color:'#4f3d2e',roughness:1}), pts=[];
      poles.forEach((d,i)=>{ const h=d.h||9; let g=new THREE.CylinderGeometry(0.11,0.16,h,7); g.translate(d.x,h/2,d.z); pg.push(g.toNonIndexed()); g=new THREE.BoxGeometry(d.rot?0.12:2.2,0.12,d.rot?2.2:0.12); g.translate(d.x,h-0.6,d.z); pg.push(g.toNonIndexed());
        const nx=poles[i+1]; if(nx&&!d.end) for(const o of [-0.9,0,0.9]){ const ax=d.x+(d.rot?0:o), az=d.z+(d.rot?o:0), bx2=nx.x+(nx.rot?0:o), bz=nx.z+(nx.rot?o:0), ay=h-0.5, by=(nx.h||9)-0.5; let px=ax,py=ay,pz=az;
            for(let k=1;k<=8;k++){ const t=k/8, x=ax+(bx2-ax)*t, z=az+(bz-az)*t, y=ay+(by-ay)*t-Math.sin(t*Math.PI)*1.1; pts.push(px,py,pz,x,y,z); px=x; py=y; pz=z; } } });
      const pm=new THREE.Mesh(THREE.mergeGeometries(pg,false),wood); pm.castShadow=QUALITY.shadow>0; root.add(pm);
      if(pts.length){ const lg=new THREE.BufferGeometry(); lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); root.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:'#15161a'}))); } }
    /* oil stains and dark patches on the ground */
    { const R2=mulberry(hashStr('stain'+mapDef.id)), P2=[], U=[], I=[]; const GW=W*CELL, GH=H*CELL;
      for(let i=0;i<70;i++){ const x=6+R2()*(GW-12), z=6+R2()*(GH-12), c=cellOf(x), r=cellOf(z); if(!inB(c,r)||G[r*W+c]!==1) continue; const s2=1.2+R2()*3.2, a=R2()*6.28, ca=Math.cos(a)*s2, sa=Math.sin(a)*s2, k=P2.length/3, y=0.018;
        P2.push(x-ca+sa,y,z-sa-ca, x+ca+sa,y,z+sa-ca, x+ca-sa,y,z+sa+ca, x-ca-sa,y,z-sa+ca); const u=(i%2)*0.5; U.push(u,0,u+0.5,0,u+0.5,1,u,1); I.push(k,k+2,k+1,k,k+3,k+2); }
      if(I.length){ const t=Assets.canvasTex(256,128,(g,w,h)=>{ g.clearRect(0,0,w,h); const Rn=mulberry(5); for(let q=0;q<2;q++) for(let i=0;i<26;i++){ const cx=q*128+64+(Rn()-0.5)*56, cy=64+(Rn()-0.5)*56, r=10+Rn()*30; const gr=g.createRadialGradient(cx,cy,0,cx,cy,r); gr.addColorStop(0,`rgba(${q?18:30},${q?16:22},${q?14:14},${0.10+Rn()*0.16})`); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(q*128,0,128,128); } },true);
        t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(P2,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); geo.setIndex(I);
        const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3})); m.renderOrder=1; root.add(m); } }
  }
  /* ---------- ground detail: painted markings (def.paint) ----------
     t: line | box | hazard | park | zebra | arrow | text. Worn paint shares one scuffed alpha texture and per-vertex colour,
     so every plain marking on the map is ONE mesh; hazard stripes are a second mesh; each stencil text is a small quad. */
  let grunge=null;
  function grungeTex(){ if(grunge) return grunge; grunge=Assets.canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#fff'; g.fillRect(0,0,w,h); const R2=mulberry(11);
      for(let i=0;i<1400;i++){ const a=0.05+R2()*0.35; g.fillStyle=`rgba(0,0,0,${a})`; const s=1+R2()*5; g.fillRect(R2()*w,R2()*h,s,s*(0.4+R2())); }
      for(let i=0;i<40;i++){ g.strokeStyle=`rgba(0,0,0,${0.15+R2()*0.35})`; g.lineWidth=0.6+R2()*2.2; g.beginPath(); const x=R2()*w, y=R2()*h; g.moveTo(x,y); g.lineTo(x+(R2()-0.5)*90,y+(R2()-0.5)*30); g.stroke(); } },false);
    grunge.wrapS=grunge.wrapT=THREE.RepeatWrapping; return grunge; }
  function buildPaint(){ const L=mapDef.paint||[]; if(!L.length) return;
    const mk=()=>({P:[],U:[],C:[],I:[]}), plain=mk(), haz=mk(), Y=0.017, col=new THREE.Color();
    /* quad by 4 corners (x,z), uv mode: world (grunge) or along (hazard) */
    const quad=(Q,pts,c,uvs)=>{ const k=Q.P.length/3; col.set(c||'#ffffff');
      for(let i=0;i<4;i++){ const [x,z]=pts[i]; Q.P.push(x,Y,z); Q.C.push(col.r,col.g,col.b); if(uvs) Q.U.push(uvs[i][0],uvs[i][1]); else Q.U.push(x/7,z/7); }
      Q.I.push(k,k+2,k+1,k,k+3,k+2); };
    const tri=(Q,a,b,c2,c)=>{ const k=Q.P.length/3; col.set(c||'#ffffff'); for(const [x,z] of [a,b,c2]){ Q.P.push(x,Y,z); Q.C.push(col.r,col.g,col.b); Q.U.push(x/7,z/7); } Q.I.push(k,k+2,k+1); };
    const rect=(Q,x0,z0,x1,z1,c)=>quad(Q,[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],c);
    const rot=(x,z,cx,cz,a)=>{ const s=Math.sin(a), co=Math.cos(a), dx=x-cx, dz=z-cz; return [cx+dx*co-dz*s, cz+dx*s+dz*co]; };
    for(const p of L){ const c=p.c||'#d9d6cc', lw=p.lw||0.16;
      if(p.t==='line') rect(plain,p.x0,p.z0,p.x1,p.z1,c);
      else if(p.t==='box'){ rect(plain,p.x0,p.z0,p.x1,p.z0+lw,c); rect(plain,p.x0,p.z1-lw,p.x1,p.z1,c); rect(plain,p.x0,p.z0,p.x0+lw,p.z1,c); rect(plain,p.x1-lw,p.z0,p.x1,p.z1,c); }
      else if(p.t==='hazard'){ const along=(p.x1-p.x0)>=(p.z1-p.z0), Lh=along?p.x1-p.x0:p.z1-p.z0, Wd=along?p.z1-p.z0:p.x1-p.x0, rep=Lh/(Wd*4);
        quad(haz,[[p.x0,p.z0],[p.x1,p.z0],[p.x1,p.z1],[p.x0,p.z1]],'#ffffff',along?[[0,0],[rep,0],[rep,1],[0,1]]:[[0,0],[0,1],[rep,1],[rep,0]]); }
      else if(p.t==='park'){ const n=p.n||4, along=(p.x1-p.x0)>=(p.z1-p.z0); for(let i=0;i<=n;i++){ if(along){ const x=p.x0+(p.x1-p.x0)*i/n; rect(plain,x-lw/2,p.z0,x+lw/2,p.z1,c); } else { const z=p.z0+(p.z1-p.z0)*i/n; rect(plain,p.x0,z-lw/2,p.x1,z+lw/2,c); } }
        if(along) rect(plain,p.x0,p.z1-lw,p.x1,p.z1,c); else rect(plain,p.x1-lw,p.z0,p.x1,p.z1,c); }
      else if(p.t==='zebra'){ const along=(p.x1-p.x0)>=(p.z1-p.z0), Lz=along?p.x1-p.x0:p.z1-p.z0, st=p.st||0.6; for(let s=0;s<Lz-0.1;s+=st*2){ if(along) rect(plain,p.x0+s,p.z0,Math.min(p.x1,p.x0+s+st),p.z1,c); else rect(plain,p.x0,p.z0+s,p.x1,Math.min(p.z1,p.z0+s+st),c); } }
      else if(p.t==='arrow'){ const a=p.rot||0, s=p.s||1, cx=p.x, cz=p.z; const R0=(x,z)=>rot(cx+x*s,cz+z*s,cx,cz,a);
        quad(plain,[R0(-0.22,-0.2),R0(0.22,-0.2),R0(0.22,1.6),R0(-0.22,1.6)],c); tri(plain,R0(-0.7,-0.2),R0(0,-1.5),R0(0.7,-0.2),c); }
      else if(p.t==='text'){ const w=p.w||6, h=w*0.25, t=Assets.canvasTex(512,128,(g,W2,H2)=>{ g.clearRect(0,0,W2,H2); g.fillStyle=p.c||'#d9d6cc'; g.font='900 92px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(p.txt,W2/2,H2/2+4); },false);
        const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,alphaMap:grungeTex(),transparent:true,depthWrite:false,roughness:0.8,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
        m.rotation.set(-Math.PI/2,0,p.rot||0); m.position.set(p.x,Y+0.002,p.z); m.renderOrder=2; root.add(m); } }
    const make=(Q,material)=>{ if(!Q.I.length) return; const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(Q.P,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(Q.U,2));
      g.setAttribute('color',new THREE.Float32BufferAttribute(Q.C,3)); g.setIndex(Q.I); g.computeVertexNormals(); const m=new THREE.Mesh(g,material); m.renderOrder=2; m.receiveShadow=true; m.matrixAutoUpdate=false; root.add(m); };
    make(plain,new THREE.MeshStandardMaterial({vertexColors:true,alphaMap:grungeTex(),transparent:true,depthWrite:false,roughness:0.72,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
    if(haz.I.length){ const hm=mat('hazard').clone(); hm.map=mat('hazard').map.clone(); hm.map.wrapS=hm.map.wrapT=THREE.RepeatWrapping; hm.map.needsUpdate=true;
      Object.assign(hm,{transparent:true,opacity:0.9,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,roughness:0.7}); make(haz,hm); } }
  /* ---------- wet puddles: dark, almost mirror-smooth patches that pick up the sky, neon and lamps (def.puddles, or automatic on rainy maps) ---------- */
  function buildPuddles(){ let L=mapDef.puddles; const auto=!L&&TH.rain; if(!L&&!auto) return;
    if(auto){ L=[]; const R2=mulberry(hashStr('pud'+mapDef.id)), GW=W*CELL, GH=H*CELL;
      for(let i=0;i<400&&L.length<(mapDef.puddleCount||34);i++){ const x=6+R2()*(GW-12), z=6+R2()*(GH-12), c=cellOf(x), r=cellOf(z); if(!inB(c,r)||G[r*W+c]!==1) continue;
        if(SOL.some(s=>s.t==='b'&&s.y0<0.3&&x>s.x0-1.5&&x<s.x1+1.5&&z>s.z0-1.5&&z<s.z1+1.5)) continue;
        if((mapDef.buildings||[]).some(b=>x>b.x-1.2&&x<b.x+b.w+1.2&&z>b.z-1.2&&z<b.z+b.d+1.2)) continue; // no puddles under a roof
        L.push([x,z,1.2+R2()*2.6]); } }
    if(!L.length) return;
    const blob=Assets.canvasTex(256,256,(g,w,h)=>{ g.clearRect(0,0,w,h); const R2=mulberry(23);
      for(let q=0;q<4;q++){ const ox=(q%2)*128, oy=(q>>1)*128; for(let i=0;i<9;i++){ const cx=ox+64+(R2()-0.5)*50, cy=oy+64+(R2()-0.5)*50, r=16+R2()*30; const gr=g.createRadialGradient(cx,cy,r*0.55,cx,cy,r);
          gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,r,0,6.283); g.fill(); } } },false);
    blob.wrapS=blob.wrapT=THREE.ClampToEdgeWrapping;
    const Pp=[], U=[], I=[], Y=0.021, R3=mulberry(7);
    for(const [x,z,r] of L){ const a=R3()*6.283, ca=Math.cos(a)*r, sa=Math.sin(a)*r, k=Pp.length/3, q=(R3()*4)|0, u0=(q%2)*0.5, v0=(q>>1)*0.5;
      Pp.push(x-ca+sa,Y,z-sa-ca, x+ca+sa,Y,z+sa-ca, x+ca-sa,Y,z+sa+ca, x-ca-sa,Y,z-sa+ca); U.push(u0,v0,u0+0.5,v0,u0+0.5,v0+0.5,u0,v0+0.5); I.push(k,k+2,k+1,k,k+3,k+2); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(Pp,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); g.setIndex(I); g.computeVertexNormals();
    const night=TH.night||TH.dusk;
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:night?'#07080c':'#2a2c30',roughness:0.09,metalness:night?0.4:0.3,envMapIntensity:night?0.95:1.0,opacity:0.9,alphaMap:blob,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
    m.renderOrder=3; m.receiveShadow=true; m.matrixAutoUpdate=false; root.add(m); }
  function buildContact(){
    const P=[], U=[], I=[]; const Wd=1.5, Y=0.025;
    const strip=(ax,az,bx,bz,nx,nz)=>{ const k=P.length/3; P.push(ax,Y,az, bx,Y,bz, bx+nx*Wd,Y,bz+nz*Wd, ax+nx*Wd,Y,az+nz*Wd); U.push(0,0, 1,0, 1,1, 0,1); I.push(k,k+2,k+1,k,k+3,k+2); };
    const open=(c,r)=>inB(c,r)&&G[r*W+c]!==0&&G[r*W+c]!==4;
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){ if(G[r*W+c]!==0) continue; const x0=c*CELL,x1=x0+CELL,z0=r*CELL,z1=z0+CELL;
      if(open(c,r-1)) strip(x0,z0,x1,z0,0,-1); if(open(c,r+1)) strip(x0,z1,x1,z1,0,1); if(open(c-1,r)) strip(x0,z0,x0,z1,-1,0); if(open(c+1,r)) strip(x1,z0,x1,z1,1,0); }
    for(const b of SOL){ if(b.t!=='b'||b.y0>0.05||b.y1<1.2||b.destr||b.k==='pk'||b.k==='rail') continue; const w=b.x1-b.x0, d=b.z1-b.z0; if(Math.max(w,d)<1.2||w*d>900) continue;
      strip(b.x0,b.z0,b.x1,b.z0,0,-1); strip(b.x0,b.z1,b.x1,b.z1,0,1); strip(b.x0,b.z0,b.x0,b.z1,-1,0); strip(b.x1,b.z0,b.x1,b.z1,1,0); }
    if(!I.length) return;
    const t=Assets.canvasTex(4,64,(g,w,h)=>{ const gr=g.createLinearGradient(0,h,0,0); gr.addColorStop(0,'rgba(0,0,0,0.5)'); gr.addColorStop(0.35,'rgba(0,0,0,0.2)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.clearRect(0,0,w,h); g.fillStyle=gr; g.fillRect(0,0,w,h); },false);
    t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(P,3)); geo.setAttribute('uv',new THREE.Float32BufferAttribute(U,2)); geo.setIndex(I);
    const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,fog:true}));
    m.renderOrder=1; m.matrixAutoUpdate=false; root.add(m);
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
  const indoor=(x,y,z)=>{ for(const b of (mapDef&&mapDef.buildings||[])) if(x>b.x+0.3&&x<b.x+b.w-0.3&&z>b.z+0.3&&z<b.z+b.d-0.3&&y<b.floors*(b.fh||4)) return true; return false; };
  function addRain(){ const N=QUALITY.particles>=1?2600:1200; const g=new THREE.BufferGeometry(); const p=new Float32Array(N*6);
    for(let i=0;i<N;i++){ const x=(Math.random()-0.5)*60, y=Math.random()*30, z=(Math.random()-0.5)*60; p.set([x,y,z,x+0.03,y-0.7,z+0.02],i*6); }
    g.setAttribute('position',new THREE.BufferAttribute(p,3)); rain=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#8fa8d8',transparent:true,opacity:0.32,depthWrite:false}));
    rain.frustumCulled=false; root.add(rain); }
  function addDust(){ const N=900; const g=new THREE.BufferGeometry(); const p=new Float32Array(N*3); for(let i=0;i<N*3;i++) p[i]=(Math.random()-0.5)*50;
    g.setAttribute('position',new THREE.BufferAttribute(p,3)); dust=new THREE.Points(g,new THREE.PointsMaterial({color:'#e8dcc0',size:0.05,transparent:true,opacity:0.45,depthWrite:false})); dust.frustumCulled=false; root.add(dust); }
  /* per-frame */
  function update(dt,t){
    const cam=R.camera.position; updatePool(dt);
    if(rain&&rain.parent){ rain.position.set(cam.x,cam.y-12,cam.z);
      { const tgt=indoor(cam.x,cam.y,cam.z)?0:0.32, mt=rain.material; mt.opacity+=(tgt-mt.opacity)*Math.min(1,dt*5); rain.visible=mt.opacity>0.01; } /* no rain streaks under a roof */
      const p=rain.geometry.attributes.position.array; for(let i=0;i<p.length;i+=6){ p[i+1]-=dt*26; p[i+4]-=dt*26; if(p[i+4]<0){ p[i+1]+=30; p[i+4]+=30; } } rain.geometry.attributes.position.needsUpdate=true; }
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
