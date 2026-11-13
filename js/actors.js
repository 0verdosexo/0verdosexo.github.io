/* actors.js — armoured player models with jointed limbs, name tags, exposure beam, orbs */
function makeHuman(armor,accent,visor){
  const g=new THREE.Group(), rig=new THREE.Group(); g.add(rig);
  const suit=MAT({color:'#2a2f37',roughness:.75,metalness:.1}), arm=MAT({color:armor,roughness:.32,metalness:.25}), acc=MAT({color:accent,roughness:.45,metalness:.3}),
        skin=MAT({color:'#e8c3a0',roughness:.8}), vis=new THREE.MeshBasicMaterial({color:visor,toneMapped:false});
  const part=(geo,m,x,y,z,p)=>{ const o=shadowed(new THREE.Mesh(geo,m),true,false); o.position.set(x,y,z); (p||rig).add(o); return o; };
  const cyl=(r1,r2,len,m,x,y,z,p)=>part(new THREE.CylinderGeometry(r1,r2,len,12),m,x,y,z,p);
  // torso
  part(rbox(.42,.5,.26,.08,2),suit,0,1.24,0); part(rbox(.45,.3,.29,.08,2),arm,0,1.34,-.01); part(rbox(.3,.12,.05,.02,1),acc,0,1.33,-.155);
  part(rbox(.41,.09,.28,.03,1),acc,0,.99,0); part(rbox(.3,.36,.15,.05,2),acc,0,1.27,.2); part(rbox(.22,.1,.06,.02,1),vis,0,1.36,.28);
  for(const sx of [-1,1]){ const sp=part(new THREE.SphereGeometry(.13,14,10),arm,sx*.26,1.47,0); sp.scale.set(1,.75,1.1); }
  // head + helmet + visor
  cyl(.06,.07,.1,suit,0,1.53,0); part(new THREE.SphereGeometry(.14,16,12),skin,0,1.66,0);
  const helm=part(new THREE.SphereGeometry(.165,18,12,0,Math.PI*2,0,Math.PI*.62),arm,0,1.67,.005); helm.rotation.x=-.12;
  part(rbox(.25,.075,.07,.03,2),vis,0,1.665,-.13); part(rbox(.05,.08,.05,.02,1),acc,.17,1.68,0); part(rbox(.05,.08,.05,.02,1),acc,-.17,1.68,0);
  // limbs: shoulder→elbow and hip→knee pivots
  const limb=(x,y,upLen,loLen,r,mUp,mLo,end)=>{ const top=new THREE.Group(); top.position.set(x,y,0); rig.add(top);
    cyl(r,r*.9,upLen,mUp,0,-upLen/2,0,top); const joint=new THREE.Group(); joint.position.y=-upLen; top.add(joint);
    cyl(r*.9,r*.8,loLen,mLo,0,-loLen/2,0,joint); end(joint,loLen); return {top,joint}; };
  const legs=[-1,1].map(sx=>limb(sx*.12,.95,.43,.43,.085,suit,arm,(j,L)=>{ part(rbox(.14,.1,.26,.03,1),acc,0,-L-.02,-.04,j); part(new THREE.SphereGeometry(.075,10,8),arm,0,0,-.02,j); }));
  const arms=[-1,1].map(sx=>limb(sx*.29,1.45,.3,.28,.06,suit,arm,(j,L)=>{ part(new THREE.SphereGeometry(.065,10,8),suit,0,-L-.02,0,j); }));
  g.userData={rig,legs:legs.map(l=>l.top),knees:legs.map(l=>l.joint),arms:arms.map(a=>a.top),elbows:arms.map(a=>a.joint),phase:0};
  return g;
}
function animHuman(g,moving,dt,slide,air){
  const u=g.userData; u.phase+=dt*(moving?10.5:0); const s=moving&&!air?Math.sin(u.phase):0, k=Math.min(1,dt*12), ease=(o,v)=>o+(v-o)*k;
  u.rig.rotation.x=ease(u.rig.rotation.x,slide?1.15:0); u.rig.position.y=ease(u.rig.position.y,slide?-.55:moving?Math.abs(Math.cos(u.phase))*.04:Math.sin(perfT*2)*.008);
  const L=u.legs, K=u.knees, A=u.arms, E=u.elbows;
  for(let i=0;i<2;i++){ const sg=i?-1:1, sw=s*sg;
    L[i].rotation.x=ease(L[i].rotation.x,slide?.25-i*.15:air?.75-i*.35:sw*.75);
    K[i].rotation.x=ease(K[i].rotation.x,slide?-.2:air?-1.05:-Math.max(0,-Math.sin(u.phase+(i?Math.PI:0)))*1.15*(moving?1:0));
    const armed=i===1&&u.armedPose;
    A[i].rotation.x=ease(A[i].rotation.x,armed?1.45:air?-2.3:-sw*.7);
    E[i].rotation.x=ease(E[i].rotation.x,armed?0:moving?.55:.15);
    A[i].rotation.z=ease(A[i].rotation.z,(i?-1:1)*(air?.25:.06)); }
}
const runnerModel=makeHuman('#e9f6f7','#1f8f9a','#5ff0f5'), seekerModel=makeHuman('#f4e9e7','#c23a30','#ff7a3d');
const seekMarker=new THREE.Mesh(new THREE.ConeGeometry(.22,.42,4),new THREE.MeshBasicMaterial({color:0xff4a3d,toneMapped:false})); seekMarker.rotation.x=Math.PI; seekMarker.position.y=2.4; seekerModel.add(seekMarker);
scene.add(runnerModel,seekerModel);
let nameTag=null;
function setNameTag(name){ if(nameTag){ nameTag.parent&&nameTag.parent.remove(nameTag); nameTag=null; } if(!name) return;
  nameTag=textSprite(name,'#fff7ec','rgba(20,16,14,.55)',0.6); nameTag.position.y=2.95; }
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,60,16,1,true),new THREE.MeshBasicMaterial({color:0xf2d23a,transparent:true,opacity:.38,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
beam.renderOrder=10; beam.visible=false; scene.add(beam);
/* orbs: bright core inside a glass shell, halo and a glowing ground ring (bloom picks these up) */
const orbCore=new THREE.SphereGeometry(.26,20,14), orbShell=new THREE.SphereGeometry(.44,24,16);
const orbCoreMat=new THREE.MeshBasicMaterial({color:0xb8fbff,toneMapped:false});
const orbShellMat=MAT({color:'#5ff0f5',emissive:'#1fb8c8',emissiveIntensity:.8,roughness:.05,metalness:.2,transparent:true,opacity:.55,envMapIntensity:1.5});
const ringGeo=new THREE.RingGeometry(1.05,1.3,40); ringGeo.rotateX(-Math.PI/2);
const orbRingMat=new THREE.MeshBasicMaterial({color:0x3fe0e8,transparent:true,opacity:.75,toneMapped:false});
let orbs=[];
function spawnOrbs(list){
  orbs.forEach(o=>scene.remove(o.g)); orbs=[];
  list.forEach((p,i)=>{ const g=new THREE.Group(); g.position.set(p.x,p.y,p.z);
    const s=new THREE.Group(); s.position.y=1.2; g.add(s);
    s.add(new THREE.Mesh(orbCore,orbCoreMat)); const sh=new THREE.Mesh(orbShell,orbShellMat); sh.castShadow=false; s.add(sh);
    const h=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTex(),color:0x7ff6ff,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending})); h.scale.set(2.4,2.4,1); h.position.y=1.2; g.add(h);
    const ring=new THREE.Mesh(ringGeo,orbRingMat); ring.position.y=.05; g.add(ring);
    g.userData={s,h,i}; scene.add(g); orbs.push({x:p.x,y:p.y,z:p.z,taken:false,g}); });
}
