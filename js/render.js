/* render.js — renderer, graphics quality tiers, linear (sRGB) colour workflow, sky dome, environment reflections,
   soft sun shadows that follow the player, post-processing (bloom + FXAA), procedural PBR textures, shared helpers.
   Written for three.js r128. Optional add-ons (EffectComposer, BufferGeometryUtils, RoundedBoxGeometry) are
   loaded from the CDN and every use is guarded, so a missing add-on only turns that feature off. */
const canvas=$('c');
const Q_LEVELS={
  high:  {pr:2,  shadow:2048,post:true, env:true, dust:true, grass:1,  std:true, tex:512},
  medium:{pr:1.5,shadow:1024,post:false,env:true, dust:true, grass:.45,std:true, tex:256},
  low:   {pr:1,  shadow:0,   post:false,env:false,dust:false,grass:0,  std:false,tex:256}
};
const GQ=Q_LEVELS[prefs.gfx]||Q_LEVELS.high;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,GQ.pr));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=GQ.shadow>0; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const MAX_ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy());
/* colours below are written in sRGB (as designers pick them); r128 has no colour management, so convert to linear */
(function(){ for(const name of ['MeshBasicMaterial','MeshLambertMaterial','MeshStandardMaterial','MeshPhysicalMaterial','SpriteMaterial','LineBasicMaterial','PointsMaterial']){
  const Base=THREE[name]; if(!Base) continue;
  const Wrapped=class extends Base{ constructor(p){ super(p); if(p&&p.color!==undefined&&this.color) this.color.convertSRGBToLinear(); if(p&&p.emissive!==undefined&&this.emissive) this.emissive.convertSRGBToLinear(); } };
  THREE[name]=Wrapped; } })();
const lin=hex=>new THREE.Color(hex).convertSRGBToLinear();
const setCol=(c,hex)=>{ c.set(hex); c.convertSRGBToLinear(); };
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(72,1,0.08,1800); camera.rotation.order='YXZ';
const hemi=new THREE.HemisphereLight(0xd9ecff,0xc98a5a,0.55); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe2bd,1.2); sun.position.set(-60,110,40); scene.add(sun); scene.add(sun.target);
const amb=new THREE.AmbientLight(0xffffff,0.05); scene.add(amb);
if(GQ.shadow){ sun.castShadow=true; sun.shadow.mapSize.set(GQ.shadow,GQ.shadow); const sc=sun.shadow.camera; sc.left=-46; sc.right=46; sc.top=46; sc.bottom=-46; sc.near=1; sc.far=320;
  sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.03; sun.shadow.radius=3; }
scene.fog=new THREE.Fog(0xead7bf,60,210);
/* ---------- sky dome (custom shader: gradient + sun disc + glow), also used to light reflections ---------- */
const SKY_VS=`varying vec3 vDir; void main(){ vDir=normalize((modelMatrix*vec4(position,0.0)).xyz); vec4 p=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position=p.xyww; }`;
const SKY_FS=`uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize; varying vec3 vDir;
void main(){ vec3 d=normalize(vDir); float h=d.y;
  vec3 c = h>0.0 ? mix(hor,top,pow(clamp(h,0.0,1.0),0.55)) : mix(hor,bot,clamp(-h*3.0,0.0,1.0));
  float s=max(dot(d,normalize(sunDir)),0.0);
  c += sunCol*(pow(s,8.0)*0.35 + pow(s,64.0)*0.6) + sunCol*smoothstep(1.0-sunSize,1.0-sunSize*0.4,s)*4.0;
  gl_FragColor=vec4(c,1.0);
  #include <encodings_fragment>
}`;
function makeSkyMat(){ return new THREE.ShaderMaterial({vertexShader:SKY_VS,fragmentShader:SKY_FS,side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,
  uniforms:{top:{value:new THREE.Color()},hor:{value:new THREE.Color()},bot:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color()},sunSize:{value:0.0015}}}); }
const skyMat=makeSkyMat();
const skyMesh=new THREE.Mesh(new THREE.SphereGeometry(1500,32,16),skyMat); skyMesh.frustumCulled=false; skyMesh.renderOrder=-10; scene.add(skyMesh);
/* stars for the night theme */
const stars=(function(){ const n=900, p=new Float32Array(n*3), R=mulberry(77); for(let i=0;i<n;i++){ const u=R()*2-1, a=R()*Math.PI*2, r=1300, y=Math.abs(u)*0.95+0.05, k=Math.sqrt(1-y*y);
  p[i*3]=Math.cos(a)*k*r; p[i*3+1]=y*r; p[i*3+2]=Math.sin(a)*k*r; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2.2,sizeAttenuation:false,fog:false,transparent:true,opacity:.9,depthWrite:false})); m.frustumCulled=false; m.visible=false; scene.add(m); return m; })();
