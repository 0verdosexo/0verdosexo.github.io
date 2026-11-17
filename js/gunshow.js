/* gunshow.js — the gunsmith's 3D weapon display. Draws one gun on the main canvas (its own scene, studio lighting, anti-aliased),
   only when something changes, so it costs nothing while idle. Drag to turn the gun. */
'use strict';
const GunShow=(()=>{
  let scene=null, cam, comp=null, rp, pivot, gun=null, on=false, raf=0, key='', area=null, bound=false;
  const V={yaw:0.62,pitch:0.1,zoom:1,ty:0.62,tp:0.1,tz:1}; let drag=null, len=0.8, hgt=0.3, lastSize='';
  /* reflections: a tiny softbox studio baked into an environment map (shared with the lobby character) */
  let envTex=null;
  function env(){ if(envTex) return envTex; const es=new THREE.Scene(); es.background=new THREE.Color('#07080a');
    const box=(w,h,x,y,z,c,i)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(i),side:THREE.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); es.add(m); };
    box(7,3,0,6,1.5,'#ffffff',7); box(3,6,-6,1.5,3,'#ffd2a0',3.2); box(3,6,6,1,-2,'#a9c8ff',3); box(10,2,0,-4,0,'#3a3f47',1); box(5,3,0,1.5,-7,'#ffffff',1.6); box(2,2,3,3,6,'#ffffff',2.5);
    const pm=new THREE.PMREMGenerator(R.renderer); envTex=pm.fromScene(es,0.035).texture; pm.dispose(); es.traverse(o=>{ if(o.isMesh){ o.geometry.dispose(); o.material.dispose(); } }); return envTex; }
  function studio(){ if(scene) return; scene=new THREE.Scene(); cam=new THREE.PerspectiveCamera(26,1,0.05,30); scene.background=new THREE.Color('#15181d');
    scene.environment=env(); scene.environmentIntensity=1.6;
    const key=new THREE.DirectionalLight('#fff1e0',4.2); key.position.set(-1.2,2.2,2.6); scene.add(key);
    const rim=new THREE.DirectionalLight('#9cc4ff',3); rim.position.set(1.5,1.2,-2.5); scene.add(rim); scene.add(new THREE.HemisphereLight('#c9d6e8','#20242a',0.55));
    /* soft orange glow behind the gun so the dark metal reads against the background */
    const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), gr=x.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,150,60,0.34)'); gr.addColorStop(0.45,'rgba(120,110,120,0.13)'); gr.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=gr; x.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; const glow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false})); glow.name='glow'; glow.renderOrder=-1; scene.add(glow);
    pivot=new THREE.Group(); scene.add(pivot); }
  function composer(){ const s=R.renderer.getDrawingBufferSize(new THREE.Vector2()), k=s.x+'x'+s.y; if(comp&&k===lastSize) return; if(comp) comp.dispose(); lastSize=k;
    const rt=new THREE.WebGLRenderTarget(s.x,s.y,{type:THREE.HalfFloatType,samples:4}); comp=new THREE.EffectComposer(R.renderer,rt); comp.setPixelRatio(1); comp.setSize(s.x,s.y);
    rp=new THREE.RenderPass(scene,cam); comp.addPass(rp); comp.addPass(new THREE.OutputPass()); }
  function draw(){ if(!on||!scene) return; R.resize(); composer();
    const W=innerWidth, H=innerHeight; let r=area?area.getBoundingClientRect():{left:0,top:0,width:W,height:H}; if(r.width<10||r.height<10) r={left:0,top:0,width:W,height:H};
    cam.aspect=W/H; const vf=cam.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*cam.aspect);
    /* far enough that the gun fits the free area between the panels */
    const fw=r.width/W, fh=r.height/H, span=Math.abs(Math.cos(V.yaw))*len+Math.abs(Math.sin(V.yaw))*0.12+0.06;
    const d=Math.max(span/(2*Math.tan(hf/2)*fw*0.94),(hgt+0.06)/(2*Math.tan(vf/2)*fh*0.9))/V.zoom;
    cam.position.set(0,Math.sin(V.pitch)*d,Math.cos(V.pitch)*d); cam.lookAt(0,0,0);
    cam.setViewOffset(W,H,(W/2-(r.left+r.width/2)),(H/2-(r.top+r.height/2)),W,H); cam.updateProjectionMatrix();
    pivot.rotation.y=V.yaw+Math.PI/2; const g=scene.getObjectByName('glow'); if(g){ g.position.set(0,0,-0.6); g.scale.setScalar(Math.max(len,0.5)*2.4); }
    const ex=R.renderer.toneMappingExposure, sh=R.renderer.shadowMap.enabled; R.renderer.toneMappingExposure=1.3; R.renderer.shadowMap.enabled=false; comp.render(); R.renderer.toneMappingExposure=ex; R.renderer.shadowMap.enabled=sh; }
  function tick(){ raf=0; if(!on) return; const k=0.22; V.yaw+=(V.ty-V.yaw)*k; V.pitch+=(V.tp-V.pitch)*k; V.zoom+=(V.tz-V.zoom)*k; draw();
    if(Math.abs(V.ty-V.yaw)>0.002||Math.abs(V.tp-V.pitch)>0.002||Math.abs(V.tz-V.zoom)>0.002) raf=requestAnimationFrame(tick); }
  function kick(){ if(on&&!raf) raf=requestAnimationFrame(tick); }
  function bind(el){ if(bound) return; bound=true;
    el.addEventListener('pointerdown',e=>{ if(!on) return; drag={x:e.clientX,y:e.clientY,yaw:V.ty,pitch:V.tp}; try{ el.setPointerCapture(e.pointerId); }catch(_){} });
    el.addEventListener('pointermove',e=>{ if(!drag) return; V.ty=drag.yaw+(e.clientX-drag.x)*0.008; V.tp=clamp(drag.pitch+(e.clientY-drag.y)*0.005,-0.5,0.7); kick(); });
    const up=()=>{ drag=null; }; el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up);
    el.addEventListener('wheel',e=>{ if(!on) return; V.tz=clamp(V.tz*(e.deltaY>0?0.9:1.1),0.7,2.2); kick(); },{passive:true});
    addEventListener('resize',()=>{ if(on) kick(); }); }
  /* show a gun (rebuilt only when the gun or its attachments change) */
  function set(id,att){ if(!on) return; const k=id+'|'+attKey(attClean(id,att)); if(k===key&&gun){ kick(); return; } key=k;
    if(gun){ pivot.remove(gun); gun.traverse(o=>{ if(o.isMesh) o.geometry.dispose(); }); gun=null; }
    gun=Guns.make(id,att,'show'); const b=new THREE.Box3().setFromObject(gun), c=b.getCenter(new THREE.Vector3()); gun.position.set(-c.x,-c.y,-c.z); if(!fitW){ len=b.max.z-b.min.z; hgt=b.max.y-b.min.y; }
    gun.traverse(o=>{ if(o.isMesh) o.castShadow=false; }); pivot.add(gun); kick(); }
  function open(el){ studio(); area=el||null; on=true; document.body.classList.add('gunview'); key=''; }
  function close(){ on=false; cancelAnimationFrame(raf); raf=0; document.body.classList.remove('gunview'); if(comp){ comp.dispose(); comp=null; lastSize=''; } }
  let fitW=0, fitH=0; function _fit(w,h){ fitW=w; fitH=h; len=w; hgt=h; kick(); }
  function view(y,p,z){ V.ty=V.yaw=y; V.tp=V.pitch=p; if(z) V.tz=V.zoom=z; kick(); }
  return {open,close,set,view,draw,_fit,env,bindDrag:bind,get on(){return on;},get scene(){return scene;},get pivot(){return pivot;}};
})();
