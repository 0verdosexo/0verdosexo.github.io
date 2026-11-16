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
  function gear(bones,teamCol){
    const dark=new THREE.MeshStandardMaterial({color:'#2b2d30',roughness:0.7}), tc=new THREE.MeshStandardMaterial({color:teamCol,roughness:0.55,metalness:0.1});
    const head=bones['DEF-head'], chest=bones['DEF-spine.003'];
    const k=1/scale;
    if(head){ const h=new THREE.Mesh(new THREE.SphereGeometry(0.135*k,16,10,0,Math.PI*2,0,Math.PI*0.55),tc); h.position.set(0,0.11*k,0.0); head.add(h);
      const v=new THREE.Mesh(new THREE.BoxGeometry(0.16*k,0.05*k,0.04*k),new THREE.MeshStandardMaterial({color:'#111',roughness:0.1,metalness:0.8})); v.position.set(0,0.07*k,0.115*k); head.add(v); }
    if(chest){ const vest=new THREE.Mesh(new THREE.RoundedBoxGeometry(0.36*k,0.3*k,0.26*k,2,0.04*k),dark); vest.position.set(0,0.0,0.01*k); chest.add(vest);
      const pack=new THREE.Mesh(new THREE.RoundedBoxGeometry(0.26*k,0.3*k,0.12*k,2,0.03*k),tc); pack.position.set(0,-0.02*k,-0.17*k); chest.add(pack); }
  }
  function fallbackBody(color){ const g=new THREE.Group(); const m=new THREE.MeshStandardMaterial({color,roughness:0.6});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.28,0.9,6,12),m); body.position.y=0.95; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,16,12),new THREE.MeshStandardMaterial({color:'#e8d2b8'})); head.position.y=1.62; g.add(head); return g; }
  /* create an avatar: opts {color, name, weapon} */
  function create(opts){
    const A={root:new THREE.Group(),model:null,mixer:null,act:{},w:{},hand:null,gun:null,gunId:null,once:null,dead:false,tag:null};
    const col=opts.color||'#3d8bff';
    if(base){
      const m=THREE.SkeletonUtils.clone(base.scene); m.scale.setScalar(scale); m.position.y=yOff; m.rotation.y=Math.PI;
      const bones={}; m.traverse(o=>{ if(o.isBone) bones[o.name]=o; if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false;
        const ms=Array.isArray(o.material)?o.material:[o.material]; o.material=ms.map(mm=>{ const c=mm.clone(); if(mm.name==='M_Main'){ c.color.set(col); c.roughness=0.55; } else { c.color.set('#26282c'); c.roughness=0.7; } return c; }); if(o.material.length===1) o.material=o.material[0]; } });
      A.model=m; A.root.add(m); A.bones=bones; A.hand=bones['DEF-hand.R']; gear(bones,col);
      A.mixer=new THREE.AnimationMixer(m);
      const mk=(n,part,loop)=>{ const c=clips[n]; if(!c) return; const a=A.mixer.clipAction(c[part]); a.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce); if(!loop) a.clampWhenFinished=true; a.enabled=true; a.setEffectiveWeight(0); a.play(); A.act[n+'_'+part]=a; A.w[n+'_'+part]=0; };
      for(const n of LOCO){ mk(n,'lower',n!=='Roll'); mk(n,'upper',n!=='Roll'); }
      for(const n of UPPER_LOOP) mk(n,'upper',true);
      for(const n of UPPER_ONCE){ const c=clips[n]; if(!c) continue; const a=A.mixer.clipAction(c.upper); a.setLoop(THREE.LoopOnce); a.clampWhenFinished=false; A.act[n+'_once']=a; }
      if(clips.Death01){ const a=A.mixer.clipAction(clips.Death01.full); a.setLoop(THREE.LoopOnce); a.clampWhenFinished=true; A.act.death=a; }
      if(clips.Dance_Loop){ const a=A.mixer.clipAction(clips.Dance_Loop.full); A.act.dance=a; }
    } else { A.model=fallbackBody(col); A.root.add(A.model); }
    if(opts.name){ A.tag=nameTag(opts.name,opts.tagColor||'#ffffff'); A.tag.position.y=2.15; A.root.add(A.tag); }
    A.setGun=id=>setGun(A,id); if(opts.weapon) setGun(A,opts.weapon);
    A.update=(dt,s)=>update(A,dt,s); A.play=(n,sp)=>playOnce(A,n,sp); A.die=()=>die(A); A.revive=()=>revive(A); A.dispose=()=>dispose(A);
    return A;
  }
  function setGun(A,id){
    if(A.gunId===id) return; A.gunId=id; if(A.gun){ A.gun.parent&&A.gun.parent.remove(A.gun); A.gun=null; }
    if(!id) return; const g=Guns.tp(id); g.traverse(o=>{ if(o.isMesh) o.castShadow=true; });
    if(A.hand){ const k=1/scale; g.scale.setScalar(k); g.position.set(0,0.09*k,0.02*k); g.rotation.set(-Math.PI/2,0,Math.PI); A.hand.add(g); }
    else { g.position.set(0.25,1.2,-0.3); A.root.add(g); }
    A.gun=g; }
  function playOnce(A,n,speed){ const a=A.act[n+'_once']; if(!a) return; a.reset(); a.timeScale=speed||1; a.setEffectiveWeight(1); a.fadeIn(0.05); a.play(); A.once={a,t:a.getClip().duration/(speed||1)}; }
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
    A.mixer.update(dt);
  }
  function dispose(A){ A.root.parent&&A.root.parent.remove(A.root); A.root.traverse(o=>{ if(o.isMesh&&o.material){ const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>m.dispose()); } }); if(A.mixer) A.mixer.stopAllAction(); }
  return {init,create,get ready(){return ready;},get loaded(){return !!base;}};
})();