const THEMES={
  day:   {top:'#3d86d8',hor:'#cfe4f2',bot:'#d9c7a8',fog:'#d3e2ec',near:70,far:240,sun:['#fff3df',1.45],sunDir:[-0.45,0.78,0.42],sunSize:0.0016,hemi:['#cfe6ff','#b98a62',0.55],amb:0.05,exp:1.0,glow:0.15,win:0.0,stars:false},
  sunset:{top:'#3a4f8f',hor:'#f2a77a',bot:'#6b4a3a',fog:'#e2a985',near:55,far:200,sun:['#ffb070',1.55],sunDir:[-0.8,0.2,0.56],sunSize:0.0024,hemi:['#ffcfa8','#7a4a36',0.5],amb:0.05,exp:1.05,glow:0.4,win:0.35,stars:false},
  night: {top:'#03061a',hor:'#1b2550',bot:'#0b0f1e',fog:'#141c38',near:22,far:130,sun:['#a9bcff',0.45],sunDir:[0.35,0.7,-0.6],sunSize:0.0011,hemi:['#6f85c8','#1e1828',0.35],amb:0.06,exp:1.15,glow:1,win:1.6,stars:true}
};
let THEME=THEMES.sunset, curTheme='';
const glowMats=[], windowMats=[], backdropMats=[];
let envRT=null; const pmrem=GQ.env&&THREE.PMREMGenerator?new THREE.PMREMGenerator(renderer):null;
function applyTheme(name){
  const T=THEMES[name]||THEMES.sunset; THEME=T; if(curTheme===name&&scene.environment!==undefined&&envRT) { glowMats.forEach(m=>m.opacity=T.glow); return; } curTheme=name;
  const u=skyMat.uniforms; u.top.value.copy(lin(T.top)); u.hor.value.copy(lin(T.hor)); u.bot.value.copy(lin(T.bot));
  u.sunDir.value.set(...T.sunDir).normalize(); u.sunCol.value.copy(lin(T.sun[0])).multiplyScalar(T.stars?0.25:1); u.sunSize.value=T.sunSize;
  setCol(scene.fog.color,T.fog); scene.fog.near=T.near; scene.fog.far=T.far;
  setCol(hemi.color,T.hemi[0]); setCol(hemi.groundColor,T.hemi[1]); hemi.intensity=T.hemi[2];
  setCol(sun.color,T.sun[0]); sun.intensity=T.sun[1]; amb.intensity=T.amb; renderer.toneMappingExposure=T.exp;
  stars.visible=T.stars; glowMats.forEach(m=>m.opacity=T.glow);
  windowMats.forEach(m=>{ m.emissiveIntensity=T.win; });
  backdropMats.forEach(b=>{ b.m.color.copy(lin(b.base)).lerp(lin(T.hor),b.haze); });
  if(pmrem){ // reflections that match the sky
    const es=new THREE.Scene(); const sm=new THREE.Mesh(new THREE.SphereGeometry(50,32,16),skyMat); es.add(sm);
    const g=new THREE.Mesh(new THREE.CircleGeometry(48,32),new THREE.MeshBasicMaterial({color:T.bot,side:THREE.DoubleSide})); g.rotation.x=-Math.PI/2; g.position.y=-2; es.add(g);
    const rt=pmrem.fromScene(es,0.02,0.1,100); if(envRT) envRT.dispose(); envRT=rt; scene.environment=rt.texture;
    sm.geometry.dispose(); g.geometry.dispose(); g.material.dispose();
  }
}
/* keep the shadow box centred on the player, snapped to texels to avoid shimmering */
function updateSun(cx,cz){
  const d=sun.userData.dir||(sun.userData.dir=new THREE.Vector3()); d.set(...THEME.sunDir).normalize();
  const step=GQ.shadow?92/GQ.shadow:1; cx=Math.round(cx/step)*step; cz=Math.round(cz/step)*step;
  sun.target.position.set(cx,0,cz); sun.position.set(cx+d.x*160,d.y*160,cz+d.z*160); sun.target.updateMatrixWorld();
  skyMesh.position.copy(camera.position); stars.position.copy(camera.position);
}
/* ---------- post-processing ---------- */
let composer=null, fxaaPass=null, bloomPass=null;
function setupPost(){
  if(!GQ.post||!THREE.EffectComposer||!THREE.RenderPass||!THREE.UnrealBloomPass||!THREE.ShaderPass||!THREE.GammaCorrectionShader||!THREE.CopyShader) return;
  try{
    const w=innerWidth,h=innerHeight, isGL2=renderer.capabilities.isWebGL2;
    const rt=new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:isGL2?THREE.HalfFloatType:THREE.UnsignedByteType});
    composer=new THREE.EffectComposer(renderer,rt);
    composer.addPass(new THREE.RenderPass(scene,camera));
    bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(w,h),0.55,0.45,0.82); composer.addPass(bloomPass);
    composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    if(THREE.FXAAShader){ fxaaPass=new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaaPass); }
  }catch(err){ console.warn('후처리 효과를 끌게요:',err); composer=null; }
}
function gfxResize(w,h){
  renderer.setSize(w,h,false);
  if(composer){ composer.setSize(w,h); const pr=renderer.getPixelRatio(); if(fxaaPass) fxaaPass.material.uniforms.resolution.value.set(1/(w*pr),1/(h*pr)); if(bloomPass) bloomPass.setSize(w,h); }
}
let postBroken=false;
function renderFrame(dt){
  if(composer&&!postBroken){ try{ composer.render(dt); return; }catch(err){ console.warn('후처리 오류로 기본 렌더링으로 바꿔요:',err); postBroken=true; } }
  renderer.render(scene,camera);
}
setupPost();
/* ---------- helpers ---------- */
function rnd2(i){ const s=Math.sin(i*127.1+311.7)*43758.5453; return s-Math.floor(s); }
let buildingMap=false; // textures made while a map is being built get disposed when the map changes
const PER_MAP_TEX=new WeakSet(); // three.js r128 textures have no userData
function cvTex(w,h,draw,rep,linear){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(cv); if(!linear) t.encoding=THREE.sRGBEncoding; if(buildingMap) PER_MAP_TEX.add(t); t.anisotropy=MAX_ANISO; if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } return t; }
/* material factory: physically based on medium/high, cheap Lambert on low */
function MAT(o){
  o=Object.assign({},o);
  if(!GQ.std){ for(const k of ['roughness','metalness','normalMap','normalScale','envMapIntensity','roughnessMap','flatShading']) delete o[k]; return new THREE.MeshLambertMaterial(o); }
  if(o.normalScale!==undefined&&typeof o.normalScale==='number') o.normalScale=new THREE.Vector2(o.normalScale,o.normalScale);
  return new THREE.MeshStandardMaterial(Object.assign({roughness:0.7,metalness:0},o));
}
const shadowed=(m,cast,recv)=>{ m.castShadow=cast!==false&&GQ.shadow>0; m.receiveShadow=recv!==false&&GQ.shadow>0; return m; };
function rbox(w,h,d,r,seg){ // rounded box when the add-on is present
  if(THREE.RoundedBoxGeometry&&GQ.std){ try{ return new THREE.RoundedBoxGeometry(w,h,d,seg||2,Math.min(r,w/2-0.01,h/2-0.01,d/2-0.01)); }catch(_){} }
  return new THREE.BoxGeometry(w,h,d);
}
/* ---------- procedural PBR textures (colour + normal maps generated once) ---------- */
function noiseField(n,oct,seed,scale){ // tileable value noise, returns Float32Array n*n in 0..1
  const R=mulberry(seed), out=new Float32Array(n*n); let amp=1, tot=0;
  for(let o=0;o<oct;o++){ const g=Math.max(2,Math.round((scale||4)*Math.pow(2,o))), grid=new Float32Array(g*g); for(let i=0;i<g*g;i++) grid[i]=R();
    for(let y=0;y<n;y++){ const fy=y/n*g, y0=Math.floor(fy), ty=fy-y0, sy=ty*ty*(3-2*ty);
      for(let x=0;x<n;x++){ const fx=x/n*g, x0=Math.floor(fx), tx=fx-x0, sx=tx*tx*(3-2*tx);
        const a=grid[(y0%g)*g+(x0%g)], b=grid[(y0%g)*g+((x0+1)%g)], c=grid[((y0+1)%g)*g+(x0%g)], d=grid[((y0+1)%g)*g+((x0+1)%g)];
        out[y*n+x]+=((a*(1-sx)+b*sx)*(1-sy)+(c*(1-sx)+d*sx)*sy)*amp; } }
    tot+=amp; amp*=0.5; }
  for(let i=0;i<n*n;i++) out[i]/=tot; return out;
}
function heightToNormal(hf,n,strength){
  return cvTex(n,n,(x)=>{ const im=x.createImageData(n,n), d=im.data;
    for(let y=0;y<n;y++)for(let xx=0;xx<n;xx++){ const l=hf[y*n+(xx-1+n)%n], r=hf[y*n+(xx+1)%n], u=hf[((y-1+n)%n)*n+xx], dn=hf[((y+1)%n)*n+xx];
      let nx=(l-r)*strength, ny=(u-dn)*strength, nz=1; const L=Math.hypot(nx,ny,nz); nx/=L; ny/=L; nz/=L; const i=(y*n+xx)*4;
      d[i]=(nx*.5+.5)*255; d[i+1]=(ny*.5+.5)*255; d[i+2]=(nz*.5+.5)*255; d[i+3]=255; }
    x.putImageData(im,0,0); },true,true);
}
function colorFromHeight(hf,n,fn){ return cvTex(n,n,(x)=>{ const im=x.createImageData(n,n), d=im.data; for(let i=0;i<n*n;i++){ const c=fn(hf[i],i%n,(i/n)|0); d[i*4]=c[0]; d[i*4+1]=c[1]; d[i*4+2]=c[2]; d[i*4+3]=255; } x.putImageData(im,0,0); },true); }
const PBR=(function(){
  const N=GQ.tex, out={};
  // desert sand: soft dunes + wind ripples
  let h=noiseField(N,5,3,3); const rip=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const i=y*N+x; rip[i]=h[i]*0.7+0.3*(0.5+0.5*Math.sin((y/N*36+h[i]*6)*Math.PI*2)); }
  out.sandN=heightToNormal(rip,N,2.2); out.sandC=colorFromHeight(h,N,(v)=>[200+v*45,160+v*38,118+v*30]);
  // concrete tiles (neo plaza): seams + speckle
  h=noiseField(N,5,9,6); const ct=new Float32Array(N*N), seam=Math.max(2,N/128);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const i=y*N+x, onSeam=(x%(N/2)<seam)||(y%(N/2)<seam); ct[i]=onSeam?0:0.6+h[i]*0.4; }
  out.concN=heightToNormal(ct,N,3); out.concC=colorFromHeight(ct,N,(v)=>{ const g=v<0.05?150:206+(v-0.6)*60; return [g,g+4,g+8]; });
  // rock strata
  h=noiseField(N,5,21,3); const rk=new Float32Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const i=y*N+x; rk[i]=h[i]*0.6+0.4*Math.abs(Math.sin((y/N*10+h[i]*3)*Math.PI)); }
  out.rockN=heightToNormal(rk,N,4.5);
  // metal panels (desert buildings): panel seams + rivets
  const mp=new Float32Array(N*N); h=noiseField(N,4,31,8);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const i=y*N+x, px=x%(N/2), py=y%(N/4); let v=0.6+h[i]*0.1; if(px<seam||py<seam) v=0.1; if((px-N/16)**2+(py-N/16)**2<(N/90)**2) v=1; mp[i]=v; }
  out.panelN=heightToNormal(mp,N,3.5);
  out.panelC=colorFromHeight(mp,N,(v,x,y)=>{ const dust=Math.max(0,(y/N-0.62))*1.6; const g=v<0.2?120:222; return [g-dust*10,g-dust*45,g-dust*85]; });
  // smooth white composite (neo buildings): faint large panels
  const wp=new Float32Array(N*N); for(let y=0;y<N;y++)for(let x=0;x<N;x++){ wp[y*N+x]=((x%(N/2))<seam||(y%(N/2))<seam)?0.2:0.7; }
  out.whiteN=heightToNormal(wp,N,1.5);
  // grass/turf
  h=noiseField(N,5,41,10); out.turfN=heightToNormal(h,N,2); out.turfC=colorFromHeight(h,N,(v)=>[70+v*60,150+v*70,60+v*40]);
  // metal tread plate
  const tr=new Float32Array(N*N); for(let y=0;y<N;y++)for(let x=0;x<N;x++){ const a=((x+y)%(N/8))<N/24, b=((x-y+N*4)%(N/8))<N/24; tr[y*N+x]=(((x/(N/16))|0)+((y/(N/16))|0))%2?(a?1:0.4):(b?1:0.4); }
  out.treadN=heightToNormal(tr,N,2.5);
  for(const k in out) PER_MAP_TEX.delete(out[k]);
  return out;
})();
const repeatTex=(t,rx,ry)=>{ const c=t.clone(); c.needsUpdate=true; c.wrapS=c.wrapT=THREE.RepeatWrapping; c.repeat.set(rx,ry); PER_MAP_TEX.add(c); return c; };
/* ---------- older canvas textures still used by a few props ---------- */
const texStripe=cvTex(64,64,(x)=>{ x.fillStyle='#2b2622'; x.fillRect(0,0,64,64); x.fillStyle='#f2c81c';
  for(let i=-64;i<128;i+=22){ x.beginPath(); x.moveTo(i,64); x.lineTo(i+11,64); x.lineTo(i+75,0); x.lineTo(i+64,0); x.fill(); } },true);
