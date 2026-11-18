/* fx.js — particles (smoke, fire, sparks, blood), tracers, bullet-hole decals, debris/shell casings, flash lights. */
'use strict';
const FX=(()=>{
  let scene=null, sysN=null, sysA=null, tracers=null, decals=null, debris=null; const lights=[]; let decalI=0;
  function softTex(kind){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
    if(kind==='smoke'){ for(let i=0;i<14;i++){ const x=20+Math.random()*24, y=20+Math.random()*24, r=10+Math.random()*16; const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,0.35)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); } }
    else { const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.25,'rgba(255,255,255,0.8)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); }
    const t=new THREE.CanvasTexture(c); return t; }
  class PSys{
    constructor(N,additive,tex){ this.N=N; this.n=0; this.p=new Float32Array(N*16); // x y z vx vy vz life max size grow r g b a drag grav
      const g=new THREE.BufferGeometry(); this.pos=new Float32Array(N*3); this.col=new Float32Array(N*4); this.siz=new Float32Array(N);
      g.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aColor',new THREE.BufferAttribute(this.col,4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aSize',new THREE.BufferAttribute(this.siz,1).setUsage(THREE.DynamicDrawUsage));
      const m=new THREE.ShaderMaterial({uniforms:Object.assign({map:{value:tex},scale:{value:600}},THREE.UniformsLib.fog),fog:true,transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
        vertexShader:`attribute vec4 aColor; attribute float aSize; uniform float scale; varying vec4 vC;
          #include <fog_pars_vertex>
          void main(){ vC=aColor; vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*scale/max(0.1,-mvPosition.z); gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
          }`,
        fragmentShader:`uniform sampler2D map; varying vec4 vC;
          #include <fog_pars_fragment>
          void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC.rgb*t.rgb,vC.a*t.a); if(gl_FragColor.a<0.005) discard;
          #include <fog_fragment>
          }`});
      this.mesh=new THREE.Points(g,m); this.mesh.frustumCulled=false; this.mesh.renderOrder=additive?3:2; }
    add(x,y,z,o){ if(this.n>=this.N) return; const i=this.n++*16, p=this.p;
      p[i]=x;p[i+1]=y;p[i+2]=z;p[i+3]=o.vx||0;p[i+4]=o.vy||0;p[i+5]=o.vz||0;p[i+6]=0;p[i+7]=o.life||1;p[i+8]=o.size||0.3;p[i+9]=o.grow||0;
      const c=o.color||[1,1,1]; p[i+10]=c[0];p[i+11]=c[1];p[i+12]=c[2];p[i+13]=o.alpha!=null?o.alpha:1;p[i+14]=o.drag!=null?o.drag:1;p[i+15]=o.grav||0; }
    update(dt){ const p=this.p; let w=0;
      for(let r=0;r<this.n;r++){ const i=r*16; p[i+6]+=dt; if(p[i+6]>=p[i+7]) continue;
        const dr=Math.max(0,1-p[i+14]*dt); p[i+3]*=dr; p[i+4]=p[i+4]*dr-p[i+15]*dt; p[i+5]*=dr; p[i]+=p[i+3]*dt; p[i+1]+=p[i+4]*dt; p[i+2]+=p[i+5]*dt;
        if(w!==r) for(let k=0;k<16;k++) p[w*16+k]=p[i+k];
        const j=w*16, t=p[j+6]/p[j+7]; this.pos[w*3]=p[j]; this.pos[w*3+1]=p[j+1]; this.pos[w*3+2]=p[j+2];
        const fade=t<0.12?t/0.12:1-(t-0.12)/0.88; this.col[w*4]=p[j+10]; this.col[w*4+1]=p[j+11]; this.col[w*4+2]=p[j+12]; this.col[w*4+3]=p[j+13]*fade;
        this.siz[w]=p[j+8]*(1+p[j+9]*t); w++; }
      this.n=w; const g=this.mesh.geometry; g.setDrawRange(0,w); g.attributes.position.needsUpdate=true; g.attributes.aColor.needsUpdate=true; g.attributes.aSize.needsUpdate=true;
      this.mesh.material.uniforms.scale.value=R.renderer.domElement.height/(2*Math.tan(R.camera.fov*Math.PI/360)); }
  }
  function init(){
    scene=R.scene; if(sysN){ scene.remove(sysN.mesh,sysA.mesh,tracers.mesh,decals,debris.mesh); }
    sysN=new PSys(Math.round(2600*QUALITY.particles),false,softTex('smoke')); sysA=new PSys(Math.round(2200*QUALITY.particles),true,softTex('glow')); scene.add(sysN.mesh,sysA.mesh);
    /* tracers */
    const TN=64, tg=new THREE.BufferGeometry(); const tp=new Float32Array(TN*6), tc=new Float32Array(TN*8);
    tg.setAttribute('position',new THREE.BufferAttribute(tp,3)); tg.setAttribute('color',new THREE.BufferAttribute(tc,4));
    const tm=new THREE.LineSegments(tg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})); tm.frustumCulled=false; scene.add(tm);
    tracers={mesh:tm,list:[],N:TN};
    /* decals */
    const dt=Assets.canvasTex(64,64,(g)=>{ const gr=g.createRadialGradient(32,32,0,32,32,30); gr.addColorStop(0,'rgba(10,10,10,1)'); gr.addColorStop(0.35,'rgba(25,22,20,0.95)'); gr.addColorStop(0.6,'rgba(40,35,30,0.4)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); });
    decals=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:dt,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,roughness:1}),160);
    decals.count=0; decals.frustumCulled=false; decals.renderOrder=1; scene.add(decals); decalI=0;
    /* debris & casings */
    const DN=260; const dm=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({roughness:0.6,metalness:0.3}),DN); dm.count=0; dm.frustumCulled=false; dm.castShadow=false;
    dm.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(DN*3),3); scene.add(dm); debris={mesh:dm,list:[],N:DN};
    for(const L of lights) L.parent&&L.parent.remove(L); lights.length=0;
    if(QUALITY.lights>=12) for(let i=0;i<2;i++){ const L=new THREE.PointLight('#ffb060',0,12,2); L.userData.t=0; scene.add(L); lights.push(L); }
  }
  function flashLight(x,y,z,color,int,dur,dist){ if(!lights.length) return; let L=lights.find(l=>l.userData.t<=0)||lights[0]; L.color.set(color); L.position.set(x,y,z); L.intensity=int; L.distance=dist||12; L.userData.t=dur; L.userData.d=dur; L.userData.i=int; }
  const _q=new THREE.Quaternion(), _m=new THREE.Matrix4(), _v=new THREE.Vector3(), _n=new THREE.Vector3(0,0,1), _s=new THREE.Vector3();
  /* ---------- public effects ---------- */
  function muzzle(x,y,z,dx,dy,dz,big){ const s=big?1.4:1;
    sysA.add(x,y,z,{life:0.06,size:0.5*s,color:[1,0.75,0.4],alpha:1}); sysA.add(x+dx*0.15,y+dy*0.15,z+dz*0.15,{life:0.05,size:0.35*s,color:[1,0.85,0.5]});
    sysN.add(x+dx*0.3,y+dy*0.3,z+dz*0.3,{vx:dx*1.5,vy:0.6,vz:dz*1.5,life:0.7,size:0.35*s,grow:2.5,color:[0.75,0.75,0.75],alpha:0.18});
    flashLight(x,y,z,'#ffb46a',big?40:24,0.05,10); }
  function tracer(ax,ay,az,bx,by,bz,color){ const t=tracers; if(t.list.length>=t.N) t.list.shift(); t.list.push({a:[ax,ay,az],b:[bx,by,bz],life:0.09,max:0.09,c:color||[1,0.85,0.55]}); }
  function impact(x,y,z,nx,ny,nz,kind){
    const c=kind==='metal'?[1,0.8,0.5]:kind==='wood'?[0.6,0.45,0.3]:kind==='sand'?[0.85,0.72,0.5]:[0.7,0.68,0.64];
    for(let i=0;i<5;i++) sysN.add(x,y,z,{vx:nx*rand(1,3)+rand(-1,1),vy:ny*rand(1,3)+rand(0,1.5),vz:nz*rand(1,3)+rand(-1,1),life:rand(0.4,0.9),size:rand(0.12,0.3),grow:2,color:c,alpha:0.55,grav:3});
    if(kind==='metal'||Math.random()<0.4) for(let i=0;i<4;i++) sysA.add(x,y,z,{vx:nx*rand(2,6)+rand(-3,3),vy:ny*rand(2,6)+rand(0,3),vz:nz*rand(2,6)+rand(-3,3),life:rand(0.12,0.3),size:0.06,color:[1,0.7,0.3],grav:9});
    decal(x,y,z,nx,ny,nz,rand(0.09,0.14)); }
  function decal(x,y,z,nx,ny,nz,size){ _n.set(nx,ny,nz).normalize(); _q.setFromUnitVectors(new THREE.Vector3(0,0,1),_n);
    const rq=new THREE.Quaternion().setFromAxisAngle(_n,Math.random()*6.28); _q.premultiply(rq);
    _m.compose(_v.set(x+nx*0.012,y+ny*0.012,z+nz*0.012),_q,_s.set(size,size,size)); decals.setMatrixAt(decalI,_m); decalI=(decalI+1)%160; decals.count=Math.max(decals.count,decalI===0?160:decalI); decals.instanceMatrix.needsUpdate=true; }
  function blood(x,y,z,dx,dz,amount){ for(let i=0;i<(amount||6);i++) sysN.add(x,y,z,{vx:dx*rand(0.5,2.5)+rand(-1,1),vy:rand(-0.5,2),vz:dz*rand(0.5,2.5)+rand(-1,1),life:rand(0.3,0.7),size:rand(0.1,0.25),grow:1.5,color:[0.55,0.03,0.03],alpha:0.85,grav:6}); }
  function explosion(x,y,z,r,kind){ r=r||4;
    sysA.add(x,y+0.3,z,{life:0.18,size:r*2.4,color:[1,0.85,0.6],alpha:1});
    for(let i=0;i<26;i++){ const a=Math.random()*6.28, b=Math.random()*1.4, sp=rand(2,7)*r/4; sysA.add(x,y+0.4,z,{vx:Math.cos(a)*Math.cos(b)*sp,vy:Math.sin(b)*sp+1,vz:Math.sin(a)*Math.cos(b)*sp,life:rand(0.35,0.75),size:rand(0.8,1.8)*r/4,grow:1.2,color:[1,rand(0.35,0.6),0.12],drag:3}); }
    for(let i=0;i<22;i++){ const a=Math.random()*6.28, sp=rand(1,4)*r/4; sysN.add(x,y+0.6,z,{vx:Math.cos(a)*sp,vy:rand(1,4),vz:Math.sin(a)*sp,life:rand(1.6,3.2),size:rand(1.4,2.6)*r/4,grow:1.8,color:[0.18,0.17,0.16],alpha:0.6,drag:1.6,grav:-0.4}); }
    for(let i=0;i<18;i++) sysA.add(x,y+0.5,z,{vx:rand(-12,12),vy:rand(3,12),vz:rand(-12,12),life:rand(0.5,1.1),size:0.08,color:[1,0.65,0.25],grav:14,drag:0.5});
    flashLight(x,y+1,z,'#ff9a4a',260,0.35,r*5); decal(x,0.02,z,0,1,0,r*0.7);
    debrisBurst(x,y+0.3,z,'concrete',10); }
  function puff(x,y,z,o){ sysN.add(x,y,z,Object.assign({life:1.5,size:1,grow:1.5,color:[0.8,0.8,0.8],alpha:0.3,drag:0.8},o)); }
  function smokeCloud(x,y,z,r,dur){ // grenade smoke: emits for a while; caller keeps SMOKES entry for LOS
    for(let i=0;i<40;i++){ const a=Math.random()*6.28, d=Math.random()*r*0.7; sysN.add(x+Math.cos(a)*d,y+rand(0.3,2.6),z+Math.sin(a)*d,{vx:Math.cos(a)*0.4,vy:rand(0,0.25),vz:Math.sin(a)*0.4,life:dur*rand(0.7,1),size:rand(3.4,5.2),grow:0.5,color:[0.78,0.78,0.8],alpha:0.62,drag:0.3}); } }
  function sparkle(x,y,z,color,n){ for(let i=0;i<(n||10);i++) sysA.add(x,y,z,{vx:rand(-2,2),vy:rand(0.5,3),vz:rand(-2,2),life:rand(0.4,0.9),size:rand(0.1,0.22),color:color||[1,0.9,0.4],grav:3}); }
  function ring(x,y,z,color,r){ for(let i=0;i<28;i++){ const a=i/28*6.28; sysA.add(x,y,z,{vx:Math.cos(a)*r*3,vy:0.2,vz:Math.sin(a)*r*3,life:0.35,size:0.35,color,drag:4}); } }
  const DCOL={wood:[0.45,0.3,0.16],metal:[0.35,0.33,0.32],concrete:[0.6,0.58,0.54],brass:[0.85,0.65,0.25],glass:[0.7,0.85,1]};
  function debrisBurst(x,y,z,kind,n){ for(let i=0;i<n;i++){ const s=rand(0.08,0.3)*(kind==='wood'?1.2:1); addDebris(x+rand(-0.4,0.4),y+rand(-0.3,0.3),z+rand(-0.4,0.4),rand(-5,5),rand(2,8),rand(-5,5),[s,s*rand(0.4,1),s*rand(0.5,1.5)],DCOL[kind]||DCOL.concrete,rand(1.5,3)); } }
  function casing(x,y,z,vx,vy,vz,big){ addDebris(x,y,z,vx,vy,vz,big?[0.016,0.016,0.06]:[0.012,0.012,0.03],DCOL.brass,1.2); }
  function addDebris(x,y,z,vx,vy,vz,size,col,life){ const d=debris; if(d.list.length>=d.N) d.list.shift(); d.list.push({x,y,z,vx,vy,vz,rx:rand(0,6),ry:rand(0,6),wx:rand(-12,12),wy:rand(-12,12),size,col,life,t:0}); }
  function update(dt){
    if(!sysN) return; sysN.update(dt); sysA.update(dt);
    // tracers
    const t=tracers, tp=t.mesh.geometry.attributes.position.array, tc=t.mesh.geometry.attributes.color.array; let k=0;
    t.list=t.list.filter(o=>(o.life-=dt)>0);
    for(const o of t.list){ const a=o.life/o.max; const hx=o.a[0]+(o.b[0]-o.a[0])*(1-a*0.9), hy=o.a[1]+(o.b[1]-o.a[1])*(1-a*0.9), hz=o.a[2]+(o.b[2]-o.a[2])*(1-a*0.9);
      const tx=o.a[0]+(o.b[0]-o.a[0])*Math.max(0,1-a*0.9-0.25), ty=o.a[1]+(o.b[1]-o.a[1])*Math.max(0,1-a*0.9-0.25), tz=o.a[2]+(o.b[2]-o.a[2])*Math.max(0,1-a*0.9-0.25);
      tp.set([tx,ty,tz,hx,hy,hz],k*6); tc.set([o.c[0],o.c[1],o.c[2],0,o.c[0],o.c[1],o.c[2],a],k*8); k++; }
    t.mesh.geometry.setDrawRange(0,k*2); t.mesh.geometry.attributes.position.needsUpdate=true; t.mesh.geometry.attributes.color.needsUpdate=true;
    // debris
    const d=debris; d.list=d.list.filter(o=>(o.t+=dt)<o.life); let n=0;
    for(const o of d.list){ o.vy-=18*dt; o.x+=o.vx*dt; o.y+=o.vy*dt; o.z+=o.vz*dt; o.rx+=o.wx*dt; o.ry+=o.wy*dt;
      const g=typeof groundAt==='function'?groundAt(o.x,o.z,o.y+0.3,0.05):0; if(o.y<g+o.size[1]/2){ o.y=g+o.size[1]/2; o.vy*=-0.3; o.vx*=0.6; o.vz*=0.6; o.wx*=0.6; o.wy*=0.6; }
      _q.setFromEuler(new THREE.Euler(o.rx,o.ry,0)); const sc=o.t>o.life-0.3?(o.life-o.t)/0.3:1; _m.compose(_v.set(o.x,o.y,o.z),_q,_s.set(o.size[0]*sc,o.size[1]*sc,o.size[2]*sc)); d.mesh.setMatrixAt(n,_m); d.mesh.instanceColor.setXYZ(n,...o.col); n++; }
    d.mesh.count=n; d.mesh.instanceMatrix.needsUpdate=true; if(d.mesh.instanceColor) d.mesh.instanceColor.needsUpdate=true;
    for(const L of lights){ if(L.userData.t>0){ L.userData.t-=dt; L.intensity=Math.max(0,L.userData.i*(L.userData.t/L.userData.d)); } else L.intensity=0; }
  }
  function clear(){ if(!sysN) return; sysN.n=0; sysA.n=0; tracers.list.length=0; debris.list.length=0; decals.count=0; decalI=0; }
  return {init,update,clear,muzzle,tracer,impact,decal,blood,explosion,puff,smokeCloud,sparkle,ring,debris:debrisBurst,casing,flashLight};
})();
