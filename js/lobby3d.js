/* lobby3d.js — the lobby's centre piece: the chosen operator standing in front of a picture of the selected map.
   Drawn on the main canvas with its own tiny scene (one character, no map geometry), at a capped frame rate, only while the lobby is showing. */
'use strict';
const LobbyShow=(()=>{
  let scene=null, cam, comp=null, pivot, av=null, avKey='', want=null, on=false, raf=0, last=0, area=null, bound=false, lastSize='', bgId=null, bgTex=null, bgAsp=16/9, drag=null, busy=false;
  const V={yaw:-0.42,tyaw:-0.42};
  function build(){ if(scene) return; scene=new THREE.Scene(); cam=new THREE.PerspectiveCamera(27,1,0.1,60); scene.background=new THREE.Color('#101216'); scene.backgroundIntensity=0.5;
    scene.environment=GunShow.env(); scene.environmentIntensity=0.9;
    const key=new THREE.DirectionalLight('#fff0df',3.4); key.position.set(-2.2,3.2,3.4); scene.add(key);
    const rim=new THREE.DirectionalLight('#ff9a4a',3.2); rim.position.set(2.6,2.2,-3); scene.add(rim); const rim2=new THREE.DirectionalLight('#8fb6ff',1.6); rim2.position.set(-3,1.5,-2.5); scene.add(rim2);
    scene.add(new THREE.HemisphereLight('#cfd8e6','#23262c',0.7));
    /* a soft dark pool under the feet so the figure sits on the ground of the picture */
    const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), g=x.createRadialGradient(64,64,4,64,64,64); g.addColorStop(0,'rgba(0,0,0,0.78)'); g.addColorStop(0.5,'rgba(0,0,0,0.42)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c); const sh=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false})); sh.rotation.x=-Math.PI/2; sh.position.y=0.005; scene.add(sh);
    pivot=new THREE.Group(); scene.add(pivot); }
  function composer(){ const s=R.renderer.getDrawingBufferSize(new THREE.Vector2()), k=s.x+'x'+s.y; if(comp&&k===lastSize) return; if(comp) comp.dispose(); lastSize=k;
    const rt=new THREE.WebGLRenderTarget(s.x,s.y,{type:THREE.HalfFloatType,samples:isTouch?2:4}); comp=new THREE.EffectComposer(R.renderer,rt); comp.setPixelRatio(1); comp.setSize(s.x,s.y);
    comp.addPass(new THREE.RenderPass(scene,cam)); comp.addPass(new THREE.OutputPass()); }
  /* the picture of the map behind the character, scaled to cover the screen */
  function setBg(id){ if(!id||id===bgId) return; bgId=id; if(!scene) return; new THREE.TextureLoader().load('assets/ui/bg_'+id+'.jpg',t=>{ if(bgId!==id){ t.dispose(); return; } t.colorSpace=THREE.SRGBColorSpace; bgAsp=t.image.width/t.image.height; if(bgTex) bgTex.dispose(); bgTex=t; scene.background=t; },undefined,()=>{}); }
  function fitBg(W,H){ if(!bgTex) return; const a=W/H; if(a>bgAsp){ bgTex.repeat.set(1,bgAsp/a); bgTex.offset.set(0,(1-bgAsp/a)*0.35); } else { bgTex.repeat.set(a/bgAsp,1); bgTex.offset.set((1-a/bgAsp)/2,0); } }
  /* which operator stands there: {look, gun, att} */
  async function setChar(o){ want=o; if(!on||busy) return; busy=true; try{ await Avatars.init(); }catch(e){} busy=false; if(!on||!Avatars.loaded||!want) return; o=want;
    const k=o.look+'|'+o.gun+'|'+attKey(attClean(o.gun,o.att)); if(k===avKey&&av) return; avKey=k;
    if(av){ pivot.remove(av.root); if(av.gun) av.gun.traverse(m=>{ if(m.isMesh) m.geometry.dispose(); }); av.dispose(); av=null; }
    av=Avatars.create({color:'#ff8a1f',look:o.look,weapon:o.gun,att:o.att,hi:true}); av.root.traverse(m=>{ if(m.isMesh){ m.castShadow=false; m.receiveShadow=false; } }); pivot.add(av.root);
    for(let i=0;i<12;i++) av.update(1/30,POSE); }
  const POSE={speed:0,armed:true,pitch:-0.42};
  function draw(dt){ if(!on||!scene) return; R.resize(); composer(); const W=innerWidth, H=innerHeight; let r=area?area.getBoundingClientRect():{left:0,top:0,width:W,height:H}; if(r.width<10||r.height<10) r={left:0,top:0,width:W,height:H};
    V.yaw+=(V.tyaw-V.yaw)*Math.min(1,dt*10); pivot.rotation.y=V.yaw+Math.PI; if(av) av.update(dt,POSE);
    /* frame the whole figure inside the free area of the screen */
    cam.aspect=W/H; const vf=cam.fov*Math.PI/180, d=2.25/(2*Math.tan(vf/2)*Math.min(1,r.height/H)*0.94);
    cam.position.set(0,1.02,d); cam.lookAt(0,0.98,0); cam.setViewOffset(W,H,W/2-(r.left+r.width/2),H/2-(r.top+r.height/2),W,H); cam.updateProjectionMatrix(); fitBg(W,H);
    const ex=R.renderer.toneMappingExposure, sh=R.renderer.shadowMap.enabled; R.renderer.toneMappingExposure=1.05; R.renderer.shadowMap.enabled=false; comp.render(); R.renderer.toneMappingExposure=ex; R.renderer.shadowMap.enabled=sh; }
  function loop(now){ raf=0; if(!on) return; raf=requestAnimationFrame(loop); const step=isTouch?1/20:1/30; if(now-last<step*1000-2) return; const dt=Math.min(0.1,(now-last)/1000||step); last=now; if(document.hidden) return; draw(dt); }
  function bind(el){ if(bound||!el) return; bound=true;
    el.addEventListener('pointerdown',e=>{ if(!on||e.target.closest('button,input')) return; drag={x:e.clientX,yaw:V.tyaw}; try{ el.setPointerCapture(e.pointerId); }catch(_){} });
    el.addEventListener('pointermove',e=>{ if(drag) V.tyaw=drag.yaw+(e.clientX-drag.x)*0.01; }); const up=()=>{ drag=null; }; el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up); }
  function open(el){ build(); area=el||null; bind(el); if(on) return; on=true; document.body.classList.add('lobbyview'); if(bgId&&!bgTex){ const id=bgId; bgId=null; setBg(id); } if(want) setChar(want); last=performance.now(); if(!raf) raf=requestAnimationFrame(loop); }
  function close(){ if(!on) return; on=false; cancelAnimationFrame(raf); raf=0; document.body.classList.remove('lobbyview'); if(comp){ comp.dispose(); comp=null; lastSize=''; } }
  return {open,close,setBg,setChar,draw,get on(){return on;}};
})();
