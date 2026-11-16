/* render.js — renderer, cameras, post-processing, quality presets, theme lighting (HDRI + sun shadows) */
'use strict';
const QUALITY_PRESETS={
  low:   {name:'낮음',  lite:true, dpr:0.75, shadow:0,    shadowR:0,  post:false, msaa:0, bloom:false, gtao:false, lights:0,  aniso:2,  bigBg:false, propShadow:false, particles:0.5},
  medium:{name:'보통',  dpr:1,    shadow:2048, shadowR:50, post:true,  msaa:0, bloom:true,  gtao:false, lights:6,  aniso:4,  bigBg:false, propShadow:false, particles:0.8, fxaa:true},
  high:  {name:'높음',  dpr:1.5,  shadow:4096, shadowR:72, post:true,  msaa:4, bloom:true,  gtao:false, lights:12, aniso:8,  bigBg:true,  propShadow:true,  particles:1},
  ultra: {name:'최고',  dpr:2,    shadow:4096, shadowR:90, post:true,  msaa:4, bloom:true,  gtao:true,  lights:18, aniso:16, bigBg:true,  propShadow:true,  particles:1.2}
};
let QUALITY=QUALITY_PRESETS.high;
const R=(()=>{
  let renderer, scene, camera, vmScene, vmCam, composer, rp, vmPass, bloom, gtao, fxaa, out, sun, hemi, canvas, theme=null, envTex=null;
  const sunDir=new THREE.Vector3(0.5,0.8,0.3);
  function init(cv){
    canvas=cv;
    renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',stencil:false});
    renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1;
    renderer.shadowMap.type=THREE.PCFShadowMap;
    scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(78,1,0.05,1200); camera.rotation.order='YXZ'; scene.add(camera);
    vmScene=new THREE.Scene(); vmCam=new THREE.PerspectiveCamera(56,1,0.01,10); vmScene.add(vmCam);
    vmScene.add(new THREE.HemisphereLight('#ffffff','#444444',0.9)); const vl=new THREE.DirectionalLight('#ffffff',1.6); vl.position.set(0.5,1,0.6); vmScene.add(vl);
    sun=new THREE.DirectionalLight('#ffffff',3); sun.castShadow=true; scene.add(sun); scene.add(sun.target);
    hemi=new THREE.HemisphereLight('#bcd4ff','#6b5a44',0.25); scene.add(hemi);
    window.addEventListener('resize',resize);
    applyQuality(QUALITY); return renderer;
  }
  function applyQuality(q){
    const liteChanged=QUALITY&&!!QUALITY.lite!==!!q.lite; QUALITY=q; if(!renderer) return;
    if(liteChanged&&typeof World!=='undefined'){ Assets.resetMaterials(); World.resetMats(); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,q.dpr));
    renderer.shadowMap.enabled=q.shadow>0; sun.castShadow=q.shadow>0;
    if(q.shadow){ sun.shadow.mapSize.set(q.shadow,q.shadow); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; }
      const c=sun.shadow.camera; c.left=-q.shadowR; c.right=q.shadowR; c.top=q.shadowR; c.bottom=-q.shadowR; c.near=1; c.far=600; c.updateProjectionMatrix();
      sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.035; }
    Assets.setAniso(Math.min(q.aniso,renderer.capabilities.getMaxAnisotropy()));
    buildComposer(); resize();
    scene.traverse(o=>{ if(o.material){ const ms=Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>m.needsUpdate=true); } });
  }
  function buildComposer(){
    if(composer){ composer.dispose&&composer.dispose(); composer=null; }
    if(!QUALITY.post) return;
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt=new THREE.WebGLRenderTarget(size.x,size.y,{type:THREE.HalfFloatType,samples:QUALITY.msaa||0});
    composer=new THREE.EffectComposer(renderer,rt);
    rp=new THREE.RenderPass(scene,camera); composer.addPass(rp);
    if(QUALITY.gtao){ gtao=new THREE.GTAOPass(scene,camera,size.x,size.y); gtao.output=THREE.GTAOPass.OUTPUT.Default; gtao.blendIntensity=0.85;
      gtao.updateGtaoMaterial({radius:0.6,distanceExponent:1.4,thickness:1.2,scale:1}); composer.addPass(gtao); } else gtao=null;
    vmPass=new THREE.RenderPass(vmScene,vmCam); vmPass.clear=false; vmPass.clearDepth=true; composer.addPass(vmPass);
    if(QUALITY.bloom){ bloom=new THREE.UnrealBloomPass(new THREE.Vector2(size.x,size.y),0.3,0.5,0.88); composer.addPass(bloom); if(theme) setBloom(theme.bloom); } else bloom=null;
    out=new THREE.OutputPass(); composer.addPass(out);
    if(QUALITY.fxaa&&!QUALITY.msaa){ const S=THREE.SMAAPass; fxaa=new S(size.x,size.y); composer.addPass(fxaa); } else fxaa=null;
  }
  function setBloom(b){ if(!bloom||!b) return; bloom.strength=b[0]; bloom.radius=b[1]; bloom.threshold=b[2]; }
  function resize(){ if(!renderer) return; const w=canvas.clientWidth||window.innerWidth, h=canvas.clientHeight||window.innerHeight;
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); vmCam.aspect=w/h; vmCam.updateProjectionMatrix();
    if(composer){ const s=renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(w,h); if(gtao) gtao.setSize(s.x,s.y); } }
  /* theme: HDRI environment, background, fog, sun */
  async function setTheme(th){
    theme=th; renderer.toneMappingExposure=th.exposure||1;
    scene.fog=new THREE.Fog(th.fog,th.fogD[0],th.fogD[1]);
    sun.color.set(th.sun.color); sun.intensity=th.sun.int; sunDir.set(...th.sun.dir).normalize();
    hemi.intensity=th.hemi; setBloom(th.bloom);
    scene.background=new THREE.Color(th.fog);
    const e=await Assets.env(th.hdri,QUALITY.bigBg);
    if(e.hdr){ const pm=new THREE.PMREMGenerator(renderer); const rt=pm.fromEquirectangular(e.hdr); if(envTex) envTex.dispose(); envTex=rt.texture; scene.environment=envTex; e.hdr.dispose(); pm.dispose();
      scene.environmentIntensity=th.envInt; vmScene.environment=envTex; vmScene.environmentIntensity=Math.max(0.7,th.envInt); }
    if(e.bg){ scene.background=e.bg; scene.backgroundIntensity=th.bgInt; scene.backgroundBlurriness=0; }
    return e;
  }
  /* keep the sun's shadow box centred on the camera, snapped to shadow texels to avoid shimmering */
  const _v=new THREE.Vector3();
  function updateSun(){
    const r=QUALITY.shadowR||80, f=camera.position; let cx=f.x, cz=f.z;
    if(QUALITY.shadow){ const tex=2*r/QUALITY.shadow; cx=Math.round(cx/tex)*tex; cz=Math.round(cz/tex)*tex; }
    sun.target.position.set(cx,0,cz); sun.position.set(cx+sunDir.x*220,sunDir.y*220,cz+sunDir.z*220); sun.target.updateMatrixWorld();
  }
  function render(){
    updateSun();
    if(composer){ composer.render(); }
    else { renderer.autoClear=true; renderer.render(scene,camera); renderer.autoClear=false; renderer.clearDepth(); renderer.render(vmScene,vmCam); renderer.autoClear=true; }
  }
  return {init,applyQuality,setTheme,render,resize,setBloom,get renderer(){return renderer;},get scene(){return scene;},get camera(){return camera;},
    get vmScene(){return vmScene;},get vmCam(){return vmCam;},get sun(){return sun;},get hemi(){return hemi;},get theme(){return theme;}};
})();
