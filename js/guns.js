/* guns.js — procedural weapon, attachment, throwable and gadget models.
   Every gun is built from side-profile extrusions (receiver, stock, magazine, grip…) plus barrels, rails and small parts, then merged per material.
   Authoring space: f = metres forward of the trigger (towards the muzzle), y = up. Gun space: barrel toward -Z (z = -f), origin = right-hand grip.
   userData: muzzle (tip, after any muzzle device), sight (height of the sight line), handL, mag, pump, len, scope (full-screen scope when aiming), adsZ */
'use strict';
const Guns=(()=>{
  const M={}; let LOD=0, FP=false;
  /* ---------- materials ---------- */
  function ntex(rep,seed,lo,hi){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'), im=x.createImageData(64,64), r=mulberry(seed);
    for(let i=0;i<4096;i++){ const v=(lo+(hi-lo)*r())*255; im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=v; im.data[i*4+3]=255; } x.putImageData(im,0,0);
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep,rep); return t; }
  function woodTex(){ const c=document.createElement('canvas'); c.width=256; c.height=128; const x=c.getContext('2d'), r=mulberry(91);
    x.fillStyle='#6a3618'; x.fillRect(0,0,256,128);
    for(let i=0;i<140;i++){ const y=r()*128, a=0.05+r()*0.2, w=0.4+r()*1.4; x.strokeStyle=r()<0.72?`rgba(38,16,6,${a})`:`rgba(150,88,44,${a*0.6})`; x.lineWidth=w; x.beginPath(); x.moveTo(0,y);
      const k1=(r()-0.5)*10, k2=(r()-0.5)*10; x.bezierCurveTo(85,y+k1,170,y+k2,256,y); x.stroke(); }
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,9); return t; }
  function mats(){ if(M.steel) return M;
    const nz=ntex(48,7,0.74,1), nb=ntex(64,3,0.38,0.62);
    const S=(color,rough,metal,o)=>new THREE.MeshStandardMaterial(Object.assign({color,roughness:rough,metalness:metal,roughnessMap:nz,bumpMap:nb,bumpScale:0.5},o||{}));
    M.steel=S('#3a3e44',0.38,0.9); M.anod=S('#2c2f35',0.5,0.7); M.poly=S('#222428',0.74,0.04,{bumpScale:1.1}); M.rubber=S('#0e0e0f',0.95,0,{bumpScale:1.4});
    M.dark=new THREE.MeshStandardMaterial({color:'#050506',roughness:0.9,metalness:0.2});
    M.tan=S('#8f7850',0.7,0.1,{bumpScale:0.9}); M.tanM=S('#9a8358',0.5,0.6); M.od=S('#3d4630',0.78,0.05,{bumpScale:1}); M.grey=S('#585d63',0.55,0.6);
    const wt=woodTex(); M.wood=new THREE.MeshStandardMaterial({map:wt,color:'#f2d8c4',roughness:0.5,metalness:0,bumpMap:wt,bumpScale:0.5});
    M.woodD=new THREE.MeshStandardMaterial({map:wt,color:'#b39a86',roughness:0.56,metalness:0,bumpMap:wt,bumpScale:0.5});
    M.woodL=new THREE.MeshStandardMaterial({map:wt,color:'#ffd9a8',roughness:0.45,metalness:0});
    M.bolt=S('#a3a8af',0.26,1); M.brass=S('#c9a24a',0.3,1); M.chrome=S('#cfd2d6',0.16,1); M.nickel=S('#9a9ea5',0.32,0.95); M.satin=S('#b9bcc2',0.36,0.9);
    M.smoke=new THREE.MeshStandardMaterial({color:'#2a2622',roughness:0.25,metalness:0.1,transparent:true,opacity:0.82});
    M.lens=new THREE.MeshStandardMaterial({color:'#120b22',roughness:0.04,metalness:1,emissive:'#1a0d3a',emissiveIntensity:0.5});
    M.tubeIn=new THREE.MeshBasicMaterial({color:'#040405',side:THREE.BackSide});
    M.dot=new THREE.MeshBasicMaterial({color:'#ff2a22'}); M.beam=new THREE.MeshBasicMaterial({color:'#ff2a22',transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}); M.fiber=new THREE.MeshBasicMaterial({color:'#ff5a3a'});
    M.red=S('#a3231c',0.5,0.2); M.yellow=S('#d9a514',0.55,0.2); M.blade=S('#c5c9cf',0.2,1);
    M.glove=S('#18191b',0.85,0,{bumpScale:1.6}); M.sleeve=S('#1d1f22',0.92,0,{bumpScale:1.8}); M.sleeveB=S('#6b6e72',0.92,0,{bumpScale:1.8}); M.skin=new THREE.MeshStandardMaterial({color:'#c99a78',roughness:0.7});
    M.glowB=new THREE.MeshBasicMaterial({color:'#4fd1ff'}); M.glowO=new THREE.MeshBasicMaterial({color:'#ff9b3d'}); M.glowG=new THREE.MeshBasicMaterial({color:'#5dff8a'});
    M.snow=new THREE.MeshStandardMaterial({color:'#e8f4ff',roughness:0.4,metalness:0.1});
    M.shield=S('#23262b',0.5,0.6); M.glass=new THREE.MeshStandardMaterial({color:'#9fd0ff',roughness:0.05,transparent:true,opacity:0.35});
    M.glassClear=new THREE.MeshBasicMaterial({color:'#bfe4ff',transparent:true,opacity:0.07,depthWrite:false});
    /* older names still used by other files */
    M.metal=M.steel; M.metal2=M.grey;
    return M; }
  /* ---------- geometry helpers (authoring space) ---------- */
  function put(g,geo,mat,x,y,z){ const m=new THREE.Mesh(geo,mat); m.position.set(x||0,y||0,z||0); m.castShadow=true; g.add(m); return m; }
  function tracePath(sh,pts){ const n=pts.length, P=i=>pts[(i+n)%n];
    const cut=(a,b,d)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1, k=Math.min(d,l*0.5)/l; return [a[0]+dx*k,a[1]+dy*k]; };
    for(let i=0;i<n;i++){ const p=P(i), r=p[2]||0;
      if(r>0){ const a=cut(p,P(i-1),r), c=cut(p,P(i+1),r); if(i===0) sh.moveTo(a[0],a[1]); else sh.lineTo(a[0],a[1]); sh.quadraticCurveTo(p[0],p[1],c[0],c[1]); }
      else if(i===0) sh.moveTo(p[0],p[1]); else sh.lineTo(p[0],p[1]); }
    sh.closePath(); return sh; }
  /* side profile [[f,y,cornerRadius?]…] extruded to thickness t, centred on x */
  function prof(g,mat,pts,t,o){ o=o||{}; const b=Math.min(o.b!=null?o.b:0.003,t*0.45); const sh=tracePath(new THREE.Shape(),pts);
    if(o.holes) for(const h of o.holes) sh.holes.push(tracePath(new THREE.Path(),h));
    const d=Math.max(0.0004,t-2*b);
    const geo=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelOffset:-b,bevelSegments:LOD?1:(o.bs||2),curveSegments:LOD?2:5});
    geo.translate(0,0,-d/2); geo.rotateY(Math.PI/2); return put(g,geo,mat,o.x||0,0,0); }
  /* cross-section [[x,y,r?]…] extruded along the bore from f0 to f1 */
  function xsec(g,mat,pts,f0,f1,b){ b=b==null?0.002:b; const sh=tracePath(new THREE.Shape(),pts); const d=Math.max(0.0004,f1-f0-2*b);
    const geo=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelOffset:-b,bevelSegments:1,curveSegments:LOD?2:4}); return put(g,geo,mat,0,0,-f1+b); }
  function bx(g,mat,f0,f1,y0,y1,w,r,x){ const dz=f1-f0, dy=y1-y0; r=Math.min(r==null?0.002:r,Math.min(w,dy,dz)/2.05);
    const geo=r>0.0002&&!LOD?new THREE.RoundedBoxGeometry(w,dy,dz,2,r):new THREE.BoxGeometry(w,dy,dz); return put(g,geo,mat,x||0,(y0+y1)/2,-(f0+f1)/2); }
  const SEG=r=>LOD?(r>0.02?10:6):(r>0.03?28:r>0.012?20:r>0.005?14:8);
  /* cylinder along the bore; r = rear radius, r1 = front radius */
  function cy(g,mat,f0,f1,y,r,x,r1,seg,open){ const geo=new THREE.CylinderGeometry(r,r1==null?r:r1,f1-f0,seg||SEG(r),1,!!open); geo.rotateX(Math.PI/2); return put(g,geo,mat,x||0,y,-(f0+f1)/2); }
  /* cylinder across the gun (axis X) */
  function cx(g,mat,f,y,r,w,x,seg){ const geo=new THREE.CylinderGeometry(r,r,w,seg||SEG(r)); geo.rotateZ(Math.PI/2); return put(g,geo,mat,x||0,y,-f); }
  /* vertical cylinder */
  function cv(g,mat,f,y0,y1,r,x,r1,seg){ const geo=new THREE.CylinderGeometry(r1==null?r:r1,r,y1-y0,seg||SEG(r)); return put(g,geo,mat,x||0,(y0+y1)/2,-f); }
  /* Picatinny rail: flat base with cross slots */
  function rail(g,mat,f0,f1,y,w){ w=w||0.021; bx(g,mat,f0,f1,y,y+0.0045,w*0.78,0.0006); if(LOD){ bx(g,mat,f0,f1,y+0.004,y+0.0075,w,0); return y+0.0075; }
    const list=[]; for(let f=f0+0.003;f<f1-0.006;f+=0.01){ const b=new THREE.BoxGeometry(w,0.0034,0.0054); b.translate(0,y+0.0058,-(f+0.0027)); list.push(b); }
    if(list.length) put(g,THREE.mergeGeometries(list,false),mat,0,0,0); return y+0.0075; }
  /* a row of dark lightening slots on both sides of a handguard */
  function slots(g,f0,f1,y,x,h,ang){ if(LOD) return; const list=[]; for(let f=f0;f<f1-0.03;f+=0.042){ for(const s of [-1,1]){ const b=new THREE.BoxGeometry(0.0012,h||0.007,0.03); if(ang) b.rotateZ(s*ang); b.translate(s*x,y,-(f+0.015)); list.push(b); } }
    if(list.length) put(g,THREE.mergeGeometries(list,false),M.dark,0,0,0); }
  /* hollow tube you can look through from behind (first person): outer wall + end rings, inner wall only for outside views */
  function tube(g,mat,f0,f1,y,ri0,ro0,ri1,ro1,o){ o=o||{}; ri1=ri1==null?ri0:ri1; ro1=ro1==null?ro0:ro1; const L=f1-f0, sg=LOD?10:28;
    cy(g,mat,f0,f1,y,ro0,0,ro1,sg,true);
    const a=new THREE.RingGeometry(ri0,ro0,sg); put(g,a,mat,0,y,-f0); const b=new THREE.RingGeometry(ri1,ro1,sg); b.rotateY(Math.PI); put(g,b,mat,0,y,-f1);
    if(!FP){ const inn=new THREE.CylinderGeometry(ri0,ri1,L,sg,1,true); inn.rotateX(Math.PI/2); put(g,inn,M.tubeIn,0,y,-(f0+f1)/2).castShadow=false; }
    if(o.lens!==false){ const l=new THREE.CircleGeometry(ri1,sg); l.rotateY(Math.PI); put(g,l,M.lens,0,y,-(f1-Math.min(0.006,L*0.1))).castShadow=false; }
    if(o.lens!==false&&(!FP||o.rearLens)){ put(g,new THREE.CircleGeometry(ri0,sg),M.lens,0,y,-(f0+Math.min(0.006,L*0.1))).castShadow=false; }
  }
  /* merge all static meshes per material; groups flagged keep (magazine, pump) stay movable */
  function bake(root){ root.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(), by=new Map(), dead=[], m4=new THREE.Matrix4();
    const walk=o=>{ for(const c of o.children.slice()){ if(c.userData&&c.userData.keep){ bake(c); continue; }
        if(c.isMesh){ let geo=c.geometry.index?c.geometry.toNonIndexed():c.geometry.clone(); geo.applyMatrix4(m4.multiplyMatrices(inv,c.matrixWorld));
          for(const k of Object.keys(geo.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') geo.deleteAttribute(k);
          if(!geo.attributes.uv) geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
          if(!geo.attributes.normal) geo.computeVertexNormals();
          (by.get(c.material)||by.set(c.material,[]).get(c.material)).push(geo); dead.push(c); }
        else walk(c); } };
    walk(root); for(const d of dead){ d.parent.remove(d); d.geometry.dispose(); }
    for(const [mat,list] of by){ const geo=list.length>1?THREE.mergeGeometries(list,false):list[0]; if(!geo) continue; const mesh=new THREE.Mesh(geo,mat); mesh.castShadow=!(mat===M.glassClear||mat===M.tubeIn||mat===M.dot||mat===M.fiber||mat===M.beam); root.add(mesh); }
    return root; }
  const V=(f,y,x)=>new THREE.Vector3(x||0,y,-f);

  /* ================= shared sub-assemblies ================= */
  /* where the barrel ends for this build: long / short barrel options move the tip, never behind min */
  function tip(A,f1,min,dl,ds){ const t=A.barrel==='long'?f1+(dl||0.1):A.barrel==='short'?f1-(ds||0.08):f1; return Math.max(min==null?-9:min,t); }
  const bR=(A,r)=>A.barrel==='heavy'?r*1.32:r;
  /* muzzle device on the barrel tip; moves u.muzzle to the new tip */
  function muzzleDev(g,u,A,w){ const m=u.muzzle; if(!m) return; const f=-m.z, y=m.y, x=m.x, r=u.muzR||0.009, k=A.muzzle||'none', pistol=w&&w.cat==='pistol'; let L=0;
    if(u.noMuzzle) return;
    if(k==='none'){ if(!u.ownMuzzle){ L=0.012; cy(g,M.steel,f-0.004,f+L,y,r*1.22,x); } }
    else if(k==='comp'){ L=pistol?0.034:0.052; const R=Math.max(r*1.75,0.0125); bx(g,M.steel,f-0.004,f+L,y-R,y+R,R*2,0.003,x);
      if(!LOD) for(let i=0;i<(pistol?2:3);i++){ const ff=f+0.008+i*(pistol?0.011:0.014); bx(g,M.dark,ff,ff+0.007,y+R*0.2,y+R+0.0004,R*1.3,0,x); bx(g,M.dark,ff,ff+0.007,y-R*0.5,y+R*0.5,R*2+0.0008,0,x); } }
    else if(k==='flash'){ L=0.05; const R=Math.max(r*1.5,0.011); cy(g,M.steel,f-0.004,f+L*0.3,y,R,x); 
      if(LOD) cy(g,M.steel,f+L*0.3,f+L,y,R,x); else for(let i=0;i<4;i++){ const a=i/4*Math.PI*2+0.4; bx(g,M.steel,f+L*0.28,f+L,y+Math.sin(a)*R*0.72-R*0.3,y+Math.sin(a)*R*0.72+R*0.3,R*0.6,0.001,x+Math.cos(a)*R*0.72).rotation.z=a; }
      cy(g,M.dark,f+L*0.3,f+L-0.002,y,R*0.42,x); }
    else if(k==='sup'){ L=pistol?0.12:0.175; const R=pistol?0.0155:Math.max(0.0185,r*1.9); cy(g,M.anod,f-0.006,f+L,y,R,x); cy(g,M.steel,f-0.01,f+0.012,y,R*1.06,x,null,LOD?8:12); cy(g,M.steel,f+L-0.006,f+L+0.002,y,R*0.94,x); cy(g,M.dark,f+L+0.0015,f+L+0.0025,y,r*0.75,x);
      if(!LOD) for(let i=1;i<4;i++) cy(g,M.steel,f+L*i/4-0.001,f+L*i/4+0.001,y,R*1.012,x); }
    else if(k==='brake'){ const R=Math.max(r*1.3,0.0115); L=brake(g,f-0.004,y,R,3)-f; }
    else if(k==='choke'){ L=0.045; cy(g,M.steel,f-0.004,f+L,y,r*1.18,x); if(!LOD) for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; bx(g,M.dark,f+L*0.45,f+L+0.0004,y+Math.sin(a)*r*1.16-0.0018,y+Math.sin(a)*r*1.16+0.0018,0.0036,0,x+Math.cos(a)*r*1.16).rotation.z=a; } }
    u.muzzle=V(f+L,y,x); u.len=(u.len||0)+L; }
  /* under-barrel parts: foregrips, laser, bipod. They hang under the handguard where the support hand sits (u.handL). */
  function gripDev(g,u,A,w){ const k=A.grip||'none'; if(k==='none') return; const hw=u.hgW||0.022;
    if(k==='laser'){ let f, y, x; if(u.under){ f=u.under.f; y=u.under.y-0.022; x=0; bx(g,M.anod,f,f+0.048,y,y+0.022,0.02,0.003,x); }
      else if(u.handL){ f=-u.handL.z+0.06; y=u.handL.y+0.026; x=hw+0.011; bx(g,M.anod,f,f+0.052,y-0.011,y+0.011,0.02,0.003,x); bx(g,M.steel,f+0.01,f+0.04,y-0.004,y+0.004,0.006,0.001,x-0.011); y-=0.011; } else return;
      cy(g,M.steel,f+0.046,f+0.056,y+0.011,0.0062,x,null,10); cy(g,M.dot,f+0.0555,f+0.057,y+0.011,0.0034,x,null,8);
      if(FP){ const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.0004,0.0011,1.6,5,1,true),M.beam); beam.rotation.x=Math.PI/2; beam.position.set(x,y+0.011,-(f+0.057+0.8)); beam.userData.keepMesh=true; g.add(beam); }
      return; }
    if(!u.handL) return; const f=-u.handL.z, yB=u.handL.y+0.01;
    if(k==='bipod'){ bipod(g,f+0.07,yB-0.002,0.2); return; }
    if(!LOD) bx(g,M.anod,f-0.03,f+0.03,yB-0.006,yB+0.002,0.018,0.001);
    if(k==='vert'){ prof(g,M.poly,[[f-0.0135,yB-0.004],[f+0.0135,yB-0.004],[f+0.012,yB-0.082,0.007],[f-0.012,yB-0.082,0.007]],0.027,{b:0.008,bs:3}); if(!LOD) for(let i=0;i<4;i++) bx(g,M.dark,f-0.014,f+0.014,yB-0.03-i*0.012,yB-0.026-i*0.012,0.0274,0);
      u.gripL={y:yB-0.045,z:-f,rk:0,wT:0.0125,wD:0.0135}; u.handL=V(f,yB-0.045); }
    else if(k==='half'){ prof(g,M.poly,[[f-0.014,yB-0.004],[f+0.014,yB-0.004],[f+0.013,yB-0.046,0.009],[f-0.013,yB-0.046,0.009]],0.028,{b:0.009,bs:3}); u.gripL={y:yB-0.026,z:-f,rk:0,wT:0.013,wD:0.014}; u.handL=V(f,yB-0.026); }
    else if(k==='angled'){ prof(g,M.poly,[[f-0.045,yB-0.004],[f+0.045,yB-0.004],[f+0.045,yB-0.014,0.004],[f-0.03,yB-0.04,0.01],[f-0.045,yB-0.034,0.006]],0.03,{b:0.008,bs:3}); u.handL=V(f-0.004,yB-0.03); }
    else if(k==='thumb'){ bx(g,M.poly,f+0.0,f+0.04,yB+0.022,yB+0.034,0.014,0.004,-(hw+0.004)); bx(g,M.poly,f+0.03,f+0.04,yB+0.03,yB+0.046,0.012,0.003,-(hw+0.005)); } }
  /* stock add-ons: cheek pad, shell loops */
  function stockExtra(g,u,A,w){ const R=stockRef; if(!R||R.none) return; const e=R.f-R.len, sw=R.w||0.038;
    if(A.stock==='cheek'){ const y=R.top!=null?R.top:R.y+0.022; prof(g,M.rubber,[[e+0.055,y-0.002],[R.f-0.045,y-0.002],[R.f-0.045,y+0.02,0.009],[e+0.055,y+0.02,0.009]],sw*0.9,{b:0.009,bs:3}); if(!LOD) for(const ff of [e+0.075,R.f-0.07]) bx(g,M.dark,ff-0.006,ff+0.006,y-0.03,y+0.004,sw+0.002,0.001); }
    else if(A.stock==='loops'){ const y=R.y-0.012, sh=w&&w.cat==='sg'; bx(g,M.dark,e+0.06,e+0.06+0.1,y-0.016,y+0.016,sw+0.003,0.002);
      for(let i=0;i<5;i++){ const ff=e+0.07+i*0.02; cv(g,sh?M.red:M.brass,ff,y-0.026,y+0.022,sh?0.0062:0.0048,sw/2+0.004,null,8); if(sh&&!LOD) cv(g,M.brass,ff,y+0.012,y+0.023,0.0064,sw/2+0.004,null,8); } } }
  /* big sniper brake (part of the gun when no muzzle device is chosen) */
  function brake(g,f,y,r,n){ bx(g,M.steel,f,f+0.022*n+0.012,y-r,y+r,r*2.6,0.003); if(!LOD) for(let i=0;i<n;i++){ bx(g,M.dark,f+0.008+i*0.022,f+0.02+i*0.022,y-r*0.55,y+r*0.55,r*2.62,0); } return f+0.022*n+0.012; }
  /* flip-up iron sights for a top rail. Returns the sight-line height. */
  function flipIrons(g,y,fr,ff){ const h=0.03;
    bx(g,M.anod,fr-0.012,fr+0.012,y,y+0.008,0.022,0.002); for(const s of [-1,1]) prof(g,M.steel,[[fr-0.004,y+0.006],[fr+0.004,y+0.006],[fr+0.004,y+h+0.004,0.003],[fr-0.004,y+h+0.004,0.003]],0.0035,{x:s*0.0085,b:0.0008});
    bx(g,M.steel,fr-0.003,fr+0.003,y+0.006,y+h-0.008,0.02,0.001);
    bx(g,M.anod,ff-0.012,ff+0.012,y,y+0.008,0.022,0.002); for(const s of [-1,1]) prof(g,M.steel,[[ff-0.005,y+0.006],[ff+0.005,y+0.006],[ff+0.003,y+h+0.008,0.003],[ff-0.003,y+h+0.008,0.003]],0.003,{x:s*0.0095,b:0.0008});
    cv(g,M.steel,ff,y+0.006,y+h,0.0013); bx(g,M.steel,ff-0.004,ff+0.004,y+0.006,y+0.014,0.02,0.001); return y+h+0.0008; }
  /* optics. R = {y: top of the rail, f: where the optic's centre sits, fr: rear limit}. Returns the sight-line height. */
  function optic(g,u,kind,R){ const y=R.y, f=R.f; let yc, rear;
    const clampKnob=(ff)=>{ cx(g,M.steel,ff,y+0.006,0.006,0.008,-0.018,8); };
    if(kind==='reddot'){ yc=y+0.034; rear=f-0.03; bx(g,M.anod,f-0.022,f+0.022,y,y+0.019,0.026,0.003); clampKnob(f); tube(g,M.anod,f-0.03,f+0.032,yc,0.0128,0.0166,null,null,{lens:false});
      cv(g,M.anod,f,yc+0.015,yc+0.024,0.0065,0,null,10); cx(g,M.anod,f,yc,0.0065,0.008,0.02,10);
      if(!LOD){ put(g,new THREE.SphereGeometry(0.00075,6,4),M.dot,0,yc,-(f+0.028)); if(FP){ const gl=new THREE.CircleGeometry(0.0128,20); put(g,gl,M.glassClear,0,yc,-(f+0.027)); } } }
    else if(kind==='holo'){ yc=y+0.04; rear=f-0.04; const W=0.021, top=yc+0.017, bot=y+0.022;
      bx(g,M.anod,f-0.042,f+0.04,y,bot,0.04,0.004); bx(g,M.poly,f-0.05,f-0.03,y+0.002,bot+0.004,0.036,0.004); clampKnob(f-0.01);
      for(const s of [-1,1]) bx(g,M.anod,f+0.016,f+0.034,bot-0.002,top,0.004,0.0012,s*W);
      bx(g,M.anod,f+0.016,f+0.034,top-0.003,top+0.001,W*2+0.004,0.0012); prof(g,M.anod,[[f-0.038,bot-0.001],[f+0.018,top-0.004],[f+0.018,top+0.001],[f-0.038,bot+0.006]],0.003,{x:W,b:0.0006}); prof(g,M.anod,[[f-0.038,bot-0.001],[f+0.018,top-0.004],[f+0.018,top+0.001],[f-0.038,bot+0.006]],0.003,{x:-W,b:0.0006});
      if(!LOD){ const rg=new THREE.RingGeometry(0.0036,0.0041,24); put(g,rg,M.dot,0,yc,-(f+0.026)); put(g,new THREE.SphereGeometry(0.0006,6,4),M.dot,0,yc,-(f+0.026)); for(let i=0;i<4;i++){ const a=i*Math.PI/2; bx(g,M.dot,f+0.0258,f+0.0262,yc+Math.sin(a)*0.0048-0.0003,yc+Math.sin(a)*0.0048+0.0003,0.0006,0,Math.cos(a)*0.0048).rotation.z=a; }
        if(FP) put(g,new THREE.PlaneGeometry(W*2-0.004,top-bot-0.003),M.glassClear,0,(top+bot)/2,-(f+0.025)); } }
    else if(kind==='x2'){ yc=y+0.036; rear=f-0.045; bx(g,M.anod,f-0.026,f+0.026,y,y+0.018,0.028,0.003); clampKnob(f-0.012); clampKnob(f+0.012);
      tube(g,M.anod,f-0.045,f+0.05,yc,0.0155,0.02,0.017,0.0215,{lens:false}); cy(g,M.anod,f+0.04,f+0.056,yc,0.0228,0,null,LOD?10:24,true);
      cv(g,M.anod,f-0.002,yc+0.018,yc+0.028,0.0075,0,null,10); cx(g,M.anod,f-0.002,yc,0.0075,0.009,0.024,10);
      if(!LOD){ put(g,new THREE.SphereGeometry(0.0006,6,4),M.dot,0,yc,-(f+0.045)); const rg=new THREE.RingGeometry(0.0042,0.0046,24); put(g,rg,M.dot,0,yc,-(f+0.045)); } }
    else if(kind==='x3'){ yc=y+0.038; rear=f-0.06; bx(g,M.anod,f-0.04,f+0.03,y,y+0.016,0.028,0.003); clampKnob(f-0.022); clampKnob(f+0.012);
      tube(g,M.anod,f-0.06,f+0.072,yc,0.0158,0.0195,0.0205,0.0245,{lens:false});
      prof(g,M.anod,[[f-0.04,y+0.012],[f+0.03,y+0.012],[f+0.03,yc-0.0185,0.003],[f-0.04,yc-0.0185,0.003]],0.03,{b:0.003}); bx(g,M.fiber,f-0.01,f+0.05,yc+0.0195,yc+0.0235,0.004,0.001);
      cx(g,M.anod,f-0.03,yc,0.007,0.008,0.023,10); cv(g,M.anod,f-0.03,yc+0.018,yc+0.026,0.007,0,null,10);
      if(!LOD){ const tr=new THREE.BufferGeometry(); tr.setAttribute('position',new THREE.Float32BufferAttribute([0,0.0012,0,-0.0011,-0.0008,0,0.0011,-0.0008,0],3)); tr.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3)); tr.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,0,0,0,0],2)); put(g,tr,M.dot,0,yc-0.0004,-(f+0.066));
        bx(g,M.dot,f+0.0658,f+0.0662,yc-0.0075,yc-0.0016,0.0003,0); } }
    else { /* long scopes: x4, x6, x8 — aiming switches to the full-screen scope */
      const P={x4:{L:0.2,ro:0.0225,oc:0.0195},x6:{L:0.27,ro:0.0265,oc:0.0205},x8:{L:0.33,ro:0.03,oc:0.021}}[kind]||{L:0.22,ro:0.024,oc:0.02};
      const f0=Math.max(R.fr!=null?R.fr-0.03:-9,f-P.L*0.5), f1=f0+P.L, t=0.0152; yc=y+0.012+Math.max(P.ro,0.022); rear=f0;
      cy(g,M.anod,f0+0.05,f1-0.07,yc,t,0); tube(g,M.anod,f0,f0+0.055,yc,P.oc-0.003,P.oc,null,null,{rearLens:true}); cy(g,M.rubber,f0-0.004,f0+0.012,yc,P.oc+0.0012,0,null,LOD?10:24,true);
      cy(g,M.anod,f0+0.052,f0+0.07,yc,P.oc,0,t); cy(g,M.anod,f1-0.085,f1-0.06,yc,t,0,P.ro); tube(g,M.anod,f1-0.062,f1+(kind==='x8'?0.03:0),yc,P.ro-0.003,P.ro);
      const fm=(f0+0.07+f1-0.085)/2; bx(g,M.anod,fm-0.014,fm+0.014,yc-0.019,yc+0.019,0.038,0.006); cv(g,M.anod,fm,yc+0.017,yc+0.032,0.0095,0,null,LOD?8:16); cx(g,M.anod,fm,yc,0.0095,0.012,0.026,LOD?8:16); cx(g,M.anod,fm,yc,0.008,0.009,-0.024,LOD?8:14);
      if(!LOD){ cv(g,M.steel,fm,yc+0.032,yc+0.034,0.0098,0,null,16); }
      for(const fr of [fm-0.045,fm+0.045].map(v=>clamp(v,f0+0.075,f1-0.1))){ bx(g,M.anod,fr-0.008,fr+0.008,y,yc,0.02,0.002); cy(g,M.anod,fr-0.008,fr+0.008,yc,t+0.004,0,null,LOD?8:16); clampKnob(fr); }
      u.scope=true; }
    u.adsZ=rear-(kind==='reddot'||kind==='holo'?0.15:kind==='x2'?0.095:kind==='x3'?0.08:0.14); return yc; }
  /* stocks. o = {f: rear face of the receiver, y: centre line, len, mat, tube: has an AR buffer tube}. Returns nothing; butt ends near f-len. */
  let stockRef=null; const sty=(A,map)=>map[A.stock]||map.std;
  function stock(g,style,o){ const f=o.f, y=o.y, L=o.len||0.25, m=o.mat||M.poly, e=f-L; stockRef={f,y,len:L,none:style==='none'};
    const pad=(top,bot,w)=>prof(g,M.rubber,[[e-0.009,top-0.004,0.004],[e+0.001,top],[e+0.001,bot],[e-0.009,bot+0.004,0.004]],w||0.036,{b:0.004});
    if(o.tube){ cy(g,M.anod,f-Math.min(L*0.8,0.19),f+0.004,y,0.0145); cy(g,M.steel,f-0.014,f-0.003,y,0.0188,0,null,LOD?8:12); }
    switch(style){
    case 'none': if(o.tube){ cy(g,M.rubber,f-0.2,f-0.06,y,0.019); cy(g,M.steel,f-0.205,f-0.195,y,0.016); } else { bx(g,M.steel,f-0.01,f+0.002,y-0.018,y+0.018,0.03,0.004); if(!LOD) put(g,new THREE.TorusGeometry(0.008,0.0016,6,12),M.steel,0.014,y-0.004,-(f-0.012)); } break;
    case 'tele': prof(g,m,[[f-0.075,y+0.02,0.004],[e+0.012,y+0.022,0.006],[e,y+0.012,0.005],[e,y-0.084,0.008],[e+0.018,y-0.09,0.008],[e+0.082,y-0.03,0.012],[f-0.075,y-0.022,0.004]],0.038,{b:0.007,bs:3,holes:[[[e+0.016,y-0.026,0.004],[e+0.06,y-0.03,0.004],[e+0.02,y-0.066,0.006]]]});
      pad(y+0.014,y-0.086); bx(g,M.steel,e+0.085,e+0.125,y-0.034,y-0.024,0.012,0.002); if(!LOD){ bx(g,M.dark,e+0.03,e+0.1,y+0.004,y+0.01,0.0388,0); } break;
    case 'fixed': prof(g,m,[[f,y+0.021],[e,y+0.024,0.008],[e,y-0.1,0.01],[e+0.03,y-0.106,0.01],[f,y-0.024]],0.04,{b:0.009,bs:3}); pad(y+0.022,y-0.102); break;
    case 'skel': prof(g,m,[[f,y+0.018],[e,y+0.02,0.006],[e,y-0.1,0.008],[e+0.02,y-0.104,0.008],[f,y-0.02]],0.024,{b:0.005,holes:[[[f-0.035,y+0.006,0.006],[e+0.022,y+0.008,0.008],[e+0.022,y-0.08,0.012]]]}); pad(y+0.018,y-0.102,0.03); break;
    case 'prec': prof(g,m,[[f,y+0.02],[e+0.004,y+0.02,0.005],[e,y-0.11,0.006],[e+0.05,y-0.112,0.008],[e+0.075,y-0.076,0.012],[f-0.03,y-0.03,0.012],[f,y-0.024]],0.04,{b:0.007,holes:[[[f-0.075,y-0.014,0.008],[e+0.045,y-0.014,0.008],[e+0.085,y-0.058,0.012]]]});
      prof(g,m,[[e+0.05,y+0.022],[f-0.06,y+0.022],[f-0.06,y+0.04,0.008],[e+0.05,y+0.04,0.008]],0.032,{b:0.008}); if(!LOD) for(const ff of [e+0.075,f-0.085]) cv(g,M.steel,ff,y+0.012,y+0.026,0.004);
      pad(y+0.018,y-0.108); if(!LOD) cx(g,M.steel,e+0.03,y-0.045,0.008,0.046,0,10); break;
    case 'wood': prof(g,m,[[f,y+0.026],[e,y+0.006,0.01],[e-0.004,y-0.094,0.014],[f,y-0.028,0.004]],0.036,{b:0.012,bs:3}); prof(g,M.steel,[[e-0.008,y+0.007,0.003],[e+0.001,y+0.007],[e-0.003,y-0.094],[e-0.012,y-0.091,0.003]],0.034,{b:0.004}); break;
    case 'fold': prof(g,m,[[f-0.01,y+0.02],[e+L*0.55,y+0.03,0.012],[e,y+0.03,0.006],[e,y-0.092,0.012],[e+0.035,y-0.098,0.01],[e+0.07,y-0.03,0.014],[f-0.01,y-0.022]],0.036,{b:0.008,holes:[[[e+0.03,y+0.012,0.008],[e+L*0.5,y+0.012,0.008],[e+0.05,y-0.06,0.012]]]});
      cv(g,M.steel,f-0.004,y-0.024,y+0.022,0.008,0,null,10); pad(y+0.024,y-0.094); break;
    case 'wire': for(const s of [-1,1]) cy(g,M.steel,e,f+0.01,y+0.004,0.0038,s*0.017,null,6); prof(g,M.steel,[[e-0.006,y+0.022,0.006],[e+0.004,y+0.022,0.004],[e+0.008,y-0.06,0.006],[e-0.004,y-0.085,0.006],[e-0.012,y-0.08,0.004]],0.044,{b:0.004}); break;
    } }
  /* magazines. o = {f0,f1: top span, y: top, len, lean, w, mat, drum:'c'|'ak'|null}; makes u.mag (movable for the reload animation) */
  /* a part the reload animation moves (kept out of the bake); its children stay in gun space */
  function part(g,u,key){ const G=new THREE.Group(); G.userData.keep=true; g.add(G); if(key) u[key]=G; return G; }
  /* a charging handle the hand pulls back on an empty reload; at = where the fingers take it */
  function chg(g,u,f,y,x){ u.chargeAt=V(f,y,x); return part(g,u,'charge'); }
  function mag(g,u,A,o){ const G=new THREE.Group(); G.userData.keep=true; g.add(G); u.mag=G; const k=A.mag||'std', big=k==='ext'||k==='extq';
    const f0=o.f0, f1=o.f1, y=o.y, w=o.w||0.023, m=o.mat||M.steel; const L=o.len*(big?1.36:1), ln=(o.lean||0)*(big?1.75:1);
    if(k==='drum'&&o.drum){ const yd=y-0.105, fm=(f0+f1)/2+ln*0.3; prof(G,m,[[f0,y],[f1,y],[f1+ln*0.2,yd+0.02],[f0+ln*0.2,yd+0.02]],w,{b:0.002});
      if(o.drum==='c'){ for(const s of [-1,1]){ cy(G,m,fm-0.03,fm+0.03,yd,0.04,s*0.046,null,LOD?10:24); cy(G,M.steel,fm+0.03,fm+0.034,yd,0.012,s*0.046); } bx(G,m,fm-0.026,fm+0.026,yd-0.012,yd+0.022,0.06,0.004); }
      else { cx(G,m,fm+0.012,yd-0.012,0.062,0.056,0,LOD?12:28); cx(G,M.steel,fm+0.012,yd-0.012,0.016,0.06,0,10); }
      return G; }
    const D=[f1+ln,y-L], E=[f0+ln,y-L-(ln>0.01?0.008:0)];
    prof(G,m,[[f0,y],[f1,y],[f1+ln*0.28,y-L*0.5,L*0.45],[D[0],D[1],0.004],[E[0],E[1],0.004],[f0+ln*0.28,y-L*0.5,L*0.45]],w,{b:0.003});
    prof(G,o.plate||m,[[E[0]-0.003,E[1]+0.004],[D[0]+0.003,D[1]+0.004],[D[0]+0.003,D[1]-0.005,0.002],[E[0]-0.003,E[1]-0.005,0.002]],w+0.004,{b:0.002});
    if(!LOD&&o.ribs){ for(let i=1;i<=o.ribs;i++){ const t=i/(o.ribs+1), q=t*t; bx(G,m,f0+ln*q+0.004,f1+ln*q-0.004,y-L*t-0.0025,y-L*t+0.0025,w+0.0016,0.001); } }
    if(k==='quick'||k==='extq'){ const cf=(D[0]+E[0])/2, cyy=(D[1]+E[1])/2-0.004; prof(G,M.rubber,[[cf-0.02,cyy+0.004,0.004],[cf+0.02,cyy+0.004,0.004],[cf+0.014,cyy-0.026,0.01],[cf-0.014,cyy-0.026,0.01]],0.012,{b:0.003,holes:[[[cf-0.011,cyy-0.004,0.004],[cf+0.011,cyy-0.004,0.004],[cf+0.007,cyy-0.019,0.006],[cf-0.007,cyy-0.019,0.006]]]}); }
    return G; }
  /* pistol grip: f0,y0 = top front corner */
  function pgrip(g,mat,f0,y0,o){ o=o||{}; const L=o.len||0.098, rk=o.rake==null?0.33:o.rake, wd=o.fw||0.044, t=o.t||0.028, tg=o.tang==null?0.012:o.tang, bf=f0-L*rk;
    return prof(g,mat,[[f0,y0],[f0-0.004,y0-L*0.22,0.008],[bf+0.002,y0-L,0.008],[bf-wd*0.88,y0-L+0.005,0.009],[f0-wd-L*rk*0.42-0.004,y0-L*0.45,0.03],[f0-wd-0.003,y0-0.012,0.008],[f0-wd-0.012,y0+tg,0.004],[f0-wd+0.008,y0+tg]],t,{b:o.b||0.008,bs:3}); }
  /* trigger and guard: f,y = where the trigger meets the receiver */
  function trig(g,f,y,o){ o=o||{}; const gl=o.len||0.055, d=o.drop||0.034, bk=o.back||0.02;
    prof(g,M.steel,[[f+0.004,y+0.004],[f+0.008,y-0.008,0.004],[f+0.004,y-0.024,0.003],[f-0.001,y-0.024,0.002],[f+0.001,y-0.01,0.004],[f-0.004,y+0.004]],0.006,{b:0.0015});
    if(o.guard!==false) prof(g,o.mat||M.anod,[[f+gl,y+0.002],[f+gl,y-d,0.009],[f-bk,y-d-0.002,0.009],[f-bk,y+0.002],[f-bk+0.004,y+0.002],[f-bk+0.004,y-d+0.003,0.006],[f+gl-0.004,y-d+0.004,0.006],[f+gl-0.004,y+0.002]],o.w||0.012,{b:0.0015}); }
  function bipod(g,f,y,len){ if(LOD) return; bx(g,M.steel,f-0.012,f+0.012,y-0.012,y+0.004,0.03,0.003); for(const s of [-1,1]){ cy(g,M.steel,f-len,f,y-0.01,0.0045,s*0.014,null,6); cy(g,M.rubber,f-len-0.012,f-len+0.004,y-0.01,0.006,s*0.014,null,6); } }

  /* ================= the guns ================= */
  /* AR-15 pattern: M4 carbine, and the semi-auto marksman rifle built on the same receiver */
  function ar15(g,u,A,c){ const B=0.05, T=B+0.031, rm=c.recv||M.anod, fm=c.furn||M.poly, hg=c.hg||0.385;
    prof(g,rm,[[-0.078,B-0.012],[-0.078,T-0.006,0.005],[-0.066,T,0.004],[0.137,T],[0.137,B-0.02,0.004],[0.09,B-0.02],[0.08,B-0.012]],0.034,{b:0.005});
    bx(g,M.dark,0.02,0.084,B-0.008,B+0.01,0.001,0,0.0168); bx(g,M.bolt,0.024,0.08,B-0.005,B+0.007,0.0014,0,0.0169);
    prof(g,rm,[[0.018,B-0.011],[0.086,B-0.011],[0.086,B-0.025,0.002],[0.018,B-0.025,0.002]],0.0028,{x:0.0185,b:0.0008});
    prof(g,rm,[[-0.014,B-0.008],[0.012,B-0.008],[0.014,B+0.004],[-0.004,B+0.013,0.003]],0.007,{x:0.0195,b:0.002});
    if(!LOD){ cx(g,M.steel,-0.036,B+0.008,0.0062,0.012,0.0215,10); cx(g,rm,-0.036,B+0.008,0.008,0.006,0.018,10); }
    bx(g,M.steel,-0.09,-0.076,T-0.012,T-0.005,0.036,0.002); bx(g,M.steel,-0.09,-0.02,T-0.011,T-0.005,0.012,0.001);
    prof(g,rm,[[-0.078,B-0.01],[0.128,B-0.01],[0.128,B-0.088,0.004],[0.066,B-0.094,0.003],[0.062,B-0.062,0.004],[0.03,B-0.058],[-0.045,B-0.058,0.004],[-0.078,B-0.036,0.008]],0.03,{b:0.004});
    if(!LOD){ for(const p of [[0.118,B-0.03],[-0.052,B-0.028]]) cx(g,M.steel,p[0],p[1],0.0035,0.0315,0,8); cx(g,M.steel,-0.02,B-0.036,0.005,0.033,0,10); bx(g,M.steel,-0.042,-0.018,B-0.039,B-0.033,0.0022,0.0008,-0.0162);
      bx(g,M.steel,0.048,0.062,B-0.032,B-0.006,0.003,0.001,-0.0165); cx(g,M.steel,0.05,B-0.042,0.005,0.004,0.0165,10); }
    trig(g,0.012,B-0.058,{len:0.052,mat:rm}); pgrip(g,fm,-0.004,B-0.058);
    xsec(g,c.hgMat||rm,[[-0.012,T-0.001,0.003],[0.012,T-0.001,0.003],[0.0215,B+0.014,0.004],[0.0215,B-0.014,0.004],[0.012,B-0.026,0.003],[-0.012,B-0.026,0.003],[-0.0215,B-0.014,0.004],[-0.0215,B+0.014,0.004]],0.139,hg,0.002);
    cy(g,M.steel,0.135,0.142,B,0.024,0,null,LOD?8:16);
    slots(g,0.158,hg-0.008,B,0.0217,0.0075); slots(g,0.158,hg-0.008,B-0.0205,0.0172,0.007,-0.78); slots(g,0.158,hg-0.008,B+0.0205,0.0172,0.007,0.78);
    const ry=rail(g,rm,-0.068,hg-0.004,T,0.021);
    const r=bR(A,0.0088), tf=tip(A,c.tip||0.483,hg+0.03,c.dl||0.12,0.07); cy(g,M.steel,0.13,tf,B,r); if(!LOD&&tf>hg+0.055) cy(g,M.steel,hg+0.02,hg+0.034,B,r*1.3);
    u.muzzle=V(tf,B); u.muzR=r;
    stock(g,sty(A,c.stocks||{std:'tele',light:'skel',heavy:'prec',none:'none'}),{f:-0.078,y:B,len:c.lop||0.235,mat:fm,tube:true});
    mag(g,u,A,{f0:0.068,f1:0.122,y:B-0.07,len:c.magLen||0.118,lean:c.magLean==null?0.02:c.magLean,w:0.0225,mat:c.magMat||M.poly,drum:'c',ribs:c.magLen?0:3});
    u.rail={y:ry,f:c.of==null?0.035:c.of,fr:-0.068}; u.irons=()=>flipIrons(g,ry,-0.05,hg-0.03); u.handL=V(0.27,B-0.036); u.rl='ar'; u.recvTop=T; }
  /* Kalashnikov pattern: AK-47 (wood) and the box-fed automatic shotgun (polymer) */
  function ak(g,u,A,c){ const B=0.05, W=c.furn||M.wood, S=M.steel, sg=!!c.sg;
    prof(g,S,[[-0.088,B-0.046,0.004],[0.176,B-0.046],[0.176,B+0.01],[-0.088,B+0.01,0.003]],0.032,{b:0.003});
    prof(g,S,[[-0.086,B+0.009],[0.112,B+0.009],[0.112,B+0.027,0.006],[-0.064,B+0.031,0.012],[-0.086,B+0.02,0.008]],0.03,{b:0.009,bs:3});
    bx(g,S,0.112,0.178,B+0.008,B+0.03,0.03,0.004);
    if(!LOD){ for(const ff of [-0.03,0.02,0.07]) bx(g,S,ff,ff+0.012,B+0.02,B+0.0325,0.024,0.004);
      bx(g,M.dark,-0.02,0.108,B+0.003,B+0.012,0.001,0,0.0162); bx(g,M.bolt,0.03,0.106,B+0.0045,B+0.0105,0.0016,0,0.0163);
      prof(g,S,[[-0.035,B-0.004],[0.07,B-0.018],[0.076,B-0.012],[0.07,B-0.006],[-0.03,B+0.006,0.004]],0.002,{x:0.0172,b:0.0006});
      for(const p of [[-0.07,B-0.01],[0.0,B-0.03],[0.05,B-0.03],[0.15,B-0.008],[0.15,B-0.036]]) cx(g,M.grey,p[0],p[1],0.0028,0.0335,0,6); }
    { /* bolt-carrier handle on the right: its own group so the reload can rack it (u.charge) */ const G=new THREE.Group(); G.userData.keep=true; g.add(G); u.charge=G;
      cx(G,S,0.062,B+0.0075,0.0042,0.026,0.029,8); cx(G,S,0.062,B+0.0075,0.0058,0.008,0.04,10); u.chargeAt=V(0.062,B+0.0075,0.044); }
    prof(g,S,[[0.078,B-0.046],[0.078,B-0.082,0.008],[-0.02,B-0.086,0.008],[-0.02,B-0.046],[-0.016,B-0.046],[-0.016,B-0.081,0.005],[0.074,B-0.078,0.005],[0.074,B-0.046]],0.014,{b:0.0012});
    trig(g,0.014,B-0.046,{guard:false}); bx(g,S,0.076,0.083,B-0.078,B-0.05,0.012,0.002);
    pgrip(g,W,-0.012,B-0.046,{len:0.1,rake:0.3,fw:0.04,tang:0.002});
    prof(g,W,[[0.18,B-0.03,0.008],[0.262,B-0.036,0.03],[0.345,B-0.028,0.008],[0.345,B+0.004],[0.18,B+0.004]],0.042,{b:0.013,bs:3});
    prof(g,W,[[0.196,B+0.014],[0.332,B+0.014],[0.332,B+0.04,0.009],[0.196,B+0.04,0.009]],0.032,{b:0.011,bs:3});
    bx(g,S,0.344,0.357,B-0.03,B+0.012,0.04,0.003); bx(g,S,0.178,0.196,B-0.012,B+0.04,0.034,0.004);
    cy(g,S,0.176,0.372,B+0.03,0.0085); prof(g,S,[[0.356,B-0.012],[0.394,B-0.012],[0.394,B+0.012],[0.376,B+0.04,0.004],[0.356,B+0.04]],0.022,{b:0.003});
    const r=bR(A,sg?0.0112:0.0082), tf=tip(A,c.tip||0.59,0.47,0.1,0.1); cy(g,S,0.176,tf,B,r);
    const fs=tf-0.04; prof(g,S,[[fs-0.014,B-0.013],[fs+0.014,B-0.013],[fs+0.012,B+0.012],[fs+0.004,B+0.04],[fs-0.004,B+0.04],[fs-0.012,B+0.012]],0.014,{b:0.002});
    for(const s of [-1,1]) prof(g,S,[[fs-0.006,B+0.036],[fs+0.006,B+0.036],[fs+0.007,B+0.057,0.004],[fs-0.007,B+0.057,0.004]],0.002,{x:s*0.008,b:0.0006});
    cv(g,S,fs,B+0.04,B+0.0505,0.0012,0,null,6); if(!LOD&&!sg) cy(g,S,0.36,tf-0.004,B-0.0135,0.0028,0,null,6);
    /* tangent rear sight */
    prof(g,S,[[0.118,B+0.031],[0.2,B+0.037],[0.2,B+0.041],[0.118,B+0.038]],0.012,{b:0.001}); for(const s of [-1,1]) bx(g,S,0.116,0.121,B+0.036,B+0.0535,0.004,0.0006,s*0.0048);
    let tf2=tf; if((A.muzzle||'none')==='none'){ cy(g,S,tf,tf+0.022,B,r*1.4); if(!sg&&!LOD) prof(g,S,[[tf+0.02,B-r*1.4],[tf+0.036,B-r*1.4],[tf+0.022,B+r*1.4],[tf+0.02,B+r*1.4]],r*2.2,{b:0.001}); tf2=tf+0.024; u.ownMuzzle=true; }
    u.muzzle=V(tf2,B); u.muzR=r;
    const st=A.stock||'std', sk=sty(A,{std:c.stockStd||'wood',light:'skel',heavy:'prec',none:'none'}); stock(g,sk,{f:-0.088,y:B-0.016,len:0.245,mat:sk==='wood'||sk==='fixed'&&st!=='heavy'?W:sk==='skel'?S:M.poly});
    if(sg) mag(g,u,A,{f0:0.084,f1:0.158,y:B-0.04,len:0.13,lean:0.018,w:0.032,mat:M.poly});
    else mag(g,u,A,{f0:0.084,f1:0.152,y:B-0.04,len:0.165,lean:0.06,w:0.026,mat:S,drum:'ak',ribs:4});
    u.irons=()=>B+0.0505; u.preOptic=()=>{ const ry=rail(g,S,-0.07,0.11,B+0.03,0.021); bx(g,S,-0.05,0.09,B-0.01,B+0.034,0.004,0.001,-0.0185); u.rail={y:ry,f:0.02,fr:-0.07}; };
    u.handL=V(0.265,B-0.042); u.rl='ak'; }
  function scar(g,u,A){ const B=0.05, T=B+0.034, Tn=M.tanM, P=M.tan;
    prof(g,Tn,[[-0.092,B-0.016],[-0.092,T,0.004],[0.37,T],[0.37,B+0.012],[0.355,B-0.006],[0.3,B-0.024,0.004],[0.14,B-0.024],[0.135,B-0.016]],0.036,{b:0.004});
    const ry=rail(g,Tn,-0.088,0.366,T,0.021);
    bx(g,M.dark,0.03,0.095,B-0.006,B+0.012,0.001,0,0.0178); bx(g,M.bolt,0.034,0.09,B-0.003,B+0.009,0.0014,0,0.0179);
    if(!LOD){ slots(g,0.15,0.36,B+0.02,0.0182,0.006); cx(g,M.steel,0.2,B+0.014,0.005,0.02,-0.027,8); }
    rail(g,Tn,0.24,0.36,B-0.032,0.018);
    prof(g,P,[[-0.092,B-0.014],[0.135,B-0.014],[0.135,B-0.09,0.004],[0.064,B-0.096,0.003],[0.06,B-0.062,0.004],[-0.05,B-0.06,0.004],[-0.092,B-0.04,0.008]],0.032,{b:0.004});
    trig(g,0.012,B-0.06,{len:0.05,mat:P}); pgrip(g,M.poly,-0.004,B-0.06);
    const r=bR(A,0.009), tf=tip(A,0.5,0.4,0.1,0.07); cy(g,M.steel,0.13,tf,B,r); prof(g,M.steel,[[0.37,B-0.014],[0.4,B-0.014],[0.4,B+0.02],[0.385,B+0.03],[0.37,B+0.03]],0.024,{b:0.003});
    u.muzzle=V(tf,B); u.muzR=r;
    stock(g,sty(A,{std:'fold',light:'skel',heavy:'prec',none:'none'}),{f:-0.092,y:B+0.004,len:0.24,mat:P});
    mag(g,u,A,{f0:0.066,f1:0.128,y:B-0.07,len:0.1,lean:0.01,w:0.026,mat:P,drum:'c',ribs:2});
    u.rail={y:ry,f:0.03,fr:-0.088}; u.irons=()=>flipIrons(g,ry,-0.06,0.345); u.handL=V(0.25,B-0.04); }
  function fal(g,u,A){ const B=0.05, S=M.steel, F=M.od;
    prof(g,S,[[-0.085,B-0.03],[-0.085,B+0.022,0.004],[0.16,B+0.022],[0.16,B-0.03]],0.032,{b:0.003}); prof(g,S,[[-0.08,B+0.02],[0.1,B+0.02],[0.1,B+0.03,0.004],[-0.08,B+0.03,0.004]],0.026,{b:0.006});
    bx(g,M.dark,0.03,0.1,B-0.004,B+0.012,0.001,0,0.0162); bx(g,M.bolt,0.034,0.096,B-0.001,B+0.009,0.0014,0,0.0163); cx(chg(g,u,0.11,B+0.008,-0.034),S,0.11,B+0.008,0.005,0.02,-0.025,8);
    prof(g,S,[[-0.085,B-0.028],[0.07,B-0.028],[0.07,B-0.052],[-0.05,B-0.056,0.004],[-0.085,B-0.04,0.006]],0.03,{b:0.003}); prof(g,S,[[0.07,B-0.028],[0.145,B-0.028],[0.145,B-0.06],[0.07,B-0.06]],0.03,{b:0.003});
    trig(g,0.012,B-0.054,{len:0.05,mat:S}); pgrip(g,F,-0.004,B-0.054,{rake:0.3});
    xsec(g,F,[[-0.012,B+0.03,0.006],[0.012,B+0.03,0.006],[0.022,B+0.012,0.008],[0.022,B-0.016,0.008],[0.012,B-0.03,0.006],[-0.012,B-0.03,0.006],[-0.022,B-0.016,0.008],[-0.022,B+0.012,0.008]],0.165,0.4,0.004);
    slots(g,0.19,0.39,B+0.012,0.0222,0.005); slots(g,0.19,0.39,B-0.004,0.0222,0.005);
    cy(g,S,0.16,0.44,B+0.022,0.007); prof(g,S,[[0.42,B-0.012],[0.45,B-0.012],[0.45,B+0.03],[0.442,B+0.05,0.003],[0.43,B+0.05,0.003],[0.42,B+0.03]],0.02,{b:0.003});
    const r=bR(A,0.0085), tf=tip(A,0.6,0.5,0.08,0.08); cy(g,S,0.16,tf,B,r); let tf2=tf;
    if((A.muzzle||'none')==='none'){ cy(g,S,tf,tf+0.06,B,r*1.35); if(!LOD) for(let i=0;i<4;i++) bx(g,M.dark,tf+0.012+i*0.011,tf+0.018+i*0.011,B-0.003,B+0.003,r*2.75,0); tf2=tf+0.06; u.ownMuzzle=true; }
    u.muzzle=V(tf2,B); u.muzR=r;
    for(const s of [-1,1]) bx(g,S,-0.078,-0.072,B+0.03,B+0.052,0.004,0.0008,s*0.007);
    stock(g,sty(A,{std:'fixed',light:'skel',heavy:'prec',none:'none'}),{f:-0.085,y:B-0.002,len:0.26,mat:F});
    mag(g,u,A,{f0:0.076,f1:0.14,y:B-0.04,len:0.125,lean:0.012,w:0.026,mat:S,drum:'c',ribs:2});
    u.irons=()=>B+0.05; u.preOptic=()=>{ const ry=rail(g,S,-0.07,0.095,B+0.03,0.021); u.rail={y:ry,f:0.02,fr:-0.07}; }; u.handL=V(0.28,B-0.036); }
  function famas(g,u,A){ const B=0.06, P=M.poly, S=M.steel;
    prof(g,P,[[-0.36,B-0.06,0.012],[-0.36,B+0.03,0.014],[-0.05,B+0.03],[0.02,B+0.024],[0.27,B+0.022,0.004],[0.27,B-0.02,0.004],[0.11,B-0.032],[0.07,B-0.046],[-0.02,B-0.05],[-0.09,B-0.046],[-0.2,B-0.07,0.012]],0.044,{b:0.009,bs:3});
    prof(g,M.rubber,[[-0.372,B+0.022,0.005],[-0.358,B+0.026],[-0.358,B-0.058],[-0.372,B-0.052,0.005]],0.04,{b:0.005});
    prof(g,P,[[-0.25,B+0.03],[-0.12,B+0.03],[-0.12,B+0.044,0.008],[-0.25,B+0.044,0.008]],0.036,{b:0.01});
    prof(g,P,[[-0.1,B+0.026],[-0.07,B+0.088,0.014],[0.17,B+0.088,0.014],[0.215,B+0.02]],0.02,{b:0.004,holes:[[[-0.062,B+0.034],[-0.05,B+0.07,0.008],[0.15,B+0.07,0.008],[0.176,B+0.034]]]});
    const ry=rail(g,M.anod,-0.06,0.165,B+0.088,0.021);
    prof(g,P,[[0.075,B-0.04],[0.086,B-0.126,0.014],[-0.02,B-0.154,0.01],[-0.022,B-0.144],[0.076,B-0.12,0.012],[0.066,B-0.04]],0.014,{b:0.003});
    pgrip(g,P,0.0,B-0.05,{len:0.1,tang:0.002}); trig(g,0.022,B-0.05,{guard:false});
    bx(g,M.dark,-0.2,-0.14,B-0.004,B+0.014,0.001,0,0.0222); if(!LOD) for(const s of [-1,1]) cy(g,S,-0.02,0.2,B+0.012,0.0045,s*0.026,null,6);
    const r=bR(A,0.0085), tf=tip(A,0.395,0.33,0.09,0.05); cy(g,S,0.26,tf,B,r); if(!LOD) for(const ff of [0.3,0.32]) cy(g,S,ff,ff+0.008,B,r*1.3);
    u.muzzle=V(tf,B); u.muzR=r;
    { const H=chg(g,u,0.0,B+0.044,0); bx(H,S,-0.01,0.012,B+0.03,B+0.04,0.012,0.002); }
    mag(g,u,A,{f0:-0.168,f1:-0.108,y:B-0.05,len:0.13,lean:0.004,w:0.024,mat:S,drum:'c',ribs:2});
    u.rail={y:ry,f:0.03,fr:-0.06}; u.irons=()=>flipIrons(g,ry,-0.045,0.15); u.handL=V(0.19,B-0.034); }
  function g36(g,u,A){ const B=0.05, P=M.poly, S=M.steel;
    prof(g,P,[[-0.085,B-0.03],[-0.085,B+0.026,0.008],[0.15,B+0.026],[0.15,B-0.03]],0.036,{b:0.007});
    bx(g,M.dark,0.03,0.095,B-0.006,B+0.012,0.001,0,0.0182); bx(g,M.bolt,0.034,0.09,B-0.003,B+0.009,0.0014,0,0.0183);
    prof(g,P,[[-0.06,B-0.028],[0.135,B-0.028],[0.135,B-0.076,0.004],[0.07,B-0.082],[0.066,B-0.058],[-0.045,B-0.058],[-0.06,B-0.045]],0.03,{b:0.004});
    prof(g,P,[[0.15,B-0.032,0.008],[0.37,B-0.03,0.01],[0.37,B+0.02,0.01],[0.15,B+0.026]],0.044,{b:0.012,bs:3}); slots(g,0.18,0.36,B+0.006,0.0222,0.006); slots(g,0.18,0.36,B-0.012,0.0222,0.006);
    prof(g,P,[[-0.075,B+0.024],[-0.048,B+0.06,0.01],[0.2,B+0.06,0.01],[0.245,B+0.024]],0.022,{b:0.004,holes:[[[-0.034,B+0.03],[-0.024,B+0.046,0.006],[0.186,B+0.046,0.006],[0.204,B+0.03]]]});
    const ry=rail(g,M.anod,-0.04,0.19,B+0.06,0.021);
    trig(g,0.012,B-0.058,{len:0.05,mat:P}); pgrip(g,P,-0.004,B-0.058);
    const r=bR(A,0.0085), tf=tip(A,0.47,0.4,0.1,0.06); cy(g,S,0.15,tf,B,r); let tf2=tf;
    if((A.muzzle||'none')==='none'){ cy(g,S,tf,tf+0.012,B,r*1.3); if(!LOD) for(let i=0;i<4;i++){ const a=i/4*Math.PI*2+0.78; cy(g,S,tf+0.012,tf+0.045,B+Math.sin(a)*r*0.95,0.0026,Math.cos(a)*r*0.95,null,6); } else cy(g,S,tf+0.012,tf+0.045,B,r*1.2); tf2=tf+0.045; u.ownMuzzle=true; }
    u.muzzle=V(tf2,B); u.muzR=r;
    stock(g,sty(A,{std:'fold',light:'skel',heavy:'prec',none:'none'}),{f:-0.085,y:B,len:0.245,mat:P});
    mag(g,u,A,{f0:0.07,f1:0.13,y:B-0.06,len:0.128,lean:0.03,w:0.028,mat:M.smoke,plate:P,drum:'c'});
    u.rail={y:ry,f:0.06,fr:-0.04}; u.irons=()=>flipIrons(g,ry,-0.025,0.175); u.handL=V(0.26,B-0.04); }
  function m249(g,u,A){ const B=0.055, S=M.steel, P=M.poly;
    prof(g,S,[[-0.1,B-0.045],[-0.1,B+0.03,0.004],[0.2,B+0.03],[0.2,B-0.045]],0.04,{b:0.003});
    const CV=part(g,u,'cover'); u.coverHinge=V(0.165,B+0.03); u.railG=CV;
    prof(CV,S,[[-0.092,B+0.03],[-0.086,B+0.05,0.007],[0.12,B+0.05,0.007],[0.165,B+0.03]],0.042,{b:0.007});
    const ry=rail(CV,S,-0.075,0.11,B+0.05,0.021);
    prof(g,P,[[0.2,B-0.046,0.008],[0.42,B-0.04,0.01],[0.42,B-0.012],[0.2,B-0.012]],0.05,{b:0.012,bs:3});
    prof(g,S,[[0.2,B+0.016],[0.42,B+0.016],[0.42,B+0.03,0.004],[0.2,B+0.03,0.004]],0.034,{b:0.006}); slots(g,0.21,0.41,B+0.022,0.0172,0.005);
    const r=bR(A,0.011), tf=tip(A,0.6,0.5,0.08,0.09); cy(g,S,0.2,tf,B,r); cy(g,S,0.2,0.47,B-0.024,0.008);
    prof(g,S,[[0.45,B-0.034],[0.48,B-0.034],[0.48,B+0.014],[0.47,B+0.05,0.003],[0.46,B+0.05,0.003],[0.45,B+0.014]],0.022,{b:0.003});
    let tf2=tf; if((A.muzzle||'none')==='none'){ cy(g,S,tf,tf+0.05,B,r*0.95,0,r*1.5); tf2=tf+0.05; u.ownMuzzle=true; }
    u.muzzle=V(tf2,B); u.muzR=r;
    prof(g,S,[[0.21,B+0.03],[0.225,B+0.064,0.008],[0.3,B+0.064,0.008],[0.305,B+0.056],[0.235,B+0.056,0.004],[0.225,B+0.03]],0.01,{b:0.002});
    trig(g,0.012,B-0.045,{len:0.05,mat:S}); pgrip(g,P,-0.004,B-0.045);
    { const H=chg(g,u,0.15,B-0.006,0.05); cx(H,S,0.15,B-0.006,0.0045,0.026,0.031,8); cx(H,S,0.15,B-0.006,0.0062,0.009,0.046,10); }
    stock(g,sty(A,{std:'fixed',heavy:'prec'}),{f:-0.1,y:B-0.004,len:0.24,mat:P});
    const G=new THREE.Group(); G.userData.keep=true; g.add(G); u.mag=G; const big=A.mag==='ext';
    prof(G,M.od,[[0.045,B-0.045],[0.175,B-0.045],[0.175,B-(big?0.2:0.165),0.012],[0.045,B-(big?0.2:0.165),0.012]],big?0.085:0.07,{b:0.012,bs:3,x:-0.012}); bx(G,M.od,0.06,0.16,B-0.05,B-0.04,0.06,0.004,-0.012);
    if(!LOD) for(let i=0;i<5;i++) cy(G,M.brass,0.075,0.13,B-0.03+i*0.012,0.0045,-0.026,null,6);
    u.rail={y:ry,f:0.02,fr:-0.075}; u.irons=()=>flipIrons(CV,ry,-0.065,0.1); u.handL=V(0.3,B-0.05); }
  function mp5(g,u,A){ const B=0.045, S=M.anod, P=M.poly;
    prof(g,S,[[-0.08,B-0.022],[-0.08,B+0.022,0.01],[-0.04,B+0.032,0.01],[0.1,B+0.034,0.004],[0.1,B-0.022]],0.034,{b:0.008,bs:3});
    bx(g,M.dark,0.01,0.07,B+0.002,B+0.016,0.001,0,0.0172); bx(g,M.bolt,0.014,0.066,B+0.004,B+0.014,0.0014,0,0.0173);
    cy(g,S,0.09,0.272,B+0.023,0.0125); cy(g,S,0.272,0.28,B+0.023,0.011); bx(g,M.dark,0.15,0.25,B+0.02,B+0.026,0.001,0,-0.0128); { const H=chg(g,u,0.22,B+0.023,-0.04); cx(H,M.steel,0.22,B+0.023,0.0045,0.022,-0.022,8); cx(H,P,0.22,B+0.023,0.007,0.01,-0.034,10); }
    prof(g,P,[[0.105,B-0.03,0.008],[0.255,B-0.026,0.012],[0.255,B+0.012],[0.105,B+0.012]],0.046,{b:0.013,bs:3});
    bx(g,S,0.258,0.276,B-0.012,B+0.03,0.016,0.003); tube(g,S,0.26,0.274,B+0.046,0.0095,0.012,null,null,{lens:false}); cv(g,M.steel,0.267,B+0.036,B+0.0462,0.0011,0,null,6);
    cv(g,M.steel,-0.052,B+0.03,B+0.042,0.0095,0,null,12); for(const s of [-1,1]) bx(g,M.steel,-0.056,-0.048,B+0.04,B+0.05,0.004,0.0008,s*0.0058);
    prof(g,P,[[-0.075,B-0.02],[0.06,B-0.02],[0.06,B-0.05,0.004],[-0.04,B-0.052,0.004],[-0.075,B-0.035,0.006]],0.03,{b:0.005});
    prof(g,S,[[0.062,B-0.02],[0.11,B-0.02],[0.11,B-0.062],[0.062,B-0.062]],0.028,{b:0.003});
    trig(g,0.012,B-0.05,{len:0.048,mat:P}); pgrip(g,P,-0.006,B-0.05,{rake:0.28});
    const r=bR(A,0.008), tf=tip(A,0.305,0.285,0.07,0.02); cy(g,M.steel,0.1,tf,B,r); if(!LOD) cy(g,M.steel,tf-0.016,tf-0.008,B,r*1.25);
    u.muzzle=V(tf,B); u.muzR=r;
    stock(g,sty(A,{std:'wire',light:'skel',heavy:'fixed',none:'none'}),{f:-0.08,y:B+0.004,len:0.23,mat:P});
    mag(g,u,A,{f0:0.068,f1:0.104,y:B-0.05,len:0.15,lean:0.03,w:0.02,mat:M.steel,drum:'ak',ribs:2});
    u.irons=()=>B+0.046; u.preOptic=()=>{ const ry=rail(g,S,-0.03,0.085,B+0.034,0.021); u.rail={y:ry,f:0.03,fr:-0.03}; }; u.handL=V(0.18,B-0.03); }
  function uzi(g,u,A,c){ c=c||{}; const B=0.05, S=MT(c.m||'steel'), P=M.poly;
    prof(g,S,[[-0.085,B-0.03],[-0.085,B+0.028,0.003],[0.15,B+0.028,0.003],[0.15,B-0.03]],0.04,{b:0.003});
    if(!LOD){ for(const ff of [-0.06,-0.02,0.07,0.11]) bx(g,S,ff,ff+0.02,B+0.026,B+0.031,0.03,0.001); bx(g,M.dark,0.02,0.08,B+0.0,B+0.014,0.001,0,0.0202); }
    bx(chg(g,u,0.033,B+0.042,0),S,0.022,0.044,B+0.028,B+0.04,0.016,0.003); cy(g,S,0.15,0.168,B,0.0145,0,null,LOD?8:12);
    const r=bR(A,0.0085), tf=tip(A,c.tip||0.205,(c.tip||0.205)-0.02,0.07,0.01); cy(g,S,0.15,tf,B,r); u.muzzle=V(tf,B); u.muzR=r;
    prof(g,P,[[-0.03,B-0.028],[0.022,B-0.028],[0.018,B-0.136,0.006],[-0.036,B-0.136,0.006]],0.034,{b:0.008,bs:3});
    prof(g,S,[[0.022,B-0.03],[0.078,B-0.03],[0.078,B-0.036],[0.036,B-0.07,0.01],[0.022,B-0.07],[0.022,B-0.064],[0.032,B-0.064,0.006],[0.066,B-0.036]],0.012,{b:0.0015}); trig(g,0.03,B-0.03,{guard:false});
    for(const s of [-1,1]){ bx(g,S,-0.08,-0.072,B+0.028,B+0.042,0.004,0.0008,s*0.008); bx(g,S,0.132,0.14,B+0.028,B+0.044,0.004,0.0008,s*0.008); } cv(g,S,0.136,B+0.028,B+0.039,0.0012,0,null,6);
    stock(g,sty(A,{std:'wire',light:'skel',heavy:'fixed',none:'none'}),{f:-0.085,y:B,len:0.2,mat:P});
    mag(g,u,A,{f0:-0.026,f1:0.012,y:B-0.11,len:0.105,lean:0,w:0.022,mat:S});
    u.irons=()=>B+0.039; u.preOptic=()=>{ const ry=rail(g,S,-0.06,0.01,B+0.028,0.021); u.rail={y:ry,f:-0.02,fr:-0.06}; }; u.handL=V(0.09,B-0.045); u.handR=V(-0.008,B-0.09); u.gripRk=0.04; u.hgW=0.021; }
  function p90(g,u,A){ const B=0.045, P=M.poly, S=M.steel;
    prof(g,P,[[-0.3,B-0.09,0.022],[-0.3,B+0.012,0.02],[-0.21,B+0.03,0.012],[0.15,B+0.03,0.006],[0.192,B+0.014,0.008],[0.192,B-0.02,0.008],[0.16,B-0.034,0.006],[0.15,B-0.104,0.02],[0.07,B-0.128,0.022],[0.035,B-0.07,0.014],[0.012,B-0.056,0.01],[-0.012,B-0.124,0.02],[-0.1,B-0.136,0.022],[-0.135,B-0.082,0.02],[-0.22,B-0.104,0.02]],0.048,
      {b:0.006,bs:3,holes:[[[-0.092,B-0.04,0.012],[-0.03,B-0.04,0.012],[-0.04,B-0.108,0.012],[-0.098,B-0.116,0.014]],[[0.05,B-0.04,0.012],[0.132,B-0.036,0.012],[0.126,B-0.092,0.014],[0.074,B-0.108,0.014]]]});
    prof(g,M.rubber,[[-0.31,B+0.004,0.006],[-0.298,B+0.008],[-0.298,B-0.086],[-0.31,B-0.08,0.006]],0.042,{b:0.005});
    const G=new THREE.Group(); G.userData.keep=true; g.add(G); u.mag=G; bx(G,M.smoke,-0.2,A.mag==='ext'?0.13:0.1,B+0.03,B+0.05,0.036,0.007); if(!LOD) for(let i=0;i<10;i++) cx(G,M.brass,-0.18+i*0.028,B+0.04,0.0038,0.026,0,6);
    prof(g,M.anod,[[-0.04,B+0.05],[0.125,B+0.05],[0.115,B+0.064,0.004],[-0.03,B+0.064,0.004]],0.026,{b:0.004}); const ry=rail(g,M.anod,-0.025,0.11,B+0.064,0.021);
    for(const ff of [-0.03,0.11]) bx(g,M.anod,ff-0.006,ff+0.006,B+0.028,B+0.052,0.04,0.003);
    if(!LOD){ bx(g,M.dark,-0.2,-0.14,B-0.03,B-0.012,0.001,0,0.0242); { const H=chg(g,u,0.12,B+0.012,-0.036); cx(H,S,0.12,B+0.012,0.006,0.012,0.027,10); cx(H,S,0.12,B+0.012,0.006,0.012,-0.027,10); } bx(g,M.dark,0.165,0.185,B-0.012,B+0.008,0.0484,0); }
    const r=bR(A,0.008), tf=tip(A,0.24,0.22,0.08,0.01); cy(g,S,0.18,tf,B,r); let tf2=tf; if((A.muzzle||'none')==='none'){ cy(g,S,tf,tf+0.03,B,r*1.4); tf2=tf+0.03; u.ownMuzzle=true; } u.muzzle=V(tf2,B); u.muzR=r;
    trig(g,0.016,B-0.058,{guard:false});
    u.rail={y:ry,f:0.045,fr:-0.025}; u.irons=()=>flipIrons(g,ry,-0.012,0.098); u.handL=V(0.1,B-0.1); u.handR=V(-0.01,B-0.09); u.gripRk=0.12; u.gripL={y:B-0.085,z:-0.09,rk:-0.1,wT:0.014,wD:0.02}; }
  function vector(g,u,A){ const B=0.055, S=M.anod, P=M.tan;
    prof(g,S,[[-0.07,B-0.02],[-0.07,B+0.03,0.004],[0.2,B+0.03,0.004],[0.2,B-0.02]],0.036,{b:0.004}); const ry=rail(g,S,-0.066,0.196,B+0.03,0.021);
    bx(g,M.dark,0.04,0.1,B-0.008,B+0.012,0.001,0,0.0182); bx(g,M.bolt,0.044,0.096,B-0.004,B+0.008,0.0014,0,0.0183);
    prof(g,P,[[-0.02,B-0.02],[0.2,B-0.02],[0.2,B-0.06,0.006],[0.165,B-0.116,0.012],[0.09,B-0.122,0.008],[0.075,B-0.07,0.004],[-0.02,B-0.062,0.004]],0.034,{b:0.006});
    if(!LOD){ bx(g,M.dark,0.105,0.185,B-0.06,B-0.04,0.001,0,0.0172); cx(g,M.steel,0.16,B-0.03,0.004,0.036,0,8); cx(chg(g,u,0.06,B+0.008,-0.036),M.steel,0.06,B+0.008,0.005,0.02,-0.027,8); }
    trig(g,0.012,B-0.062,{len:0.05,mat:P,drop:0.03}); pgrip(g,M.poly,-0.004,B-0.062,{rake:0.2});
    const r=bR(A,0.008), tf=tip(A,0.25,0.23,0.09,0.01); cy(g,M.steel,0.2,tf,B,r); cy(g,S,0.2,0.222,B,0.014,0,null,LOD?8:14); u.muzzle=V(tf,B); u.muzR=r;
    stock(g,sty(A,{std:'fold',light:'skel',heavy:'prec',none:'none'}),{f:-0.07,y:B+0.004,len:0.22,mat:M.poly});
    mag(g,u,A,{f0:0.1,f1:0.136,y:B-0.1,len:0.09,lean:0.014,w:0.024,mat:M.poly});
    u.rail={y:ry,f:0.02,fr:-0.066}; u.irons=()=>flipIrons(g,ry,-0.05,0.18); u.handL=V(0.17,B-0.07); }
  function pumpSg(g,u,A,c){ c=c||{}; const B=0.075, S=MT(c.rm||'steel'), W=MT(c.fm||'woodD'), st=A.stock||'std';
    prof(g,S,[[-0.06,B-0.036,0.006],[-0.072,B+0.004,0.012],[-0.05,B+0.024,0.01],[0.16,B+0.024,0.003],[0.16,B-0.042,0.003],[0.0,B-0.042]],0.036,{b:0.006});
    bx(g,M.dark,0.04,0.12,B-0.004,B+0.014,0.001,0,0.0182); bx(g,M.bolt,0.044,0.1,B-0.001,B+0.011,0.0014,0,0.0183);
    const r=bR(A,0.0105), tf=tip(A,c.tip||0.66,0.5,0.1,0.14); cy(g,S,0.16,tf,B+0.008,r); const mt=Math.min(0.6,tf-0.04); cy(g,S,0.16,mt,B-0.02,0.0125); cy(g,S,mt,mt+0.016,B-0.02,0.0142,0,null,LOD?8:12);
    bx(g,S,mt-0.06,mt-0.045,B-0.034,B+0.022,0.012,0.003); bx(g,S,0.17,tf-0.004,B+0.008+r-0.001,B+0.008+r+0.003,0.007,0.0008); if(!LOD) put(g,new THREE.SphereGeometry(0.0028,8,6),M.brass,0,B+0.008+r+0.0055,-(tf-0.012));
    u.muzzle=V(tf,B+0.008); u.muzR=r;
    const G=new THREE.Group(); G.userData.keep=true; G.userData.z0=0; g.add(G); u.pump=G;
    xsec(G,st==='std'||st==='loops'?W:M.poly,[[-0.016,B-0.002,0.008],[0.016,B-0.002,0.008],[0.025,B-0.018,0.01],[0.02,B-0.044,0.012],[-0.02,B-0.044,0.012],[-0.025,B-0.018,0.01]],0.26,0.41,0.006);
    if(!LOD) for(let i=0;i<7;i++) for(const s of [-1,1]) bx(G,M.dark,0.275+i*0.018,0.283+i*0.018,B-0.034,B-0.012,0.0012,0,s*0.0245);
    for(const s of [-1,1]) cy(G,S,0.17,0.27,B-0.006,0.003,s*0.016,null,6);
    trig(g,0.03,B-0.042,{len:0.045,mat:S,drop:0.03});
    if(st==='std'||st==='loops'){ stockRef={f:-0.1,y:B-0.03,len:0.26,w:0.04}; prof(g,W,[[-0.055,B+0.014],[-0.1,B-0.006,0.03],[-0.15,B-0.01,0.04],[-0.36,B-0.03,0.01],[-0.365,B-0.14,0.014],[-0.33,B-0.146,0.012],[-0.14,B-0.076,0.04],[-0.095,B-0.092,0.02],[-0.058,B-0.06,0.014],[-0.05,B-0.036]],0.04,{b:0.014,bs:3});
      prof(g,M.rubber,[[-0.376,B-0.022,0.005],[-0.362,B-0.02],[-0.366,B-0.14],[-0.38,B-0.134,0.005]],0.036,{b:0.005}); u.handR=V(-0.085,B-0.05); u.gripRk=1.15; }
    else { pgrip(g,M.poly,-0.02,B-0.04,{rake:0.3}); if(st!=='none') stock(g,{light:'skel',heavy:'fixed'}[st],{f:-0.07,y:B-0.004,len:0.27,mat:M.poly}); else bx(g,S,-0.078,-0.066,B-0.03,B+0.02,0.03,0.005); }
    u.irons=()=>B+0.008+r+0.011; u.preOptic=()=>{ const ry=rail(g,S,-0.03,0.13,B+0.024,0.021); u.rail={y:ry,f:0.04,fr:-0.03}; }; u.handL=V(0.335,B-0.052); u.hgW=0.026; u.rl='pump'; u.port=V(0.095,B-0.036); }
  function sawed(g,u){ const B=0.055, S=M.steel, W=M.woodD, gb=g; g=part(gb,u,'brl'); u.brlHinge=V(0.072,B-0.03);
    for(const s of [-1,1]){ cy(g,S,0.07,0.36,B,0.0115,s*0.0118); cy(g,M.dark,0.3595,0.3605,B,0.0092,s*0.0118); cy(g,M.dark,0.0695,0.0705,B,0.0092,s*0.0118); } bx(g,S,0.07,0.36,B+0.009,B+0.013,0.008,0.001);
    prof(g,W,[[0.08,B-0.036,0.008],[0.23,B-0.03,0.012],[0.23,B-0.006],[0.08,B-0.006]],0.05,{b:0.013,bs:3}); if(!LOD) put(g,new THREE.SphereGeometry(0.0026,8,6),M.brass,0,B+0.016,-0.352); g=gb;
    prof(g,M.grey,[[-0.03,B-0.03],[-0.034,B+0.014,0.008],[-0.01,B+0.02,0.006],[0.075,B+0.02],[0.075,B-0.03]],0.05,{b:0.007,bs:3});
    for(const s of [-1,1]) prof(g,S,[[-0.035,B+0.012],[-0.02,B+0.014],[-0.024,B+0.034,0.004],[-0.04,B+0.03,0.004]],0.008,{x:s*0.012,b:0.002});
    prof(g,S,[[-0.02,B+0.02],[0.02,B+0.02],[0.02,B+0.026,0.003],[-0.02,B+0.026,0.003]],0.01,{b:0.002});
    prof(g,W,[[-0.028,B+0.014],[-0.075,B-0.004,0.03],[-0.132,B-0.076,0.03],[-0.106,B-0.112,0.024],[-0.06,B-0.09,0.024],[-0.03,B-0.034,0.01]],0.04,{b:0.014,bs:3});
    trig(g,0.012,B-0.03,{len:0.05,mat:M.brass,drop:0.03});
    u.muzzle=V(0.36,B); u.sight=B+0.028; u.handL=V(0.15,B-0.044); u.handR=V(-0.085,B-0.05); u.gripRk=0.9; u.hgW=0.026; u.mag=null; }
  function garand(g,u,A){ const B=0.065, S=M.steel, W=M.woodD;
    prof(g,W,[[-0.37,B-0.022,0.008],[-0.375,B-0.135,0.014],[-0.34,B-0.142,0.012],[-0.14,B-0.078,0.04],[-0.095,B-0.098,0.02],[-0.058,B-0.066,0.014],[-0.045,B-0.05],[0.3,B-0.04,0.006],[0.3,B-0.004],[-0.06,B-0.004],[-0.1,B-0.002,0.03],[-0.16,B-0.006,0.04]],0.04,{b:0.014,bs:3});
    prof(g,S,[[-0.384,B-0.024,0.004],[-0.372,B-0.022],[-0.376,B-0.136],[-0.39,B-0.13,0.004]],0.036,{b:0.004}); stockRef={f:-0.12,y:B-0.05,len:0.25,w:0.04};
    prof(g,W,[[0.1,B+0.004],[0.4,B+0.004],[0.4,B+0.024,0.009],[0.1,B+0.026,0.009]],0.034,{b:0.012,bs:3}); prof(g,W,[[0.3,B-0.03,0.006],[0.4,B-0.028,0.006],[0.4,B-0.004],[0.3,B-0.004]],0.036,{b:0.011,bs:3});
    bx(g,S,0.292,0.306,B-0.042,B+0.028,0.04,0.004); bx(g,S,0.398,0.41,B-0.03,B+0.026,0.034,0.004);
    prof(g,S,[[-0.075,B-0.006],[-0.075,B+0.02,0.006],[-0.03,B+0.028,0.006],[0.1,B+0.026],[0.1,B-0.006]],0.034,{b:0.005}); const OP=chg(g,u,0.085,B+0.011,0.036); bx(OP,M.bolt,-0.01,0.072,B+0.02,B+0.031,0.016,0.004); u.clipAt=V(0.03,B+0.03,0);
    for(const s of [-1,1]){ bx(g,S,-0.068,-0.052,B+0.02,B+0.05,0.004,0.001,s*0.011); cx(g,S,-0.06,B+0.034,0.008,0.008,s*0.021,10); } bx(g,S,-0.062,-0.058,B+0.03,B+0.044,0.018,0.0006);
    bx(OP,S,0.07,0.1,B+0.006,B+0.016,0.012,0.003,0.022); bx(OP,S,0.09,0.3,B-0.002,B+0.006,0.006,0.001,0.019);
    const r=bR(A,0.0082), tf=tip(A,0.615,0.52,0.06,0.08); cy(g,S,0.1,tf,B,r); cy(g,S,0.4,tf-0.012,B-0.019,0.0095); bx(g,S,tf-0.03,tf-0.014,B-0.028,B+0.012,0.02,0.003);
    for(const s of [-1,1]) prof(g,S,[[tf-0.03,B+0.008],[tf-0.014,B+0.008],[tf-0.014,B+0.05,0.004],[tf-0.026,B+0.05,0.004]],0.002,{x:s*0.008,b:0.0006}); cv(g,S,tf-0.022,B+0.008,B+0.0425,0.0012,0,null,6);
    u.muzzle=V(tf,B); u.muzR=r;
    prof(g,S,[[0.06,B-0.046],[0.06,B-0.078,0.008],[-0.03,B-0.082,0.008],[-0.03,B-0.046],[-0.026,B-0.046],[-0.026,B-0.077,0.005],[0.056,B-0.074,0.005],[0.056,B-0.046]],0.014,{b:0.0012}); trig(g,0.01,B-0.046,{guard:false}); bx(g,S,0.06,0.13,B-0.05,B-0.042,0.026,0.002);
    u.mag=null; u.irons=()=>B+0.0425; u.preOptic=()=>{ const ry=rail(g,S,-0.03,0.14,B+0.03,0.021); u.rail={y:ry,f:0.05,fr:-0.03}; }; u.handL=V(0.24,B-0.048); u.handR=V(-0.085,B-0.06); u.gripRk=1.15; }
  /* bolt-action heavy sniper (one-piece thumbhole chassis) */
  function awm(g,u,A,c){ c=c||{}; const B=0.06, S=M.steel, C=MT(c.cm||'od'), st=A.stock||'std';
    const holes=[[[-0.3,B-0.022,0.014],[-0.135,B-0.034,0.016],[-0.155,B-0.074,0.016],[-0.29,B-0.088,0.016]]];
    prof(g,C,[[-0.36,B+0.012,0.012],[-0.36,B-0.112,0.014],[-0.3,B-0.122,0.014],[-0.165,B-0.094,0.02],[-0.125,B-0.118,0.018],[-0.078,B-0.112,0.016],[-0.04,B-0.052,0.012],[0.05,B-0.052,0.004],[0.37,B-0.04,0.014],[0.37,B-0.012,0.006],[-0.07,B-0.012],[-0.1,B+0.02,0.012]],0.046,{b:0.013,bs:3,holes});
    prof(g,C,[[-0.3,B+0.014],[-0.14,B+0.022],[-0.14,B+(st==='heavy'?0.05:0.04),0.01],[-0.3,B+(st==='heavy'?0.048:0.038),0.01]],0.036,{b:0.011,bs:3}); stockRef={f:-0.1,y:B-0.01,len:0.26,w:0.046,top:B+(st==='heavy'?0.05:0.04)};
    prof(g,M.rubber,[[-0.374,B+0.008,0.006],[-0.358,B+0.012],[-0.358,B-0.112],[-0.374,B-0.106,0.006]],0.04,{b:0.006});
    if(st==='heavy'&&!LOD){ cv(g,S,-0.31,B-0.16,B-0.115,0.006,0,null,8); cv(g,M.rubber,-0.31,B-0.166,B-0.156,0.011,0,null,10); }
    cy(g,S,-0.09,0.125,B+0.006,0.0172); cy(g,S,-0.112,-0.088,B+0.006,0.0125); const ry=rail(g,M.anod,-0.082,0.115,B+0.0225,0.021);
    bx(g,M.dark,0.02,0.09,B+0.0,B+0.014,0.001,0,0.0176);
    { /* bolt: turns about the bore and slides back when cycled (u.bolt, animated in Game.updateViewmodel) */
      const G=new THREE.Group(); G.userData.keep=true; G.position.set(0,B+0.006,0.07); G.userData.z0=0.07; g.add(G); u.bolt=G;
      const h=new THREE.Mesh(new THREE.CylinderGeometry(0.0042,0.0042,0.046,8),S); h.position.set(0.036,-0.018,0); h.rotation.z=-0.95; h.castShadow=true; G.add(h); put(G,new THREE.SphereGeometry(0.0105,LOD?8:14,LOD?6:10),M.poly,0.055,-0.032,0);
      if(!LOD){ const bb=new THREE.Mesh(new THREE.CylinderGeometry(0.0108,0.0108,0.085,12),M.bolt); bb.rotation.x=Math.PI/2; bb.position.set(0,0,-0.03); G.add(bb); } }
    const r=bR(A,0.0115), tf=tip(A,c.tip||0.7,0.55,0.08,0.12); cy(g,S,0.125,tf,B+0.006,r,0,r*0.85);
    if(!LOD&&A.barrel!=='heavy') for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; bx(g,M.dark,0.2,tf-0.12,B+0.006+Math.sin(a)*r*0.93-0.0012,B+0.006+Math.sin(a)*r*0.93+0.0012,0.0024,0,Math.cos(a)*r*0.93).rotation.z=a; }
    let tf2=tf; if((A.muzzle||'none')==='none'){ tf2=brake(g,tf-0.004,B+0.006,r*0.95,2); u.ownMuzzle=true; } u.muzzle=V(tf2,B+0.006); u.muzR=r*0.85;
    prof(g,S,[[0.045,B-0.052],[0.045,B-0.084,0.008],[-0.035,B-0.088,0.008],[-0.035,B-0.05],[-0.031,B-0.05],[-0.031,B-0.083,0.005],[0.041,B-0.08,0.005],[0.041,B-0.052]],0.012,{b:0.0012}); trig(g,0.0,B-0.05,{guard:false});
    mag(g,u,A,{f0:0.052,f1:0.118,y:B-0.04,len:0.058,lean:0.002,w:0.026,mat:S});
    u.rail={y:ry,f:0.01,fr:-0.082}; u.irons=()=>flipIrons(g,ry,-0.07,0.1); u.handL=V(0.24,B-0.048); u.handR=V(-0.1,B-0.075); u.gripRk=0.45; u.hgW=0.024; u.rl='bolt'; }
  /* anti-materiel rifle */
  function barrett(g,u,A){ const B=0.055, S=M.anod, st=A.stock||'std';
    prof(g,S,[[-0.2,B-0.03],[-0.2,B+0.03,0.004],[0.36,B+0.03,0.004],[0.36,B-0.03]],0.042,{b:0.004}); const ry=rail(g,S,-0.19,0.35,B+0.03,0.021);
    slots(g,0.16,0.35,B+0.012,0.0212,0.008); slots(g,0.16,0.35,B-0.012,0.0212,0.008); bx(g,M.dark,0.02,0.12,B-0.008,B+0.016,0.001,0,0.0212); { const G=new THREE.Group(); G.userData.keep=true; G.userData.z0=0; g.add(G); u.bolt=G; u.boltSlide=true; bx(G,M.bolt,0.026,0.114,B-0.004,B+0.012,0.0014,0,0.0213); cx(G,M.steel,0.11,B+0.004,0.005,0.024,0.03,8); u.knobAt=V(0.11,B+0.004,0.046); }
    prof(g,S,[[-0.2,B-0.03],[0.14,B-0.03],[0.14,B-0.076],[0.05,B-0.082],[0.046,B-0.062],[-0.05,B-0.062],[-0.2,B-0.046]],0.036,{b:0.004});
    prof(g,S,[[-0.2,B+0.03],[-0.33,B+0.03,0.006],[-0.33,B-0.086,0.008],[-0.3,B-0.092,0.006],[-0.2,B-0.046]],0.04,{b:0.006,holes:st==='light'?[[[-0.22,B+0.012,0.006],[-0.31,B+0.012,0.006],[-0.31,B-0.06,0.01]]]:undefined});
    prof(g,M.rubber,[[-0.35,B+0.026,0.006],[-0.328,B+0.03],[-0.328,B-0.088],[-0.35,B-0.082,0.006]],0.038,{b:0.006});
    stockRef={f:-0.2,y:B,len:0.13,w:0.04,top:B+0.03};
    if(st==='heavy'){ prof(g,M.poly,[[-0.3,B+0.032],[-0.18,B+0.032],[-0.18,B+0.05,0.008],[-0.3,B+0.05,0.008]],0.034,{b:0.01}); if(!LOD){ cv(g,M.steel,-0.3,B-0.14,B-0.09,0.006,0,null,8); cv(g,M.rubber,-0.3,B-0.146,B-0.136,0.011,0,null,10); } }
    trig(g,0.012,B-0.062,{len:0.05,mat:S}); pgrip(g,M.poly,-0.004,B-0.062);
    const r=bR(A,0.0135), tf=tip(A,0.76,0.6,0.1,0.14); cy(g,M.steel,0.36,tf,B,r);
    if(!LOD&&A.barrel!=='heavy') for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; bx(g,M.dark,0.4,tf-0.04,B+Math.sin(a)*r*0.94-0.0014,B+Math.sin(a)*r*0.94+0.0014,0.0028,0,Math.cos(a)*r*0.94).rotation.z=a; }
    let tf2=tf; if((A.muzzle||'none')==='none'){ prof(g,M.steel,[[tf,B-0.012],[tf+0.022,B-0.032,0.004],[tf+0.08,B-0.032,0.004],[tf+0.08,B+0.032,0.004],[tf+0.022,B+0.032,0.004],[tf,B+0.012]],0.03,{b:0.004});
      if(!LOD) for(const ff of [tf+0.03,tf+0.055]) bx(g,M.dark,ff,ff+0.016,B-0.024,B+0.024,0.031,0); tf2=tf+0.08; u.ownMuzzle=true; }
    u.muzzle=V(tf2,B); u.muzR=r*0.8;
    mag(g,u,A,{f0:0.056,f1:0.136,y:B-0.06,len:0.115,lean:0.006,w:0.03,mat:M.steel,ribs:2});
    u.rail={y:ry,f:0.0,fr:-0.19}; u.irons=()=>flipIrons(g,ry,-0.17,0.33); u.handL=V(0.25,B-0.038); u.rl='bolt'; }
  function mrl(g,u){ const B=0.07;
    cy(g,M.od,-0.25,0.405,B,0.05); cy(g,M.steel,0.395,0.405,B,0.054); cy(g,M.steel,-0.27,-0.24,B,0.054); cy(g,M.dark,-0.2705,-0.2695,B,0.04);
    { const P=part(g,u,'mag'); u.magCenter=true; cy(P,M.steel,0.405,0.444,B,0.0545); for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; cy(P,M.dark,0.4435,0.4448,B+Math.sin(a)*0.028,0.0125,Math.cos(a)*0.028,null,10); cy(P,M.red,0.42,0.4455,B+Math.sin(a)*0.028,0.0085,Math.cos(a)*0.028,0.004,8); } }
    if(!LOD) for(const ff of [-0.1,0.1,0.3]) cy(g,M.steel,ff,ff+0.012,B,0.052);
    bx(g,M.steel,-0.07,0.07,B-0.066,B-0.044,0.03,0.004); trig(g,0.012,B-0.066,{len:0.05,mat:M.steel}); pgrip(g,M.poly,-0.004,B-0.066);
    prof(g,M.poly,[[0.2,B-0.046],[0.24,B-0.046],[0.235,B-0.13,0.008],[0.2,B-0.13,0.008]],0.03,{b:0.008,bs:3});
    prof(g,M.rubber,[[-0.24,B-0.045],[-0.14,B-0.045],[-0.15,B-0.1,0.01],[-0.24,B-0.1,0.01]],0.05,{b:0.01});
    u.sight=optic(g,u,'holo',{y:B+0.05,f:0.03}); u.adsZ=null; bx(g,M.steel,-0.03,0.09,B+0.04,B+0.052,0.03,0.004);
    u.muzzle=V(0.445,B); u.handL=V(0.22,B-0.09); }
  /* self-loading pistols. c = {f1: front of the slide, slide, frame, panel, sh, sw, B, ext, style} */
  function pistol(g,u,A,c){ const B=c.B||0.064, r0=-0.056, f1=c.f1+(A.barrel==='long'?0.028:0), sh=c.sh||0.0135, sw=c.sw||0.026, yb=B-sh, sm=c.slide, fm=c.frame;
    const gg=g; { const G=new THREE.Group(); G.userData.keep=true; g.add(G); u.slide=G; g=G; } /* slide parts go in u.slide (locks back when empty, racked on reload) */
    if(c.style==='beretta'){ prof(g,sm,[[r0,yb+0.002],[r0-0.002,B+sh,0.003],[0.02,B+sh,0.002],[0.02,B+0.002],[f1-0.03,B+0.002],[f1-0.03,B+sh,0.002],[f1,B+sh,0.003],[f1,yb,0.002]],sw,{b:0.004}); cy(gg,M.steel,0.0,f1+0.012,B+0.003,0.0068); }
    else if(c.style==='deagle'){ prof(g,sm,[[r0,yb+0.002],[r0-0.002,B+sh,0.003],[0.06,B+sh,0.002],[0.06,yb]],sw,{b:0.004});
      xsec(g,sm,[[-0.006,B+sh+0.004,0.002],[0.006,B+sh+0.004,0.002],[sw/2,yb+0.006,0.004],[sw/2,yb-0.004,0.003],[-sw/2,yb-0.004,0.003],[-sw/2,yb+0.006,0.004]],0.06,f1,0.002); if(!LOD) for(let i=0;i<5;i++) bx(g,M.dark,0.075+i*0.013,0.081+i*0.013,B+sh+0.0036,B+sh+0.0046,0.008,0); }
    else prof(g,sm,[[r0,yb+0.002],[r0-0.002,B+sh,0.003],[f1,B+sh,0.003],[f1,yb,0.002]],sw,{b:c.style==='glock'?0.003:0.0045});
    if(!LOD){ for(let i=0;i<6;i++) for(const s of [-1,1]) bx(g,M.dark,r0+0.006+i*0.0042,r0+0.008+i*0.0042,yb+0.004,B+sh-0.003,0.0008,0,s*(sw/2+0.0001));
      if(c.style!=='beretta'){ bx(g,M.dark,0.034,0.07,B+0.002,B+sh+0.0004,sw*0.52,0,sw*0.25); bx(g,M.bolt,0.036,0.068,B+0.001,B+sh-0.0006,sw*0.5,0.001,sw*0.2); } }
    cy(g,M.bolt,f1-0.004,f1+0.004,B+(c.style==='beretta'?0.003:0),0.0064); cy(g,M.dark,f1+0.0038,f1+0.0046,B+(c.style==='beretta'?0.003:0),0.0046);
    g=gg; const dust=c.dust==null?0.014:c.dust;
    prof(g,fm,[[r0+0.006,yb+0.003],[f1-dust,yb+0.003],[f1-dust,yb-0.012,0.003],[0.04,yb-0.014],[0.034,yb-0.008],[-0.05,yb-0.008],[r0-0.008,yb-0.004,0.004],[r0-0.014,yb+0.007,0.003]],sw-0.003,{b:0.003});
    const gl=c.gl||0.09, rk=c.rake==null?0.26:c.rake; pgrip(g,fm,-0.004,yb-0.006,{len:gl,rake:rk,fw:c.fw||0.04,t:sw-0.004,tang:0.004,b:0.006});
    if(c.panel&&!LOD) for(const s of [-1,1]) prof(g,c.panel,[[-0.012,yb-0.018,0.006],[-0.012-gl*rk*0.86,yb-gl+0.008,0.006],[-0.04-gl*rk*0.9,yb-gl+0.01,0.008],[-0.04,yb-0.02,0.01]],0.004,{x:s*(sw/2-0.0025),b:0.0015});
    trig(g,0.014,yb-0.008,{len:0.034,drop:0.03,mat:fm,w:0.011,back:0.014});
    if(c.hammer!==false) prof(g,M.steel,[[r0-0.002,yb+0.006],[r0+0.004,yb+0.008],[r0-0.004,B+sh+0.002,0.003],[r0-0.014,B+sh-0.002,0.003]],0.007,{b:0.0015});
    if(c.rail&&!LOD) bx(g,fm,0.045,f1-dust-0.002,yb-0.017,yb-0.011,0.016,0.001);
    if(c.fore){ prof(g,fm,[[0.062,yb-0.014],[0.084,yb-0.014],[0.092,yb-0.075,0.006],[0.07,yb-0.078,0.006]],0.02,{b:0.006}); u.handL=V(0.08,yb-0.045); }
    if(c.foreMag){ prof(g,M.steel,[[0.058,yb-0.014],[0.092,yb-0.014],[0.1,yb-0.1,0.004],[0.068,yb-0.104,0.004]],0.02,{b:0.003}); u.handL=V(0.082,yb-0.06); }
    const G=new THREE.Group(); G.userData.keep=true; g.add(G); u.mag=G; const ext=c.ext||A.mag==='ext', mb=yb-0.006-gl, mf=-0.004-gl*rk;
    prof(G,M.steel,[[mf-0.036,mb+0.03],[mf-0.002,mb+0.03],[mf-0.002-(ext?0.05*rk:0),mb-(ext?0.05:0.002)],[mf-0.036-(ext?0.05*rk:0),mb-(ext?0.046:0)]],sw-0.011,{b:0.002});
    prof(G,c.plate||M.poly,[[mf-0.04-(ext?0.05*rk:0),mb-(ext?0.044:-0.002)],[mf+0.002-(ext?0.05*rk:0),mb-(ext?0.048:-0.002)],[mf+0.002-(ext?0.05*rk:0),mb-(ext?0.056:0.006),0.002],[mf-0.04-(ext?0.05*rk:0),mb-(ext?0.052:0.004),0.002]],sw-0.006,{b:0.002});
    if(A.mag==='quick'&&!LOD) bx(G,M.yellow,mf-0.03,mf-0.008,mb-0.0065,mb-0.004,sw-0.004,0.001);
    if(FP){ const tf=-0.006-0.004*rk, ty=yb-0.012; prof(G,M.steel,[[tf-0.034,ty],[tf,ty],[mf-0.002,mb+0.03],[mf-0.036,mb+0.03]],sw-0.013,{b:0.002}); bx(G,M.brass,tf-0.03,tf-0.006,ty-0.004,ty+0.002,0.009,0.002); } /* the rest of the magazine, inside the grip (seen when it drops out) */
    u.muzzle=V(f1+0.004,B+(c.style==='beretta'?0.003:0)); u.muzR=0.0066; u.top=B+sh; u.under={f:Math.min(0.062,f1-dust-0.05),y:yb-0.015}; u.handR=V(-0.03-gl*rk*0.4,yb-gl*0.5); u.gripRk=rk;
    u.irons=()=>{ const S=u.slide||g; for(const s of [-1,1]) bx(S,M.steel,r0+0.006,r0+0.013,B+sh-0.001,B+sh+0.0062,0.0045,0.0006,s*0.0052); bx(S,M.steel,f1-0.016,f1-0.009,B+sh-0.001,B+sh+0.006,0.003,0.0006); return B+sh+0.0064; };
    u.pistol=true; u.fr=r0; u.rl='pistol'; u.slideRear=V(r0+0.012,B+sh); }
  /* small reflex sight for pistols */
  function miniDot(g,u,y,f){ bx(g,M.anod,f-0.018,f+0.018,y-0.001,y+0.007,0.024,0.002); const W=0.0115, top=y+0.031;
    for(const s of [-1,1]) bx(g,M.anod,f+0.008,f+0.018,y+0.006,top,0.003,0.001,s*W); prof(g,M.anod,[[f+0.008,top-0.003],[f+0.018,top-0.003],[f+0.018,top,0.002],[f+0.008,top,0.002]],W*2+0.003,{b:0.001});
    if(!LOD){ put(g,new THREE.SphereGeometry(0.00055,6,4),M.dot,0,y+0.018,-(f+0.014)); if(FP) put(g,new THREE.PlaneGeometry(W*2-0.003,top-y-0.009),M.glassClear,0,(top+y+0.006)/2-0.001,-(f+0.013)); }
    u.adsZ=null; return y+0.018; }
  function revolver(g,u,A,c){ c=c||{}; const B=0.066, m=MT(c.m||'nickel'), tf=(c.bl||0.2)+(A.barrel==='long'?0.05:A.barrel==='short'?-0.07:0);
    prof(g,m,[[-0.05,B-0.03],[-0.062,B+0.008,0.008],[-0.03,B+0.024,0.006],[0.072,B+0.024],[0.072,B-0.014],[0.05,B-0.03],[0.036,B-0.036],[-0.02,B-0.036]],0.02,{b:0.004,holes:[[[-0.014,B+0.018],[0.038,B+0.018],[0.038,B-0.027],[-0.014,B-0.027]]]});
    { const C=part(g,u,'cyl'); u.cylPiv=V(0.012,B-0.027,-0.011); u.cylC=V(0.012,B-0.004,0); cy(C,m,-0.012,0.036,B-0.004,0.0215,0,null,LOD?8:20); if(!LOD) for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+0.5; cy(C,M.dark,-0.004,0.0365,B-0.004+Math.sin(a)*0.021,0.0052,Math.cos(a)*0.021,null,8); cy(C,M.brass,-0.0135,-0.0115,B-0.004+Math.sin(a)*0.013,0.0048,Math.cos(a)*0.013,null,8); } }
    cy(g,m,0.07,tf,B+0.006,0.0086); cy(g,m,0.07,tf-0.012,B-0.01,0.0072); bx(g,m,0.07,tf-0.012,B-0.012,B+0.008,0.009,0.001); bx(g,m,0.072,tf,B+0.014,B+0.019,0.007,0.001); cy(g,M.dark,tf-0.0005,tf+0.0006,B+0.006,0.0056);
    prof(g,m,[[tf-0.02,B+0.018],[tf-0.002,B+0.018],[tf-0.004,B+0.03]],0.003,{b:0.0006}); for(const s of [-1,1]) bx(g,m,-0.036,-0.028,B+0.023,B+0.0305,0.004,0.0006,s*0.005);
    prof(g,M.steel,[[-0.052,B+0.008],[-0.04,B+0.012],[-0.052,B+0.036,0.003],[-0.066,B+0.03,0.003]],0.007,{b:0.0015});
    trig(g,0.012,B-0.034,{len:0.036,drop:0.03,mat:m,w:0.01,back:0.014});
    prof(g,MT(c.gm||'wood'),[[-0.022,B-0.03],[-0.062,B-0.02,0.012],[-0.088,B-0.082,0.03],[-0.072,B-0.132,0.014],[-0.03,B-0.126,0.014],[-0.018,B-0.07,0.014]],0.03,{b:0.011,bs:3});
    u.muzzle=V(tf,B+0.006); u.muzR=0.0086; u.noMuzzle=true; u.top=B+0.024; u.irons=()=>B+0.0302; u.mag=null; u.handR=V(-0.05,B-0.08); u.gripRk=0.42; u.pistol=true; u.fr=-0.03; }
  /* ---------- oddities, melee, gadgets (simple shapes) ---------- */
  const RB=(w,h,d,r)=>new THREE.RoundedBoxGeometry(w,h,d,2,Math.min(r!=null?r:0.006,Math.min(w,h,d)/2.2));
  function add(g,geo,mat,x,y,z,rx,ry,rz){ const m=new THREE.Mesh(geo,mat); m.position.set(x||0,y||0,z||0); if(rx||ry||rz) m.rotation.set(rx||0,ry||0,rz||0); m.castShadow=true; g.add(m); return m; }
  const cylZ=(r,l,s)=>{ const g=new THREE.CylinderGeometry(r,r,l,s||12); g.rotateX(Math.PI/2); return g; };
  function crossbow(g,u){ const B=0.05; prof(g,M.woodD,[[-0.3,B-0.01,0.01],[-0.3,B-0.1,0.012],[-0.27,B-0.104,0.01],[-0.12,B-0.05,0.03],[-0.07,B-0.05],[0.3,B-0.02,0.006],[0.3,B+0.012],[-0.06,B+0.012],[-0.12,B+0.004,0.03]],0.034,{b:0.011,bs:3});
    pgrip(g,M.poly,-0.004,B-0.04,{rake:0.3}); trig(g,0.012,B-0.04,{len:0.04,mat:M.steel});
    const bow=new THREE.Mesh(new THREE.TorusGeometry(0.21,0.008,6,24,Math.PI*0.72),M.steel); bow.rotation.set(-Math.PI/2,0,Math.PI*0.14+Math.PI); bow.position.set(0,B+0.02,-0.16); bow.castShadow=true; g.add(bow);
    { const seg=()=>{ const G=part(g,u); const m=new THREE.Mesh(new THREE.CylinderGeometry(0.0014,0.0014,1,4),M.chrome); G.add(m); return G; }, A=seg(), Bs=seg(), tipF=0.1, tipX=0.185;
      /* fc = where the middle of the string is (front distance): 0.1 = slack between the bow tips, 0.0 = drawn back to the latch */
      const a=new THREE.Vector3(), b=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
      const place=(G,x,fc)=>{ a.set(x,B+0.02,-tipF); b.set(0,B+0.02,-fc); G.position.copy(a).add(b).multiplyScalar(0.5); G.scale.set(1,a.distanceTo(b),1); G.quaternion.setFromUnitVectors(up,b.sub(a).normalize()); };
      u.setString=fc=>{ place(A,tipX,fc); place(Bs,-tipX,fc); }; u.setString(0.0); u.stringRest=tipF; }
    { const P=part(g,u,'arrow'); cy(P,M.grey,0.0,0.32,B+0.03,0.0038,0,null,6); add(P,new THREE.ConeGeometry(0.008,0.03,6),M.blade,0,B+0.03,-0.335,-Math.PI/2,0,0); if(!LOD) for(const s of [-1,1]) bx(P,M.red,0.005,0.04,B+0.03,B+0.042,0.001,0,s*0.002); u.arrowAt=V(0.16,B+0.03,0); } bx(g,M.steel,0.27,0.3,B+0.008,B+0.03,0.05,0.004);
    u.sight=optic(g,u,'reddot',{y:B+0.022,f:-0.03}); u.adsZ=null; bx(g,M.steel,-0.06,0.0,B+0.01,B+0.024,0.024,0.003);
    u.muzzle=V(0.34,B+0.03); u.handL=V(0.2,B-0.03); u.two=true; u.mag=null; }
  function flintlock(g,u){ const B=0.06; prof(g,M.woodD,[[-0.03,B-0.004],[-0.07,B-0.016,0.02],[-0.12,B-0.09,0.03],[-0.09,B-0.12,0.02],[-0.055,B-0.1,0.02],[-0.02,B-0.04,0.012],[0.26,B-0.02,0.006],[0.26,B-0.002]],0.03,{b:0.011,bs:3});
    cy(g,M.steel,-0.03,0.36,B+0.006,0.0095,0,0.0078); cy(g,M.brass,0.34,0.365,B+0.006,0.0105); cy(g,M.dark,0.3645,0.3656,B+0.006,0.0062); cy(part(g,u,'rod'),M.brass,0.08,0.3,B-0.018,0.003,0,null,6);
    prof(part(g,u,'cock'),M.steel,[[-0.025,B+0.012],[-0.01,B+0.012],[0.004,B+0.046,0.004],[-0.012,B+0.05,0.004]],0.006,{x:0.017,b:0.0015}); u.cockPiv=V(-0.018,B+0.012,0.017); bx(g,M.brass,0.01,0.04,B+0.004,B+0.02,0.006,0.002,0.016); cx(g,M.brass,-0.105,B-0.105,0.014,0.032,0,12);
    trig(g,0.0,B-0.03,{len:0.04,mat:M.brass,drop:0.028}); u.muzzle=V(0.366,B+0.006); u.sight=B+0.017; u.mag=null; u.handR=V(-0.07,B-0.07); u.gripRk=0.8; u.pistol=true; }
  function melee(id){ const g=new THREE.Group(), u=g.userData; u.melee=true;
    if(id==='knife'){ prof(g,M.poly,[[-0.075,-0.016,0.006],[-0.075,0.016,0.006],[0.03,0.014,0.004],[0.03,-0.014,0.004]],0.022,{b:0.007,bs:3}); bx(g,M.steel,0.03,0.04,-0.024,0.024,0.014,0.002);
      prof(g,M.blade,[[0.04,-0.013],[0.04,0.014],[0.15,0.014],[0.21,-0.002,0.004],[0.17,-0.014,0.02]],0.004,{b:0.0018}); if(!LOD) bx(g,M.dark,0.06,0.14,0.006,0.009,0.0044,0); u.len=0.3; }
    else if(id==='axe'){ add(g,new THREE.CylinderGeometry(0.014,0.017,0.62,10),M.woodL,0,0,-0.2,Math.PI/2,0,0); prof(g,M.red,[[0.44,-0.02],[0.52,-0.02],[0.53,0.05],[0.55,0.12,0.01],[0.42,0.12,0.01],[0.45,0.05]],0.022,{b:0.005}); prof(g,M.blade,[[0.418,0.1],[0.552,0.1],[0.56,0.135,0.006],[0.41,0.135,0.006]],0.02,{b:0.008}); prof(g,M.red,[[0.45,-0.02],[0.51,-0.02],[0.5,-0.075,0.006],[0.475,-0.075,0.006]],0.02,{b:0.006}); u.len=0.65; }
    else if(id==='shield'){ add(g,RB(0.5,0.75,0.04,0.02),M.shield,-0.08,0.05,-0.12); add(g,RB(0.24,0.06,0.045,0.01),M.glass,-0.08,0.28,-0.12); add(g,new THREE.PlaneGeometry(0.3,0.05),M.grey,-0.08,-0.15,-0.098); u.shield=true; u.len=0.4; }
    else { u.fists=true; u.len=0.1; }
    u.muzzle=new THREE.Vector3(0,0,-0.3); u.sight=0.05; return g; }
  function snowcan(g,u){ add(g,cylZ(0.05,0.55,20),M.snow,0,0.06,-0.18);
    { const P=part(g,u,'mag'); add(P,new THREE.CylinderGeometry(0.026,0.026,0.09,14),M.snow,0,-0.03,-0.11); add(P,new THREE.CylinderGeometry(0.0275,0.0275,0.012,14),M.glowB,0,-0.012,-0.11); add(P,new THREE.CylinderGeometry(0.028,0.028,0.012,14),M.grey,0,-0.077,-0.11); } add(g,cylZ(0.065,0.06,20),M.glowB,0,0.06,-0.47); add(g,new THREE.SphereGeometry(0.07,14,10),M.grey,0,0.02,0.12); pgrip(g,M.poly,-0.004,0.0); trig(g,0.012,0.0,{len:0.045,mat:M.steel});
    bx(g,M.poly,0.0,0.1,0.108,0.116,0.03,0.003); u.muzzle=new THREE.Vector3(0,0.06,-0.5); u.sight=optic(g,u,'holo',{y:0.116,f:0.04}); u.adsZ=null; u.handL=new THREE.Vector3(-0.01,0.0,-0.3); }
  function item(kind){ const g=new THREE.Group(), u=g.userData; u.item=true;
    switch(kind){
      case 'frag': add(g,new THREE.SphereGeometry(0.035,12,10),M.od,0,0.03,-0.05); add(g,RB(0.012,0.03,0.04,0.003),M.steel,0,0.07,-0.05); add(g,new THREE.TorusGeometry(0.012,0.002,4,10),M.chrome,0.015,0.08,-0.05); break;
      case 'smoke': case 'flash': case 'stun': add(g,new THREE.CylinderGeometry(0.028,0.028,0.11,12),kind==='smoke'?M.od:kind==='flash'?M.grey:M.tan,0,0.04,-0.05); add(g,RB(0.012,0.03,0.04,0.003),M.steel,0,0.11,-0.05); break;
      case 'sticky': add(g,new THREE.SphereGeometry(0.035,12,10),M.poly,0,0.03,-0.05); add(g,new THREE.SphereGeometry(0.012,8,6),M.glowO,0,0.065,-0.05); break;
      case 'repulse': case 'implode': add(g,new THREE.IcosahedronGeometry(0.04,1),M.grey,0,0.03,-0.05); add(g,new THREE.TorusGeometry(0.045,0.005,6,16),kind==='repulse'?M.glowB:M.glowG,0,0.03,-0.05); break;
      case 'c4': add(g,RB(0.1,0.04,0.06,0.006),M.tan,0,0.02,-0.05); add(g,RB(0.03,0.02,0.04,0.004),M.poly,0.02,0.05,-0.05); add(g,new THREE.SphereGeometry(0.005,6,4),M.dot,0.03,0.062,-0.04); break;
      case 'mine': add(g,new THREE.CylinderGeometry(0.08,0.08,0.035,16),M.od,0,0.02,-0.06); add(g,new THREE.CylinderGeometry(0.02,0.02,0.02,10),M.steel,0,0.045,-0.06); break;
      case 'rocket': add(g,cylZ(0.05,0.9),M.od,0,0.09,-0.12); add(g,new THREE.ConeGeometry(0.045,0.12,10),M.od,0,0.09,-0.62,-Math.PI/2,0,0); pgrip(g,M.poly,-0.004,0.045); add(g,RB(0.03,0.05,0.06,0.006),M.steel,-0.05,0.15,-0.1); u.muzzle=new THREE.Vector3(0,0.09,-0.6); break;
      case 'ammo': add(g,RB(0.16,0.09,0.09,0.01),M.od,0,0.02,-0.08); add(g,RB(0.05,0.012,0.02,0.003),M.brass,0,0.07,-0.08); break;
      case 'health': add(g,RB(0.15,0.1,0.08,0.012),M.blade,0,0.02,-0.08); add(g,RB(0.06,0.02,0.002,0),M.red,0,0.02,-0.039); add(g,RB(0.02,0.06,0.002,0),M.red,0,0.02,-0.039); break;
      case 'repair': add(g,RB(0.02,0.02,0.22,0.004),M.chrome,0,0.02,-0.1); add(g,new THREE.TorusGeometry(0.025,0.008,6,12,Math.PI*1.5),M.chrome,0,0.02,-0.22,Math.PI/2,0,0); break;
      case 'wall': case 'trophy': add(g,RB(0.12,0.08,0.06,0.01),M.poly,0,0.02,-0.06); add(g,RB(0.05,0.012,0.002,0),kind==='wall'?M.glowB:M.glowO,0,0.04,-0.029); break;
    }
    if(!u.muzzle) u.muzzle=new THREE.Vector3(0,0.05,-0.1); u.sight=0.08; u.len=0.2; return g; }

  /* ================= v7.10.0: the hundred added guns =================
     A few general builders driven by settings (kit: rifles/carbines/SMGs/shotguns, wrifle: wooden rifles, bpup: bullpups, lmgK: belt-fed),
     the existing builders with settings (ar15, ak, pistol, revolver, awm, pumpSg, uzi), and small ones for the oddities. */
  const MT=k=>typeof k==='string'?M[k]:k;
  function kit(g,u,A,c){ const B=c.B||0.05, rm=MT(c.rm||'steel'), lm=MT(c.lm||c.rm||'steel'), hm=MT(c.hm||'poly'), w=c.w||0.034, R0=c.r0!=null?c.r0:-0.09, R1=c.r1!=null?c.r1:0.16, top=c.top||0.03, bot=c.bot!=null?c.bot:-0.032;
    if(c.rs==='tube') cy(g,rm,R0,R1,B+(top+bot)/2,(top-bot)/2,0,null,LOD?10:16);
    else prof(g,rm,[[R0,B+bot],[R0,B+top,0.004],[R1,B+top,0.003],[R1,B+bot]],w,{b:0.004});
    const low=c.lower!==false; if(low) prof(g,lm,[[R0+0.01,B+bot+0.002],[Math.max(R0+0.05,0.12),B+bot+0.002],[Math.max(R0+0.05,0.12),B+bot-0.016,0.004],[R0+0.03,B+bot-0.018,0.004]],w*0.9,{b:0.003});
    if(!LOD&&c.rs!=='tube'){ const p0=R0+(R1-R0)*0.42, p1=R0+(R1-R0)*0.7; bx(g,M.dark,p0,p1,B-0.004,B+0.012,0.001,0,w/2+0.0002); bx(g,M.bolt,p0+0.004,p1-0.004,B-0.002,B+0.01,0.0014,0,w/2+0.0003); }
    { const f=R0+(R1-R0)*0.78, H=chg(g,u,f,B+0.006,-(w/2+0.014)); cx(H,M.steel,f,B+0.006,0.0045,0.022,-(w/2+0.008),8); }
    const hg=c.hg, H0=hg?hg[0]:R1, H1=hg?hg[1]:R1, ht=hg?hg[2]:'none', hh=c.hh||0.024;
    if(ht==='rail'){ prof(g,hm,[[H0,B-hh],[H1,B-hh],[H1,B+hh*0.9,0.003],[H0,B+hh*0.9]],0.044,{b:0.006}); rail(g,hm,H0+0.004,H1-0.004,B+hh*0.9,0.021); slots(g,H0+0.02,H1-0.02,B,0.0222,0.008); }
    else if(ht==='quad'){ prof(g,hm,[[H0,B-hh],[H1,B-hh],[H1,B+hh,0.004],[H0,B+hh]],0.042,{b:0.008}); rail(g,hm,H0+0.004,H1-0.004,B+hh,0.021); for(const s of [-1,1]) bx(g,hm,H0+0.01,H1-0.01,B-0.006,B+0.006,0.008,0.001,s*0.024); bx(g,hm,H0+0.01,H1-0.01,B-hh-0.006,B-hh,0.016,0.001); }
    else if(ht==='round'){ cy(g,hm,H0,H1,B-0.002,hh,0,hh*0.92,LOD?10:18); if(!LOD) for(let i=0;i<5;i++){ const f=H0+0.02+(H1-H0-0.04)*i/4; cy(g,M.dark,f,f+0.004,B-0.002,hh*1.01,0,null,LOD?10:18); } }
    else if(ht==='wood') prof(g,hm,[[H0,B-hh,0.008],[H1,B-hh*0.85,0.01],[H1,B+hh*0.55],[H0,B+hh*0.55]],0.04,{b:0.012,bs:3});
    else if(ht==='slots'){ prof(g,hm,[[H0,B-hh,0.006],[H1,B-hh*0.9,0.008],[H1,B+hh*0.8,0.004],[H0,B+hh*0.8]],0.042,{b:0.009,bs:3}); slots(g,H0+0.02,H1-0.02,B+0.004,0.0212,0.006); }
    else if(ht==='jacket'){ cy(g,hm,H0,H1,B,hh,0,null,LOD?10:16); if(!LOD) for(let i=0;i<6;i++){ const f=H0+0.02+(H1-H0-0.05)*i/5; for(const s of [-1,1]) bx(g,M.dark,f,f+0.018,B-0.006,B+0.006,0.0012,0,s*hh); bx(g,M.dark,f,f+0.018,B+hh-0.001,B+hh+0.0003,0.008,0); } }
    const r=bR(A,c.br||0.0085), tf0=c.tip||0.5, tf=tip(A,tf0,Math.max(H1,R1)+0.02,0.08,0.06); cy(g,M.steel,Math.max(R1,H0)-0.01,tf,B,r);
    if(c.gas&&!LOD) cy(g,M.steel,R1,H1+0.02,B+0.016,0.004);
    if(c.tube){ cy(g,M.steel,R1,Math.min(tf-0.03,(c.tube===true?tf-0.06:c.tube)),B-0.022,0.011); u.port=V(Math.max(0.05,R1-0.05),B+bot); }
    let tf2=tf;
    if(c.sup){ const L=c.sup, sr=c.supR||0.02; cy(g,M.anod,tf-0.01,tf+L,B,sr); cy(g,M.steel,tf+L-0.004,tf+L+0.002,B,sr*0.92); tf2=tf+L+0.002; u.noMuzzle=true; }
    else if((A.muzzle||'none')==='none'&&c.mz){ const R=r*(c.mz==='flash'?1.45:1.6);
      if(c.mz==='brake') tf2=brake(g,tf-0.004,B,R,2); else { const L=c.mz==='flash'?0.045:0.03; cy(g,M.steel,tf-0.004,tf+L,B,R); tf2=tf+L; } u.ownMuzzle=true; }
    u.muzzle=V(tf2,B); u.muzR=r;
    let fsY=B+0.045; if(c.sight!=='rail'&&c.sight!=='carry'&&c.fs!==false){ const fs=tf-0.04; prof(g,M.steel,[[fs-0.012,B-0.006],[fs+0.012,B-0.006],[fs+0.008,B+0.026],[fs+0.003,B+0.045],[fs-0.003,B+0.045],[fs-0.008,B+0.026]],0.012,{b:0.002}); }
    const gy=B+bot-(low&&c.rs!=='tube'?0.016:0);
    trig(g,0.012,gy,{len:0.05,mat:lm}); pgrip(g,MT(c.gm||'poly'),-0.004,gy,{rake:c.grake==null?0.3:c.grake});
    const mg=c.mg||{t:'box'}, mf0=mg.f0!=null?mg.f0:0.065, mf1=mg.f1!=null?mg.f1:mf0+0.058, mm=MT(mg.m||'steel');
    if(mg.t==='box'||mg.t==='curve') mag(g,u,A,{f0:mf0,f1:mf1,y:gy+0.004,len:mg.len||0.12,lean:mg.lean!=null?mg.lean:(mg.t==='curve'?0.05:0.012),w:mg.w||0.024,mat:mm,drum:mg.drum||'c',ribs:mg.ribs==null?2:mg.ribs});
    else if(mg.t==='drum') mag(g,u,{mag:'drum'},{f0:mf0,f1:mf1,y:gy+0.004,len:0.1,lean:0,w:0.024,mat:mm,drum:mg.drum||'c'});
    else if(mg.t==='helix'){ const G=part(g,u,'mag'); cy(G,mm,R1-0.02,H1,B-0.045,0.024,0,null,LOD?10:18); cy(G,M.dark,R1-0.024,R1-0.018,B-0.045,0.02); u.magCenter=true; }
    else if(mg.t==='side'){ const G=part(g,u,'mag'); prof(G,mm,[[mf0,B-0.012],[mf1,B-0.012],[mf1,B+0.012],[mf0,B+0.012]],0.15,{x:-(w/2+0.075),b:0.002}); }
    else if(mg.t==='cyl'){ const G=part(g,u,'mag'); u.magCenter=true; cy(G,mm,mf0,mf1,B-0.03,0.07,0,null,LOD?12:24); if(!LOD) for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; cy(G,M.dark,mf1-0.001,mf1+0.0005,B-0.03+Math.sin(a)*0.05,0.009,Math.cos(a)*0.05,null,8); } }
    else u.mag=null;
    if(c.st!=='none'&&c.st!==false){ const map=c.st&&typeof c.st==='object'?c.st:{std:c.st||'tele',light:'skel',heavy:'prec',none:'none'}, sk=sty(A,map);
      stock(g,sk,{f:R0,y:B+(c.sty||0),len:c.sl||0.24,mat:MT(c.sm||(sk==='wood'?'wood':'poly')),tube:sk==='tele'||sk==='skel'}); }
    if(c.sight==='rail'||c.sight==null){ const to=c.railTo||R1, ry=rail(g,MT(c.railM||'anod'),R0+0.006,to-0.006,B+top,0.021); u.rail={y:ry,f:c.of==null?0.03:c.of,fr:R0+0.006}; u.irons=()=>flipIrons(g,ry,R0+0.03,Math.min(to-0.02,0.22)); }
    else if(c.sight==='carry'){ prof(g,rm,[[R0+0.02,B+top],[R0+0.03,B+top+0.03,0.004],[R1-0.03,B+top+0.03,0.004],[R1-0.02,B+top]],0.016,{b:0.003}); const ry=B+top+0.03;
      u.rail={y:ry,f:0.0,fr:R0+0.02}; u.irons=()=>{ prof(g,M.steel,[[R0+0.03,ry],[R0+0.042,ry],[R0+0.042,ry+0.012],[R0+0.03,ry+0.012]],0.012,{b:0.001}); return ry+0.011; }; }
    else { u.irons=()=>{ for(const s of [-1,1]) bx(g,M.steel,R0+0.01,R0+0.018,B+top,B+top+0.015,0.004,0.0008,s*0.006); return Math.max(B+top+0.014,fsY); };
      u.preOptic=()=>{ const ry=rail(g,M.steel,R0+0.01,R1-0.01,B+top,0.021); u.rail={y:ry,f:0.02,fr:R0+0.01}; }; }
    if(c.bip&&!LOD) bipod(g,H1-0.02,B-0.02,0.2);
    u.handL=V(c.hl!=null?c.hl:(hg?(H0+H1)/2+0.02:R1+0.06),B+(c.hly!=null?c.hly:-0.036)); u.hgW=c.hgW||0.022;
    if(c.vfg){ const f=c.vfg; prof(g,MT(c.vm||c.hm||'poly'),[[f-0.014,B-hh+0.004],[f+0.014,B-hh+0.004],[f+0.012,B-hh-0.08,0.008],[f-0.012,B-hh-0.08,0.008]],0.028,{b:0.009,bs:3}); u.gripL={y:B-hh-0.04,z:-f,rk:0,wT:0.013,wD:0.0135}; u.handL=V(f,B-hh-0.04); } }
  /* wooden service rifles: bolt-action, lever-action, semi-auto (garand pattern stock, one piece from butt to fore-end) */
  function wrifle(g,u,A,c){ const B=c.B||0.062, S=M.steel, W=MT(c.wm||'woodD'), fe=c.fe||0.4, act=c.act||'bolt';
    prof(g,W,[[-0.37,B-0.022,0.008],[-0.375,B-0.135,0.014],[-0.34,B-0.142,0.012],[-0.14,B-0.078,0.04],[-0.095,B-0.098,0.02],[-0.058,B-0.066,0.014],[-0.045,B-0.05],[fe,B-0.036,0.008],[fe,B-0.004],[-0.06,B-0.004],[-0.1,B-0.002,0.03],[-0.16,B-0.006,0.04]],0.04,{b:0.014,bs:3});
    prof(g,S,[[-0.384,B-0.024,0.004],[-0.372,B-0.022],[-0.376,B-0.136],[-0.39,B-0.13,0.004]],0.036,{b:0.004}); stockRef={f:-0.12,y:B-0.05,len:0.25,w:0.04};
    if(c.hgTop) prof(g,W,[[0.13,B+0.004],[fe-0.02,B+0.004],[fe-0.02,B+0.022,0.008],[0.13,B+0.024,0.008]],0.032,{b:0.011,bs:3});
    prof(g,S,[[-0.07,B-0.006],[-0.07,B+0.018,0.006],[-0.03,B+0.024,0.006],[0.13,B+0.022],[0.13,B-0.006]],0.03,{b:0.005});
    const r=bR(A,c.br||0.0082), tf=tip(A,c.tip||0.64,fe+0.04,0.06,0.08); cy(g,S,0.13,tf,B,r);
    for(const f of [fe-0.16,fe-0.012]) bx(g,S,f,f+0.012,B-0.038,B+(c.hgTop?0.026:0.012),0.044,0.004);
    bx(g,S,tf-0.034,tf-0.008,B-0.01,B+0.008,0.02,0.003); prof(g,S,[[tf-0.03,B+0.004],[tf-0.012,B+0.004],[tf-0.014,B+0.034],[tf-0.024,B+0.034]],0.004,{b:0.001});
    u.muzzle=V(tf,B); u.muzR=r;
    prof(g,S,[[0.06,B-0.046],[0.06,B-0.078,0.008],[-0.03,B-0.082,0.008],[-0.03,B-0.046],[-0.026,B-0.046],[-0.026,B-0.077,0.005],[0.056,B-0.074,0.005],[0.056,B-0.046]],0.014,{b:0.0012}); trig(g,0.01,B-0.046,{guard:false});
    if(act==='bolt'){ const G=new THREE.Group(); G.userData.keep=true; G.position.set(0,B+0.008,0.03); G.userData.z0=0.03; g.add(G); u.bolt=G;
      const h=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.05,8),S); h.position.set(0.032,-0.016,0); h.rotation.z=c.boltDown?-1.3:-0.95; h.castShadow=true; G.add(h); put(G,new THREE.SphereGeometry(0.009,LOD?8:12,LOD?6:8),S,0.052,-0.03,0);
      if(!LOD){ const bb=new THREE.Mesh(new THREE.CylinderGeometry(0.0095,0.0095,0.1,10),M.bolt); bb.rotation.x=Math.PI/2; bb.position.set(0,0,-0.05); G.add(bb); } u.rl='bolt'; }
    else if(act==='lever'){ const G=part(g,u,'lever'); const t=new THREE.Mesh(new THREE.TorusGeometry(0.028,0.0042,6,LOD?10:18),S); t.rotation.y=Math.PI/2; t.position.set(0,B-0.088,-0.01); t.castShadow=true; G.add(t); bx(G,S,-0.01,0.05,B-0.05,B-0.044,0.01,0.002); }
    else { const OP=chg(g,u,0.085,B+0.011,0.03); bx(OP,M.bolt,-0.01,0.07,B+0.018,B+0.028,0.014,0.003); bx(OP,S,0.07,0.095,B+0.006,B+0.016,0.012,0.003,0.02); if(act==='clip') u.clipAt=V(0.03,B+0.03,0); }
    if(c.mg==='box') mag(g,u,A,{f0:0.07,f1:0.13,y:B-0.04,len:c.magLen||0.09,lean:c.magLean||0.01,w:0.026,mat:S,ribs:2});
    else if(c.mg==='tube'){ cy(g,S,0.13,Math.min(tf-0.03,fe+0.14),B-0.02,0.0085); u.port=V(0.06,B-0.006); u.mag=null; }
    else u.mag=null;
    bx(g,S,0.0,0.02,B+0.022,B+0.036,0.012,0.002); u.irons=()=>B+0.034; u.preOptic=()=>{ const ry=rail(g,S,-0.04,0.13,B+0.024,0.021); u.rail={y:ry,f:0.04,fr:-0.04}; };
    u.handL=V(c.hl||(fe-0.12),B-0.044); u.handR=V(-0.085,B-0.06); u.gripRk=1.15; u.hgW=0.024; }
  /* bullpups: magazine behind the grip, the butt is the receiver */
  function bpup(g,u,A,c){ const B=c.B||0.06, P=MT(c.bm||'poly'), S=M.steel, F=c.front||0.26, L=c.butt||-0.36, bw=c.bw||0.046;
    prof(g,P,[[L,B-0.066,0.012],[L,B+0.03,0.014],[-0.05,B+0.03],[F,B+0.026,0.004],[F,B-0.022,0.004],[0.11,B-0.032],[0.07,B-0.046],[-0.02,B-0.05],[-0.09,B-0.046],[-0.2,B-0.072,0.012]],bw,{b:0.009,bs:3});
    prof(g,M.rubber,[[L-0.012,B+0.026,0.006],[L+0.002,B+0.028],[L+0.002,B-0.064],[L-0.012,B-0.06,0.006]],bw-0.004,{b:0.005}); stockRef={f:-0.06,y:B-0.01,len:0.3,w:bw,top:B+0.03};
    if(c.hg) prof(g,MT(c.hgm||c.bm||'poly'),[[0.07,B-0.046],[F,B-0.022],[F,B-0.042,0.008],[0.1,B-0.062,0.01]],bw-0.004,{b:0.008,bs:3});
    if(c.sight==='carry'){ prof(g,P,[[-0.16,B+0.03],[-0.14,B+0.07,0.008],[0.16,B+0.07,0.008],[0.18,B+0.03]],0.014,{b:0.004}); const ry=B+0.07; u.rail={y:ry,f:0.0,fr:-0.14}; u.irons=()=>{ bx(g,S,-0.13,-0.12,ry,ry+0.012,0.01,0.001); return ry+0.011; }; }
    else { const ry=rail(g,MT(c.railM||'anod'),-0.2,F-0.02,B+0.03,0.021); u.rail={y:ry,f:c.of==null?-0.04:c.of,fr:-0.2}; u.irons=()=>flipIrons(g,ry,-0.16,F-0.04); }
    const r=bR(A,c.br||0.0085), tf=tip(A,c.tip||0.5,F+0.04,0.08,0.06); cy(g,S,F-0.02,tf,B,r); let tf2=tf;
    if(c.dbl) cy(g,S,F-0.02,tf,B+0.024,r);
    if(c.sup){ cy(g,M.anod,tf-0.01,tf+c.sup,B,0.02); tf2=tf+c.sup; u.noMuzzle=true; } else if((A.muzzle||'none')==='none'){ cy(g,S,tf-0.004,tf+0.04,B,r*1.5); tf2=tf+0.04; u.ownMuzzle=true; }
    u.muzzle=V(tf2,B); u.muzR=r;
    trig(g,0.03,B-0.046,{len:0.05,mat:P}); pgrip(g,MT(c.gm||c.bm||'poly'),0.0,B-0.046,{rake:0.22});
    if(c.vfg){ const f=c.vfg; prof(g,P,[[f-0.015,B-0.03],[f+0.015,B-0.03],[f+0.013,B-0.11,0.008],[f-0.013,B-0.11,0.008]],0.028,{b:0.009,bs:3}); u.gripL={y:B-0.075,z:-f,rk:0,wT:0.013,wD:0.0135}; u.handL=V(f,B-0.075); }
    else u.handL=V(c.hl||Math.min(F-0.05,0.2),B-0.045);
    if(c.mg==='tube'){ for(const x of c.tubes||[0]) cy(g,S,-0.2,F-0.02,B-0.034,0.011,x); u.mag=null; u.port=V(-0.12,B-0.05);
      const G=new THREE.Group(); G.userData.keep=true; G.userData.z0=0; g.add(G); u.pump=G; xsec(G,P,[[-0.024,B-0.024,0.008],[0.024,B-0.024,0.008],[0.028,B-0.05,0.01],[-0.028,B-0.05,0.01]],F-0.12,F+0.02,0.005); }
    else mag(g,u,A,{f0:c.mf0||-0.15,f1:(c.mf0||-0.15)+0.06,y:B-0.05,len:c.magLen||0.12,lean:c.magLean==null?0.03:c.magLean,w:0.026,mat:MT(c.mm||'poly'),drum:'c',ribs:2});
    { const H=chg(g,u,0.12,B+0.02,-0.03); cx(H,S,0.12,B+0.02,0.005,0.02,-0.03,8); }
    if(c.bolt){ const G=new THREE.Group(); G.userData.keep=true; G.position.set(0,B+0.02,0.16); G.userData.z0=0.16; g.add(G); u.bolt=G; const h=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.045,8),S); h.position.set(0.03,-0.012,0); h.rotation.z=-0.95; h.castShadow=true; G.add(h); put(G,new THREE.SphereGeometry(0.009,10,8),M.poly,0.048,-0.026,0); u.rl='bolt'; }
    if(c.bip&&!LOD) bipod(g,F-0.03,B-0.02,0.2);
    u.hgW=0.024; }
  /* belt-fed machine guns (feed cover, belt box / drum / magazine) */
  function lmgK(g,u,A,c){ const B=0.055, S=M.steel, RM=MT(c.rm||'steel'), P=MT(c.pm||'poly'), rc=c.rc||0.2, h1=c.h1||rc+0.22;
    prof(g,RM,[[-0.1,B-0.045],[-0.1,B+0.03,0.004],[rc,B+0.03],[rc,B-0.045]],0.04,{b:0.003});
    const CV=part(g,u,'cover'); u.coverHinge=V(rc-0.035,B+0.03); u.railG=CV;
    prof(CV,RM,[[-0.092,B+0.03],[-0.086,B+0.05,0.007],[rc-0.08,B+0.05,0.007],[rc-0.035,B+0.03]],0.042,{b:0.007});
    const ry=rail(CV,S,-0.075,rc-0.09,B+0.05,0.021);
    if(c.jacket){ cy(g,S,rc,h1,B,0.024,0,null,LOD?10:16); if(!LOD) for(let i=0;i<7;i++){ const f=rc+0.02+(h1-rc-0.05)*i/6; for(const s of [-1,1]) bx(g,M.dark,f,f+0.02,B-0.008,B+0.008,0.0012,0,s*0.0242); } }
    else { prof(g,P,[[rc,B-0.046,0.008],[h1,B-0.04,0.01],[h1,B-0.012],[rc,B-0.012]],0.05,{b:0.012,bs:3}); prof(g,RM,[[rc,B+0.016],[h1,B+0.016],[h1,B+0.03,0.004],[rc,B+0.03,0.004]],0.034,{b:0.006}); slots(g,rc+0.01,h1-0.01,B+0.022,0.0172,0.005); }
    const r=bR(A,c.br||0.011), tf=tip(A,c.tip||0.62,h1+0.04,0.08,0.09); cy(g,S,rc,tf,B,r); if(!c.jacket) cy(g,S,rc,Math.min(tf-0.03,h1+0.06),B-0.024,0.008);
    prof(g,S,[[tf-0.03,B-0.01],[tf-0.006,B-0.01],[tf-0.006,B+0.014],[tf-0.016,B+0.05,0.003],[tf-0.024,B+0.05,0.003],[tf-0.03,B+0.014]],0.02,{b:0.003});
    let tf2=tf; if((A.muzzle||'none')==='none'){ cy(g,S,tf,tf+0.05,B,r*0.95,0,r*1.5); tf2=tf+0.05; u.ownMuzzle=true; } u.muzzle=V(tf2,B); u.muzR=r;
    if(c.carry) prof(g,S,[[rc-0.02,B+0.03],[rc,B+0.064,0.008],[rc+0.08,B+0.064,0.008],[rc+0.085,B+0.056],[rc+0.02,B+0.056,0.004],[rc+0.01,B+0.03]],0.01,{b:0.002});
    trig(g,0.012,B-0.045,{len:0.05,mat:S}); pgrip(g,MT(c.gm||'poly'),-0.004,B-0.045);
    { const H=chg(g,u,0.15,B-0.006,0.05); cx(H,S,0.15,B-0.006,0.0045,0.026,0.031,8); cx(H,S,0.15,B-0.006,0.0062,0.009,0.046,10); }
    stock(g,sty(A,{std:c.st||'fixed',light:'skel',heavy:'prec',none:'none'}),{f:-0.1,y:B-0.004,len:c.sl||0.24,mat:MT(c.sm||'poly')});
    const G=new THREE.Group(); G.userData.keep=true; g.add(G); u.mag=G; const big=A.mag==='ext', bm=MT(c.bm||'od');
    if(c.box==='drum'){ cx(G,bm,0.11,B-0.11,0.062,0.05,-0.004,LOD?12:24); bx(G,bm,0.08,0.14,B-0.05,B-0.04,0.04,0.004,-0.004); }
    else if(c.box==='mag') prof(G,S,[[0.06,B-0.045],[0.12,B-0.045],[0.14,B-(big?0.2:0.16)],[0.08,B-(big?0.2:0.16)]],0.026,{b:0.003});
    else if(c.box==='side') bx(G,bm,0.04,0.17,B-0.15,B-0.03,0.07,0.01,0.05);
    else { prof(G,bm,[[0.045,B-0.045],[0.175,B-0.045],[0.175,B-(big?0.2:0.165),0.012],[0.045,B-(big?0.2:0.165),0.012]],big?0.085:0.07,{b:0.012,bs:3,x:-0.012}); bx(G,bm,0.06,0.16,B-0.05,B-0.04,0.06,0.004,-0.012); }
    if(!LOD&&c.box!=='mag') for(let i=0;i<5;i++) cy(G,M.brass,0.075,0.13,B-0.03+i*0.012,0.0045,-0.026,null,6);
    if(c.bip!==false&&!LOD) bipod(g,h1-0.03,B-0.02,0.22);
    u.rail={y:ry,f:0.02,fr:-0.075}; u.irons=()=>flipIrons(CV,ry,-0.065,rc-0.1); u.handL=V(c.hl||(rc+0.1),B-0.05); }
  /* over-under shotgun (break action, barrels stacked) */
  function ou(g,u){ const B=0.055, S=M.steel, W=M.woodD, gb=g; g=part(gb,u,'brl'); u.brlHinge=V(0.072,B-0.03);
    for(const y of [B+0.012,B-0.012]){ cy(g,S,0.07,0.7,y,0.0115); cy(g,M.dark,0.6995,0.7005,y,0.0092); } bx(g,S,0.07,0.7,B+0.024,B+0.028,0.008,0.001);
    prof(g,W,[[0.08,B-0.04,0.008],[0.3,B-0.034,0.012],[0.3,B-0.016],[0.08,B-0.016]],0.046,{b:0.013,bs:3}); if(!LOD) put(g,new THREE.SphereGeometry(0.0026,8,6),M.brass,0,B+0.031,-0.69); g=gb;
    prof(g,M.satin,[[-0.03,B-0.034],[-0.034,B+0.014,0.008],[-0.01,B+0.026,0.006],[0.075,B+0.026],[0.075,B-0.034]],0.05,{b:0.007,bs:3});
    prof(g,S,[[-0.02,B+0.026],[0.02,B+0.026],[0.02,B+0.032,0.003],[-0.02,B+0.032,0.003]],0.01,{b:0.002});
    prof(g,W,[[-0.028,B+0.014],[-0.075,B-0.004,0.03],[-0.12,B-0.01,0.04],[-0.34,B-0.03,0.01],[-0.345,B-0.14,0.014],[-0.31,B-0.146,0.012],[-0.12,B-0.078,0.04],[-0.07,B-0.09,0.02],[-0.03,B-0.04,0.01]],0.04,{b:0.014,bs:3});
    prof(g,M.rubber,[[-0.356,B-0.022,0.005],[-0.342,B-0.026],[-0.346,B-0.14],[-0.36,B-0.134,0.005]],0.036,{b:0.005}); stockRef={f:-0.1,y:B-0.03,len:0.26,w:0.04};
    trig(g,0.012,B-0.034,{len:0.05,mat:M.brass,drop:0.03});
    u.muzzle=V(0.7,B+0.012); u.sight=B+0.03; u.handL=V(0.2,B-0.044); u.handR=V(-0.085,B-0.05); u.gripRk=0.9; u.hgW=0.026; u.mag=null; }
  function derr(g,u){ const B=0.05, S=M.nickel, gb=g; g=part(gb,u,'brl'); u.brlHinge=V(0.0,B+0.02);
    for(const y of [B+0.009,B-0.009]) cy(g,S,0.0,0.09,y,0.0085); bx(g,S,0.0,0.09,B-0.011,B+0.011,0.012,0.002); cy(g,M.dark,0.0895,0.0905,B+0.009,0.006); cy(g,M.dark,0.0895,0.0905,B-0.009,0.006); g=gb;
    prof(g,S,[[-0.035,B-0.02],[-0.035,B+0.02,0.006],[0.0,B+0.02],[0.0,B-0.02]],0.02,{b:0.003});
    prof(g,M.woodD,[[-0.002,B-0.02],[-0.034,B-0.02],[-0.064,B-0.072,0.01],[-0.038,B-0.078,0.01],[-0.006,B-0.032]],0.022,{b:0.006});
    trig(g,0.0,B-0.02,{len:0.02,mat:S,drop:0.016,guard:false}); u.muzzle=V(0.09,B+0.009); u.sight=B+0.021; u.handR=V(-0.035,B-0.05); u.gripRk=0.4; u.pistol=true; u.mag=null; u.fr=-0.035; u.top=B+0.02; }
  function m79(g,u){ const B=0.06, S=M.steel, W=M.woodD, gb=g; g=part(gb,u,'brl'); u.brlHinge=V(0.06,B-0.035);
    cy(g,S,0.06,0.36,B,0.022,0,null,LOD?10:18); cy(g,M.dark,0.3595,0.3605,B,0.019); bx(g,S,0.06,0.12,B-0.03,B-0.016,0.02,0.003); bx(g,S,0.08,0.1,B+0.02,B+0.05,0.03,0.002); g=gb;
    prof(g,S,[[-0.04,B-0.03],[-0.04,B+0.02,0.006],[0.06,B+0.02],[0.06,B-0.03]],0.04,{b:0.005});
    prof(g,W,[[0.1,B-0.05,0.01],[0.28,B-0.044,0.012],[0.28,B-0.022],[0.1,B-0.022]],0.05,{b:0.013,bs:3});
    prof(g,W,[[-0.03,B+0.016],[-0.07,B-0.004,0.03],[-0.12,B-0.01,0.04],[-0.3,B-0.03,0.01],[-0.305,B-0.13,0.014],[-0.27,B-0.136,0.012],[-0.12,B-0.076,0.04],[-0.07,B-0.088,0.02],[-0.035,B-0.04,0.01]],0.044,{b:0.014,bs:3});
    prof(g,M.rubber,[[-0.32,B-0.026,0.006],[-0.302,B-0.028],[-0.306,B-0.13],[-0.322,B-0.124,0.006]],0.044,{b:0.006}); stockRef={f:-0.1,y:B-0.03,len:0.22,w:0.044};
    trig(g,0.012,B-0.03,{len:0.05,mat:S}); u.muzzle=V(0.36,B); u.muzR=0.02; u.sight=B+0.05; u.handL=V(0.19,B-0.05); u.handR=V(-0.075,B-0.05); u.gripRk=0.9; u.hgW=0.03; u.mag=null; u.noMuzzle=true; }
  function gl6(g,u){ const B=0.06, S=M.grey, P=M.poly, O=M.od;
    cy(g,O,0.2,0.46,B,0.024,0,null,LOD?10:16); cy(g,S,0.44,0.46,B,0.027,0,null,LOD?10:16); cy(g,M.dark,0.4595,0.4605,B,0.021);
    { const C=part(g,u,'mag'); u.magCenter=true; cy(C,O,0.03,0.2,B-0.03,0.066,0,null,LOD?12:24); if(!LOD) for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; cy(C,M.dark,0.199,0.2005,B-0.03+Math.sin(a)*0.04,0.017,Math.cos(a)*0.04,null,10); } }
    prof(g,S,[[-0.06,B-0.03],[-0.06,B+0.03,0.004],[0.21,B+0.03],[0.21,B+0.02],[0.03,B+0.02],[0.03,B-0.03]],0.032,{b:0.003}); const ry=rail(g,S,-0.05,0.32,B+0.03,0.021);
    pgrip(g,P,-0.004,B-0.03,{rake:0.25}); trig(g,0.012,B-0.03,{len:0.04,mat:S});
    prof(g,P,[[0.27,B-0.024],[0.3,B-0.024],[0.305,B-0.11,0.008],[0.275,B-0.11,0.008]],0.03,{b:0.009}); u.gripL={y:B-0.07,z:-0.288,rk:0,wT:0.013,wD:0.0135};
    stock(g,'fold',{f:-0.06,y:B,len:0.25,mat:P});
    u.muzzle=V(0.46,B); u.muzR=0.024; u.noMuzzle=true; u.rail={y:ry,f:0.1,fr:-0.05}; u.irons=()=>flipIrons(g,ry,-0.03,0.3); u.handL=V(0.288,B-0.07); u.hgW=0.03; }
  function cbow(g,u){ const B=0.05, S=M.grey, P=M.poly;
    prof(g,P,[[-0.01,B-0.2],[0.04,B-0.18,0.01],[0.05,B-0.04,0.01],[0.02,B-0.02],[0.05,B+0.02],[0.05,B+0.18,0.01],[-0.01,B+0.2],[0.0,B+0.03],[-0.02,B+0.0],[0.0,B-0.03]],0.028,{b:0.006});
    for(const s of [-1,1]){ const L=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.2,0.012),M.anod); L.position.set(0,B+s*0.27,0.02); L.rotation.x=s*0.42; L.castShadow=true; g.add(L);
      put(g,new THREE.CylinderGeometry(0.018,0.018,0.012,14),S,0,B+s*0.36,0.06).rotation.z=Math.PI/2; }
    { const st=new THREE.Mesh(new THREE.CylinderGeometry(0.0012,0.0012,0.72,4),M.chrome); st.position.set(0,B,0.07); g.add(st); }
    { const P2=part(g,u,'arrow'); cy(P2,M.grey,-0.06,0.5,B,0.0038,0,null,6); add(P2,new THREE.ConeGeometry(0.009,0.03,6),M.blade,0,B,-0.515,-Math.PI/2,0,0); if(!LOD) for(const s of [-1,1]) bx(P2,M.red,-0.05,-0.01,B,B+0.012,0.001,0,s*0.002); }
    u.muzzle=V(0.52,B); u.muzR=0.004; u.noMuzzle=true; u.sight=B+0.012; u.handR=V(0.0,B-0.02); u.gripRk=0.05; u.pistol=true; u.mag=null; u.fr=-0.02; u.top=B+0.01; }
  function flamer(g,u){ const B=0.06, S=M.grey, R=M.red;
    cy(g,R,-0.25,0.05,B-0.075,0.055,0,null,LOD?12:20); cy(g,S,0.05,0.064,B-0.075,0.05); cy(g,S,-0.264,-0.25,B-0.075,0.05);
    cy(g,S,-0.1,0.5,B,0.018); cy(g,M.dark,0.46,0.53,B,0.026,0,0.022); bx(g,S,-0.12,0.14,B+0.016,B+0.03,0.03,0.004); cy(g,M.steel,0.05,0.3,B-0.03,0.006);
    pgrip(g,M.poly,-0.004,B-0.018,{rake:0.3}); trig(g,0.012,B-0.018,{len:0.04,mat:S});
    prof(g,M.poly,[[0.3,B-0.018],[0.33,B-0.018],[0.335,B-0.1,0.008],[0.305,B-0.1,0.008]],0.03,{b:0.009}); u.gripL={y:B-0.06,z:-0.318,rk:0,wT:0.013,wD:0.0135};
    put(g,new THREE.SphereGeometry(0.006,8,6),M.glowO,0,B-0.022,-0.52);
    u.muzzle=V(0.53,B); u.muzR=0.02; u.noMuzzle=true; u.sight=B+0.04; u.handL=V(0.318,B-0.06); u.hgW=0.03; u.mag=null; }
  function minigun(g,u){ const B=0.06, S=M.steel, D=M.grey;
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; cy(g,S,0.08,0.62,B+Math.sin(a)*0.022,0.0065,Math.cos(a)*0.022,null,8); }
    for(const f of [0.08,0.3,0.5]) cy(g,D,f,f+0.016,B,0.032,0,null,LOD?10:16);
    bx(g,D,-0.16,0.08,B-0.05,B+0.04,0.07,0.01); cy(g,M.poly,-0.21,-0.16,B-0.005,0.03,0,null,12);
    prof(g,S,[[-0.1,B+0.04],[-0.08,B+0.09,0.01],[0.06,B+0.09,0.01],[0.08,B+0.04]],0.014,{b:0.004});
    pgrip(g,M.poly,-0.004,B-0.05); trig(g,0.012,B-0.05,{len:0.04,mat:S});
    prof(g,M.poly,[[0.12,B-0.05],[0.15,B-0.05],[0.155,B-0.13,0.008],[0.125,B-0.13,0.008]],0.03,{b:0.009}); u.gripL={y:B-0.09,z:-0.138,rk:0,wT:0.013,wD:0.0135};
    const G=part(g,u,'mag'); bx(G,M.od,-0.12,0.06,B-0.2,B-0.05,0.09,0.01,-0.085);
    u.muzzle=V(0.62,B); u.muzR=0.03; u.noMuzzle=true; u.sight=B+0.095; u.handL=V(0.138,B-0.09); u.hgW=0.035; }
  function flare(g,u){ const B=0.06, O=M.red, gb=g; g=part(gb,u,'brl'); u.brlHinge=V(0.03,B-0.016); cy(g,O,0.02,0.17,B,0.016,0,null,LOD?10:16); cy(g,M.dark,0.1695,0.1705,B,0.013); g=gb;
    prof(g,O,[[-0.05,B-0.018],[-0.05,B+0.016,0.006],[0.03,B+0.016],[0.03,B-0.018]],0.026,{b:0.004});
    pgrip(g,O,-0.03,B-0.016,{len:0.09,rake:0.3,fw:0.038,t:0.024}); trig(g,0.0,B-0.018,{len:0.03,mat:M.poly,drop:0.026});
    u.muzzle=V(0.17,B); u.muzR=0.016; u.noMuzzle=true; u.sight=B+0.02; u.handR=V(-0.06,B-0.06); u.gripRk=0.3; u.pistol=true; u.mag=null; u.fr=-0.05; u.top=B+0.016; }
  function harpoon(g,u){ const B=0.055, S=M.grey, Y=M.yellow;
    cy(g,Y,-0.05,0.4,B,0.02,0,null,LOD?10:16); cy(g,M.dark,0.399,0.401,B,0.016); prof(g,M.poly,[[-0.22,B-0.01],[-0.05,B+0.004],[-0.05,B-0.03],[-0.22,B-0.075,0.01]],0.03,{b:0.008});
    { const P=part(g,u,'arrow'); cy(P,M.chrome,0.0,0.55,B+0.028,0.004,0,null,6); add(P,new THREE.ConeGeometry(0.01,0.05,6),M.blade,0,B+0.028,-0.575,-Math.PI/2,0,0); }
    if(!LOD) for(const s of [-1,1]) cy(g,M.rubber,0.2,0.38,B+0.02,0.004,s*0.018,null,6);
    pgrip(g,M.poly,-0.004,B-0.02,{rake:0.25}); trig(g,0.012,B-0.02,{len:0.04,mat:S});
    u.muzzle=V(0.6,B+0.028); u.muzR=0.01; u.noMuzzle=true; u.sight=B+0.045; u.handL=V(0.24,B-0.025); u.hgW=0.022; u.mag=null; }
  function stun(g,u){ const B=0.06, Y=M.yellow, P=M.poly;
    prof(g,Y,[[-0.05,B-0.02],[-0.05,B+0.02,0.008],[0.1,B+0.02,0.006],[0.12,B+0.0,0.006],[0.12,B-0.03,0.006],[0.03,B-0.03]],0.034,{b:0.006});
    bx(g,M.dark,0.118,0.122,B-0.025,B+0.012,0.024,0.002); for(const y of [B+0.004,B-0.016]) cy(g,M.glowB,0.121,0.124,y,0.004,0,null,8);
    pgrip(g,P,-0.004,B-0.03,{len:0.09,rake:0.25}); trig(g,0.014,B-0.03,{len:0.03,mat:P,drop:0.026});
    u.muzzle=V(0.124,B-0.006); u.muzR=0.01; u.noMuzzle=true; u.sight=B+0.022; u.handR=V(-0.03,B-0.075); u.gripRk=0.25; u.pistol=true; u.mag=null; u.fr=-0.05; u.top=B+0.02; }
  function railgun(g,u,A){ const B=0.06, S=M.anod, D=M.grey;
    prof(g,S,[[-0.3,B-0.06,0.012],[-0.3,B+0.03,0.01],[0.12,B+0.03],[0.12,B-0.05]],0.05,{b:0.008});
    for(const s of [-1,1]) bx(g,D,0.1,0.62,B-0.008,B+0.008,0.012,0.002,s*0.018);
    for(let i=0;i<5;i++){ const f=0.16+i*0.09; cy(g,M.brass,f,f+0.03,B,0.026,0,null,LOD?10:16); }
    for(let i=0;i<4;i++) bx(g,M.glowB,0.14+i*0.11,0.15+i*0.11,B+0.02,B+0.024,0.008,0);
    const ry=rail(g,S,-0.2,0.1,B+0.03,0.021);
    pgrip(g,M.poly,-0.004,B-0.05); trig(g,0.012,B-0.05,{len:0.045,mat:S});
    mag(g,u,A,{f0:0.03,f1:0.1,y:B-0.05,len:0.07,lean:0,w:0.03,mat:M.grey});
    u.muzzle=V(0.62,B); u.muzR=0.012; u.noMuzzle=true; u.rail={y:ry,f:0.0,fr:-0.2}; u.irons=()=>flipIrons(g,ry,-0.18,0.08); u.handL=V(0.3,B-0.035); u.hgW=0.03; }
  function nail(g,u){ const B=0.06, Y=M.yellow, P=M.poly;
    prof(g,Y,[[-0.08,B-0.02],[-0.08,B+0.035,0.012],[0.12,B+0.035,0.01],[0.14,B+0.0,0.008],[0.14,B-0.025,0.006],[0.02,B-0.025]],0.04,{b:0.008});
    cy(g,M.steel,0.14,0.2,B-0.008,0.008); bx(g,M.steel,0.18,0.205,B-0.03,B+0.012,0.024,0.003);
    { const G=part(g,u,'mag'); prof(G,M.grey,[[0.12,B-0.025],[0.17,B-0.025],[0.08,B-0.12,0.006],[0.03,B-0.12,0.006]],0.014,{b:0.003}); }
    pgrip(g,P,-0.004,B-0.025,{len:0.1,rake:0.25}); trig(g,0.014,B-0.025,{len:0.035,mat:P,drop:0.028});
    u.muzzle=V(0.205,B-0.008); u.muzR=0.008; u.noMuzzle=true; u.sight=B+0.04; u.handR=V(-0.03,B-0.08); u.gripRk=0.25; u.pistol=true; u.fr=-0.08; u.top=B+0.035; }
  function paint(g,u){ const B=0.055, P=M.poly;
    prof(g,M.grey,[[-0.06,B-0.024],[-0.06,B+0.024,0.008],[0.14,B+0.024],[0.14,B-0.024]],0.032,{b:0.006});
    cy(g,M.steel,0.14,0.4,B,0.011); cy(g,M.dark,0.399,0.401,B,0.009);
    { const H=part(g,u,'mag'); u.magCenter=true; put(H,new THREE.SphereGeometry(0.05,LOD?10:16,LOD?8:12),M.smoke,0,B+0.08,-0.03); cv(H,P,0.03,B+0.024,B+0.05,0.012); }
    cy(g,M.chrome,-0.3,-0.06,B-0.02,0.03,0,null,LOD?10:16);
    pgrip(g,P,-0.004,B-0.024); trig(g,0.012,B-0.024,{len:0.04,mat:P});
    u.muzzle=V(0.4,B); u.muzR=0.011; u.noMuzzle=true; u.sight=B+0.03; u.handL=V(0.24,B-0.02); u.hgW=0.02; }
  function blunder(g,u){ flintlock(g,u); cy(g,M.brass,0.36,0.46,0.066,0.0105,0,0.034,LOD?10:18,true); u.muzzle=V(0.46,0.066); }
  const P0=o=>(g,u,A)=>{ const c={}; for(const k in o) c[k]=['slide','frame','panel','plate'].includes(k)?MT(o[k]):o[k]; pistol(g,u,A,c); };
  const BUILD2={
    r416:(g,u,A)=>ar15(g,u,A,{hg:0.36,tip:0.52}), m16:(g,u,A)=>ar15(g,u,A,{hg:0.42,tip:0.68,stocks:{std:'fixed',light:'skel',heavy:'prec',none:'none'},lop:0.26}),
    k2:(g,u,A)=>kit(g,u,A,{rm:'anod',hg:[0.16,0.36,'slots'],tip:0.52,gas:1,mz:'flash',mg:{t:'curve',f0:0.07,f1:0.125,len:0.12,lean:0.03},st:{std:'fold',light:'skel',heavy:'prec',none:'none'},sight:'irons'}),
    k1a:(g,u,A)=>ar15(g,u,A,{hg:0.25,tip:0.42,magLen:0.1}),
    ak74:(g,u,A)=>ak(g,u,A,{furn:M.woodL,tip:0.58}), ak12:(g,u,A)=>ak(g,u,A,{furn:M.poly,stockStd:'fold'}), gallant:(g,u,A)=>ak(g,u,A,{furn:M.poly,stockStd:'fold',tip:0.56}),
    augur:(g,u,A)=>bpup(g,u,A,{bm:'od',hg:true,vfg:0.17,tip:0.48,front:0.24,mm:'smoke'}), s550:(g,u,A)=>kit(g,u,A,{rm:'grey',hg:[0.16,0.38,'slots'],tip:0.56,mz:'flash',mg:{t:'curve',f0:0.07,f1:0.125,len:0.11,lean:0.03,m:'smoke'},st:{std:'fold',light:'skel',heavy:'prec',none:'none'},sight:'irons'}),
    arc7:(g,u,A)=>kit(g,u,A,{rm:'anod',hg:[0.16,0.38,'quad'],tip:0.52,mg:{t:'box',f0:0.068,f1:0.122,len:0.118,lean:0.02,m:'poly'},st:{std:'fold',light:'skel',heavy:'prec',none:'none'},railTo:0.38,mz:'flash'}),
    t21:(g,u,A)=>bpup(g,u,A,{tip:0.42,front:0.22}), qbz:(g,u,A)=>bpup(g,u,A,{sight:'carry',tip:0.48}), l85:(g,u,A)=>bpup(g,u,A,{tip:0.5,front:0.26,mm:'steel'}),
    f2k:(g,u,A)=>bpup(g,u,A,{bm:'tan',hg:true,tip:0.42,front:0.24}), groza:(g,u,A)=>bpup(g,u,A,{tip:0.32,front:0.16,mf0:-0.12,mm:'steel',magLean:0.05,hl:0.12}),
    asv:(g,u,A)=>kit(g,u,A,{rm:'steel',hg:[0.16,0.24,'wood'],hm:'poly',tip:0.2,sup:0.26,supR:0.021,mg:{t:'box',f0:0.07,f1:0.12,len:0.09,lean:0.02},st:'skel',sm:'steel',sight:'irons',hl:0.24}),
    g3:(g,u,A)=>kit(g,u,A,{rm:'steel',r1:0.17,hg:[0.17,0.38,'slots'],tip:0.6,mz:'flash',mg:{t:'box',f0:0.075,f1:0.14,len:0.13,lean:0.018,ribs:3},st:'fixed',sight:'irons'}),
    m14:(g,u,A)=>wrifle(g,u,A,{tip:0.64,fe:0.44,act:'semi',mg:'box',magLen:0.085,hgTop:true}),
    u45:(g,u,A)=>kit(g,u,A,{rm:'poly',lm:'poly',r0:-0.08,r1:0.2,tip:0.3,mg:{t:'box',f0:0.08,f1:0.125,len:0.13,lean:0.006,m:'poly'},st:{std:'fold',light:'skel',heavy:'prec',none:'none'},railTo:0.2,hl:0.18,hly:-0.04}),
    mx7:(g,u,A)=>uzi(g,u,A,{m:'poly',tip:0.25}), mps9:(g,u,A)=>uzi(g,u,A,{m:'anod',tip:0.22}), m10:(g,u,A)=>uzi(g,u,A,{m:'grey',tip:0.19}),
    px9:(g,u,A)=>ar15(g,u,A,{hg:0.24,tip:0.3,magLen:0.15,magLean:0.01,lop:0.2}), wraith:(g,u,A)=>ar15(g,u,A,{hg:0.26,tip:0.32,magLen:0.13,magLean:0.004,furn:M.grey}),
    evo3:(g,u,A)=>kit(g,u,A,{rm:'poly',lm:'poly',r0:-0.07,r1:0.2,hg:[0.2,0.26,'rail'],tip:0.3,mg:{t:'box',f0:0.07,f1:0.11,len:0.13,lean:0.02,m:'smoke'},st:'fold',railTo:0.2}),
    sk61:(g,u,A)=>kit(g,u,A,{rm:'steel',r0:-0.05,r1:0.1,top:0.024,bot:-0.024,tip:0.18,mg:{t:'box',f0:0.068,f1:0.096,len:0.09,lean:0.03},st:{std:'wire',light:'skel',heavy:'fixed',none:'none'},sl:0.2,sight:'irons',hl:0.12,hly:-0.04}),
    bison:(g,u,A)=>kit(g,u,A,{rm:'steel',hg:[0.16,0.32,'wood'],hm:'poly',tip:0.36,mg:{t:'helix',m:'poly'},st:'fold',sm:'steel',sight:'irons',hl:0.24,hly:-0.06}),
    ppsh:(g,u,A)=>kit(g,u,A,{rm:'steel',r0:-0.06,r1:0.12,hg:[0.12,0.34,'jacket'],hh:0.02,hm:'steel',tip:0.35,mg:{t:'drum',f0:0.07,f1:0.12,drum:'ak'},st:{std:'wood',light:'skel',heavy:'fixed',none:'none'},sm:'wood',gm:'wood',sl:0.3,sight:'irons'}),
    tommy:(g,u,A)=>kit(g,u,A,{rm:'steel',r0:-0.08,r1:0.14,hg:[0.14,0.28,'round'],hh:0.018,hm:'steel',tip:0.33,mz:'comp',mg:{t:'drum',f0:0.07,f1:0.12,drum:'ak'},st:{std:'wood',light:'skel',heavy:'fixed',none:'none'},sm:'wood',gm:'wood',vfg:0.24,vm:'wood',sight:'irons'}),
    mp40:(g,u,A)=>kit(g,u,A,{rm:'steel',rs:'tube',r0:-0.07,r1:0.2,top:0.02,bot:-0.02,tip:0.3,mg:{t:'box',f0:0.09,f1:0.12,len:0.17,lean:0},st:{std:'fold',light:'skel',heavy:'fixed',none:'none'},sm:'steel',sight:'irons',hl:0.105,hly:-0.07}),
    k7:(g,u,A)=>kit(g,u,A,{rm:'anod',r0:-0.08,r1:0.12,hg:[0.12,0.2,'rail'],tip:0.16,sup:0.2,supR:0.022,mg:{t:'curve',f0:0.065,f1:0.1,len:0.14,lean:0.03},st:'fold',sight:'irons'}),
    ap9:(g,u,A)=>kit(g,u,A,{rm:'anod',r0:-0.07,r1:0.2,hg:[0.2,0.26,'rail'],tip:0.29,mg:{t:'box',f0:0.07,f1:0.105,len:0.15,lean:0.025},st:'fold',railTo:0.26}),
    sten:(g,u,A)=>kit(g,u,A,{rm:'steel',rs:'tube',r0:-0.06,r1:0.25,top:0.018,bot:-0.018,tip:0.33,mg:{t:'side',f0:0.14,f1:0.17},st:{std:'wire',light:'skel',heavy:'fixed',none:'none'},sm:'steel',sl:0.22,sight:'irons',hl:0.2,hly:-0.02}),
    s90:(g,u,A)=>kit(g,u,A,{rm:'anod',r0:-0.07,r1:0.16,hg:[0.16,0.36,'slots'],tip:0.62,br:0.011,mg:{t:'none'},tube:true,st:'fixed',sight:'irons'}),
    sps12:(g,u,A)=>pumpSg(g,u,A,{fm:'poly',rm:'grey',tip:0.6}), slug:(g,u,A)=>pumpSg(g,u,A,{fm:'wood',tip:0.7}),
    ax12:(g,u,A)=>kit(g,u,A,{rm:'poly',lm:'poly',r0:-0.1,r1:0.18,top:0.034,bot:-0.04,hg:[0.18,0.34,'rail'],tip:0.46,br:0.012,mg:{t:'drum',f0:0.075,f1:0.135},st:'fixed',sight:'carry'}),
    ks14:(g,u,A)=>bpup(g,u,A,{mg:'tube',tubes:[-0.014,0.014],front:0.3,tip:0.46,br:0.011,hl:0.26}),
    lever87:(g,u,A)=>wrifle(g,u,A,{tip:0.56,fe:0.3,act:'lever',mg:'tube',br:0.011}),
    usas:(g,u,A)=>kit(g,u,A,{rm:'poly',lm:'poly',hg:[0.16,0.34,'slots'],tip:0.5,br:0.012,mg:{t:'box',f0:0.07,f1:0.14,len:0.12,lean:0.02,m:'poly',w:0.034},st:'fixed',sight:'carry'}),
    ou, db12:(g,u,A)=>bpup(g,u,A,{mg:'tube',tubes:[-0.014,0.014],front:0.3,tip:0.42,br:0.011,dbl:true,hl:0.26}),
    striker:(g,u,A)=>kit(g,u,A,{rm:'steel',r0:-0.07,r1:0.08,tip:0.42,br:0.012,mg:{t:'cyl',f0:0.08,f1:0.2},st:'fold',sight:'irons',hl:0.26,hly:-0.03}),
    sks:(g,u,A)=>wrifle(g,u,A,{tip:0.56,fe:0.38,act:'clip',mg:'none',hgTop:true,wm:'wood'}),
    mk14:(g,u,A)=>kit(g,u,A,{rm:'tanM',lm:'tan',hm:'tan',hg:[0.16,0.4,'quad'],tip:0.6,mz:'brake',mg:{t:'box',f0:0.07,f1:0.13,len:0.09,lean:0.01},st:'prec',sm:'tan',railTo:0.4}),
    svd:(g,u,A)=>wrifle(g,u,A,{tip:0.72,fe:0.42,act:'semi',mg:'box',magLen:0.1,magLean:0.03,wm:'wood'}),
    m110:(g,u,A)=>ar15(g,u,A,{recv:M.tanM,furn:M.tan,hg:0.42,tip:0.66,magLen:0.075,magLean:0.004,magMat:M.steel,stocks:{std:'prec',light:'skel',heavy:'prec',none:'none'}}),
    g28:(g,u,A)=>ar15(g,u,A,{recv:M.od,furn:M.od,hg:0.42,tip:0.64,magLen:0.08,magLean:0.004,magMat:M.steel,stocks:{std:'prec',light:'skel',heavy:'prec',none:'none'}}),
    ranch14:(g,u,A)=>wrifle(g,u,A,{tip:0.52,fe:0.36,act:'semi',mg:'box',magLen:0.07,wm:'woodL'}),
    vss:(g,u,A)=>kit(g,u,A,{rm:'steel',hg:[0.16,0.24,'wood'],hm:'wood',tip:0.2,sup:0.28,supR:0.022,mg:{t:'box',f0:0.07,f1:0.12,len:0.07,lean:0.01},st:'skel',sm:'wood',gm:'wood',sight:'irons',hl:0.25}),
    mk12:(g,u,A)=>ar15(g,u,A,{hg:0.42,tip:0.66,stocks:{std:'fixed',light:'skel',heavy:'prec',none:'none'}}),
    svu:(g,u,A)=>bpup(g,u,A,{tip:0.56,mm:'steel',hg:true}), qbu:(g,u,A)=>bpup(g,u,A,{tip:0.6,bip:true,mm:'steel'}),
    m24:(g,u,A)=>awm(g,u,A,{cm:'od',tip:0.74}), kar98:(g,u,A)=>wrifle(g,u,A,{tip:0.66,fe:0.46,act:'bolt',mg:'none',boltDown:true}),
    mosin:(g,u,A)=>wrifle(g,u,A,{tip:0.72,fe:0.5,act:'bolt',mg:'none',wm:'wood'}), enfield:(g,u,A)=>wrifle(g,u,A,{tip:0.62,fe:0.5,act:'bolt',mg:'box',magLen:0.07,hgTop:true}),
    scout:(g,u,A)=>awm(g,u,A,{cm:'poly',tip:0.56}), lrr:(g,u,A)=>awm(g,u,A,{cm:'grey',tip:0.84}), bp1:(g,u,A)=>bpup(g,u,A,{tip:0.62,bolt:true,mm:'steel',magLen:0.07,front:0.24}),
    sv98:(g,u,A)=>awm(g,u,A,{cm:'poly',tip:0.72}), k14:(g,u,A)=>awm(g,u,A,{cm:'tan',tip:0.74}), lever94:(g,u,A)=>wrifle(g,u,A,{tip:0.58,fe:0.34,act:'lever',mg:'tube'}),
    m60:(g,u,A)=>lmgK(g,u,A,{h1:0.42,tip:0.66,carry:true}), pkm:(g,u,A)=>lmgK(g,u,A,{sm:'woodD',st:'skel',box:'side',tip:0.64}),
    rpk:(g,u,A)=>{ ak(g,u,A,{tip:0.72,furn:M.wood}); if(!LOD) bipod(g,0.56,0.03,0.2); },
    mg42:(g,u,A)=>lmgK(g,u,A,{jacket:true,h1:0.5,tip:0.56,sm:'woodD',box:'side'}), ng7:(g,u,A)=>lmgK(g,u,A,{rm:'anod',tip:0.6,st:'fold'}),
    k3:(g,u,A)=>lmgK(g,u,A,{tip:0.62,bm:'poly'}), u100:(g,u,A)=>lmgK(g,u,A,{rm:'grey',box:'drum',bm:'poly',tip:0.56,st:'fold'}), rpd:(g,u,A)=>lmgK(g,u,A,{sm:'woodD',pm:'woodD',box:'drum',bm:'steel',tip:0.62,st:'wood'}),
    p17:P0({f1:0.13,slide:'anod',frame:'poly',style:'glock',hammer:false,rail:true,rake:0.34}), p18c:P0({f1:0.13,slide:'anod',frame:'poly',style:'glock',hammer:false,rail:true,rake:0.34,ext:true}),
    usx:P0({f1:0.14,slide:'anod',frame:'poly',style:'glock',rail:true,sh:0.015,sw:0.028}), s226:P0({f1:0.135,slide:'anod',frame:'anod',panel:'poly',rail:true,sh:0.0145}),
    m9:P0({f1:0.145,slide:'anod',frame:'anod',panel:'poly',style:'beretta'}), pk:P0({f1:0.1,slide:'satin',frame:'satin',panel:'poly',sh:0.012,sw:0.022,gl:0.07,fw:0.034}),
    makarov:P0({f1:0.1,slide:'steel',frame:'steel',panel:'poly',sh:0.0125,sw:0.024,gl:0.075}), tt33:P0({f1:0.125,slide:'steel',frame:'steel',panel:'poly',sw:0.024}),
    f57:P0({f1:0.14,slide:'anod',frame:'tan',style:'glock',hammer:false,rail:true,gl:0.1}), c96:P0({f1:0.17,slide:'steel',frame:'steel',panel:'woodD',foreMag:true,sw:0.024,gl:0.08}),
    mark22:P0({f1:0.19,slide:'steel',frame:'steel',panel:'poly',sh:0.011,sw:0.02,style:'glock'}), k5:P0({f1:0.125,slide:'anod',frame:'anod',panel:'poly'}),
    aps:P0({f1:0.14,slide:'steel',frame:'steel',panel:'poly',style:'beretta',ext:true}),
    peace:(g,u,A)=>revolver(g,u,A,{bl:0.27,m:'steel',gm:'woodD'}), viper:(g,u,A)=>revolver(g,u,A,{bl:0.23,m:'satin',gm:'woodD'}), m500:(g,u,A)=>revolver(g,u,A,{bl:0.28,m:'satin',gm:'poly'}),
    derr, m79, gl6, cbow, flamer, minigun, flare, harpoon, blunder, taser:stun, railgun, nail, paint };
  /* ================= assembly ================= */
  const P1911={f1:0.132,sh:0.0135}, BUILD={
    m4:(g,u,A)=>ar15(g,u,A,{}), lightsr:(g,u,A)=>ar15(g,u,A,{recv:M.tanM,furn:M.tan,hg:0.44,tip:0.61,dl:0.08,magLen:0.07,magLean:0.004,magMat:M.steel,lop:0.25,stocks:{std:'fixed',light:'skel',heavy:'prec'},bipod:true,of:0.02}),
    ak47:(g,u,A)=>ak(g,u,A,{}), autosg:(g,u,A)=>ak(g,u,A,{sg:true,furn:M.poly,tip:0.56,stockStd:'fixed'}), scar, falcon:fal, famas, g36, m249,
    smg9:mp5, microsmg:uzi, p50:p90, vector, pump:pumpSg, sawed, m1:garand, heavysr:awm, piercesr:barrett, mrl,
    p1912:(g,u,A)=>pistol(g,u,A,{f1:0.132,slide:M.steel,frame:M.steel,panel:M.wood,rake:0.3}),
    deagle:(g,u,A)=>pistol(g,u,A,{f1:0.17,slide:M.satin,frame:M.satin,panel:M.poly,sh:0.017,sw:0.032,style:'deagle',gl:0.1,fw:0.046,dust:0.05,B:0.068}),
    auto75:(g,u,A)=>pistol(g,u,A,{f1:0.125,slide:M.steel,frame:M.grey,panel:M.poly,ext:true,foreMag:true,sh:0.012}),
    burst9:(g,u,A)=>pistol(g,u,A,{f1:0.13,slide:M.steel,frame:M.steel,panel:M.woodD,style:'beretta',ext:true,fore:true}),
    tagpistol:(g,u,A)=>pistol(g,u,A,{f1:0.118,slide:M.steel,frame:M.yellow,style:'glock',hammer:false,rail:true,rake:0.34,plate:M.yellow}),
    revolver, crossbow, flintlock, snowcan, ...BUILD2,
    shuriken:(g,u)=>{ const sh=new THREE.Shape(); for(let i=0;i<8;i++){ const a=i/8*Math.PI*2, r=i%2?0.018:0.06; sh[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r); }
      add(g,new THREE.ExtrudeGeometry(sh,{depth:0.004,bevelEnabled:false}),M.blade,0,0.05,-0.08,Math.PI/2.4,0,0); u.muzzle=new THREE.Vector3(0,0.05,-0.1); u.sight=0.06; u.thrown=true; u.mag=null; }
  };
  function make(id,att,mode){ mats(); const pL=LOD, pF=FP; LOD=mode==='tp'?1:0; FP=mode==='fp'; let g;
    try{
      if(TH[id]) g=item(TH[id].kind==='grenade'?'frag':TH[id].kind); else if(SP[id]) g=item(id);
      else { const w=WPN[id]||WPN.m4; if(w.mode==='melee') g=melee(id);
        else { g=new THREE.Group(); const u=g.userData, A=attClean(id,att)||{}, b=BUILD[id]||BUILD[w.cat==='pistol'?'p1912':'m4'];          stockRef=null; b(g,u,A);
          if(w.att){ muzzleDev(g,u,A,w); if(w.att.grip) gripDev(g,u,A,w); stockExtra(g,u,A,w); const sc=A.scope||'iron';
            if(sc==='iron'||!w.att.scope) u.sight=u.irons?u.irons():u.sight; else if(u.pistol){ u.sight=sc==='reddot'?miniDot(g,u,u.top,u.fr+0.03):(()=>{ const ry=rail(g,M.anod,u.fr+0.01,u.fr+0.11,u.top,0.018); return optic(g,u,sc,{y:ry,f:u.fr+0.06}); })(); if(sc!=='reddot') u.adsZ=null; }
            else { if(u.preOptic) u.preOptic(); u.sight=optic(u.railG||g,u,sc,u.rail); if(u.adsZ!=null) u.adsZ=Math.min(-0.09,u.adsZ); } }
          else if(u.sight==null) u.sight=u.irons?u.irons():0.1;
          delete u.irons; delete u.preOptic; bake(g); const bb=new THREE.Box3().setFromObject(g); u.len=bb.max.z-bb.min.z; u.box=bb; } }
    } finally { LOD=pL; FP=pF; }
    g.userData.id=id; return g; }
  /* one attachment on its own, for the armory's shelves and counters. Gun scale, pointing -z like a gun, roughly centred on the origin. */
  function partModel(slot,opt){ mats(); const pL=LOD, pF=FP; LOD=0; FP=false; const g=new THREE.Group(), u=g.userData;
    try{
      if(slot==='scope'){ const ry=rail(g,M.anod,-0.075,0.075,-0.014,0.021); if(opt==='iron') flipIrons(g,ry,-0.06,0.06); else optic(g,u,opt,{y:ry,f:0}); }
      else if(slot==='muzzle'){ u.muzzle=V(-0.03,0,0); u.muzR=0.0095; cy(g,M.steel,-0.05,-0.026,0,0.0075); muzzleDev(g,u,{muzzle:opt},{cat:'ar'}); }
      else if(slot==='barrel'){ const L=opt==='long'?0.62:opt==='short'?0.3:0.45, r=opt==='heavy'?0.0145:0.0105;
        cy(g,M.steel,-L/2,L/2,0,r); cy(g,M.steel,-L/2-0.012,-L/2+0.03,0,0.017); bx(g,M.anod,-L/2+0.06,-L/2+0.1,-0.016,0.014,0.03,0.003); cy(g,M.dark,L/2-0.002,L/2+0.001,0,r*0.45); }
      else if(slot==='grip'){ u.hgW=0.022; u.handL=V(0,0); u.under={f:-0.024,y:0.012}; rail(g,M.anod,-0.06,0.06,0.012,0.021); gripDev(g,u,{grip:opt},{cat:'ar'}); }
      else if(slot==='stock'){ const style=opt==='light'?'skel':opt==='heavy'?'prec':opt==='std'?'tele':'fixed'; stock(g,style,{f:0.12,y:0,len:0.25,mat:M.poly,tube:true});
        if(opt==='cheek'||opt==='loops') stockExtra(g,u,{stock:opt},{cat:opt==='loops'?'sg':'sr'}); }
      else if(slot==='mag') mag(g,u,{mag:opt},{f0:-0.036,f1:0.036,y:0.08,len:0.16,lean:0.04,w:0.024,ribs:3,drum:'c'});
    } finally { LOD=pL; FP=pF; }
    g.userData.part=slot+'|'+opt; return g; }
  const pcache=new Map();
  function partTP(slot,opt){ const k=slot+'|'+opt; let src=pcache.get(k); if(!src){ src=flatten(partModel(slot,opt)); pcache.set(k,src); }
    const c=src.clone(true); c.userData=Object.assign({},src.userData); return c; }
  /* third-person copies share geometry per gun + attachment set */
  const cache=new Map();
  /* hi = full detail (the armory's close-up displays) */
  function tp(id,att,hi){ const key=id+'|'+attKey(attClean(id,att))+(hi?'|hi':''); let src=cache.get(key); if(!src){ src=flatten(make(id,att,hi?'show':'tp')); cache.set(key,src); }
    const c=src.clone(true); c.userData=Object.assign({},src.userData); return c; }
  /* a held gun seen from outside is small on screen: bake every part's colour into the vertices and draw the whole gun as ONE mesh
     (was 5-8 draw calls per character, twice with shadows). See-through parts (shield window) stay separate. */
  let tpMat=null; const _c=new THREE.Color(), WOODC=new THREE.Color('#6a3618');
  function flatten(g){ if(!tpMat) tpMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.55,metalness:0.35});
    g.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(g.matrixWorld).invert(), m4=new THREE.Matrix4(), list=[], dead=[];
    g.traverse(o=>{ if(!o.isMesh) return; const mt=o.material; if(mt===M.glassClear||mt===M.tubeIn){ dead.push(o); return; } if(mt.transparent&&mt.opacity<0.5) return;
      const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); geo.applyMatrix4(m4.multiplyMatrices(inv,o.matrixWorld)); for(const k of Object.keys(geo.attributes)) if(k!=='position'&&k!=='normal') geo.deleteAttribute(k);
      if(!geo.attributes.normal) geo.computeVertexNormals(); _c.copy(mt.color); if(mt.map) _c.multiply(WOODC); const n=geo.attributes.position.count, col=new Float32Array(n*3); for(let i=0;i<n;i++){ col[i*3]=_c.r; col[i*3+1]=_c.g; col[i*3+2]=_c.b; }
      geo.setAttribute('color',new THREE.BufferAttribute(col,3)); list.push(geo); dead.push(o); });
    for(const o of dead){ o.parent.remove(o); o.geometry.dispose(); }
    if(list.length){ const mesh=new THREE.Mesh(list.length>1?THREE.mergeGeometries(list,false):list[0],tpMat); mesh.castShadow=true; g.add(mesh); for(const x of list) if(list.length>1) x.dispose(); }
    return g; }
  /* ---------- first-person hands ----------
     Built from capsules: a palm, four fingers of three joints each curled round what they hold, a thumb, a knuckle guard, a glove cuff with strap,
     and a sleeve with a few folds. Two poses: 'wrap' (fingers round a grip: pistol grips, vertical foregrips, knife handles) and 'cup' (support hand under a handguard).
     look 0 = full black gloves and black sleeves, look 1 = fingerless gloves (skin finger tips) and grey sleeves. */
  const _Y=new THREE.Vector3(0,1,0), V3=(x,y,z)=>new THREE.Vector3(x,y,z);
  function limb(g,mat,a,b,r,r2){ const d=new THREE.Vector3().subVectors(b,a), L=Math.max(0.0005,d.length());
    const geo=r2!=null?new THREE.CylinderGeometry(r2,r,L,12,1):new THREE.CapsuleGeometry(r,L,3,8); const m=new THREE.Mesh(geo,mat); m.position.copy(a).addScaledVector(d,0.5); m.quaternion.setFromUnitVectors(_Y,d.normalize()); g.add(m); return m; }
  function finger(g,pts,r,mat,tip){ for(let i=0;i<pts.length-1;i++) limb(g,i===pts.length-2?tip:mat,pts[i],pts[i+1],r*(1-i*0.06)); }
  function obox(g,mat,c,X,Y,Z,w,h,d,r){ const m=new THREE.Mesh(RB(w,h,d,r),mat); m.position.copy(c); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X,Y,Z)); g.add(m); return m; }
  /* glove cuff + strap + sleeve from the wrist W to the elbow E */
  function sleeve(g,W,E,sl){ const d=new THREE.Vector3().subVectors(E,W).normalize(), at=t=>W.clone().addScaledVector(d,t), L=W.distanceTo(E);
    limb(g,M.glove,at(-0.012),at(0.05),0.0285,0.0315); limb(g,M.poly,at(0.024),at(0.037),0.034,0.034); limb(g,M.steel,at(0.027),at(0.034),0.0348,0.0348);
    limb(g,sl,at(0.042),at(L),0.034,0.05); for(const t of [0.09,0.16,0.25,0.36]) if(t<L-0.02) limb(g,sl,at(t),at(t+0.014),0.0365+t*0.045,0.0375+t*0.045); }
  /* fingers wrapped round a grip. O = middle of the grip, dn = direction down the grip, fw = direction of its front edge, side = +1 right hand / -1 left hand */
  function handWrap(g,O,dn,fw,side,o){ o=o||{}; const wT=o.wT||0.014, wD=o.wD||0.022, tip=o.tip||M.glove, s=V3(side,0,0);
    const P=(x,d,n)=>O.clone().addScaledVector(s,x).addScaledVector(dn,d).addScaledVector(fw,n), up=dn.clone().negate(), Z=new THREE.Vector3().crossVectors(s,up).normalize();
    obox(g,M.glove,P(wT+0.011,0.002,-0.003),s,up,Z,0.025,0.09,0.058,0.011); obox(g,M.glove,P(0.004,0.006,-wD-0.007),s,up,Z,0.04,0.082,0.022,0.01);
    const n=o.index?3:4; for(let k=0;k<n;k++){ const d=(o.index?-0.014:-0.036)+k*0.0215; finger(g,[P(wT+0.009,d,0.01),P(wT+0.003,d,wD+0.0095),P(-wT-0.003,d,wD+0.0085),P(-wT-0.0095,d,0.004)],0.0096-k*0.0003,M.glove,tip); }
    if(o.index) finger(g,[P(wT+0.009,-0.037,0.008),P(wT+0.008,-0.044,0.05),P(wT+0.003,-0.048,0.083)],0.0094,M.glove,tip);
    finger(g,[P(0.006,-0.05,-wD-0.004),P(-wT-0.006,-0.047,-0.004),P(-wT-0.008,-0.052,0.03)],0.0108,M.glove,tip);
    obox(g,M.poly,P(wT+0.0245,-0.012,0.017),s,up,Z,0.006,0.052,0.036,0.003);
    return P(wT+0.008,0.052,-0.014); }
  /* support hand under a handguard. L = point under the handguard, hw = half its width */
  function handCup(g,L,hw,o){ o=o||{}; const tip=o.tip||M.glove, yT=L.y+0.008;
    const pm=new THREE.Mesh(RB(0.076,0.027,0.09,0.012),M.glove); pm.position.set(L.x-0.005,yT-0.0135,L.z); pm.rotation.z=0.14; g.add(pm);
    for(let i=0;i<4;i++){ const z=L.z+(i-1.5)*0.0215; finger(g,[V3(hw+0.003,yT-0.009,z),V3(hw+0.0125,yT+0.019,z),V3(hw+0.0095,yT+0.043,z),V3(hw+0.001,yT+0.054,z)],0.0096-i*0.0003,M.glove,tip); }
    finger(g,[V3(-hw-0.004,yT-0.008,L.z+0.03),V3(-hw-0.0125,yT+0.022,L.z+0.012),V3(-hw-0.009,yT+0.045,L.z-0.014)],0.0108,M.glove,tip);
    const kg=new THREE.Mesh(RB(0.006,0.034,0.076,0.003),M.poly); kg.position.set(hw+0.0235,yT+0.02,L.z); g.add(kg);
    return V3(L.x-0.03,yT-0.028,L.z+0.046); }
  /* first-person arms holding a gun: returns {group, gun, armR, armL}. look: 0 = special forces, 1 = terrorist */
  function viewmodel(id,att,look){ mats(); const root=new THREE.Group(); const gun=make(id,att,'fp'); root.add(gun); const u=gun.userData, sl=look?M.sleeveB:M.sleeve, tip=look?M.skin:M.glove;
    const done=a=>{ a.updateMatrixWorld(true); bake(a); a.traverse(o=>{ if(o.isMesh) o.castShadow=true; }); root.add(a); return a; };
    const hr=u.handR||V3(0,-0.045,0.035), rk=u.gripRk!=null?u.gripRk:(u.pistol?0.27:0.33);
    /* right hand */
    const armR=new THREE.Group(); { let dn, fw, O=hr.clone();
      if(u.melee&&!u.shield&&!u.fists){ dn=V3(0,0,1); fw=V3(0,-1,0); O.set(0.0,0.0,0.03); } else { dn=V3(0,-1,rk).normalize(); fw=V3(0,-rk,-1).normalize(); O.add(V3(0,-0.006,0.006)); }
      const W=handWrap(armR,O,dn,fw,1,{index:!u.melee&&!u.item,tip,wT:u.pistol?0.0115:u.fists?0.005:u.item?0.02:0.014,wD:u.pistol?0.02:u.fists?0.012:0.022});
      sleeve(armR,W,V3(0.13,hr.y-0.3,hr.z+0.3),sl); armR.userData.W=W.clone(); armR.userData.E=V3(0.13,hr.y-0.3,hr.z+0.3); done(armR); }
    /* left hand */
    let armL=null; const mkL=fn=>{ armL=new THREE.Group(); const r=fn(armL); sleeve(armL,r.W,r.E,sl); armL.userData.W=r.W.clone(); armL.userData.E=r.E.clone(); done(armL); };
    if(u.handL&&!u.melee){ const L=u.handL;
      if(u.gripL){ /* a foregrip to hold: wrap it */ const G=u.gripL, dn=V3(0,-1,G.rk||0).normalize(), fw=V3(0,-(G.rk||0),-1).normalize(); mkL(a=>({W:handWrap(a,V3(G.x||0,G.y,G.z),dn,fw,-1,{tip,wT:G.wT||0.0125,wD:G.wD||0.015}),E:V3(-0.21,G.y-0.3,G.z+0.2)})); }
      else mkL(a=>({W:handCup(a,L,u.hgW||0.022,{tip}),E:V3(-0.2,L.y-0.34,L.z+0.2)})); }
    else if(u.pistol&&!u.thrown){ /* two-handed pistol hold: the support hand wraps over the shooting hand */
      const dn=V3(0,-1,rk).normalize(), fw=V3(0,-rk,-1).normalize(), O=hr.clone().add(V3(0,-0.012,0.004)); mkL(a=>({W:handWrap(a,O,dn,fw,-1,{tip,wT:0.0125,wD:0.031}),E:V3(-0.19,hr.y-0.3,hr.z+0.2)})); }
    else if(u.fists||u.item){ const O=V3(-0.22,-0.03,-0.08); mkL(a=>({W:handWrap(a,O,V3(0,-1,0.2).normalize(),V3(0,-0.2,-1).normalize(),-1,{tip,wT:0.005,wD:0.012}),E:V3(-0.3,-0.33,0.3)})); }
    if(u.fists){ gun.visible=false; armR.position.x+=0.02; }
    return {group:root,gun,armR,armL}; }
  /* where the first-person gun rests when not aiming (camera space) */
  const HIP={x:0.12,y:-0.135,z:-0.3,ry:0.07};
  return {make,tp,partTP,viewmodel,mats,HIP};
})();