const texCrate=cvTex(128,128,(x)=>{ x.fillStyle='#c9cdd1'; x.fillRect(0,0,128,128); x.strokeStyle='#7f868d'; x.lineWidth=10; x.strokeRect(6,6,116,116);
  x.beginPath(); x.moveTo(12,12); x.lineTo(116,116); x.stroke(); x.fillStyle='#d9774c'; x.fillRect(6,54,116,16); });
const texSwirl=cvTex(128,128,(x)=>{ const g=x.createRadialGradient(64,64,4,64,64,64); g.addColorStop(0,'rgba(255,255,255,.95)'); g.addColorStop(.35,'rgba(170,120,255,.8)'); g.addColorStop(1,'rgba(63,224,232,0)');
  x.fillStyle=g; x.fillRect(0,0,128,128); x.strokeStyle='rgba(255,255,255,.55)'; x.lineWidth=3;
  for(let k=0;k<4;k++){ x.beginPath(); for(let t=0;t<1;t+=0.02){ const a=k*Math.PI/2+t*5, r=t*60; x.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r); } x.stroke(); } });
function textSprite(text,color,bg,scale){
  const t=cvTex(256,64,(x)=>{ x.font='bold 30px "Black Han Sans", sans-serif'; x.textAlign='center'; x.textBaseline='middle';
    const w=Math.min(250,x.measureText(text).width+28); if(bg){ x.fillStyle=bg; x.beginPath(); if(x.roundRect) x.roundRect(128-w/2,8,w,48,14); else x.rect(128-w/2,8,w,48); x.fill(); }
    x.fillStyle=color; x.fillText(text,128,33); });
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,fog:false})); s.scale.set(4*(scale||1),1*(scale||1),1); s.userData.dynamic=true; return s;
}
const HALO=cvTex(64,64,(x)=>{ const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,.95)'); g.addColorStop(.4,'rgba(255,255,255,.35)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); });
const haloTex=()=>HALO;
const isNeo=()=>MAP&&MAP.style==='neo';
/* ---------- floating dust in sunlight ---------- */
const dust=(function(){ if(!GQ.dust) return null; const n=360, p=new Float32Array(n*3), R=mulberry(5); for(let i=0;i<n*3;i++) p[i]=(R()-.5)*60;
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const m=new THREE.Points(g,new THREE.PointsMaterial({map:HALO,color:0xfff1d6,size:0.09,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));
  m.frustumCulled=false; scene.add(m); return m; })();
function updateDust(dt){ if(!dust) return; const a=dust.geometry.attributes.position, c=camera.position;
  dust.material.color.copy(lin(THEME.stars?'#9fb4ff':'#fff1d6')); dust.material.opacity=THEME.stars?.25:.45;
  for(let i=0;i<a.count;i++){ let x=a.getX(i)+Math.sin(perfT*.3+i)*dt*.25, y=a.getY(i)+dt*.08, z=a.getZ(i)+Math.cos(perfT*.25+i*1.7)*dt*.25;
    if(x-c.x>30) x-=60; if(c.x-x>30) x+=60; if(z-c.z>30) z-=60; if(c.z-z>30) z+=60; if(y-c.y>12) y-=24; if(c.y-y>12) y+=24; a.setXYZ(i,x,y,z); }
  a.needsUpdate=true; }
