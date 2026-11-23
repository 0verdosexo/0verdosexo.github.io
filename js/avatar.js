/* avatar.js — animated third-person characters (Quaternius mannequin, CC0) with team colours, gear, a held weapon and name tags.
   Lower body plays locomotion, upper body plays aim/shoot/reload/melee on top. Falls back to a capsule figure. */
'use strict';
const Avatars=(()=>{
  let base=null, ready=false, scale=1, yOff=0; const clips={};
  const LOWER=/^(DEF-hips|DEF-thigh|DEF-shin|DEF-foot|DEF-toe|root)/;
  async function init(){
    if(ready) return; const m=await Assets.character(); ready=true; if(!m) return;
    base=m; const b=m.box, h=b.max.y-b.min.y; scale=1.8/h; yOff=-b.min.y*scale;
    for(const c of m.animations){
      const lower=c.clone(); lower.tracks=c.tracks.filter(t=>LOWER.test(t.name)); lower.name=c.name+'_L';
      const upper=c.clone(); upper.tracks=c.tracks.filter(t=>!LOWER.test(t.name)&&!/^DEF-hips\.position/.test(t.name)); upper.name=c.name+'_U';
      clips[c.name]={full:c,lower,upper}; }
  }
  const LOCO=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Crouch_Idle_Loop','Crouch_Fwd_Loop','Jump_Loop','Roll'];
  const UPPER_LOOP=['Pistol_Idle_Loop','Pistol_Aim_Neutral','Pistol_Aim_Up','Pistol_Aim_Down'];
  const UPPER_ONCE=['Pistol_Shoot','Pistol_Reload','Sword_Attack','Punch_Cross','Interact','Hit_Chest'];
  function nameTag(name,color){ const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d');
    g.font='700 30px "Pretendard","Noto Sans KR",sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=6; g.strokeStyle='rgba(0,0,0,0.7)'; g.strokeText(name,128,32); g.fillStyle=color; g.fillText(name,128,32);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:true,transparent:true})); s.scale.set(1.6,0.4,1); s.renderOrder=5; return s; }
  /* ---------- team looks ----------
     look 0: black SWAT operator — helmet with headset and goggles, balaclava, plate carrier, knee and elbow pads, thigh holster.
     look 1: balaclava, grey long-sleeve top, black magazine vest, olive trousers, black boots, thigh holster.
     The mannequin body and all gear are merged into ONE skinned geometry per look: clothes are vertex colours picked by body part,
     every gear piece rides a single bone. A character is 3 draw calls (cloth, hard parts, team-colour marks) instead of one per gear piece.
     Geometry space: metres, origin at the hips, y up, z forward, T-pose, the character's left is +x. */
  const LOOKS=[
    /* special forces: black tactical kit, kept dark but lifted to charcoal so the shape reads at a distance */
    {head:'#25272c',top:'#2f3238',glove:'#1d1e22',legs:'#2b2e34',boot:'#17181b',joint:'#202227',vest:'#22252a',pouch:'#2d3036',swat:true},
    /* terrorists: grey top, olive trousers, dark balaclava and vest */
    {head:'#232427',top:'#6a6f76',glove:'#202125',legs:'#57603c',boot:'#18181a',joint:null,vest:'#23252a',pouch:'#2e3035',swat:false}
  ];
  const lookGeo=[], MAT={}, ACC=new Map();
  /* visibility (players must be able to spot each other): a soft light along the silhouette, half the distance haze of the world,
     and on dark maps a little self-light so black kit does not vanish into the night. Shared uniforms, set per map by setVis(). */
  const VIS={uRim:{value:new THREE.Color('#9fb4d0').multiplyScalar(0.5)},uRimP:{value:2.6},uLift:{value:0.03},uFogK:{value:0.5},uMul:{value:1}};
  function visPatch(m){ m.onBeforeCompile=sh=>{ Object.assign(sh.uniforms,VIS);
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uRim; uniform float uRimP; uniform float uLift; uniform float uFogK; uniform float uMul;')
        .replace('#include <opaque_fragment>','{ float fr=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),uRimP); outgoingLight=outgoingLight*uMul+uRim*fr+diffuseColor.rgb*uLift; }\n#include <opaque_fragment>')
        .replace('#include <fog_fragment>','#ifdef USE_FOG\n  float fogFactor=smoothstep(fogNear,fogFar,vFogDepth)*uFogK;\n  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);\n#endif'); };
    m.customProgramCacheKey=()=>'charvis'; return m; }
  function setVis(o){ if(o.rim!=null) VIS.uRim.value.set('#9fb4d0').multiplyScalar(o.rim); if(o.lift!=null) VIS.uLift.value=o.lift; if(o.fog!=null) VIS.uFogK.value=o.fog; if(o.mul!=null) VIS.uMul.value=o.mul; }
  function mats(){ if(MAT.cloth) return;
    MAT.cloth=visPatch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.86,metalness:0})); MAT.hard=visPatch(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.4,metalness:0.25}));
    MAT.cloth.userData.shared=MAT.hard.userData.shared=true; }
  function accent(col){ let m=ACC.get(col); if(!m){ m=visPatch(new THREE.MeshStandardMaterial({color:col,roughness:0.6,emissive:col,emissiveIntensity:0.28})); m.userData.shared=true; ACC.set(col,m); } return m; }
  function buildLook(li){ if(lookGeo[li]) return lookGeo[li]; const L=LOOKS[li], srcs=[]; base.scene.traverse(o=>{ if(o.isSkinnedMesh) srcs.push(o); });
    const names=srcs[0].skeleton.bones.map(b=>b.name), bi=n=>Math.max(0,names.indexOf(n)), parts=[[],[],[]], C=new THREE.Color();
    const SI=srcs[0].geometry.attributes.skinIndex, SW=srcs[0].geometry.attributes.skinWeight, one=SW.normalized?(SW.array instanceof Uint8Array?255:65535):1;
    /* the body: colour each vertex by the bone that moves it most */
    srcs.forEach((o,mi)=>{ const g=o.geometry.clone(); for(const k of Object.keys(g.attributes)) if(!['position','normal','skinIndex','skinWeight'].includes(k)) g.deleteAttribute(k);
      for(const k of ['position','normal']){ const at=g.attributes[k]; if(!(at.array instanceof Float32Array)||at.isInterleavedBufferAttribute){ const f=new Float32Array(at.count*3); for(let i=0;i<at.count;i++){ f[i*3]=at.getX(i); f[i*3+1]=at.getY(i); f[i*3+2]=at.getZ(i); } g.setAttribute(k,new THREE.BufferAttribute(f,3)); } }
      const P=g.attributes.position, si=g.attributes.skinIndex, sw=g.attributes.skinWeight, col=new Float32Array(P.count*3);
      for(let i=0;i<P.count;i++){ let b=0,bw=-1; for(let k=0;k<4;k++){ const w=sw.getComponent(i,k); if(w>bw){ bw=w; b=si.getComponent(i,k); } } const n=names[b], y=P.getY(i);
        const c=/head|neck/.test(n)?L.head:/hand|f_|thumb/.test(n)?L.glove:/foot|toe/.test(n)?L.boot:/shin/.test(n)?(y<-0.64?L.boot:(mi&&L.joint)||L.legs):/thigh|hips/.test(n)?(mi&&L.joint&&/thigh/.test(n)&&y<-0.3?L.joint:L.legs):(mi&&L.joint&&/arm/.test(n)?L.joint:L.top);
        C.set(c); col[i*3]=C.r; col[i*3+1]=C.g; col[i*3+2]=C.b; }
      g.setAttribute('color',new THREE.BufferAttribute(col,3));
      /* the joints mesh is mostly tiny knuckle balls on the fingers: thousands of triangles that are never visible in a match — drop them */
      if(mi&&g.index){ const ix=g.index.array, keep=[], fin=i=>{ let b=0,bw=-1; for(let k=0;k<4;k++){ const w=sw.getComponent(i,k); if(w>bw){ bw=w; b=si.getComponent(i,k); } } return /f_|thumb/.test(names[b]); };
        const isF=new Uint8Array(P.count); for(let i=0;i<P.count;i++) isF[i]=fin(i)?1:0;
        for(let i=0;i<ix.length;i+=3) if(!(isF[ix[i]]&&isF[ix[i+1]]&&isF[ix[i+2]])) keep.push(ix[i],ix[i+1],ix[i+2]); g.setIndex(keep); }
      parts[0].push(g); });
    /* gear pieces: grp 0 cloth, 1 hard, 2 team colour */
    const add=(grp,geo,bone,color)=>{ geo.deleteAttribute('uv'); if(!geo.index) geo=THREE.mergeVertices(geo); const n=geo.attributes.position.count, col=new Float32Array(n*3); C.set(color||'#fff');
      const si=new SI.array.constructor(n*4), sw=new SW.array.constructor(n*4), b=bi(bone); for(let i=0;i<n;i++){ col[i*3]=C.r; col[i*3+1]=C.g; col[i*3+2]=C.b; si[i*4]=b; sw[i*4]=one; }
      geo.setAttribute('color',new THREE.BufferAttribute(col,3)); geo.setAttribute('skinIndex',new THREE.BufferAttribute(si,4,SI.normalized)); geo.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4,SW.normalized)); parts[grp].push(geo); };
    const rot=(g,rx,ry,rz)=>{ if(rx||ry||rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx||0,ry||0,rz||0))); return g; };
    const box=(w,h,d,x,y,z,rx,ry,rz)=>rot(new THREE.BoxGeometry(w,h,d),rx,ry,rz).translate(x,y,z);
    const rbox=(w,h,d,r,x,y,z,rx,ry,rz)=>rot(new THREE.RoundedBoxGeometry(w,h,d,1,Math.min(r,Math.min(w,h,d)/2.1)),rx,ry,rz).translate(x,y,z);
    const ell=(rx,ry,rz,x,y,z,tl,tilt)=>{ const g=new THREE.SphereGeometry(1,12,7,0,Math.PI*2,0,tl||Math.PI); g.scale(rx,ry,rz); if(tilt) g.rotateX(tilt); return g.translate(x,y,z); };
    const ring=(rx,rz,h,x,y,z,ax)=>{ const g=new THREE.CylinderGeometry(1,1,h,12,1,true); g.scale(rx,1,rz); if(ax==='x') g.rotateZ(Math.PI/2); return g.translate(x,y,z); };
    const cyl=(r,h,x,y,z,ax,r2)=>{ const g=new THREE.CylinderGeometry(r2==null?r:r2,r,h,8); if(ax==='x') g.rotateZ(Math.PI/2); else if(ax==='z') g.rotateX(Math.PI/2); return g.translate(x,y,z); };
    const CH='DEF-spine003', HP='DEF-hips', HD='DEF-head', V=L.vest, PO=L.pouch;
    /* plate carrier */
    add(0,rbox(0.31,0.33,0.075,0.028,0,0.445,0.106),CH,V); add(0,rbox(0.31,0.36,0.07,0.028,0,0.452,-0.168),CH,V);
    for(const s of [-1,1]){ add(0,rbox(0.045,0.16,0.26,0.012,s*0.166,0.335,-0.03),CH,V); add(0,rbox(0.066,0.036,0.31,0.014,s*0.1,0.638,-0.03),CH,V); }
    for(const x of [-0.092,0,0.092]){ add(0,rbox(0.078,0.13,0.05,0.014,x,0.338,0.162),CH,PO); add(0,box(0.072,0.03,0.008,x,0.385,0.19),CH,V);
      if(!L.swat) add(1,box(0.05,0.034,0.026,x,0.414,0.158),CH,'#2b2c30'); }
    add(0,rbox(0.17,0.075,0.022,0.008,0,0.545,0.152),CH,PO); add(2,box(0.085,0.034,0.006,0,0.548,0.165),CH);
    add(1,rbox(0.055,0.13,0.04,0.008,0.105,0.53,-0.218),CH,'#18191c'); add(1,cyl(0.004,0.22,0.12,0.7,-0.225),CH,'#0c0c0d');
    add(0,rbox(0.2,0.2,0.04,0.014,0,0.42,-0.215),CH,PO); add(2,box(0.12,0.04,0.006,0,0.585,-0.205),CH);
    /* belt, pouches, thigh holster (right leg) */
    add(0,ring(0.152,0.132,0.055,0,0.125,-0.022),HP,'#0e0e10'); add(0,rbox(0.055,0.085,0.045,0.01,0.142,0.12,0.03),HP,PO); add(0,rbox(0.075,0.09,0.05,0.012,0.1,0.115,-0.145),HP,PO); add(1,box(0.05,0.035,0.012,0,0.125,0.112),HP,'#2a2b2f');
    add(0,ring(0.092,0.105,0.026,-0.096,-0.09,-0.015),'DEF-thighR','#0e0e10'); add(0,ring(0.086,0.098,0.026,-0.096,-0.2,-0.015),'DEF-thighR','#0e0e10');
    add(1,rbox(0.036,0.17,0.085,0.012,-0.196,-0.15,-0.012),'DEF-thighR','#141518'); add(1,rbox(0.028,0.07,0.04,0.008,-0.2,-0.045,-0.04,-0.35),'DEF-thighR','#1e1f23');
    add(0,box(0.012,0.2,0.04,-0.176,-0.02,-0.012),'DEF-thighR','#0e0e10');
    /* team marks: armbands */
    for(const s of [-1,1]) add(2,ring(0.074,0.074,0.05,s*0.34,0.547,-0.088,'x'),s>0?'DEF-upper_armL':'DEF-upper_armR');
    if(L.swat){
      add(1,ell(0.107,0.13,0.142,0,0.838,-0.024,Math.PI*0.56,-0.13),HD,'#16171a'); add(1,rbox(0.05,0.045,0.02,0.006,0,0.905,0.108,-0.5),HD,'#0f1012');
      for(const s of [-1,1]){ add(1,cyl(0.043,0.042,s*0.103,0.79,-0.026,'x'),HD,'#111214'); add(1,box(0.012,0.022,0.11,s*0.108,0.85,-0.03),HD,'#0d0d0f'); add(2,box(0.005,0.03,0.05,s*0.112,0.89,-0.05),HD); }
      add(0,ring(0.1,0.127,0.028,0,0.803,-0.02),HD,'#0d0d0f'); add(1,rbox(0.17,0.064,0.05,0.02,0,0.803,0.082),HD,'#101113'); add(1,rbox(0.15,0.044,0.014,0.006,0,0.803,0.108),HD,'#2a1c10');
      add(1,cyl(0.004,0.1,0.075,0.735,0.06,'z'),HD,'#0c0c0d'); add(1,ell(0.012,0.012,0.012,0.045,0.73,0.108),HD,'#0c0c0d');
      for(const s of [-1,1]){ add(1,ell(0.062,0.078,0.042,s*0.096,-0.405,0.04),s>0?'DEF-shinL':'DEF-shinR','#111214'); add(0,ring(0.066,0.075,0.022,s*0.096,-0.46,-0.03),s>0?'DEF-shinL':'DEF-shinR','#0d0d0f');
        add(1,ell(0.05,0.046,0.05,s*0.485,0.545,-0.128),s>0?'DEF-forearmL':'DEF-forearmR','#111214'); }
    } else {
      add(0,rbox(0.126,0.036,0.03,0.012,0,0.806,0.086),HD,'#b98d6c'); for(const s of [-1,1]) add(1,ell(0.008,0.006,0.004,s*0.03,0.806,0.1015),HD,'#1a1512');
      add(0,rbox(0.045,0.13,0.085,0.012,0.19,-0.15,0.0),'DEF-thighL',PO); add(0,ring(0.092,0.105,0.026,0.096,-0.12,-0.015),'DEF-thighL','#0e0e10');
    }
    const merged=parts.map(list=>THREE.mergeGeometries(list.map(g=>g.index?g:THREE.mergeVertices(g)),false));
    const geo=THREE.mergeGeometries(merged,true); geo.computeBoundingSphere(); geo.boundingSphere.radius=1.4; lookGeo[li]=geo; return geo; }
  function fallbackBody(color){ const g=new THREE.Group(); const m=new THREE.MeshStandardMaterial({color,roughness:0.6});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.28,0.9,6,12),m); body.position.y=0.95; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,16,12),new THREE.MeshStandardMaterial({color:'#e8d2b8'})); head.position.y=1.62; g.add(head); return g; }
  /* create an avatar: opts {color, name, weapon} */
  function create(opts){
    const A={root:new THREE.Group(),model:null,mixer:null,act:{},w:{},hand:null,gun:null,gunId:null,once:null,dead:false,tag:null};
    const col=opts.color||'#3d8bff';
    if(base){
      const m=THREE.SkeletonUtils.clone(base.scene); m.scale.setScalar(scale); m.position.y=yOff; m.rotation.y=Math.PI; mats();
      const bones={}, sk=[]; m.traverse(o=>{ if(o.isBone) bones[o.name]=o; if(o.isSkinnedMesh) sk.push(o); });
      /* one skinned mesh carries body + gear; the second body mesh of the source model is not needed */
      const body=sk[0]; for(const o of sk.slice(1)) o.parent.remove(o);
      body.geometry=buildLook(opts.look?1:0); body.material=[MAT.cloth,MAT.hard,accent(col)]; body.castShadow=true; body.receiveShadow=true; body.frustumCulled=false;
      A.model=m; A.body=body; A.root.add(m); A.bones=bones; A.hand=bones['DEF-handR']||bones['DEF-hand.R']||null;
      A.mixer=new THREE.AnimationMixer(m);
      const mk=(n,part,loop)=>{ const c=clips[n]; if(!c) return; const a=A.mixer.clipAction(c[part]); a.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce); if(!loop) a.clampWhenFinished=true; a.enabled=true; a.setEffectiveWeight(0); a.play(); A.act[n+'_'+part]=a; A.w[n+'_'+part]=0; };
      for(const n of LOCO){ mk(n,'lower',n!=='Roll'); mk(n,'upper',n!=='Roll'); }
      for(const n of UPPER_LOOP) mk(n,'upper',true);
      for(const n of UPPER_ONCE){ const c=clips[n]; if(!c) continue; const a=A.mixer.clipAction(c.upper); a.setLoop(THREE.LoopOnce); a.clampWhenFinished=false; A.act[n+'_once']=a; }
      if(clips.Death01){ const a=A.mixer.clipAction(clips.Death01.full); a.setLoop(THREE.LoopOnce); a.clampWhenFinished=true; A.act.death=a; }
      if(clips.Dance_Loop){ const a=A.mixer.clipAction(clips.Dance_Loop.full); A.act.dance=a; }
    } else { A.model=fallbackBody(col); A.root.add(A.model); }
    if(opts.name){ A.tag=nameTag(opts.name,opts.tagColor||'#ffffff'); A.tag.position.y=2.15; A.root.add(A.tag); }
    A.hi=!!opts.hi; A.setGun=(id,att)=>setGun(A,id,att); if(opts.weapon) setGun(A,opts.weapon,opts.att);
    A.update=(dt,s)=>update(A,dt,s); A.play=(n,sp)=>playOnce(A,n,sp); A.die=()=>die(A); A.revive=()=>revive(A); A.dispose=()=>dispose(A);
    return A;
  }
  function setGun(A,id,att){ const key=id?id+'|'+attKey(att):null;
    if(A.gunKey===key) return; A.gunKey=key; A.gunId=id; if(A.gun){ A.gun.parent&&A.gun.parent.remove(A.gun); A.gun=null; }
    if(!id) return; const g=A.hi?Guns.make(id,att,'show'):Guns.tp(id,att); g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
    /* right-hand bone: +y runs along the fingers, +z is the thumb side, -x is the palm. The gun's barrel follows the fingers, its top faces the thumb. */
    if(A.hand){ const k=1/scale, u=g.userData, hr=u.handR; g.scale.setScalar(k); g.rotation.set(Math.PI/2,0,0); const hy=hr?hr.y:-0.045, hz=hr?hr.z:0.035; g.position.set(-0.03*k,(0.085+hz)*k,(-0.01-hy)*k); A.hand.add(g); }
    else { g.position.set(0.25,1.2,-0.3); A.root.add(g); }
    A.gun=g; }
  function playOnce(A,n,speed){ const a=A.act[n+'_once']; if(!a) return; a.reset(); a.timeScale=speed||1; a.setEffectiveWeight(1); a.fadeIn(0.05); a.play(); A.once={a,t:a.getClip().duration/(speed||1),busy:n!=='Pistol_Shoot'&&n!=='Hit_Chest'}; }
  function die(A){ if(A.dead) return; A.dead=true; if(A.act.death){ for(const k in A.act) if(A.act[k]!==A.act.death) A.act[k].setEffectiveWeight(0); A.act.death.reset(); A.act.death.setEffectiveWeight(1); A.act.death.play(); } else A.model.rotation.x=-Math.PI/2; if(A.tag) A.tag.visible=false; }
  function revive(A){ A.dead=false; if(A.act.death){ A.act.death.stop(); } else A.model.rotation.x=0; if(A.tag) A.tag.visible=true; }
  /* s: {speed (m/s), crouch, air, slide, armed, pitch, aiming, dance} */
  function update(A,dt,s){
    if(!A.mixer){ return; }
    if(A.dead){ A.mixer.update(dt); return; }
    let loco='Idle_Loop', ts=1;
    if(s.slide) loco='Roll';
    else if(s.air) loco='Jump_Loop';
    else if(s.crouch) loco=s.speed>0.5?'Crouch_Fwd_Loop':'Crouch_Idle_Loop';
    else if(s.speed>6.5) { loco='Sprint_Loop'; ts=s.speed/7.5; }
    else if(s.speed>3.2) { loco='Jog_Fwd_Loop'; ts=s.speed/5; }
    else if(s.speed>0.4) { loco='Walk_Loop'; ts=Math.max(0.6,s.speed/2.2); }
    if(s.dance&&A.act.dance){ A.act.dance.play(); A.act.dance.setEffectiveWeight(1); } else if(A.act.dance) A.act.dance.setEffectiveWeight(0);
    const target={};
    target[loco+'_lower']=1;
    if(s.armed){ const p=clamp(s.pitch||0,-1.2,1.2); const up=Math.max(0,p/1.1), dn=Math.max(0,-p/1.1);
      if(s.aiming||true){ target['Pistol_Aim_Up_upper']=up; target['Pistol_Aim_Down_upper']=dn; target['Pistol_Aim_Neutral_upper']=Math.max(0,1-up-dn); } }
    else target[loco+'_upper']=1;
    const k=Math.min(1,dt*12);
    for(const n in A.act){ if(!n.endsWith('_lower')&&!n.endsWith('_upper')) continue; const a=A.act[n]; const t=target[n]||0; A.w[n]+= (t-A.w[n])*k; a.setEffectiveWeight(A.w[n]); if(n.startsWith(loco)) a.timeScale=ts; }
    // keep upper locomotion in phase with lower
    const lo=A.act[loco+'_lower'], up=A.act[loco+'_upper']; if(lo&&up) up.time=lo.time;
    if(A.once){ A.once.t-=dt; if(A.once.t<=0){ A.once.a.fadeOut(0.1); A.once=null; } }
    /* The mixer only writes a bone when the animated value CHANGED since its last write. The aim poses are still, so without this
       the arm bones kept last frame's IK result, the IK then ran on top of its own output and the arm flipped between two poses
       every frame (gun and arms shaking / seen double). So: put the arm bones back to their animated pose first, then animate, then solve. */
    const IB=A.ikB||(A.ikB=IK_BONES.map(n=>A.bones[n]).filter(Boolean)), AQ=A.animQ||(A.animQ=IB.map(b=>b.quaternion.clone()));
    if(A.ikDirty){ for(let i=0;i<IB.length;i++) IB[i].quaternion.copy(AQ[i]); A.ikDirty=false; }
    A.mixer.update(dt);
    for(let i=0;i<IB.length;i++) AQ[i].copy(IB[i].quaternion);
    /* hold the gun properly: the clips only know a one-size pistol pose, so both arms are solved onto the actual gun.
       Rifles go to the shoulder with the left hand under the handguard; pistols are held out in both hands; the muzzle follows the real aim pitch. */
    const u=A.gun&&A.gun.userData, hold=s.armed&&u&&!u.melee&&!u.item&&!s.slide&&A.hand&&!(A.once&&A.once.busy);
    A.ikW=clamp((A.ikW||0)+(hold?dt*7:-dt*7),0,1); if(A.ikW>0.01&&u&&A.hand){ aimArms(A,u,s.pitch||0,A.ikW); A.ikDirty=true; }
  }
  /* ---------- two-bone arm IK ---------- */
  const IK_BONES=['DEF-upper_armR','DEF-forearmR','DEF-handR','DEF-upper_armL','DEF-forearmL','DEF-handL'];
  const T={a:new THREE.Vector3(),b:new THREE.Vector3(),c:new THREE.Vector3(),d:new THREE.Vector3(),e:new THREE.Vector3(),t:new THREE.Vector3(),f:new THREE.Vector3(),r:new THREE.Vector3(),up:new THREE.Vector3(),aim:new THREE.Vector3(),ua:new THREE.Vector3(),
    g:new THREE.Vector3(),x:new THREE.Vector3(),y:new THREE.Vector3(),z:new THREE.Vector3(),pole:new THREE.Vector3(),q:new THREE.Quaternion(),q2:new THREE.Quaternion(),qp:new THREE.Quaternion(),q0:new THREE.Quaternion(),qi:new THREE.Quaternion(),qh:new THREE.Quaternion(),ql:new THREE.Quaternion(),m:new THREE.Matrix4(),sR:new THREE.Vector3(),sL:new THREE.Vector3()};
  const wpos=(b,o)=>o.setFromMatrixPosition(b.matrixWorld);
  /* give a bone a world orientation, blended with what the animation wanted by w */
  function setWorldQuat(bone,qw,w){ T.q0.copy(bone.quaternion); bone.parent.getWorldQuaternion(T.qp); T.qi.copy(T.qp.invert().multiply(qw)); if(w<1) bone.quaternion.slerpQuaternions(T.q0,T.qi,w); else bone.quaternion.copy(T.qi); bone.updateMatrixWorld(true); }
  function reach(U,F,H,target,pole,w){ const a=wpos(U,T.a), b=wpos(F,T.b), c=wpos(H,T.c), l1=a.distanceTo(b), l2=b.distanceTo(c);
    const dir=T.d.copy(target).sub(a); const d=clamp(dir.length(),Math.abs(l1-l2)+0.01,l1+l2-0.004); dir.normalize();
    const cosA=clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1), sinA=Math.sqrt(1-cosA*cosA);
    const perp=T.e.copy(pole).addScaledVector(dir,-pole.dot(dir)); if(perp.lengthSq()<1e-6) perp.set(0,-1,0); perp.normalize();
    const b2=T.t.copy(a).addScaledVector(dir,l1*cosA).addScaledVector(perp,l1*sinA);
    T.q.setFromUnitVectors(b.sub(a).normalize(),b2.sub(a).normalize()); U.getWorldQuaternion(T.q2); setWorldQuat(U,T.q2.premultiply(T.q),w);
    wpos(F,T.b); wpos(H,T.c); const t2=T.t.copy(a).addScaledVector(dir,d);
    T.q.setFromUnitVectors(T.c.sub(T.b).normalize(),t2.sub(T.b).normalize()); F.getWorldQuaternion(T.q2); setWorldQuat(F,T.q2.premultiply(T.q),w); }
  function aimArms(A,u,pitch,w){ const B=A.bones, UR=B['DEF-upper_armR'], FR=B['DEF-forearmR'], HR=B['DEF-handR'], UL=B['DEF-upper_armL'], FL=B['DEF-forearmL'], HL=B['DEF-handL']; if(!UR||!FR||!HR) return;
    A.root.updateMatrixWorld(true); A.root.getWorldQuaternion(T.q);
    const f=T.f.set(0,0,-1).applyQuaternion(T.q), up=T.up.set(0,1,0), r=T.r.crossVectors(f,up).normalize(), p=clamp(pitch,-1.2,1.2), cp=Math.cos(p), sp=Math.sin(p);
    const aim=T.aim.copy(f).multiplyScalar(cp).addScaledVector(up,sp), ua=T.ua.copy(up).multiplyScalar(cp).addScaledVector(f,-sp);
    wpos(UR,T.sR); if(UL) wpos(UL,T.sL); const long=!u.pistol&&!u.thrown;
    /* where the gun's grip should be */
    const G=T.g; if(long) G.copy(T.sR).addScaledVector(aim,0.24).addScaledVector(r,-0.1).addScaledVector(ua,0.05);
    else { G.copy(T.sR); if(UL) G.add(T.sL).multiplyScalar(0.5); G.addScaledVector(aim,0.43).addScaledVector(ua,0.17).addScaledVector(r,0.02); }
    /* right hand: fingers (+y) along the barrel, thumb side (+z) up */
    T.y.copy(aim); T.z.copy(ua); T.x.crossVectors(T.y,T.z); T.m.makeBasis(T.x,T.y,T.z); const qh=T.qh.setFromRotationMatrix(T.m);
    const wr=T.c.copy(A.gun.position).multiplyScalar(scale).applyQuaternion(qh); T.pole.copy(up).multiplyScalar(-1).addScaledVector(r,0.55);
    reach(UR,FR,HR,T.b.copy(G).sub(wr),T.pole,w); setWorldQuat(HR,qh,w);
    if(!UL||!FL||!HL) return;
    /* left hand: under the handguard (rifles) or wrapped over the right hand (pistols) */
    const pt=T.g; if(long&&u.handL){ pt.copy(u.handL); pt.z=Math.max(pt.z,-0.27); A.gun.localToWorld(pt); pt.addScaledVector(ua,-0.012); T.x.copy(ua); T.y.copy(r).multiplyScalar(0.82).addScaledVector(aim,0.5).addScaledVector(ua,0.25); }
    else { pt.copy(G).addScaledVector(r,-0.04).addScaledVector(ua,-0.04).addScaledVector(aim,0.02); T.x.copy(r).addScaledVector(ua,0.3); T.y.copy(aim).multiplyScalar(0.75).addScaledVector(r,0.6).addScaledVector(ua,-0.2); }
    T.x.normalize(); T.y.addScaledVector(T.x,-T.y.dot(T.x)).normalize(); T.z.crossVectors(T.x,T.y); T.m.makeBasis(T.x,T.y,T.z); const ql=T.ql.setFromRotationMatrix(T.m);
    const wl=T.c.set(0.028,0.085,0).multiplyScalar(scale).applyQuaternion(ql); T.pole.copy(up).multiplyScalar(-1).addScaledVector(r,-0.5);
    reach(UL,FL,HL,T.b.copy(pt).sub(wl),T.pole,w); setWorldQuat(HL,ql,w); }
  function dispose(A){ A.root.parent&&A.root.parent.remove(A.root); if(A.gun&&A.gun.parent) A.gun.parent.remove(A.gun); A.root.traverse(o=>{ if(o.isMesh&&o.material){ const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>{ if(!(m.userData&&m.userData.shared)) m.dispose(); }); } }); if(A.mixer) A.mixer.stopAllAction(); }
  return {init,create,setVis,get ready(){return ready;},get loaded(){return !!base;}};
})();
