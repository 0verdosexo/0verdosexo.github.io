/* ww2.js — the dressing of the WWII trench map (v7.11): wrecked tanks, the windmill and water tower, wire, hedgehogs, poles,
   trees, wheat and reeds, crates and lanterns, bunker furniture, signs, smoke. Visual only — collision lives in the map file.
   Static pieces are merged per material and per 80 m chunk (so far chunks are culled); repeated things are instanced. */
'use strict';
const WW2=(()=>{
  let api=null, root=null, ACC={}, MATS={}, anims=[], lights=[];
  const V3=THREE.Vector3, M4=THREE.Matrix4, Q=THREE.Quaternion, E=THREE.Euler;
  const mtx=(x,y,z,ry,rx,rz,sx,sy,sz)=>new M4().compose(new V3(x,y,z),new Q().setFromEuler(new E(rx||0,ry||0,rz||0,'YXZ')),new V3(sx||1,sy==null?(sx||1):sy,sz==null?(sx||1):sz));
  /* a material by name: world keys (ter:*, st:*, pbr:…) or our own */
  function M(k){ if(MATS[k]) return MATS[k]; let m;
    const S=(c,r,mt,o)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:r==null?0.8:r,metalness:mt||0},o||{}));
    switch(k){
      case 'tigerGrey': m=S('#4a4b45',0.85,0.3); break; case 'tigerDark': m=S('#2c2c29',0.9,0.3); break; case 'scorch': m=S('#2a2622',0.95,0.2); break;
      case 't34': m=S('#4a4a40',0.9,0.25); break; case 'track': m=S('#1e1c19',0.75,0.6); break; case 'rust': m=S('#6a3e24',0.9,0.3); break; case 'htGrey': m=S('#5d6058',0.8,0.3); break;
      case 'steel': m=S('#3d4042',0.5,0.75); break; case 'wire': m=S('#4a4540',0.55,0.7); break; case 'iron': m=S('#2e2c2a',0.6,0.6); break;
      case 'wood': m=S('#6b4e33',0.9); break; case 'woodD': m=S('#4a3624',0.92); break; case 'woodG': m=S('#7d746a',0.95); break; case 'pole': m=S('#4f3d2c',0.95); break;
      case 'birch': m=new THREE.MeshStandardMaterial({map:birchTex(),roughness:0.9}); break; case 'bark': m=S('#4a3a2c',0.95); break;
      case 'leafB': m=S('#6f8a45',0.85,0,{flatShading:true}); break; case 'leafP': m=S('#33462c',0.88,0,{flatShading:true}); break; case 'leafF': m=S('#5f7a3a',0.85,0,{flatShading:true}); break; case 'leafW': m=S('#7c9455',0.85,0,{flatShading:true}); break;
      case 'hay': m=S('#97865a',1.0); break; case 'hayD': m=S('#8a7446',0.95); break; case 'burnt': m=S('#2c2620',0.98); break;
      case 'crateRU': m=new THREE.MeshStandardMaterial({map:crateTex('ru'),roughness:0.85}); break; case 'crateDE': m=new THREE.MeshStandardMaterial({map:crateTex('de'),roughness:0.85}); break;
      case 'helmRU': m=S('#4f5a3a',0.6,0.3); break; case 'helmDE': m=S('#55595a',0.6,0.35); break; case 'cloth': m=S('#5a5446',0.95); break; case 'blanket': m=S('#6a5f4e',0.98); break;
      case 'paper': m=S('#d8cfb4',0.9); break; case 'brass': m=S('#a8843c',0.4,0.8); break; case 'glassY': m=new THREE.MeshStandardMaterial({color:'#ffd79a',emissive:'#ffb24a',emissiveIntensity:1.4,roughness:0.3}); break;
      case 'fire': m=new THREE.MeshBasicMaterial({color:new THREE.Color('#ff7a1e').multiplyScalar(2.2),transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending}); break;
      case 'fire2': m=new THREE.MeshBasicMaterial({color:new THREE.Color('#ffd27a').multiplyScalar(2.4),transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending}); break;
      case 'ember': m=new THREE.MeshBasicMaterial({color:new THREE.Color('#ff5a14').multiplyScalar(1.8)}); break;
      case 'water': { const ts=Assets.texSet('brown_mud_03'); m=new THREE.MeshStandardMaterial({color:'#4c3c27',roughness:0.78,metalness:0.0,envMapIntensity:0.08}); if(ts.normalMap){ const n=ts.normalMap.clone(); n.repeat.set(0.35,0.35); n.needsUpdate=true; m.normalMap=n; m.normalScale.set(0.7,0.7); } break; }
      case 'net': m=new THREE.MeshStandardMaterial({map:netTex(),alphaTest:0.4,side:THREE.DoubleSide,roughness:0.95}); break;
      case 'grass': m=new THREE.MeshStandardMaterial({map:tuftTex('#a89654','#6e6234'),alphaTest:0.45,side:THREE.DoubleSide,roughness:0.95}); break;
      case 'grassB': m=new THREE.MeshStandardMaterial({map:tuftTex('#3a3128','#1e1914'),alphaTest:0.45,side:THREE.DoubleSide,roughness:0.98}); break;
      case 'reed': m=new THREE.MeshStandardMaterial({map:tuftTex('#8a9658','#5c6a3a',true),alphaTest:0.5,side:THREE.DoubleSide,roughness:0.9}); break;
      case 'bag': m=api.mat('ter:bags'); break;
      default: m=api.mat(k); }
    MATS[k]=m; return m; }
  const ct=(w,h,f)=>{ const t=Assets.canvasTex(w,h,f,true); return t; };
  function birchTex(){ return ct(64,256,(g,w,h)=>{ g.fillStyle='#d9d6cc'; g.fillRect(0,0,w,h); const R=mulberry(5); for(let i=0;i<40;i++){ g.fillStyle='rgba(30,28,24,'+(0.5+R()*0.4)+')'; g.fillRect(R()*w,R()*h,4+R()*22,2+R()*4); } }); }
  function crateTex(side){ return ct(256,128,(g,w,h)=>{ g.fillStyle=side==='ru'?'#4f5a32':'#5b5e4c'; g.fillRect(0,0,w,h); const R=mulberry(side==='ru'?3:4);
      for(let i=0;i<5;i++){ g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(0,i*h/5,w,2); } g.fillStyle='rgba(0,0,0,.35)'; g.fillRect(0,0,w,6); g.fillRect(0,h-6,w,6); g.fillRect(0,0,6,h); g.fillRect(w-6,0,6,h);
      g.fillStyle=side==='ru'?'#e8e2c8':'#f0ead8'; g.font='bold 30px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(side==='ru'?'ПАТРОНЫ':'7,92 Patr.',w/2,h*0.42); g.font='bold 20px sans-serif'; g.fillText(side==='ru'?'7,62 · 440 шт':'S.m.K. 1500',w/2,h*0.72);
      for(let i=0;i<300;i++){ g.fillStyle='rgba(255,255,255,.04)'; g.fillRect(R()*w,R()*h,2,2); } }); }
  function netTex(){ const t=ct(128,128,(g,w,h)=>{ g.clearRect(0,0,w,h); const R=mulberry(9); g.strokeStyle='#3b3d2a'; g.lineWidth=2; for(let i=0;i<=w;i+=16){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); }
      for(let i=0;i<120;i++){ g.fillStyle=['#4f5a34','#5f6a3c','#6e6440','#3f4a2c'][i%4]; g.beginPath(); g.ellipse(R()*w,R()*h,4+R()*6,2+R()*4,R()*3,0,7); g.fill(); } }); t.repeat.set(1,1); return t; }
  function tuftTex(c1,c2,reed){ return ct(128,128,(g,w,h)=>{ g.clearRect(0,0,w,h); const R=mulberry(reed?13:11); for(let i=0;i<46;i++){ const x=8+R()*(w-16), lean=(R()-0.5)*26, top=reed?R()*20:20+R()*40;
      g.strokeStyle=R()<0.5?c1:c2; g.lineWidth=reed?2:2; g.beginPath(); g.moveTo(x,h); g.quadraticCurveTo(x+lean*0.4,(h+top)/2,x+lean,top); g.stroke(); if(!reed&&R()<0.3){ g.fillStyle=c1; g.fillRect(x+lean-2,top-6,4,9); } if(reed&&R()<0.18){ g.fillStyle='#5a3e22'; g.beginPath(); g.ellipse(x+lean,top+8,2.5,8,0,0,7); g.fill(); } } }); }
  function textTex(txt,style,w,h){ if(style==='star') return ct(256,256,(g,W,H)=>{ g.fillStyle='#5e4a30'; g.fillRect(0,0,W,H); g.fillStyle='#b51d1d'; g.beginPath(); for(let i=0;i<10;i++){ const r=i%2?46:112, a=-Math.PI/2+i*Math.PI/5; g.lineTo(W/2+Math.cos(a)*r,H/2+8+Math.sin(a)*r); } g.closePath(); g.fill(); g.strokeStyle='#2a2016'; g.lineWidth=10; g.strokeRect(5,5,W-10,H-10); });
    return ct(w||512,h||128,(g,W,H)=>{ const de=style==='de', warn=style==='warn';
      g.fillStyle=warn?'#e9e2c2':de?'#d8d2bc':'#6b5536'; g.fillRect(0,0,W,H); const R=mulberry(hashStr(txt)); for(let i=0;i<400;i++){ g.fillStyle='rgba(0,0,0,.06)'; g.fillRect(R()*W,R()*H,3,2); }
      g.strokeStyle=warn?'#b01818':'#2a2016'; g.lineWidth=8; g.strokeRect(4,4,W-8,H-8); g.fillStyle=warn?'#b01818':de?'#1c1c1c':'#efe6cf'; g.font=`900 ${Math.round(H*0.42)}px sans-serif`; g.textAlign='center'; g.textBaseline='middle';
      g.fillText(txt,W/2,H/2+2,W*0.9); }); }
  function mapTex(side){ return ct(256,160,(g,w,h)=>{ g.fillStyle='#d8cfb2'; g.fillRect(0,0,w,h); g.strokeStyle='rgba(80,110,140,.4)'; g.lineWidth=1; for(let i=0;i<w;i+=16){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,h); g.stroke(); } for(let i=0;i<h;i+=16){ g.beginPath(); g.moveTo(0,i); g.lineTo(w,i); g.stroke(); }
      g.lineWidth=4; for(const [c,y] of [['#b8201c',side==='ru'?50:110],['#1f4aa8',side==='ru'?110:50]]){ g.strokeStyle=c; g.beginPath(); g.moveTo(8,y); for(let x=8;x<w;x+=24) g.lineTo(x,y+Math.sin(x*0.08)*10+((x/24)%2?6:-6)); g.stroke(); }
      g.strokeStyle='#b8201c'; g.lineWidth=3; g.beginPath(); g.moveTo(130,64); g.lineTo(150,90); g.lineTo(144,84); g.stroke(); }); }
  /* ---------- geometry accumulation ---------- */
  function add(mk,geo,m,x,z){ const cx=Math.floor((x||0)/80), cz=Math.floor((z||0)/80), key=mk+'|'+cx+'|'+cz; let g=geo.index?geo.toNonIndexed():geo.clone(); if(m) g.applyMatrix4(m);
    for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') g.deleteAttribute(k); if(!g.attributes.uv) g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    (ACC[key]=ACC[key]||{mk,list:[]}).list.push(g); }
  const BX=(mk,w,h,d,m,x,z)=>add(mk,new THREE.BoxGeometry(w,h,d),m,x,z);
  const CY=(mk,r0,r1,h,seg,m,x,z)=>add(mk,new THREE.CylinderGeometry(r0,r1,h,seg||10),m,x,z);
  function flushAcc(){ for(const k in ACC){ const A=ACC[k]; const g=THREE.mergeGeometries(A.list,false); A.list.forEach(q=>q.dispose()); if(!g) continue; g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,M(A.mk)); mesh.castShadow=QUALITY.shadow>0&&!/fire|ember|grass|reed|net|water/.test(A.mk); mesh.receiveShadow=true; mesh.matrixAutoUpdate=false; mesh.updateMatrix(); root.add(mesh); } ACC={}; }
  /* local builder: pieces in an object's own frame, placed with one matrix */
  function piece(base){ return { m:base, box:(mk,w,h,d,x,y,z,ry,rx,rz)=>BX(mk,w,h,d,base.clone().multiply(mtx(x,y,z,ry,rx,rz)),base.elements[12],base.elements[14]),
    cyl:(mk,r0,r1,h,seg,x,y,z,ry,rx,rz)=>CY(mk,r0,r1,h,seg,base.clone().multiply(mtx(x,y,z,ry,rx,rz)),base.elements[12],base.elements[14]),
    geo:(mk,geo,x,y,z,ry,rx,rz,s)=>add(mk,geo,base.clone().multiply(mtx(x,y,z,ry,rx,rz,s)),base.elements[12],base.elements[14]) }; }
  /* ---------- instancing ---------- */
  function inst(geo,mat,list,shadow){ if(!list.length) return; const im=new THREE.InstancedMesh(geo,mat,list.length); list.forEach((m,i)=>im.setMatrixAt(i,m)); im.instanceMatrix.needsUpdate=true;
    im.castShadow=!!shadow&&QUALITY.shadow>0; im.receiveShadow=true; im.computeBoundingSphere&&im.computeBoundingSphere(); root.add(im); return im; }
  /* ---------- the build ---------- */
  async function build(r,def,a){ api=a; root=new THREE.Group(); root.name='ww2'; r.add(root); ACC={}; anims=[]; lights=[]; const W=def.ww2;
    trees(W.trees); wire(W.wire); hedge(W.hedge); poles(W.poles); for(const w of W.wrecks) wreck(w);
    for(const w of W.water) water(w); crates(W.crates); for(const l of W.lanterns) lantern(l); for(const s of W.signs) sign(s); fields(W.wheat,W.reeds,W.sunflower); for(const f of W.fence) fence(f);
    for(const r2 of W.rubble) rubble(r2); for(const n of W.nets) net(n); for(const s of W.stoves) stove(s); for(const t of W.tables) table(t); for(const b of W.bunks) bunk(b); for(const m of W.mortars) mortar(m);
    duck(W.planks); for(const s of W.steps) step(s); const bags=[]; for(const m of W.misc) misc(m,bags); bagInst(bags); rifles(W.rifles); smokes(W.smokes); grassField(W.reeds); bagLay(); skirt(); posts();
    flushAcc(); root.traverse(o=>{ if(o.isMesh&&!o.isInstancedMesh){ o.matrixAutoUpdate=false; o.updateMatrix(); } });
    api.anims.push({t:'ww2',update:update}); return root; }
  /* trees (v7.11): bark trunk and branches + leaf-cluster cards (Poly Haven leaves), two shapes per kind, instanced with tinted copies */
  const TK={ birch:{h:9.5,tr:0.55,r:0.2,nb:5,cr:2.7,ry:0.95,nc:56,cs:2.4,tint:'#f2f7d2'}, pine:{h:12.5,tr:0.42,r:0.25,nb:6,cr:2.4,ry:1.6,nc:62,cs:2.4,tint:'#d9e4c2'},
    fruit:{h:4.6,tr:0.4,r:0.14,nb:4,cr:1.9,ry:0.75,nc:32,cs:1.8,tint:'#f0f5c8'}, willow:{h:7.5,tr:0.4,r:0.34,nb:6,cr:3.5,ry:0.72,nc:64,cs:2.6,tint:'#f4fbd6'},
    dead:{h:7.5,tr:0.95,r:0.22,nb:4,cr:2.2,ry:1,nc:0,cs:0,tint:'#fff'}, far:{h:11,tr:0.4,r:0.25,nb:3,cr:3.2,ry:1.1,nc:16,cs:3.6,tint:'#d2dcbc'} };
  function treeGeo(o,seed,dead){ const R=mulberry(seed), Wd=[], Lf=[], th=o.h*o.tr, ends=[];
    Wd.push(new THREE.CylinderGeometry(o.r*(dead?0.35:0.55),o.r,th,7,3).translate(0,th/2,0));
    for(let i=0;i<o.nb;i++){ const a=i/o.nb*6.283+R()*0.9, up=dead?0.6+R()*0.7:0.45+R()*0.6, len=o.cr*(dead?0.5+R()*0.5:0.75+R()*0.45), y0=th*(dead?0.45+R()*0.5:0.62+R()*0.38);
      const dir=new V3(Math.cos(a)*Math.cos(up),Math.sin(up),Math.sin(a)*Math.cos(up)), g=new THREE.CylinderGeometry(o.r*0.12,o.r*0.32,len,5).translate(0,len/2,0);
      g.applyMatrix4(new M4().makeRotationFromQuaternion(new Q().setFromUnitVectors(new V3(0,1,0),dir))); g.translate(0,y0,0); Wd.push(g); ends.push(new V3(0,y0,0).addScaledVector(dir,len)); }
    const C=new V3(0,o.h-o.cr*o.ry,0);
    for(let i=0;i<o.nc;i++){ let p; if(R()<0.45){ p=ends[Math.floor(R()*ends.length)].clone().add(new V3((R()-0.5)*o.cr*0.8,(R()-0.3)*o.cr*0.6,(R()-0.5)*o.cr*0.8)); }
      else { const u=R()*6.283, v=Math.acos(2*R()-1), rr=Math.cbrt(0.3+0.7*R()); p=new V3(Math.sin(v)*Math.cos(u)*o.cr*rr,Math.cos(v)*o.cr*o.ry*rr,Math.sin(v)*Math.sin(u)*o.cr*rr).add(C); }
      const sz=o.cs*(0.75+R()*0.5), g=new THREE.PlaneGeometry(sz,sz), cell=Math.floor(R()*4), uv=g.attributes.uv; for(let k=0;k<uv.count;k++) uv.setXY(k,(cell%2)*0.5+uv.getX(k)*0.5,(cell>>1)*0.5+uv.getY(k)*0.5);
      g.rotateZ(R()*6.283); g.applyMatrix4(new M4().makeRotationFromEuler(new E((R()-0.5)*1.6,R()*6.283,0))); g.translate(p.x,p.y,p.z);
      const ps=g.attributes.position, nr=g.attributes.normal; for(let k=0;k<ps.count;k++){ const d=new V3(ps.getX(k)-C.x,(ps.getY(k)-C.y)/o.ry,ps.getZ(k)-C.z).normalize(); d.y=d.y*0.75+0.4; d.normalize(); nr.setXYZ(k,d.x,d.y,d.z); }
      Lf.push(g.toNonIndexed()); }
    return {wood:THREE.mergeGeometries(Wd.map(g=>g.toNonIndexed())),leaf:Lf.length?THREE.mergeGeometries(Lf):null}; }
  function leafMat(){ if(MATS.leafCard) return MATS.leafCard; const t=Assets.texSet('leaves').map; return MATS.leafCard=new THREE.MeshStandardMaterial({map:t,alphaTest:0.42,side:THREE.DoubleSide,roughness:0.85,envMapIntensity:1.0}); }
  function barkMat(dead){ const k=dead?'barkDead':'barkT'; if(MATS[k]) return MATS[k]; const b=api.mat('ter:bark'), m=b.clone(); m.color.set(dead?'#6d655c':'#b3a796'); return MATS[k]=m; }
  function trees(L){ const by={}; for(const t of L){ const k=TK[t.k]?t.k:'birch'; (by[k]=by[k]||[]).push(t); }
    for(const k in by){ const o=TK[k], dead=k==='dead', G=[treeGeo(o,hashStr(k)+1,dead),treeGeo(o,hashStr(k)+7,dead)], R=mulberry(hashStr(k)+3);
      for(let v=0;v<2;v++){ const list=by[k].filter((t,i)=>i%2===v); if(!list.length) continue;
        const ms=list.map(t=>mtx(t.x,(t.y!=null?t.y:terrY(t.x,t.z))-0.1,t.z,R()*6.28,(R()-0.5)*(dead?0.25:0.06),(R()-0.5)*(dead?0.25:0.06),(t.s||1)*(0.85+R()*0.3)));
        inst(G[v].wood,barkMat(dead),ms,k!=='far');
        if(G[v].leaf){ const im=inst(G[v].leaf,leafMat(),ms,k!=='far'), base=new THREE.Color(o.tint), c=new THREE.Color();
          for(let i=0;i<ms.length;i++){ c.copy(base).offsetHSL((R()-0.5)*0.05,(R()-0.5)*0.12,(R()-0.5)*0.1); if(list[i].dark) c.multiplyScalar(0.55+R()*0.15); im.setColorAt(i,c); } im.instanceColor.needsUpdate=true; } } } }
  /* grass clumps (Poly Haven grass cards), scattered by the ground mask; also used for reeds */
  function cardMat(){ if(MATS.gcard) return MATS.gcard; const m=new THREE.MeshStandardMaterial({map:Assets.texSet('grasscard').map,alphaTest:0.4,side:THREE.DoubleSide,roughness:0.95,envMapIntensity:0.5});
    m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aCell; varying float vGD;').replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=vec2(mod(aCell,2.0)*0.5,floor(aCell/2.0+0.01)*0.5)+vMapUv*0.5;').replace('#include <project_vertex>','#include <project_vertex>\nvGD=-mvPosition.z;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vGD;').replace('#include <alphatest_fragment>','if(vGD>24.0+fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)*14.0) discard;\n#include <alphatest_fragment>'); };
    m.customProgramCacheKey=()=>'gcard'; return MATS.gcard=m; }
  let CARD=null; function cardGeo(){ if(CARD) return CARD; const q=[]; for(let i=0;i<3;i++) q.push(new THREE.PlaneGeometry(1,0.62).translate(0,0.31,0).rotateY(i*Math.PI/3).toNonIndexed());
    const g=THREE.mergeGeometries(q), n=g.attributes.normal; for(let k=0;k<n.count;k++) n.setXYZ(k,0,1,0); return CARD=g; }
  function cards(P){ const CH={}; for(const p of P){ const key=Math.floor(p.x/48)+'|'+Math.floor(p.z/48); (CH[key]=CH[key]||[]).push(p); }
    for(const k in CH){ const L=CH[k], g=cardGeo().clone(); g.setAttribute('aCell',new THREE.InstancedBufferAttribute(new Float32Array(L.map(p=>p.cell)),1));
      const im=inst(g,cardMat(),L.map(p=>p.m),false), c=new THREE.Color(); im.receiveShadow=false; L.forEach((p,i)=>{ c.set(p.c); im.setColorAt(i,c); }); im.instanceColor.needsUpdate=true; } }
  function grassField(reeds){ const T=typeof TERR!=='undefined'?TERR:null; if(!T||!T._mask) return; const mk=T._mask, R=mulberry(91), lite=QUALITY.lite||QUALITY.flatTex, step=lite?1.5:0.95, P=[], Wm=T.nx*T.res, Hm=T.nz*T.res;
    const dry=new THREE.Color('#c4b98c'), grn=new THREE.Color('#9fb070'), c=new THREE.Color();
    const at=(x,z,ch)=>mk.data[(Math.min(mk.h-1,Math.floor(z*mk.px))*mk.w+Math.min(mk.w-1,Math.floor(x*mk.px)))*4+ch]/255;
    for(let x=4.5;x<Wm-4.5;x+=step) for(let z=4.5;z<Hm-4.5;z+=step){ const px=x+R()*step, pz=z+R()*step, g=at(px,pz,0), w=at(px,pz,1);
      if(w>0.3||(g<0.62&&R()>0.02)||R()>0.12+g*0.5) continue; const y=terrY(px,pz);
      if(Math.abs(terrY(px+0.45,pz)-y)>0.25||Math.abs(terrY(px-0.45,pz)-y)>0.25||Math.abs(terrY(px,pz+0.45)-y)>0.25||Math.abs(terrY(px,pz-0.45)-y)>0.25) continue;
      if(typeof pointHit==='function'&&pointHit(px,y+0.3,pz)) continue;
      const sc=0.45+R()*0.55; c.copy(dry).lerp(grn,R()*0.8).multiplyScalar(1.9+R()*0.5);
      P.push({x:px,z:pz,cell:Math.floor(R()*4),c:c.getHex(),m:mtx(px,y-0.04,pz,R()*6.28,(R()-0.5)*0.15,(R()-0.5)*0.15,sc,sc*(0.75+R()*0.6),sc)}); }
    for(const f of reeds||[]) for(let x=f.x0;x<f.x1;x+=0.7) for(let z=f.z0;z<f.z1;z+=0.7){ if(R()<0.25) continue; const px=x+R()*0.7, pz=z+R()*0.7, y=terrY(px,pz), sc=0.8+R()*0.5;
      c.set('#9fae6e').multiplyScalar(0.8+R()*0.3); P.push({x:px,z:pz,cell:Math.floor(R()*4),c:c.getHex(),m:mtx(px,y-0.05,pz,R()*6.28,0,0,sc,sc*(2.0+R()*0.9),sc)}); }
    cards(P); }
  /* sandbags (v7.11): every sandbag block in the map is laid as courses of pillow-shaped bags (visual; the block stays the collision) */
  function bagGeo(){ const g=new THREE.BoxGeometry(1,1,1,2,1,1), p=g.attributes.position;
    for(let i=0;i<p.count;i++){ let x=p.getX(i), y=p.getY(i), z=p.getZ(i); const ex=Math.abs(x)>0.4, ez=Math.abs(z)>0.4;
      y*=ex?0.45:1; if(ex&&ez) y*=0.6; x*=1-Math.abs(y)*0.3; z*=(Math.abs(x)<0.1?1.08:0.88)-(Math.abs(y)>0.4?0.2:0); p.setXYZ(i,x*0.6,y*0.24,z*0.34); }
    const n=g.toNonIndexed(); n.computeVertexNormals(); return n; }
  function bagLay(){ if(typeof SOL==='undefined') return; const R=mulberry(57), CH={}, c=new THREE.Color(), cols=[];
    for(const s of SOL){ if(s.k!=='sandbag') continue; const lx=s.x1-s.x0, lz=s.z1-s.z0, alongX=lx>=lz, L=alongX?lx:lz, D=alongX?lz:lx, H=s.y1-s.y0;
      const nl=Math.max(1,Math.round(H/0.16)), hh=H/nl, nd=Math.max(1,Math.round(D/0.33)), dd=D/nd;
      for(let l=0;l<nl;l++){ const off=(l%2)*0.29, na=Math.max(1,Math.floor((L-off)/0.58)), aa=(L-off)/na;
        for(let d=0;d<nd;d++){ if(nd>2&&l<nl-1&&d>0&&d<nd-1) continue;
          for(let a=0;a<na;a++){ const u=off+aa*(a+0.5), v=dd*(d+0.5), x=alongX?s.x0+u:s.x0+v, z=alongX?s.z0+v:s.z0+u, y=s.y0+hh*(l+0.5);
            const wide=nd>3, m=mtx(x+(R()-0.5)*(wide?0.16:0.04),y+(wide?(R()-0.5)*0.06:0),z+(R()-0.5)*(wide?0.16:0.04),(alongX?0:Math.PI/2)+(R()-0.5)*(wide?0.7:0.12),(R()-0.5)*(wide?0.16:0.06),(R()-0.5)*(wide?0.16:0.08),aa/0.58*(0.97+R()*0.06),hh/0.16*(0.95+R()*0.1),dd/0.33*(0.96+R()*0.08));
            const key=Math.floor(x/48)+'|'+Math.floor(z/48); (CH[key]=CH[key]||[]).push(m); c.set('#c2ad88').lerp(new THREE.Color('#6e5c43'),R()*1.2).multiplyScalar(0.85+R()*0.18); (CH[key].c=CH[key].c||[]).push(c.getHex()); } } } }
    const g=bagGeo(), mt=api.mat('ter:burlap'); for(const k in CH){ const im=inst(g,mt,CH[k],true); CH[k].c.forEach((h,i)=>{ c.setHex(h); im.setColorAt(i,c); }); im.instanceColor.needsUpdate=true; } }
  /* land beyond the play area: a field skirt to the fogged horizon and belts of forest */
  function posts(){ const T=typeof TERR!=='undefined'?TERR:null; if(!T||!T.wall) return; const Rs=T.res, nx=T.nx, nz=T.nz, L=[], R=mulberry(13);
    for(let j=1;j<nz-1;j++) for(let i=1;i<nx-1;i++){ const k=j*nx+i, h=T.h[k], wk=T.wall[k]; if(!(wk===1||wk===4)||h>-1.0) continue;
      for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const q=(j+b)*nx+i+a; if(T.h[q]<h+1.2) continue; if((a?j:i)%3) continue;
        const x=(i+0.5+a*0.5)*Rs-a*0.07, z=(j+0.5+b*0.5)*Rs-b*0.07, top=T.h[q]+0.12; L.push(mtx(x,(h+top)/2,z,R()*0.3,0,0,1,top-h,1)); } }
    if(L.length) inst(new THREE.BoxGeometry(0.15,1,0.15),M('woodD'),L,true); }
  let SK=null; function skirtH(x,z){ if(!SK) return 0; const dx=Math.max(0,-x,x-SK.W), dz=Math.max(0,-z,z-SK.H), d=Math.hypot(dx,dz), f=Math.min(1,Math.max(0,(d-4)/120)), e=f*f*(3-2*f);
    return e*(12+Math.sin(x*0.011+1.3)*10+Math.sin(z*0.013+0.4)*9+Math.sin((x+z)*0.006)*11+Math.sin(x*0.031-z*0.027)*4)-0.03; }
  function skirt(){ const T=typeof TERR!=='undefined'?TERR:null; if(!T) return; const Wm=T.nx*T.res, Hm=T.nz*T.res, F=2600, m=api.mat('ter:skirt'); SK={W:Wm,H:Hm};
    for(const [x0,z0,x1,z1] of [[-F,-F,Wm+F,0],[-F,Hm,Wm+F,Hm+F],[-F,0,0,Hm],[Wm,0,Wm+F,Hm]]){ const sx=Math.max(1,Math.round((x1-x0)/26)), sz=Math.max(1,Math.round((z1-z0)/26)), g=new THREE.PlaneGeometry(x1-x0,z1-z0,sx,sz).rotateX(-Math.PI/2).translate((x0+x1)/2,0,(z0+z1)/2);
      const uv=g.attributes.uv, ps=g.attributes.position; for(let i=0;i<uv.count;i++){ const x=ps.getX(i), z=ps.getZ(i); ps.setY(i,skirtH(x,z)); uv.setXY(i,x/9,-z/9); } g.computeVertexNormals(); const me=new THREE.Mesh(g,m); me.receiveShadow=true; root.add(me); }
    const R=mulberry(404), L=[], cl=(x,z)=>Math.sin(x*0.031+z*0.017)*0.5+Math.sin(x*0.083-z*0.061+1.7)*0.35+Math.sin(z*0.05+2.1)*0.3;
    const belt=(x0,z0,x1,z1,n)=>{ for(let i=0,c=0;i<n*4&&c<n;i++){ const x=x0+R()*(x1-x0), z=z0+R()*(z1-z0); if(cl(x,z)<0.05&&R()<0.92) continue; const big=R()<0.25; L.push({x,z,k:R()<0.3?'pine':big?'willow':'birch',s:big?0.9+R()*0.8:0.5+R()*1.3,y:skirtH(x,z),dark:1}); c++; } };
    belt(-60,-110,Wm+60,-55,110); belt(-60,Hm+45,Wm+60,Hm+110,240); belt(-140,-40,-55,Hm+40,170); belt(Wm+50,-40,Wm+150,Hm+40,170);
    for(let i=0;i<40;i++){ const a=R()*6.283, d=200+R()*260; const fx=Wm/2+Math.cos(a)*d*1.3, fz=Hm/2+Math.sin(a)*d; L.push({x:fx,z:fz,k:'far',s:0.9+R()*0.7,y:skirtH(fx,fz)}); }
    trees(L); }
  const terrY=(x,z)=>typeof terrH==='function'?terrH(x,z):0;
  /* concertina wire on screw pickets */
  function wire(L){ const pts=[], N=90; for(let i=0;i<=N;i++){ const t=i/N, a=t*Math.PI*2*6; pts.push(new V3((t-0.5)*2.6,0.5+Math.sin(a)*0.45,Math.cos(a)*0.55)); }
    const coil=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),96,0.012,3,false); const post=new THREE.BoxGeometry(0.05,1.25,0.05).translate(0,0.62,0); const coils=[], posts=[];
    for(const s of L){ const dx=s.x1-s.x0, dz=s.z1-s.z0, len=Math.hypot(dx,dz), ry=-Math.atan2(dz,dx), n=Math.max(1,Math.round(len/2.5));
      for(let i=0;i<n;i++){ const t=(i+0.5)/n, x=s.x0+dx*t, z=s.z0+dz*t; coils.push(mtx(x,terrY(x,z),z,ry,0,0,len/n/2.5,1,1)); for(const o of [-0.75,0.75]){ const px=x+Math.sin(ry)*o, pz=z+Math.cos(ry)*o; posts.push(mtx(px,terrY(px,pz),pz,ry,(Math.random()-0.5)*0.15)); } } }
    inst(coil,M('wire'),coils,false); inst(post,M('iron'),posts,true); }
  function hedge(L){ const g=THREE.mergeGeometries([0,1,2].map(i=>new THREE.BoxGeometry(2.0,0.21,0.21).rotateZ(i===2?0:(i?0.95:-0.95)).rotateY(i*2.1).translate(0,0.68,0)));
    inst(g,M('rust'),L.map(h=>mtx(h.x,terrY(h.x,h.z),h.z,h.rot,0.05,0)),true); }
  function poles(L){ for(const p of L){ const y=terrY(p.x,p.z), b=piece(mtx(p.x,y,p.z,p.rot,0,p.lean)); b.cyl('pole',0.11,0.15,7.2,7,0,3.6,0); b.box('pole',1.8,0.12,0.12,0,6.6,0); for(const o of [-0.7,-0.25,0.25,0.7]) b.cyl('paper',0.04,0.05,0.12,6,o,6.75,0); }
    for(let i=1;i<L.length;i++){ const a=L[i-1], b2=L[i]; for(const o of [-0.7,0.25]){ const pts=[]; const ax=a.x+Math.sin(a.lean)*6.6*Math.cos(a.rot)+o*Math.cos(a.rot), az=a.z-o*Math.sin(a.rot), bx=b2.x+o*Math.cos(b2.rot), bz=b2.z-o*Math.sin(b2.rot);
        for(let k=0;k<=12;k++){ const t=k/12; pts.push(new V3(ax+(bx-ax)*t,6.7-Math.sin(t*Math.PI)*1.6-(o<0?1.2*t:0)+terrY(ax,az)*(1-t)+terrY(bx,bz)*t,az+(bz-az)*t)); }
        const ln=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#1c1c1c'})); root.add(ln); } } }
  /* ---------- tanks ---------- */
  function wheels(b,mk,xs,z,r,w,y){ for(const x of xs) b.cyl(mk,r,r,w,12,x,y,z,0,Math.PI/2,0); }
  function wreck(w){ const base=mtx(w.x,w.y,w.z,w.rot,w.tilt||0,w.roll||0), b=piece(base);
    if(w.t==='tiger'){ const G='tigerGrey', Dk='tigerDark', K='track';
      /* chamfered armour plates */
      const cb=(w2,h2,d2,c)=>{ c=Math.min(c||0.05,w2/3,h2/3); const sh=new THREE.Shape(); sh.moveTo(-w2/2+c,-h2/2); sh.lineTo(w2/2-c,-h2/2); sh.lineTo(w2/2,-h2/2+c); sh.lineTo(w2/2,h2/2-c); sh.lineTo(w2/2-c,h2/2); sh.lineTo(-w2/2+c,h2/2); sh.lineTo(-w2/2,h2/2-c); sh.lineTo(-w2/2,-h2/2+c); sh.closePath();
        const g=new THREE.ExtrudeGeometry(sh,{depth:d2-2*c,bevelEnabled:true,bevelThickness:c,bevelSize:0,bevelSegments:1}); g.translate(0,0,-(d2-2*c)/2); return g; };
      b.geo(G,cb(6.0,0.95,1.9,0.04),0,0.98,0); b.geo(G,cb(6.3,0.8,3.5,0.07),0.05,1.82,0); b.geo(G,cb(1.0,0.82,3.4,0.05),3.0,1.72,0,0,0,-0.17); b.geo(G,cb(1.4,0.8,1.9,0.05),3.25,1.0,0,0,0,-0.95);
      b.geo(G,cb(0.9,0.75,3.3,0.05),-3.05,1.68,0,0,0,0.1); b.box(Dk,0.36,0.14,0.55,3.5,2.02,0.72); b.cyl(Dk,0.1,0.12,0.2,10,3.55,1.86,-0.78,0,0,Math.PI/2);
      for(const z of [-0.45,0.45]){ b.cyl(Dk,0.1,0.1,0.75,10,-3.42,2.15,z); b.cyl('rust',0.13,0.13,0.5,10,-3.42,2.3,z); }
      b.box('scorch',1.8,0.03,3.0,-2.2,2.23,0); b.cyl('steel',0.25,0.25,0.06,12,-1.0,2.24,0.9); b.cyl('steel',0.25,0.25,0.06,12,-1.0,2.24,-0.9);
      for(const s2 of [-1,1]){ const z=s2*1.42;
        b.box(K,6.6,0.12,0.74,0,0.2,z); b.box(K,6.4,0.12,0.74,0,1.46,z); b.cyl(K,0.6,0.6,0.74,16,3.25,0.83,z,0,Math.PI/2,0,1); b.cyl(K,0.6,0.6,0.74,16,-3.2,0.83,z,0,Math.PI/2,0);
        for(let x=-3.2;x<=3.2;x+=0.26){ b.box(Dk,0.1,0.05,0.76,x,0.12,z); b.box(Dk,0.1,0.05,0.76,x,1.54,z); }
        for(let i=0;i<8;i++){ const x=-2.6+i*0.74, zz=s2*(i%2?1.18:1.62); b.cyl(Dk,0.41,0.41,0.11,18,x,0.64,zz,0,Math.PI/2,0); b.cyl('steel',0.14,0.14,0.13,10,x,0.64,zz+s2*0.01,0,Math.PI/2,0); b.cyl(Dk,0.05,0.05,0.16,6,x,0.64,zz+s2*0.04,0,Math.PI/2,0); }
        b.cyl('steel',0.44,0.44,0.5,14,3.2,0.9,z,0,Math.PI/2,0); for(let k=0;k<12;k++){ const an=k/12*6.283; b.box(Dk,0.1,0.1,0.52,3.2+Math.cos(an)*0.48,0.9+Math.sin(an)*0.48,z,0,0,an); }
        b.cyl(Dk,0.4,0.4,0.48,14,-3.2,0.86,z,0,Math.PI/2,0);
        b.box(G,6.5,0.04,0.66,0.05,2.23,s2*1.47); b.box(G,0.7,0.04,0.66,3.45,2.05,s2*1.47,0,0,-0.45);
        b.box('woodD',1.0,0.07,0.12,-1.6,2.0,s2*1.79); b.box('steel',0.7,0.05,0.12,-0.3,2.05,s2*1.79); b.box(Dk,0.45,0.32,0.14,0.9,1.95,s2*1.8);
        b.geo('steel',new THREE.TorusGeometry(1.4,0.025,4,24,Math.PI),0.4,1.62,s2*1.79,0,0,0,1); }
      decal(b,'cross',0.9,0.85,-0.6,1.75,1.79,0); decal(b,'cross',0.9,0.85,-0.6,1.75,-1.79,Math.PI);
      /* horseshoe turret, mantlet, 8.8 cm gun with a double-baffle muzzle brake */
      const t=piece(base.clone().multiply(mtx(-0.35,2.24,0,0.35))), ts=new THREE.Shape(); ts.moveTo(1.15,-1.42); ts.lineTo(1.15,1.42); ts.absellipse(-0.25,0,1.48,1.5,Math.PI*0.45,Math.PI*1.55,false); ts.lineTo(1.15,-1.42);
      const tg=new THREE.ExtrudeGeometry(ts,{depth:0.88,bevelEnabled:true,bevelThickness:0.05,bevelSize:0.05,bevelSegments:2,curveSegments:18}); tg.rotateX(-Math.PI/2); t.geo(G,tg,0,0.05,0);
      t.geo(G,cb(0.45,0.9,1.95,0.12),1.38,0.5,0); t.cyl(Dk,0.2,0.2,0.4,12,1.75,0.52,0,0,0,Math.PI/2);
      t.cyl(G,0.11,0.14,5.1,14,4.35,0.52,0,0,0,Math.PI/2); t.cyl(Dk,0.17,0.17,0.2,14,7.0,0.52,0,0,0,Math.PI/2); t.cyl(Dk,0.17,0.17,0.2,14,7.32,0.52,0,0,0,Math.PI/2); t.cyl(G,0.1,0.1,0.18,10,7.16,0.52,0,0,0,Math.PI/2);
      t.cyl(Dk,0.42,0.46,0.3,16,-0.7,1.08,0.6); for(let k=0;k<6;k++){ const an=k/6*6.283; t.box('steel',0.1,0.08,0.06,-0.7+Math.cos(an)*0.44,1.12,0.6+Math.sin(an)*0.44,-an); } t.cyl(Dk,0.36,0.36,0.04,14,-1.05,1.3,0.6,0,0,1.1);
      t.cyl(Dk,0.18,0.18,0.06,10,0.3,0.96,-0.5); t.geo(G,cb(0.95,0.5,1.5,0.05),-1.85,0.55,0);
      for(const s2 of [-1,1]){ for(let i=0;i<3;i++){ t.cyl(Dk,0.05,0.05,0.28,8,0.85,0.75+i*0.12,s2*1.2,0,0,0.6); } for(let i=0;i<4;i++) t.box(K,0.3,0.08,0.62,-0.85+i*0.36,0.5,s2*1.45,0,Math.PI/2,0); }
      t.box('scorch',1.3,0.03,1.9,-0.4,0.95,0); decal(t,'211',0.9,0.4,-0.2,0.5,1.5,0);
      const thrown=piece(base.clone().multiply(mtx(2.0,0.05,2.6,0.35))); thrown.box(K,3.2,0.08,0.72,0,0,0); for(let x=-1.5;x<=1.5;x+=0.26) thrown.box(Dk,0.1,0.05,0.74,x,0.05,0);
      fire(w.x-1.4*Math.cos(w.rot),w.y+2.5,w.z+1.4*Math.sin(w.rot),0.8); }
    else if(w.t==='t34'){ b.box('t34',5.6,0.9,2.6,0,0.9,0); b.box('t34',3.0,0.5,2.9,-0.3,1.55,0,0,0,0); b.box('t34',1.4,0.7,2.9,2.0,1.3,0,0,0,-0.6); b.box('scorch',2.2,0.3,2.0,-1.6,1.85,0);
      for(const s of [-1,1]){ b.box('track',6.0,0.2,0.5,0,0.28,s*1.45); b.box('track',5.6,0.18,0.5,0,1.32,s*1.45); wheels(b,'t34',[-2.2,-1.1,0,1.1,2.2],s*1.45,0.42,0.42,0.72); }
      const t=piece(base.clone().multiply(mtx(0.4,1.8,0,-0.5,0,0.18))); t.cyl('t34',1.05,1.25,0.8,8,0,0.4,0); t.cyl('t34',0.07,0.09,3.2,8,2.0,0.45,0,0,0,Math.PI/2+0.05); t.box('scorch',1.6,0.15,1.6,0,0.82,0);
      piece(base.clone().multiply(mtx(-3.6,0,1.2,0.4))).box('track',3.0,0.08,0.5,0,0.04,0); fire(w.x,w.y+1.9,w.z,0.55); }
    else if(w.t==='halftrack'){ b.box('htGrey',5.4,1.2,2.1,0,1.2,0); b.box('htGrey',1.8,0.6,1.8,2.4,1.9,0,0,0,-0.35); b.box('scorch',3.0,0.1,1.9,-0.9,1.82,0);
      for(const s of [-1,1]){ b.box('track',3.0,0.5,0.4,-1.2,0.45,s*1.0); wheels(b,'track',[-2.4,-1.6,-0.8,0],s*1.0,0.36,0.36,0.45); b.cyl('track',0.45,0.45,0.3,12,2.2,0.45,s*1.0,0,Math.PI/2,0); b.box('htGrey',1.0,0.12,0.5,2.2,0.95,s*1.0); } }
    else if(w.t==='track'){ for(let i=0;i<14;i++) b.box('track',0.2,0.08,0.55,i*0.22-1.5,0.04+Math.sin(i*0.6)*0.06,0,0,0,Math.sin(i*0.9)*0.2); } }
  function decal(b,kind,w,h,x,y,z,ry){ const tex=kind==='cross'?ct(128,128,(g,W2,H2)=>{ g.clearRect(0,0,W2,H2); g.fillStyle='#f2f2f2'; g.fillRect(W2*0.38,0,W2*0.24,H2); g.fillRect(0,H2*0.38,W2,H2*0.24); g.fillStyle='#141414'; g.fillRect(W2*0.44,H2*0.06,W2*0.12,H2*0.88); g.fillRect(W2*0.06,H2*0.44,W2*0.88,H2*0.12); })
      :ct(256,128,(g,W2,H2)=>{ g.clearRect(0,0,W2,H2); g.font='900 96px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=8; g.strokeStyle='#f0f0f0'; g.strokeText(kind,W2/2,H2/2); g.fillStyle='#202020'; g.fillText(kind,W2/2,H2/2); });
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:0.8,polygonOffset:true,polygonOffsetFactor:-2}));
    m.matrixAutoUpdate=false; m.matrix.copy(b.m.clone().multiply(mtx(x,y,z,ry))); root.add(m); }
  /* fire + smoke on a wreck */
  function fire(x,y,z,s){ const g=new THREE.Group(); g.position.set(x,y,z); for(let i=0;i<4;i++){ const c=new THREE.Mesh(new THREE.ConeGeometry(0.18*s+i*0.03,0.7*s,7),M(i%2?'fire2':'fire')); c.position.set((Math.random()-0.5)*0.5*s,0.3*s,(Math.random()-0.5)*0.5*s); g.add(c); anims.push({t:'flame',m:c,base:c.position.y,ph:Math.random()*6}); }
    root.add(g); api.lamp('#ff8a3a',9,9,1.8,x,y+0.6,z); }
  /* ---------- water, crates, lanterns, signs ---------- */
  function water(w){ let g; if(w.r){ g=new THREE.CircleGeometry(w.r,28); g.rotateX(-Math.PI/2); g.translate(w.x,w.y,w.z); } else { g=new THREE.PlaneGeometry(w.x1-w.x0,w.z1-w.z0,1,8); g.rotateX(-Math.PI/2); g.translate((w.x0+w.x1)/2,w.y,(w.z0+w.z1)/2); }
    const m=new THREE.Mesh(g,M('water')); m.renderOrder=2; root.add(m); }
  function crates(L){ for(const c of L){ const y=c.y!=null?c.y:terrY(c.x,c.z), b=piece(mtx(c.x,y,c.z,c.rot)), mk=c.k==='de'?'crateDE':'crateRU';
    for(let i=0;i<c.n;i++){ const big=i===0; const w=big?0.8:0.6, h=big?0.45:0.32, d=big?0.45:0.32; b.box(mk,w,h,d,i*0.15,(i===0?0:0.45+(i-1)*0.33)+h/2,(i%2)*0.08,i*0.25); b.box('iron',w+0.02,0.03,0.08,i*0.15,(i===0?0:0.45+(i-1)*0.33)+h-0.02,(i%2)*0.08,i*0.25); } } }
  function lantern(l){ const y=l.y, b=piece(mtx(l.x,y,l.z,0)); b.cyl('iron',0.09,0.1,0.04,8,0,0.0,0); b.cyl('glassY',0.07,0.07,0.16,8,0,0.11,0); b.cyl('iron',0.05,0.09,0.06,8,0,0.22,0); b.box('iron',0.01,0.18,0.01,0,0.34,0);
    if(l.hang) b.box('iron',0.008,0.3,0.008,0,0.55,0); if(l.light||Math.random()<0.5) api.lamp('#ffb35a',l.light===2?45:l.light?10:6,l.light===2?14:l.light?10:7,1.8,l.x,y+0.15,l.z); if(l.light===2) b.geo('glassY',new THREE.SphereGeometry(0.12,8,6),0,0.11,0); }
  function sign(s){ const w=s.style==='star'?0.75:s.txt.length>10?1.9:1.2, h=s.style==='star'?0.75:0.42, y=s.y; const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:textTex(s.txt,s.style),roughness:0.9}));
    m.position.set(s.x,y,s.z); m.rotation.y=s.rot||0; m.rotation.z=(Math.random()-0.5)*0.12; root.add(m); const back=new THREE.Mesh(new THREE.BoxGeometry(w+0.04,h+0.04,0.04),M('woodD')); back.position.copy(m.position); back.rotation.copy(m.rotation); back.translateZ(-0.025); root.add(back);
    if(y>0.3){ const p=new THREE.Mesh(new THREE.BoxGeometry(0.08,y,0.08),M('woodD')); p.position.set(s.x,y/2-0.1,s.z); p.rotation.y=s.rot||0; p.translateZ(-0.07); root.add(p); } }
  /* ---------- fields: wheat (burnt or standing), reeds, sunflowers ---------- */
  function fields(wheat,reeds,sun){ const tuft=new THREE.PlaneGeometry(1.1,1.1).translate(0,0.55,0), cross=THREE.mergeGeometries([tuft.clone().toNonIndexed(),tuft.clone().rotateY(Math.PI/2).toNonIndexed()]);
    const R=mulberry(23), put=(list,area,step,sc)=>{ for(let x=area.x0;x<area.x1;x+=step) for(let z=area.z0;z<area.z1;z+=step){ const px=x+R()*step, pz=z+R()*step; list.push(mtx(px,terrY(px,pz),pz,R()*3,0,0,sc*(0.8+R()*0.5),sc*(0.7+R()*0.6),sc)); } };
    const A=[],Bn=[],Rd=[]; for(const f of wheat) put(f.burnt?Bn:A,f,0.9,1.05); for(const f of reeds) put(Rd,f,1.25,1.45);
    inst(cross,M('grass'),A,false); inst(cross,M('grassB'),Bn,false);
    const stalk=new THREE.CylinderGeometry(0.02,0.03,1.7,5).translate(0,0.85,0), head=new THREE.CylinderGeometry(0.16,0.12,0.08,9).rotateX(1.2).translate(0,1.62,0.12); const S=[];
    for(const f of sun) for(let x=f.x0;x<f.x1;x+=0.7) for(let z=f.z0;z<f.z1;z+=0.8){ const px=x+R()*0.3, pz=z+R()*0.3; S.push(mtx(px,terrY(px,pz),pz,R()*6.28,(R()-0.5)*0.3,(R()-0.5)*0.2,0.8+R()*0.4)); }
    inst(stalk,M('burnt'),S,false); inst(head,M('burnt'),S,false); }
  function fence(f){ const dx=f.x1-f.x0, dz=f.z1-f.z0, len=Math.hypot(dx,dz), b=piece(mtx(f.x0,0,f.z0,-Math.atan2(dz,dx)));
    for(let x=0;x<=len;x+=1.2) b.cyl('woodD',0.04,0.05,1.2,5,x,0.6,0,0,(Math.random()-0.5)*0.1); for(let k=0;k<len;k+=2.4) b.box('ter:wicker',Math.min(2.4,len-k),0.85,0.06,k+Math.min(2.4,len-k)/2,0.5,0,0,0,(Math.random()-0.5)*0.05); }
  function rubble(r){ const R=mulberry(hashStr(''+r.x+r.z)); for(let i=0;i<26;i++){ const a=R()*6.28, d=Math.sqrt(R())*r.r, x=r.x+Math.cos(a)*d, z=r.z+Math.sin(a)*d, s=0.15+R()*0.4*(1-d/r.r+0.3);
      BX(r.k==='metal'?(R()<0.5?'track':'tigerDark'):r.k==='stone'?'ter:conc':R()<0.6?'ter:stone':R()<0.5?'ter:brick':'woodD',s*(1+R()),r.k==='metal'?s*0.35:s,s*(1+R()),mtx(x,terrY(x,z)+s*0.35,z,R()*3,R()*0.6,R()*0.6),x,z); } }
  function net(n){ const g=new THREE.PlaneGeometry(n.w,n.d,8,6); const p=g.attributes.position; for(let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i); p.setZ(i,-Math.abs(Math.sin(x*1.3)*0.25)-(1-Math.min(1,Math.min(n.w/2-Math.abs(x),n.d/2-Math.abs(y))/1.2))*0.9); }
    g.computeVertexNormals(); g.rotateX(-Math.PI/2); const m=new THREE.Mesh(g,M('net')); m.position.set(n.x,n.y,n.z); m.rotation.y=n.rot||0; root.add(m);
    if(n.truck){ const b=piece(mtx(n.x,0,n.z,(n.rot||0))), c=n.truck==='ru'?'t34':'htGrey'; b.box(c,2.2,1.3,2.2,2.2,1.35,0); b.box(c,4.0,0.25,2.3,-0.9,1.05,0); b.box('cloth',4.0,1.5,2.3,-0.9,1.95,0); for(const x of [2.3,-0.2,-2.2]) for(const s of [-1,1]) b.cyl('track',0.48,0.48,0.3,12,x,0.48,s*1.0,0,Math.PI/2,0); } }
  /* ---------- bunker furniture ---------- */
  function stove(s){ const b=piece(mtx(s.x,s.y,s.z,0)); b.cyl('iron',0.32,0.32,0.75,12,0,0.38,0); b.cyl('iron',0.08,0.08,2.0,8,0,1.7,0); b.box('ember',0.2,0.12,0.02,0,0.35,0.32); api.lamp('#ff7a2a',7,6,2,s.x,s.y+0.5,s.z+0.4); }
  function table(t){ const b=piece(mtx(t.x,t.y,t.z,0)); b.box('wood',t.w,0.06,t.d,0,0.78,0); for(const sx of [-1,1]) for(const sz of [-1,1]) b.box('woodD',0.07,0.76,0.07,sx*(t.w/2-0.1),0.38,sz*(t.d/2-0.1));
    const m=new THREE.Mesh(new THREE.PlaneGeometry(t.w*0.7,t.d*0.7),new THREE.MeshStandardMaterial({map:mapTex(t.map),roughness:0.9})); m.rotation.x=-Math.PI/2; m.position.set(t.x,t.y+0.815,t.z); root.add(m);
    b.cyl('iron',0.07,0.08,0.08,8,t.w*0.3,0.86,-t.d*0.25); b.box('woodD',0.22,0.12,0.16,-t.w*0.33,0.87,t.d*0.25); b.geo(t.map==='de'?'helmDE':'helmRU',new THREE.SphereGeometry(0.15,10,6,0,6.28,0,1.5),t.w*0.36,0.81,t.d*0.18); }
  function bunk(k){ const b=piece(mtx(k.x,k.y,k.z,k.rot)); for(const y of [0.45,1.35]){ b.box('wood',k.len,0.08,0.8,0,y,0); b.box('blanket',k.len-0.2,0.1,0.7,0,y+0.09,0); }
    for(const sx of [-1,1]) for(const sz of [-1,1]) b.box('woodD',0.08,1.9,0.08,sx*(k.len/2-0.05),0.95,sz*0.38); }
  function mortar(m){ const b=piece(mtx(m.x,m.y,m.z,m.team==='ru'?Math.PI:0)); b.box('iron',0.5,0.05,0.5,0,0.03,0); b.cyl('iron',0.045,0.045,1.2,8,0,0.6,-0.25,0,-0.75,0); for(const s of [-1,1]) b.box('iron',0.03,0.6,0.03,s*0.22,0.3,0.15,0,0.3,s*0.2);
    for(let i=0;i<4;i++) b.cyl('steel',0.04,0.04,0.32,8,0.8+i*0.1,0.16,0.6); }
  function duck(L){ const slat=new THREE.BoxGeometry(0.12,0.04,1.0), rail=new THREE.BoxGeometry(1,0.05,0.07), S=[], Rl=[];
    for(const p of L){ const along=(p.x1-p.x0)>=(p.z1-p.z0), len=along?p.x1-p.x0:p.z1-p.z0, wd=along?p.z1-p.z0:p.x1-p.x0, ry=along?0:Math.PI/2, cx=(p.x0+p.x1)/2, cz=(p.z0+p.z1)/2;
      for(let t=0.1;t<len;t+=0.24){ const x=along?p.x0+t:cx, z=along?cz:p.z0+t; S.push(mtx(x,p.y+0.06,z,ry,0,0,1,1,wd*0.9)); }
      for(const o of [-wd*0.32,wd*0.32]) Rl.push(mtx(along?cx:cx+o,p.y+0.025,along?cz+o:cz,ry,0,0,len,1,1)); }
    inst(slat,M('ter:duck'),S,false); inst(rail,M('woodD'),Rl,false); }
  function step(s){ BX('woodD',s.x1-s.x0,0.06,0.3,mtx((s.x0+s.x1)/2,s.y+0.03,s.z,0),s.x0,s.z); }
  /* ---------- the rest ---------- */
  function misc(m,bags){ switch(m.t){
    case 'bag': bags.push(mtx(m.x,(m.y!=null?m.y:terrY(m.x,m.z))+0.08,m.z,m.rot)); bags.push(mtx(m.x+0.05,(m.y!=null?m.y:terrY(m.x,m.z))+0.23,m.z,m.rot+0.15)); break;
    case 'helmet': add(m.de?'helmDE':'helmRU',new THREE.SphereGeometry(0.15,10,6,0,6.28,0,1.6),mtx(m.x,m.y,m.z,Math.random()*6,0.5,0.3),m.x,m.z); break;
    case 'ammo42': BX('steel',0.3,0.2,0.12,mtx(m.x,m.y+0.1,m.z,0.4),m.x,m.z); break;
    case 'radio': { const b=piece(mtx(m.x,m.y,m.z,0)); b.box('helmRU',0.45,0.3,0.28,0,0.15,0); b.cyl('iron',0.01,0.01,1.0,4,0.18,0.8,0); b.box('iron',0.3,0.06,0.02,0,0.2,0.15); break; }
    case 'phone': { const b=piece(mtx(m.x,m.y,m.z,0.3)); b.box('woodD',0.24,0.14,0.16,0,0.07,0); b.box('iron',0.22,0.04,0.05,0,0.17,0); break; }
    case 'shelf': { const b=piece(mtx(m.x,m.y,m.z,m.rot)); for(const y of [0.9,1.5]){ b.box('wood',1.6,0.04,0.35,0,y,0); for(let i=0;i<4;i++) b.box(i%2?'crateRU':'iron',0.25,0.22,0.22,-0.6+i*0.4,y+0.13,0); } for(const x of [-0.78,0.78]) b.box('woodD',0.05,1.7,0.35,x,0.85,0); break; }
    case 'curtain': BX('cloth',m.w,0.25,0.25,mtx(m.x,m.y+2.0,m.z,0),m.x,m.z); break;
    case 'wallmap': { const pm=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.9),new THREE.MeshStandardMaterial({map:mapTex(m.de?'de':'ru'),roughness:0.9})); pm.position.set(m.x,m.y,m.z); pm.rotation.y=m.rot||0; root.add(pm); break; }
    case 'rafters': for(let x=m.x0+0.4;x<m.x1;x+=1.2){ BX('woodD',0.14,0.14,(m.z1-m.z0)*0.62,mtx(x,m.y+1.2,m.z0+(m.z1-m.z0)*0.3,0,-0.62),x,m.z0); BX('woodD',0.14,0.14,(m.z1-m.z0)*0.45,mtx(x,m.y+0.9,m.z1-(m.z1-m.z0)*0.22,0,0.5),x,m.z1); }
      BX('woodD',m.x1-m.x0,0.16,0.16,mtx((m.x0+m.x1)/2,m.y+2.5,(m.z0+m.z1)/2,0),m.x0,m.z0); break;
    case 'beams': for(let z=m.z0+0.8;z<m.z1-0.4;z+=1.6){ const broken=Math.random()<0.5; BX('woodD',(m.x1-m.x0)*(broken?0.5:0.9),0.18,0.14,mtx(m.x0+(m.x1-m.x0)*(broken?0.25:0.45),m.y-0.1-(broken?0.4:0),z,0,0,broken?-0.5:0),m.x0,z); } break;
    case 'chimneyTop': BX('ter:brick',1.6,0.3,1.6,mtx(m.x,m.y+0.15,m.z,0),m.x,m.z); break;
    case 'well': { const b=piece(mtx(m.x,0,m.z,0)); for(const s of [-1,1]) b.box('woodD',0.12,2.2,0.12,s*0.85,1.1,0); b.box('woodD',2.0,0.1,0.12,0,2.2,0); b.box('wood',2.2,0.06,1.5,0,2.45,0.4,0,0.5); b.box('wood',2.2,0.06,1.5,0,2.45,-0.4,0,-0.5); b.cyl('woodD',0.12,0.12,1.6,8,0,1.7,0,0,0,Math.PI/2); b.cyl('iron',0.16,0.14,0.28,8,0.3,1.2,0); break; }
    case 'cart': { const b=piece(mtx(m.x,0,m.z,m.rot,0,0,m.s||1)), HR=mulberry(hashStr('hay'+m.x));
      for(let i=0;i<7;i++) b.box('wood',3.6,0.06,0.22,0,0.85,-0.75+i*0.25); b.box('woodD',3.7,0.12,0.12,0,0.78,0.8); b.box('woodD',3.7,0.12,0.12,0,0.78,-0.8);
      for(const s2 of [-1,1]){ for(let i=0;i<5;i++) b.box('wood',0.08,0.5,0.06,-1.6+i*0.8,1.12,s2*0.85); b.box('wood',3.6,0.08,0.06,0,1.35,s2*0.85); b.box('wood',3.6,0.08,0.06,0,1.0,s2*0.85);
        for(const x of [-0.9,1.0]){ b.geo('woodD',new THREE.TorusGeometry(0.58,0.05,6,20),x,0.62,s2*0.97,0,0,0,1); b.cyl('woodD',0.1,0.1,0.18,8,x,0.62,s2*0.97,0,Math.PI/2,0); for(let k=0;k<8;k++){ const an=k/8*Math.PI; b.box('wood',1.12,0.04,0.04,x,0.62,s2*0.97,0,0,an); } } }
      b.box('iron',0.06,0.06,2.0,-0.9,0.62,0); b.box('iron',0.06,0.06,2.0,1.0,0.62,0);
      { const hg=new THREE.SphereGeometry(1,12,8), hp=hg.attributes.position; for(let i=0;i<hp.count;i++){ const y=hp.getY(i); hp.setXYZ(i,hp.getX(i)*(1.3+HR()*0.12),Math.max(-0.05,y)*0.45+HR()*0.05,hp.getZ(i)*(0.62+HR()*0.08)); } hg.computeVertexNormals(); b.geo('hay',hg,0.3,0.9,0,0,0,0,1); }
      b.box('woodD',1.8,0.08,0.08,2.6,0.6,0.3,0.2); b.box('woodD',1.8,0.08,0.08,2.6,0.6,-0.3,-0.2); break; }
    case 'roofGable': { const w=m.x1-m.x0, d=m.z1-m.z0, sl=Math.hypot(d/2,m.h)+0.4, a=Math.atan2(m.h,d/2), R=mulberry(hashStr(''+m.x0));
      const hn0=m.hole?w*m.hole[0]:w*(0.25+R()*0.2), hn1=m.hole?w*m.hole[1]:hn0+w*m.broken*1.1, hs0=m.hole?w*(m.hole[0]+0.08):w*(0.5+R()*0.2), hs1=m.hole?w*(m.hole[1]-0.12):hs0+w*m.broken*0.5; BX('woodD',w+0.3,0.18,0.18,mtx(m.x0+w/2,m.y+m.h,(m.z0+m.z1)/2,0),m.x0,m.z0);
      for(let x=0;x<w;x+=0.9){ const holeN=x+0.45>hn0+R()*0.6&&x+0.45<hn1-R()*0.6, holeS=x+0.45>hs0&&x+0.45<hs1; const cx=m.x0+x+0.45;
        if(!holeN) BX(m.mat||'ter:boards',0.92,0.06,sl,mtx(cx,m.y+m.h/2,m.z0+d/4,0,a),cx,m.z0); else if(R()<0.35) BX('woodD',0.12,0.12,sl*(0.4+R()*0.5),mtx(cx,m.y+m.h*0.3,m.z0+d/4+d*0.08,0,a),cx,m.z0);
        if(!holeS) BX(m.mat||'ter:boards',0.92,0.06,sl,mtx(cx,m.y+m.h/2,m.z1-d/4,0,-a),cx,m.z1); else if(R()<0.35) BX('woodD',0.12,0.12,sl*(0.4+R()*0.5),mtx(cx,m.y+m.h*0.3,m.z1-d/4-d*0.08,0,-a),cx,m.z1); }
      for(const x of [m.x0,m.x1]){ const sh=new THREE.Shape(); sh.moveTo(-d/2,0); sh.lineTo(d/2,0); sh.lineTo(0,m.h); sh.closePath(); add(m.gmat||'ter:boards',new THREE.ShapeGeometry(sh),mtx(x,m.y,(m.z0+m.z1)/2,Math.PI/2),x,m.z0); add(m.gmat||'ter:boards',new THREE.ShapeGeometry(sh),mtx(x,m.y,(m.z0+m.z1)/2,-Math.PI/2),x,m.z0); } break; }
    case 'roofFlat': for(let x=m.x0;x<m.x1-0.5;x+=0.8){ if(Math.random()<0.35) continue; BX('ter:boards',0.8,0.06,m.z1-m.z0+0.4,mtx(x+0.4,m.y+0.05,(m.z0+m.z1)/2,0,0.08),x,m.z0); } break;
    case 'forge': { const b=piece(mtx(m.x,0,m.z,0)); b.box('ter:stone',2,0.95,1.7,0,0.47,0); b.box('ember',1.2,0.05,0.9,0,0.97,0); b.cyl('ter:brick',0.4,0.5,2.2,8,0,2.0,0); api.lamp('#ff6a1a',5,6,2,m.x,1.3,m.z); break; }
    case 'anvil': { const b=piece(mtx(m.x,0,m.z,0.4)); b.cyl('woodD',0.3,0.32,0.55,10,0,0.27,0); b.box('iron',0.7,0.2,0.25,0,0.68,0); b.box('iron',0.3,0.12,0.2,0,0.53,0); break; }
    case 'flag': { const b=piece(mtx(m.x,m.y||0,m.z,0.4)); b.cyl('pole',0.04,0.05,m.h,6,0,m.h/2,0); const t=ct(128,84,(g,w,h)=>{ g.fillStyle='#a3191b'; g.fillRect(0,0,w,h); for(let i=0;i<300;i++){ g.fillStyle='rgba(0,0,0,.08)'; g.fillRect(Math.random()*w,Math.random()*h,3,2); } g.fillStyle='#e8c23a'; g.font='bold 30px sans-serif'; g.fillText('★',10,34); });
      const fm=new THREE.MeshStandardMaterial({map:t,side:THREE.DoubleSide,roughness:0.95}), pg=new THREE.PlaneGeometry(1.3,0.85,8,1), p=pg.attributes.position; for(let i=0;i<p.count;i++) p.setZ(i,Math.sin(p.getX(i)*3.2)*0.09); pg.computeVertexNormals();
      const me=new THREE.Mesh(pg,fm); me.position.set(m.x+0.66*Math.cos(0.4),(m.y||0)+m.h-0.48,m.z-0.66*Math.sin(0.4)); me.rotation.y=0.4; root.add(me); break; }
    case 'pbgun': { const b=piece(mtx(m.x,m.y,m.z,0)); b.box('steel',1.05,0.85,0.16,0,0,0.05); b.cyl('steel',0.26,0.3,0.4,14,0,0,-0.18,0,Math.PI/2,0); b.cyl('steel',0.2,0.24,3.4,14,0,0,-1.95,0,Math.PI/2,0); b.cyl('steel',0.3,0.3,0.9,14,0,0,-0.7,0,Math.PI/2,0); b.cyl('iron',0.3,0.3,0.3,14,0,0,-3.62,0,Math.PI/2,0); b.cyl('iron',0.3,0.3,0.3,14,0,0,-4.0,0,Math.PI/2,0); break; }
    case 'pbroof': { const w=m.x1-m.x0, d=m.z1-m.z0, b=piece(mtx((m.x0+m.x1)/2,m.y,(m.z0+m.z1)/2,0)); b.box('ter:conc',w,0.42,d,0,0.21,0); b.box('iron',1.6,0.08,0.12,0,-1.2,-d/2+0.56); b.box('iron',1.6,0.08,0.12,0,-1.62,-d/2+0.56); b.box('iron',0.08,0.5,0.12,-0.8,-1.41,-d/2+0.56); b.box('iron',0.08,0.5,0.12,0.8,-1.41,-d/2+0.56); break; }
    case 'frame': { const R3=mulberry(hashStr(''+m.a+m.c)), L=m.b-m.a, H2=m.y1-m.y0, d=m.th+0.08, ax=m.ax==='x', at=(u,y)=>ax?mtx(m.a+u,y,m.c,0):mtx(m.c,y,m.a+u,Math.PI/2);
      for(const [u,y,w,h] of [[L/2,m.y0-0.05,L+0.24,0.1],[L/2,m.y1+0.05,L+0.24,0.1],[-0.05,(m.y0+m.y1)/2,0.1,H2],[L+0.05,(m.y0+m.y1)/2,0.1,H2]]) BX('woodD',w,h,d,at(u,y),m.a,m.c);
      for(const [side,u0] of [[1,0],[-1,L]]){ const r=R3(); if(r<0.3) continue; const ang=side*(1.6+r*0.6)*(r<0.5?0.35:1), sw=L/2, g=new THREE.BoxGeometry(sw,H2*0.98,0.04).translate(side*sw/2,0,0);
        add('woodG',g,ax?mtx(m.a+u0,(m.y0+m.y1)/2,m.c-m.th/2-0.04,ang):mtx(m.c-m.th/2-0.04,(m.y0+m.y1)/2,m.a+u0,ang+Math.PI/2),m.a,m.c); } break; }
    case 'mound': { const g=new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2), p=g.attributes.position, HR=mulberry(hashStr('mound'+m.x)); for(let i=0;i<p.count;i++){ const k=1+(HR()-0.5)*0.12; p.setXYZ(i,p.getX(i)*k,p.getY(i)*k,p.getZ(i)*k); } g.computeVertexNormals(); add('ter:mud',g,mtx(m.x,m.y,m.z,0,0,0,m.sx,m.sy,m.sz),m.x,m.z); break; }
    case 'farmill': { const b=piece(mtx(m.x,terrY(m.x,m.z),m.z,0.3)); b.box('woodD',5.6,m.h,5.6,0,m.h/2,0); misc({t:'windmill',x:m.x,z:m.z,h:m.h},[]); break; }
    case 'windmill': { const b=piece(mtx(m.x,0,m.z,0)); b.box('ter:boards',5.6,0.3,5.6,0,m.h+1.15,0); b.box('woodD',4.2,1.6,4.2,0.6,m.h+2.1,0.4,0.3,0.25,0.4);
      const hub=piece(mtx(m.x,m.h+1.6,m.z-3.0,0,0,0.5)); hub.cyl('woodD',0.28,0.28,0.6,8,0,0,0,0,Math.PI/2,0); for(let i=0;i<4;i++){ const a=i*Math.PI/2; if(i===2) continue; const L=i===1?4.5:8; hub.box('woodD',0.22,L,0.12,Math.cos(a+Math.PI/2)*L/2,Math.sin(a+Math.PI/2)*L/2,-0.3,0,0,a);
        if(i!==1) for(let k=1;k<6;k++) hub.box('wood',1.4,0.05,0.04,Math.cos(a+Math.PI/2)*k*1.3+Math.cos(a)*0.7,Math.sin(a+Math.PI/2)*k*1.3+Math.sin(a)*0.7,-0.3,0,0,a); }
      for(const [dx,dz] of [[-2.9,-2.9],[2.9,-2.9],[-2.9,2.9],[2.9,2.9]]) b.box('woodD',0.3,m.h,0.3,dx,m.h/2,dz); break; }
    case 'watertower': { const b=piece(mtx(m.x,0,m.z,0,0,0,m.s||1)); for(const [dx,dz] of [[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]]) b.box('woodD',0.36,14,0.36,dx,7,dz);
      for(let y=3;y<13;y+=3.5){ b.box('woodD',3.6,0.12,0.12,0,y,-1.6,0,0,0.75); b.box('woodD',3.6,0.12,0.12,0,y,1.6,0,0,-0.75); b.box('woodD',0.12,0.12,3.6,-1.6,y,0,0,0.75); b.box('woodD',0.12,0.12,3.6,1.6,y,0,0,-0.75); }
      b.cyl('ter:boards',1.7,1.7,3.0,14,-0.4,16.0,-0.6); b.cyl('rust',1.85,1.85,0.2,14,-0.4,17.6,-0.6); b.cyl('iron',1.78,1.78,0.08,14,-0.4,15.0,-0.6); b.cyl('iron',1.78,1.78,0.08,14,-0.4,16.8,-0.6); break; }
    case 'bridge': { const zm=(m.z0+m.z1)/2, d=m.z1-m.z0, R2=mulberry(77);
      for(let x=m.x0+0.6;x<m.x1;x+=2.2){ if(x>m.gap[0]-0.4&&x<m.gap[1]+0.4) continue; const ground=Math.max((m.wy||-2.62)-0.45,terrY(x,zm)-0.25), h=m.y-0.22-ground;
        for(const z of [m.z0+0.2,zm,m.z1-0.2]) BX('woodD',0.4,h,0.4,mtx(x,ground+h/2,z,0,0,(R2()-0.5)*0.03),x,z); if(x+2.2<m.x1&&!(x+2.2>m.gap[0]-0.4&&x+2.2<m.gap[1]+0.4)) for(const z of [m.z0+0.2,m.z1-0.2]) for(const sg of [-1,1]) BX('woodD',Math.hypot(2.2,h*0.8),0.18,0.14,mtx(x+1.1,ground+h*0.45,z,0,0,sg*Math.atan2(h*0.8,2.2)),x,z);
        BX('woodD',0.3,0.28,d+0.6,mtx(x,m.y-0.36,zm,0),x,m.z0); BX('woodD',0.22,0.18,d,mtx(x,ground+h*0.45,zm,0),x,m.z0);
        if(h>0.8) for(const sg of [-1,1]) BX('woodD',0.16,0.22,Math.hypot(d/2,h),mtx(x+0.16,ground+h/2,zm+sg*d/4,0,sg*Math.atan2(d/2,h)),x,m.z0); }
      for(const [a2,b2] of [[m.x0,m.gap[0]],[m.gap[1],m.x1]]){ for(const z of [m.z0+0.3,zm-0.6,zm+0.6,m.z1-0.3]) BX('woodD',b2-a2,0.26,0.2,mtx((a2+b2)/2,m.y-0.18,z,0),a2,z);
        for(const z of [m.z0+0.05,m.z1-0.05]){ BX('woodD',b2-a2,0.12,0.12,mtx((a2+b2)/2,m.y+1.05,z,0),a2,z); BX('woodD',b2-a2,0.08,0.08,mtx((a2+b2)/2,m.y+0.55,z,0),a2,z); for(let x=a2;x<=b2+0.01;x+=1.1) BX('woodD',0.12,1.15,0.12,mtx(Math.min(x,b2-0.06),m.y+0.55,z,0),x,z); } }
      for(const [gx,dir] of [[m.gap[0],1],[m.gap[1],-1]]) for(let i=0;i<5;i++){ const z=m.z0+0.4+i*(d-0.8)/4; BX('ter:plank',1.6+R2()*0.8,0.06,0.28,mtx(gx+dir*0.6,m.y-0.5-R2()*0.3,z,0,0,dir*(0.5+R2()*0.4)),gx,z); }
      for(let i=0;i<6;i++) BX('ter:plank',0.3,0.06,1.6+R2(),mtx(m.gap[0]+0.8+i*0.8,(m.wy||-2.62)+R2()*0.12,zm+(R2()-0.5)*2,R2()*3,0.1,0.1),m.gap[0],m.z0);
      for(let i=0;i<3;i++) BX('woodD',0.26,0.26,2.2+R2(),mtx(m.gap[0]+1.2+i*1.6,(m.wy||-2.62)+0.1,zm+(R2()-0.5)*1.5,R2()*3,0.3,1.2),m.gap[0],m.z0); break; }
    case 'culvert': { const b=piece(mtx(m.x,terrY(m.x,m.z),m.z,m.rot)); const g=new THREE.CylinderGeometry(0.66,0.66,2.4,16,1,true); b.geo('ter:conc',g,0,0.5,0,0,0,Math.PI/2); b.geo('ter:conc',new THREE.TorusGeometry(0.66,0.08,6,16),1.2,0.5,0,Math.PI/2); break; }
    case 'willow': trees([{x:m.x,z:m.z,k:'willow',s:1}]); break;
    case 'periscope': { const b=piece(mtx(m.x,m.y,m.z,0)); b.box('helmRU',0.12,1.5,0.12,0,0.75,0); b.box('helmRU',0.14,0.12,0.24,0,1.5,0.06); break; }
    case 'plate': { const b=piece(mtx(m.x,terrY(m.x,m.z),m.z,0)); b.box('steel',0.6,0.5,0.04,0,0.42,0); b.box('iron',0.12,0.08,0.05,0,0.5,0); b.box('steel',0.04,0.2,0.3,-0.25,0.12,-0.12); b.box('steel',0.04,0.2,0.3,0.25,0.12,-0.12); break; }
    case 'phoneWire': { const pts=[]; for(let x=m.x0;x<=m.x1;x+=3) pts.push(new V3(x,m.y-Math.abs(Math.sin(x*0.9))*0.15,m.z)); root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#151515'}))); break; }
  } }
  function bagInst(list){ const g=new THREE.RoundedBoxGeometry?new THREE.RoundedBoxGeometry(0.6,0.16,0.35,2,0.06):new THREE.BoxGeometry(0.6,0.16,0.35); inst(g,M('bag'),list,true); }
  /* rifles: leaning on a trench wall in threes, or standing in a rack */
  function rifles(L){ if(typeof Guns==='undefined') return; for(const r of L){ let g=null; try{ g=Guns.tp(r.id); }catch(e){ g=null; } if(!g) continue; const bb=new THREE.Box3().setFromObject(g), butt=bb.max.z;
      if(r.rack){ const b=piece(mtx(r.x,r.y,r.z,r.rot)); b.box('woodD',0.9,0.08,0.3,0,0.12,0); b.box('woodD',0.9,0.06,0.08,0,0.95,-0.1); for(const x of [-0.42,0.42]) b.box('woodD',0.05,1.0,0.3,x,0.5,0); }
      for(let i=0;i<r.n;i++){ const o=g.clone(); const off=r.rack?(-0.3+i*(0.6/Math.max(1,r.n-1))):(i*0.3-0.3);
        const holder=new THREE.Group(); holder.position.set(r.x+Math.cos(r.rot)*off,r.y+0.04,r.z-Math.sin(r.rot)*off); holder.rotation.y=r.rot; const inner=new THREE.Group(); inner.rotation.x=Math.PI/2-(r.rack?0.06:0.3+i*0.04); inner.add(o); holder.add(inner);
        o.position.set(0,0,-butt); o.rotation.set(0,0,i%2?0.2:-0.2); root.add(holder); } } }
  /* smoke columns: billboards that rise, grow and fade, recycled */
  let smokeMat=null; const puffs=[];
  function smokes(L){ smokeMat=new THREE.SpriteMaterial({map:ct(64,64,(g,w,h)=>{ const gr=g.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2); gr.addColorStop(0,'rgba(60,58,54,.85)'); gr.addColorStop(0.6,'rgba(70,68,64,.35)'); gr.addColorStop(1,'rgba(70,68,64,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); }),color:'#8a8680',transparent:true,depthWrite:false,fog:true});
    for(const s of L){ const n=s.fire?10:s.s>2?26:18; for(let i=0;i<n;i++){ const sp=new THREE.Sprite(smokeMat.clone()); if(s.s>2) sp.material.color.set('#3f3b37'); root.add(sp); puffs.push({sp,s,t:i/n}); } } }
  function update(dt,t){ for(const a of anims){ if(a.t==='flame'){ a.m.scale.y=0.75+Math.sin(t*9+a.ph)*0.25+Math.sin(t*23+a.ph)*0.1; a.m.position.y=a.base+Math.sin(t*7+a.ph)*0.04; } }
    /* smoke: rises fast at first, then flattens out and drifts with the wind (east-north-east), so it reads as a leaning plume */
    for(const p of puffs){ const s=p.s, life=s.fire?7:22; p.t+=dt/life; if(p.t>1) p.t-=1; const u=p.t, big=!s.fire&&s.s>2, rise=(s.fire?9:big?19:16)*s.s*Math.sqrt(u), drift=(s.fire?5:big?5:34)*s.s*u, sz=(s.fire?1.0:big?6.5:6)*s.s*(0.55+u*1.5);
      p.sp.position.set(s.x+drift,(s.fire?terrY(s.x,s.z)+2.2:s.low?s.y:4)+rise,s.z-drift*0.35+Math.sin(u*5+s.x)*0.8*s.s); p.sp.scale.set(sz*1.3,sz,1); p.sp.material.opacity=(s.fire?0.5:s.s>2?0.5:0.24)*Math.min(1,u*5)*(1-u)*(1-u*0.3); }
  }
  return {build};
})();
