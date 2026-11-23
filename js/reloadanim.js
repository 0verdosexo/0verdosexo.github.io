/* reloadanim.js — first-person reload animations, in the spirit of CS2.
   Each weapon family has a keyframed sequence over the weapon's own reload time (so balance does not change):
   the gun turns to show the work, the left hand leaves the handguard, the empty magazine drops out of the frame,
   a fresh one comes up from the belt, goes in and gets a slap. An empty gun adds the bolt / slide / charging handle.
   Families: ar (box magazine, AR-15 style), ak (rocked-in magazine), pistol (magazine in the grip), pump (shell by shell),
   bolt (bolt-action / straight-pull), p90 (top magazine), lmg (feed cover + belt box), break (break-action),
   clip (M1 en-bloc clip), rev (swing-out cylinder + speedloader), xbow (crossbow), flint (muzzle-loader with ramrod), tube (rocket pack).
   Gun space = view-model root space: x right, y up, -z toward the muzzle. Sounds are cut from the existing recordings and play in time with the hands. */
'use strict';
const ReloadAnim=(()=>{
  const FAM={m4:'ar',lightsr:'ar',scar:'ar',g36:'ar',famas:'ar',vector:'ar',smg9:'ar',snowcan:'ar',
    ak47:'ak',autosg:'ak',falcon:'ak',
    p1912:'pistol',deagle:'pistol',auto75:'pistol',burst9:'pistol',tagpistol:'pistol',microsmg:'pistol',
    pump:'pump',heavysr:'bolt',piercesr:'bolt',p50:'p90',m249:'lmg',sawed:'break',m1:'clip',revolver:'rev',crossbow:'xbow',flintlock:'flint',mrl:'tube'};
  /* per gun: ea = what an empty reload adds (catch: bolt release, rackL / rackR: a hand pulls the charging handle, none); bp = bullpup */
  const CFG={famas:{ea:'rackL',bp:true},vector:{ea:'rackL'},smg9:{ea:'rackL'},falcon:{ea:'rackL'},microsmg:{ea:'rackL'},p50:{ea:'rackL'},snowcan:{ea:'none',snow:true}};
  const has=id=>!!FAM[id];
  const AIM=new Set(['p90','lmg','break','clip','rev','xbow','flint','tube']);
  const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const ss=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
  /* keyframes: [[t, a, b, c, ...], ...] → [a, b, c, ...] at p, smooth between keys */
  function K(keys,p){ if(p<=keys[0][0]) return keys[0].slice(1);
    for(let i=1;i<keys.length;i++){ const b=keys[i]; if(p<=b[0]){ const a=keys[i-1], e=ss((p-a[0])/Math.max(1e-6,b[0]-a[0])), o=new Array(b.length-1); for(let j=1;j<b.length;j++) o[j-1]=a[j]+(b[j]-a[j])*e; return o; } }
    return keys[keys.length-1].slice(1); }
  const k1=(keys,p)=>K(keys,p)[0];
  const add=(a,b,k)=>{ k=k==null?1:k; return a.map((v,i)=>v+(b[i]||0)*k); };
  const _e=new THREE.Euler(), _v=new THREE.Vector3();
  /* a point turned about a pivot (gun space) */
  const rotAbout=(pt,piv,ax,ay,az)=>pt.clone().sub(piv).applyEuler(_e.set(ax||0,ay||0,az||0)).add(piv);
  /* turn a part (group at the gun origin, children in gun space) about a pivot */
  function turn(G,piv,ax,ay,az){ if(!G) return; G.rotation.set(ax||0,ay||0,az||0); _v.copy(piv).applyEuler(G.rotation); G.position.copy(piv).sub(_v); }
  /* sound cues: slices of the recordings we have */
  const SND={
    rMagOut:['reload_rifle',{offset:0.05,dur:0.3,vol:0.75}], rMagIn:['reload_rifle',{offset:0.85,dur:0.17,vol:0.85}], rSlap:['reload_rifle',{offset:1.02,dur:0.38,vol:0.9}],
    pMagOut:['reload_pistol',{offset:0.04,dur:0.3,vol:0.75}], pMagIn:['reload_pistol',{offset:1.16,dur:0.3,vol:0.85}],
    catch:['switch_02',{rate:1.35,dur:0.2,vol:0.7}], boltFwd:['pump',{offset:0.15,dur:0.25,rate:1.25,vol:0.8}], boltBack:['pump',{offset:0.03,dur:0.13,rate:1.2,vol:0.7}],
    slideBack:['pump',{offset:0.03,dur:0.12,rate:1.7,vol:0.6}], slideFwd:['reload_pistol',{offset:1.22,dur:0.25,rate:1.12,vol:0.85}],
    shellIn:['reload_pistol',{offset:1.2,dur:0.13,rate:1.45,vol:0.7}], pump:['pump',{vol:0.85}],
    awmUp:['switch_01',{rate:0.72,vol:0.6}], awmBack:['pump',{rate:0.82,dur:0.15,vol:0.65}], awmFwd:['pump',{offset:0.13,dur:0.26,rate:0.86,vol:0.7}], awmDown:['switch_02',{rate:0.8,dur:0.2,vol:0.55}],
    grab:['switch_01',{rate:1.3,vol:0.25}],
    coverOpen:['key_open_01',{rate:1.1,vol:0.6}], coverShut:['slam_01',{rate:1.35,dur:0.3,vol:0.6}], belt:['metal_09',{rate:1.5,dur:0.3,vol:0.4}],
    brkOpen:['switch_02',{rate:0.9,dur:0.25,vol:0.75}], eject:['reload_pistol',{offset:0.04,dur:0.22,rate:1.25,vol:0.7}], brkShut:['slam_01',{rate:1.6,dur:0.25,vol:0.65}],
    ping:['bell_02',{rate:2.4,vol:0.3}], cylOut:['switch_01',{rate:0.85,vol:0.65}], casings:['metal_09',{rate:1.8,vol:0.45}], cylIn:['switch_02',{rate:1.2,dur:0.25,vol:0.75}],
    string:['spring_03',{rate:1.3,dur:0.35,vol:0.6}], latch:['switch_02',{rate:1.6,dur:0.18,vol:0.7}], thud:['wooden_02',{rate:1.3,dur:0.2,vol:0.5}],
    cock:['switch_02',{rate:0.85,dur:0.25,vol:0.65}], ballIn:['metal_04',{rate:2.2,dur:0.25,vol:0.3}], twist:['tools_03',{rate:1.6,dur:0.25,vol:0.45}],
    snowIn:['wooden_02',{rate:0.8,dur:0.3,vol:0.5}] };
  function snd(k){ const c=SND[k]; if(c) Sfx.play(c[0],Object.assign({jitter:false},c[1])); }

  /* ---------- small meshes the hands carry ---------- */
  let MT=null; const mats=()=>MT||(MT={hull:new THREE.MeshStandardMaterial({color:'#9a1d17',roughness:0.55}),brass:new THREE.MeshStandardMaterial({color:'#c79a45',roughness:0.3,metalness:0.85}),
    steel:new THREE.MeshStandardMaterial({color:'#3a3d42',roughness:0.45,metalness:0.7}),lead:new THREE.MeshStandardMaterial({color:'#5a5a5e',roughness:0.5,metalness:0.6}),
    wood:new THREE.MeshStandardMaterial({color:'#5a3a22',roughness:0.7}),grey:new THREE.MeshStandardMaterial({color:'#8a9098',roughness:0.5,metalness:0.4}),red:new THREE.MeshStandardMaterial({color:'#b02a20',roughness:0.5})});
  /* geometry is shared (spent shells and clips are made on every reload; new buffers each time would pile up on the GPU) */
  const GEO=new Map(), geo=(k,mk)=>GEO.get(k)||(GEO.set(k,mk()),GEO.get(k));
  const cylZ=(r,l,m,x,y,z,seg)=>{ const o=new THREE.Mesh(geo('c'+r+'_'+l+'_'+(seg||10),()=>new THREE.CylinderGeometry(r,r,l,seg||10)),m); o.rotation.x=Math.PI/2; o.position.set(x||0,y||0,z||0); return o; };
  function shellMesh(){ const G=new THREE.Group(), m=mats(); G.add(cylZ(0.0108,0.05,m.hull,0,0,-0.007,14)); G.add(cylZ(0.0115,0.016,m.brass,0,0,0.024,14)); return G; }
  function casing(){ return cylZ(0.0048,0.03,mats().brass,0,0,0,8); }
  /* M1 en-bloc clip with its eight rounds (two staggered rows) */
  function clipMesh(){ const G=new THREE.Group(), m=mats(); const fr=new THREE.Mesh(geo('clipF',()=>new THREE.BoxGeometry(0.02,0.022,0.06)),m.steel); fr.position.set(0,-0.006,0); G.add(fr);
    for(let i=0;i<4;i++) for(const s of [-1,1]){ const r=cylZ(0.0042,0.07,m.brass,s*0.0045,0.002+i*0.007+(s>0?0.0035:0),-0.006,8); G.add(r); } return G; }
  function emptyClip(){ return new THREE.Mesh(geo('clipE',()=>new THREE.BoxGeometry(0.02,0.02,0.06)),mats().steel); }
  /* revolver speedloader: a knob with six rounds pointing forward */
  function loaderMesh(){ const G=new THREE.Group(), m=mats(); G.add(cylZ(0.019,0.014,m.steel,0,0,0.01,16)); G.add(cylZ(0.008,0.014,m.grey,0,0,0.022,10));
    for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+0.5; G.add(cylZ(0.0048,0.03,m.brass,Math.cos(a)*0.013,Math.sin(a)*0.013,-0.012,8)); } return G; }
  const ballMesh=()=>new THREE.Mesh(geo('ball',()=>new THREE.SphereGeometry(0.0085,10,8)),mats().lead);
  function rodMesh(){ const G=new THREE.Group(); G.add(cylZ(0.003,0.22,mats().brass,0,0,0.11,6)); return G; }

  /* ---------- per-gun setup (once per view model) ---------- */
  function boxOf(G){ const bb=new THREE.Box3(); G.traverse(o=>{ if(o.isMesh){ if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrix); bb.union(b); } }); return bb; }
  /* put an arm under a pivot at its hand, so it can turn about the palm */
  function pivot(root,arm,at){ if(!arm) return null; const P=new THREE.Group(); P.position.copy(at); const W=arm.userData.W, E=arm.userData.E;
    P.userData.axis=W&&E?E.clone().sub(W).normalize():V3(-0.45,-0.77,0.45).normalize(); /* along the forearm: turning about it rolls the palm without swinging the arm */
    root.remove(arm); P.add(arm); arm.position.set(-at.x,-at.y,-at.z); root.add(P); P.userData.at=at.clone(); return P; }
  function hold(R,key,mesh,x,y,z){ if(!R.L||!mesh) return; mesh.visible=false; mesh.position.set(x,y,z); (R.aim?R.root:R.L).add(mesh); R.held[key]=mesh; }
  function prep(vm){ const u=vm.gun.userData, fam=FAM[u.id]; if(!fam) return vm.rl=false;
    const root=vm.group, R={fam,u,root,cfg:CFG[u.id]||{},n:-1,ev:new Set(),drops:[],sm:{},held:{},aim:AIM.has(fam)};
    if(u.mag){ const bb=boxOf(u.mag), top=u.magCenter?bb.getCenter(V3(0,0,0)):V3((bb.min.x+bb.max.x)/2,bb.max.y,(bb.min.z+bb.max.z)/2);
      for(const c of u.mag.children) c.position.sub(top); u.mag.position.copy(top); R.m0=top.clone(); R.mH=bb.max.y-bb.min.y; R.mC=V3(0,-(bb.max.y-bb.min.y)/2,0);
      R.mFront=bb.min.z-top.z; R.mBack=bb.max.z-top.z; }
    R.H=(u.handL||(u.handR&&u.handR.clone().add(V3(0,-0.012,0.004)))||V3(0,-0.04,0.03)).clone();
    R.HR=(u.handR||V3(0,-0.045,0.035)).clone();
    R.L=pivot(root,vm.armL,R.H); R.Rt=pivot(root,vm.armR,R.HR);
    R.d0=R.L?R.L.userData.axis.toArray():[-0.45,-0.77,0.45]; R.n0=u.handL?[0,1,0]:[1,0,0]; /* rest forearm direction and palm normal (cupped under a handguard: palm up; wrapped on a grip: palm right) */
    if(u.charge) R.c0=u.charge.position.clone(); if(u.slide) R.s0=u.slide.position.clone();
    if(fam==='pump') hold(R,'shell',shellMesh(),0.004,0.022,0);
    if(fam==='break'){ const G=new THREE.Group(); for(const s of [-1,1]){ const sh=shellMesh(); sh.position.x=s*0.0118; G.add(sh); } hold(R,'shells',G,0.004,0.024,0); }
    if(fam==='clip') hold(R,'clip',clipMesh(),0.0,0.032,0);
    if(fam==='rev') hold(R,'loader',loaderMesh(),0.0,0.03,0);
    if(fam==='flint'){ hold(R,'ball',ballMesh(),0.002,0.02,0); hold(R,'rod',rodMesh(),0,0.012,0); }
    if(fam==='xbow'&&u.arrow&&u.arrowAt) R.Lar=u.arrowAt.clone().add(V3(0,0.026,0)).sub(R.H);
    /* where the left hand goes to hold the magazine (palm a little left of its middle; on top for a top magazine; in front for the rocket pack) */
    if(R.m0){ let mid;
      if(fam==='p90') mid=R.m0.clone().add(V3(0,0.026,R.mBack*0.55));
      else if(fam==='tube') mid=R.m0.clone().add(V3(-0.064,0,0));
      else mid=R.m0.clone().add(V3(-0.016,-R.mH*(fam==='pistol'?1.05:0.55),0.004));
      R.Lmag=mid.sub(R.H); }
    if(fam==='lmg'&&u.cover){ const bb=boxOf(u.cover); R.cvRear=V3(0,bb.max.y,u.coverHinge.z+(bb.max.z-u.coverHinge.z)*0.55); R.feed=V3(0,bb.min.y+0.004,u.coverHinge.z+0.075); }
    return vm.rl=R; }

  /* ---------- shared pieces ---------- */
  const rel=(R,pt,dx,dy,dz)=>[pt.x-R.H.x+(dx||0),pt.y-R.H.y+(dy||0),pt.z-R.H.z+(dz||0)];
  /* left hand pulls the charging handle at u.chargeAt back over [t0,t1]: hand keys, the handle's travel and the sounds */
  function rackL(R,t0,t1,pull){ const c=R.u.chargeAt; if(!c) return null; const d=t1-t0; pull=pull||0.05;
    /* a handle on top is taken from the left like a left-side one, just higher */
    const side=c.x>0.012?1:-1, top=Math.abs(c.x)<=0.012, tw=side<0?-1.35:0.9, rx=0.15, ox=side<0?(top?-0.024:-0.014):0.014, oy=top?-0.01:-0.024;
    const P=(dx,dy,dz,k)=>[...rel(R,c,ox+dx,oy+dy,dz),rx,0,tw*(k==null?1:k)];
    return {L:[[t0+0.3*d,...P(side*0.025,0.018,-0.02,0.75)],[t0+0.44*d,...P(0,0,0)],[t0+0.7*d,...P(0,0,pull)],[t0+0.8*d,...P(side*0.02,-0.018,pull+0.012,0.7)]],
      charge:[[t0+0.44*d,0],[t0+0.7*d,pull],[t0+0.73*d,0]], cues:[[t0+0.46*d,'boltBack'],[t0+0.73*d,'boltFwd'],[t0+0.735*d,'bump']]}; }
  /* right hand pulls a right-side handle back (and optionally leaves it there) */
  function rackR(R,t0,t1,pull,stay){ const c=R.u.chargeAt, H=R.HR, d=t1-t0, Q=(dx,dy,dz)=>[c.x-H.x+dx,c.y-H.y+dy,c.z-H.z+dz];
    return {Rh:[[t0,0,0,0,0,0,0],[t0+0.35*d,...Q(0.022,-0.012,0.006),0,0,0.5],[t0+0.45*d,...Q(0.012,-0.006,0),0,0,0.6],[t0+0.75*d,...Q(0.012,-0.006,pull),0,0,0.6],[t0+0.85*d,...Q(0.03,-0.02,pull+0.006),0,0,0.4],[t1,0,0,0,0,0,0]],
      charge:stay?[[t0+0.45*d,0],[t0+0.75*d,pull]]:[[t0+0.45*d,0],[t0+0.75*d,pull],[t0+0.78*d,0]], cues:stay?[[t0+0.47*d,'boltBack']]:[[t0+0.47*d,'boltBack'],[t0+0.78*d,'boltFwd'],[t0+0.785*d,'bump']]}; }

  /* ---------- the sequences. Each returns a frame: g = gun turn/shift [rx,ry,rz,px,py,pz], L / Rh = hand offset [dx,dy,dz,rx,ry,twist(,rz)],
     mag: 'seat' | 'gone' | 'hand' | 'rot' (+ magX extra [dx,dy,dz,rx,ry,rz]), parts, held items, and the cue list (t, sound | 'drop' | 'bump' | other events) ---------- */
  const SEQ={
    ar(p,e,R){ const M=R.Lmag, ea=R.cfg.ea||'catch', f={};
      f.g=K([[0,0,0,0,0,0,0],[0.12,0.13,0.0,-0.32,-0.01,0.012,-0.03],[0.55,0.15,0.0,-0.35,-0.01,0.012,-0.03],[0.66,0.18,0.0,-0.37,-0.01,0.018,-0.03],[0.7,0.11,0.0,-0.3,-0.01,0.01,-0.03],
        ...(e&&ea!=='none'?[[0.76,0.2,0.1,-0.36,-0.008,0.008,-0.03],[0.82,0.25,0.12,-0.38,-0.008,0.014,-0.03],[0.86,0.16,0.07,-0.27,-0.006,0.006,-0.02],[1,0,0,0,0,0,0]]:[[0.82,0.1,0.03,-0.15,-0.004,0.004,-0.015],[1,0,0,0,0,0,0]])],p);
      if(R.cfg.bp){ const w=ss(p/0.12)-ss((p-0.86)/0.14); f.g=add(f.g,[-0.1,0.45,0.25,-0.06,0.04,-0.12],w); } /* bullpup: bring the magazine behind the grip out in front of you */
      if(R.cfg.snow){ const w=ss(p/0.12)-ss((p-0.86)/0.14); f.g=add(f.g,[0,0.3,0.12,-0.03,0.02,-0.16],w); }
      const at=(dx,dy,dz)=>[M.x+dx,M.y+dy,M.z+dz];
      let tail=[[0.8,...at(-0.01,-0.04,0.03),0.25,0,-0.4],[0.95,0,0,0,0,0,0]], rk=null;
      if(e&&ea==='catch') tail=[[0.74,...at(-0.03,0.05,-0.012),0.1,0,-1.4],[0.79,...at(-0.02,0.058,-0.012),0.1,0,-1.45],[0.82,...at(-0.03,0.05,-0.012),0.1,0,-1.3],[0.95,0,0,0,0,0,0]];
      if(e&&ea==='rackL'&&(rk=rackL(R,0.68,0.94,0.05))) tail=[...rk.L,[0.98,0,0,0,0,0,0]];
      f.L=K([[0,0,0,0,0,0,0],[0.08,...at(-0.02,-0.03,0.03),0.2,0,-0.6],[0.16,...at(0,0,0),0.2,0,-1.25],[0.2,...at(0,-0.015,0),0.2,0,-1.25],[0.3,...at(-0.05,-0.2,0.05),0.4,0,-0.8],[0.38,...at(-0.07,-0.32,0.08),0.5,0,-0.6],
        [0.43,...at(-0.06,-0.3,0.07),0.4,0,-0.9],[0.55,...at(-0.006,-0.075,0.006),0.2,0,-1.25],[0.63,...at(0,-0.008,0),0.15,0,-1.25],[0.66,...at(0,0.004,0),0.1,0,-1.1],[0.69,...at(0,-0.03,0.01),0.2,0,-0.6],...tail],p);
      f.mag=p<0.2?'seat':p<0.43?'gone':p<0.66?'hand':'seat'; f.magX=K([[0.43,-0.01,-0.04,0.01,0.5,0,0.2],[0.55,0,-0.02,0,0.12,0,0],[0.63,0,-0.004,0,0,0,0],[0.66,0,0,0,0,0,0]],p);
      const mi=R.cfg.snow?'snowIn':'rMagIn';
      f.cues=[[0.19,'rMagOut'],[0.2,'drop'],[0.42,'grab'],[0.63,mi],[0.68,'rSlap'],[0.68,'bump']].concat(e&&ea==='catch'?[[0.8,'catch'],[0.805,'boltFwd'],[0.81,'bump']]:rk?rk.cues:[]);
      if(rk) f.charge=K(rk.charge,p)[0];
      return f; },
    ak(p,e,R){ const M=R.Lmag, fr=R.mFront||-0.03, rl=e&&R.cfg.ea==='rackL', f={};
      f.g=K([[0,0,0,0,0,0,0],[0.12,0.14,0.0,-0.32,-0.01,0.012,-0.03],[0.5,0.16,0.0,-0.35,-0.01,0.012,-0.03],[0.58,0.19,0.0,-0.37,-0.01,0.018,-0.03],[0.62,0.12,0.0,-0.29,-0.01,0.01,-0.03],
        ...(rl?[[0.72,0.2,0.1,-0.36,-0.008,0.008,-0.03],[0.8,0.24,0.12,-0.38,-0.008,0.014,-0.03],[0.86,0.16,0.07,-0.27,-0.006,0.006,-0.02],[1,0,0,0,0,0,0]]
          :e?[[0.7,0.1,-0.08,0.22,0.0,0.016,-0.03],[0.8,0.08,-0.1,0.28,0.0,0.02,-0.03],[0.86,0.1,-0.06,0.18,0.0,0.01,-0.02],[1,0,0,0,0,0,0]]:[[0.78,0.1,0.03,-0.15,-0.004,0.004,-0.015],[1,0,0,0,0,0,0]])],p);
      const at=(dx,dy,dz)=>[M.x+dx,M.y+dy,M.z+dz], ch=R.u.chargeAt||V3(0.04,0.06,-0.06);
      const rk=rl?rackL(R,0.64,0.92,0.06):null;
      f.L=K([[0,0,0,0,0,0,0],[0.08,...at(-0.02,-0.02,0.02),0.2,0,-0.6],[0.15,...at(0,0,0),0.2,0,-1.25],[0.2,...at(0,-0.01,-0.03),0.5,0,-1.2],[0.26,...at(-0.02,-0.08,-0.02),0.7,0,-1.0],
        [0.33,...at(-0.07,-0.3,0.06),0.5,0,-0.6],[0.38,...at(-0.06,-0.3,0.06),0.5,0,-0.9],[0.48,...at(0,-0.06,-0.03),0.4,0,-1.2],[0.55,...at(0,-0.01,-0.012),0.35,0,-1.25],[0.6,...at(0,0.003,0),0.2,0,-1.2],[0.63,...at(0,-0.025,0.01),0.25,0,-0.6],
        ...(rk?[...rk.L,[0.97,0,0,0,0,0,0]]:e?[[0.72,...at(-0.01,-0.04,0.03),0.25,0,-0.4],[0.9,0,0,0,0,0,0]]:[[0.78,...at(-0.01,-0.04,0.03),0.25,0,0.1],[0.95,0,0,0,0,0,0]])],p);
      /* rock out about the front lip, rock the new one in the same way */
      f.mag=p<0.15?'seat':p<0.26?'hand':p<0.38?'gone':p<0.6?'hand':'seat';
      f.magX=p<0.3?K([[0.15,0,0,0,0,0,0],[0.2,0,-0.006,-0.012,-0.4,0,0],[0.26,0,-0.03,-0.02,-0.5,0,0]],p):K([[0.38,0,-0.04,0,-0.7,0,0.2],[0.48,0,-0.02,-0.012,-0.45,0,0],[0.55,0,-0.006,-0.004,-0.3,0,0],[0.6,0,0,0,0,0,0]],p);
      f.magPiv=fr; f.handMag=p<0.3?K([[0.15,0],[0.2,1]],p)[0]:1;
      if(rk) f.charge=K(rk.charge,p)[0];
      else if(e){ f.charge=K([[0.74,0],[0.79,0.072],[0.8,0.074],[0.815,0]],p)[0]; const HR=R.HR, Q=(dx,dy,dz)=>[ch.x-HR.x+dx,ch.y-HR.y+dy,ch.z-HR.z+dz]; f.Rh=K([[0.66,0,0,0,0,0,0],[0.72,...Q(0.022,-0.012,0.006),0,0,0.5],[0.74,...Q(0.012,-0.006,0),0,0,0.6],[0.79,...Q(0.012,-0.006,0.074),0,0,0.6],[0.81,...Q(0.03,-0.02,0.08),0,0,0.4],[0.9,0,0,0,0,0,0]],p); }
      else f.charge=0;
      f.cues=[[0.2,'rMagOut'],[0.26,'drop'],[0.38,'grab'],[0.55,'rMagIn'],[0.6,'rSlap'],[0.6,'bump']].concat(rk?rk.cues:e?[[0.75,'boltBack'],[0.81,'boltFwd'],[0.815,'bump']]:[]);
      return f; },
    pistol(p,e,R){ const M=R.Lmag, u=R.u, rl=e&&R.cfg.ea==='rackL', f={};
      f.g=K([[0,0,0,0,0,0,0],[0.1,0.1,0.22,-0.32,0.004,0.012,0.012],[0.5,0.12,0.24,-0.36,0.004,0.014,0.012],[0.6,0.16,0.22,-0.38,0.004,0.02,0.012],[0.64,0.08,0.2,-0.3,0.004,0.008,0.01],
        ...(rl?[[0.72,0.12,0.16,-0.36,0.004,0.01,0.01],[0.86,0.12,0.16,-0.36,0.004,0.012,0.01],[1,0,0,0,0,0,0]]:[[0.8,0.04,0.08,-0.12,0,0.004,0.004],[1,0,0,0,0,0,0]])],p);
      const at=(dx,dy,dz)=>[M.x+dx,M.y+dy,M.z+dz], rk=rl?rackL(R,0.64,0.92,0.04):null;
      f.L=K([[0,0,0,0,0,0,0],[0.08,-0.05,-0.07,0.05,0.2,0,0.3],[0.28,-0.08,-0.3,0.09,0.4,0,0.5],[0.36,-0.07,-0.28,0.08,0.3,0,0.4],[0.5,...at(-0.004,-0.05,0.01),0.1,0,0.1],[0.58,...at(0,-0.004,0),0,0,0],[0.62,...at(0,0.006,0),0,0,0],[0.65,...at(0,-0.02,0.006),0.1,0,0],
        ...(rk?[...rk.L,[0.98,0,0,0,0,0,0]]:[[0.95,0,0,0,0,0,0]])],p);
      f.mag=p<0.14?'seat':p<0.36?'gone':p<0.6?'hand':'seat'; f.magX=K([[0.36,0,-0.03,0,0.3,0,0.1],[0.5,0,-0.03,0.009,0.05,0,0],[0.58,0,-0.004,0,0,0,0],[0.6,0,0,0,0,0,0]],p);
      f.slide=e?K([[0.66,0.026],[0.69,0]],p)[0]:0;
      if(rk) f.charge=K(rk.charge,p)[0];
      f.cues=[[0.13,'pMagOut'],[0.14,'drop'],[0.36,'grab'],[0.58,'pMagIn'],[0.62,'bump']].concat(rk?rk.cues:e&&u.slide?[[0.67,'slideFwd'],[0.68,'bump']]:[]);
      return f; },
    /* one shell per cycle; the gun stays rolled over while loading (see apply) */
    pump(p,e,R){ const u=R.u, H=R.H, po=u.port||V3(0,0.03,-0.1), P=(dx,dy,dz)=>[po.x-H.x+dx,po.y-H.y+dy,po.z-H.z+dz], first=R.shellI===0, f={};
      f.L=K([[0,...(first?[0,0,0,0,0,0]:[...P(-0.05,-0.2,0.06),0.4,0,0.4])],[0.3,...P(-0.06,-0.26,0.07),0.5,0,0.5],[0.55,...P(-0.012,-0.05,0.03),0.2,0,0.2],[0.7,...P(0,-0.024,0.004),0.1,0,0.1],
        [0.8,...P(0,-0.022,-0.03),0.1,0,0.1],[1,...P(-0.04,-0.16,0.04),0.35,0,0.35]],p);
      f.hold=p>0.32&&p<0.8?'shell':null; f.holdX=K([[0.3,0,0.02,0.01],[0.7,0,0.024,0],[0.8,0,0.024,-0.03]],p);
      f.cues=[[0.33,'grab'],[0.76,'shellIn']];
      return f; },
    bolt(p,e,R){ const M=R.Lmag, sl=!!R.u.boltSlide, f={};
      f.g=K([[0,0,0,0,0,0,0],[0.08,0.05,0.08,0.42,-0.012,-0.03,0.02],[0.24,0.05,0.08,0.42,-0.012,-0.03,0.02],[0.3,0.1,0.14,-0.3,-0.008,0.01,0.015],[0.62,0.1,0.16,-0.34,-0.008,0.012,0.015],[0.67,0.13,0.16,-0.36,-0.008,0.016,0.015],
        [0.72,0.08,0.12,-0.2,-0.006,0.006,0.012],[0.78,0.05,0.08,0.42,-0.012,-0.03,0.02],[0.92,0.05,0.08,0.42,-0.012,-0.03,0.02],[1,0,0,0,0,0,0]],p);
      const at=(dx,dy,dz)=>[M.x+dx,M.y+dy,M.z+dz];
      f.L=K([[0,0,0,0,0,0,0],[0.26,0,0,0,0,0,0],[0.3,...at(0,0,0),0.2,0,-1.25],[0.34,...at(0,-0.015,0),0.2,0,-1.25],[0.42,...at(-0.07,-0.3,0.08),0.5,0,-0.6],[0.47,...at(-0.06,-0.3,0.07),0.4,0,-0.9],
        [0.58,...at(-0.004,-0.06,0.006),0.2,0,-1.25],[0.64,...at(0,0.004,0),0.1,0,-1.1],[0.68,...at(0,-0.03,0.01),0.2,0,-0.6],[0.76,0,0,0,0,0,0]],p);
      f.mag=p<0.34?'seat':p<0.47?'gone':p<0.64?'hand':'seat'; f.magX=K([[0.47,-0.01,-0.04,0.01,0.5,0,0.2],[0.58,0,-0.02,0,0.12,0,0],[0.64,0,0,0,0,0,0]],p);
      f.boltUp=sl?0:k1([[0.08,0],[0.14,1],[0.8,1],[0.88,0]],p); f.boltBack=sl?k1([[0.1,0],[0.2,1],[0.78,1],[0.8,0]],p):k1([[0.14,0],[0.22,1],[0.74,1],[0.82,0]],p); f.boltHand=k1([[0.04,0],[0.1,1],[0.24,1],[0.28,0],[0.74,0],[0.78,1],[0.9,1],[0.96,0]],p);
      f.cues=(sl?[[0.12,'boltBack'],[0.8,'boltFwd'],[0.805,'bump']]:[[0.1,'awmUp'],[0.17,'awmBack'],[0.8,'awmFwd'],[0.87,'awmDown']]).concat([[0.33,'rMagOut'],[0.34,'drop'],[0.47,'grab'],[0.63,'rMagIn'],[0.67,'rSlap'],[0.67,'bump']]);
      return f; },
    /* P90: the hand on top lifts the long magazine off by its back, a new one goes on front first and gets pressed down */
    p90(p,e,R){ const M=R.Lmag, f={}, rk=e?rackL(R,0.7,0.94,0.04):null, DN=O.down, UP=O.up(R), RS=O.rest(R);
      f.g=K([[0,0,0,0,0,0,0],[0.1,-0.06,0.14,-0.12,-0.05,-0.02,-0.16],[0.62,-0.08,0.16,-0.14,-0.05,-0.02,-0.16],[0.67,-0.12,0.16,-0.14,-0.05,-0.016,-0.16],[0.7,-0.04,0.14,-0.1,-0.05,-0.024,-0.15],
        ...(rk?[[0.78,0.12,0.16,-0.36,-0.01,0.014,-0.02],[0.9,0.12,0.16,-0.36,-0.01,0.014,-0.02],[1,0,0,0,0,0,0]]:[[0.85,-0.06,0.1,-0.04,-0.008,0.006,-0.02],[1,0,0,0,0,0,0]])],p);
      const at=(dx,dy,dz,o)=>[M.x+dx,M.y+dy,M.z+dz,...(o||DN)];
      if(rk&&p>=0.72){ f.L=K([[0.72,...at(0,-0.002,0)],...rk.L.map(k=>[k[0],k[1],k[2],k[3],...O.side(R)]),[0.98,...RS]],p); f.legacyR=true; }
      else f.L=K([[0,...RS],[0.08,...at(-0.03,0.05,0.03)],[0.15,...at(0,0.006,0)],[0.18,...at(0,0,0)],[0.24,...at(0,0.03,0.015)],[0.31,...at(-0.03,0.07,0.07)],
        [0.37,...O.pouch(R)],[0.45,...O.pouch(R,0.01)],[0.54,...at(-0.01,0.06,0.04)],[0.6,...at(0,0.03,0.015)],[0.64,...at(0,0.004,0)],[0.67,...at(0,0.014,0)],[0.7,...at(0,-0.002,0)],
        [0.78,...at(-0.03,0.05,0.04)],[0.95,...RS]],p);
      f.mag=p<0.2?'seat':p<0.36?'hand':p<0.47?'gone':p<0.66?'hand':'seat';
      f.magX=p<0.4?K([[0.2,0,0,0,0,0,0],[0.24,0,0,0,-0.12,0,0],[0.31,0,0,0,-0.2,0,0.1]],p):K([[0.47,0,0,0,-0.25,0,0.1],[0.6,0,0,0,-0.12,0,0],[0.64,0,0,0,0,0,0]],p);
      f.magPiv=R.mFront;
      if(rk) f.charge=K(rk.charge,p)[0];
      f.cues=[[0.2,'rMagOut'],[0.36,'drop'],[0.47,'grab'],[0.64,'rMagIn'],[0.68,'rSlap'],[0.68,'bump']].concat(rk?rk.cues:[]);
      return f; },
    /* M249: open the feed cover, swap the belt box, lay the belt, slap the cover shut; empty: rack the handle on the right */
    lmg(p,e,R){ const u=R.u, CH=u.coverHinge, M=R.Lmag, f={}, OPEN=-0.8, DN=O.downL, SD=O.side(R), RS=O.rest(R);
      f.g=K([[0,0,0,0,0,0,0],[0.1,0.0,0.1,-0.2,-0.06,0.0,-0.15],[0.2,0.06,0.14,-0.24,-0.04,0.02,-0.08],[0.62,0.1,0.16,-0.26,-0.04,0.02,-0.08],[0.66,0.04,0.12,-0.2,-0.06,0.0,-0.15],[0.76,0.04,0.12,-0.16,-0.06,0.0,-0.15],[0.78,0.04,0.12,-0.14,-0.04,0.02,-0.08],
        ...(e?[[0.84,0.08,-0.06,0.24,0,0.016,-0.02],[0.92,0.08,-0.08,0.26,0,0.018,-0.02],[1,0,0,0,0,0,0]]:[[0.9,0.03,0.06,-0.06,-0.01,0.008,-0.02],[1,0,0,0,0,0,0]])],p);
      f.cover=k1([[0.1,0],[0.18,OPEN],[0.7,OPEN],[0.76,0]],p);
      const cv=(a,dy)=>{ const q=rotAbout(R.cvRear,CH,a,0,0); return [...rel(R,q,0,0.022+(dy||0),0.004),...DN]; }, at=(dx,dy,dz)=>[M.x+dx,M.y+dy,M.z+dz,...SD];
      if((p>=0.1&&p<0.19)||(p>=0.7&&p<0.78)) f.L=cv(f.cover);
      else f.L=K([[0,...RS],[0.06,...cv(0,0.03)],[0.1,...cv(0)],[0.19,...cv(OPEN)],[0.26,...at(-0.004,0,0)],[0.3,...at(-0.004,-0.01,0)],[0.36,...at(-0.06,-0.16,0.04)],[0.42,...O.pouch(R)],
        [0.48,...O.pouch(R,0.01)],[0.58,...at(-0.006,-0.06,0.006)],[0.62,...at(-0.004,0,0)],[0.65,...rel(R,R.feed,-0.01,0.05,0.01),...DN],[0.67,...rel(R,R.feed,0,0.03,0),...DN],[0.69,...rel(R,R.feed,0,0.032,-0.03),...DN],[0.7,...cv(OPEN)],
        [0.78,...cv(0)],[0.81,...cv(0,0.03)],[0.92,...RS]],p);
      f.mag=p<0.3?'seat':p<0.38?'hand':p<0.49?'gone':p<0.62?'hand':'seat'; f.magX=p<0.4?K([[0.3,0,0,0,0,0,0],[0.38,0,-0.02,0,0.2,0,0.15]],p):K([[0.49,-0.01,-0.04,0.01,0.3,0,0.2],[0.58,0,-0.012,0,0.05,0,0],[0.62,0,0,0,0,0,0]],p);
      const rk=e?rackR(R,0.8,0.97,0.075):null; if(rk){ f.Rh=K(rk.Rh,p); f.charge=K(rk.charge,p)[0]; }
      f.cues=[[0.12,'latch'],[0.15,'coverOpen'],[0.3,'rMagOut'],[0.38,'drop'],[0.49,'grab'],[0.62,'rMagIn'],[0.67,'belt'],[0.76,'coverShut'],[0.76,'bump']].concat(rk?rk.cues:[]);
      return f; },
    /* sawed-off: barrels drop open, the shells kick out, two fresh ones go in, snap it shut */
    break(p,e,R){ const u=R.u, HB=u.brlHinge, f={}, OPEN=-0.62, SD=O.side(R), RS=O.rest(R);
      f.brl=k1([[0.06,0],[0.13,OPEN],[0.72,OPEN],[0.77,0]],p);
      f.g=K([[0,0,0,0,0,0,0],[0.08,-0.06,0.1,-0.24,-0.03,0.03,-0.03],[0.14,-0.08,0.1,-0.26,-0.03,0.03,-0.03],[0.18,0.22,0.12,-0.2,-0.03,0.04,-0.03],[0.24,-0.22,0.16,-0.22,-0.05,0.05,-0.08],[0.7,-0.24,0.18,-0.24,-0.05,0.05,-0.08],
        [0.75,0.2,0.1,-0.18,-0.03,0.035,-0.03],[0.8,0.04,0.06,-0.08,-0.01,0.012,0],[1,0,0,0,0,0,0]],p);
      /* the hand riding on the forend as the barrels turn */
      const fo=a=>{ const q=rotAbout(R.H,HB,a,0,0), d=V3(...R.d0).applyEuler(_e.set(a,0,0)), n=V3(...R.n0).applyEuler(_e.set(a,0,0)); return [q.x-R.H.x,q.y-R.H.y,q.z-R.H.z,d.x,d.y,d.z,n.x,n.y,n.z]; };
      const bb=V3(0,-Math.sin(OPEN),Math.cos(OPEN)), ch=rotAbout(V3(0,HB.y+0.03,HB.z+0.002),HB,OPEN,0,0);
      const S=k=>{ const q=ch.clone().addScaledVector(bb,k).add(V3(-0.036,0,0)); return [...rel(R,q),...SD]; }; /* shells sit k behind the chambers; the hand is on their left */
      if(p<0.22) f.L=fo(f.brl);
      else if(p>=0.66&&p<0.78) f.L=K([[0.66,...fo(OPEN)],[0.72,...fo(OPEN)],[0.77,...fo(0)],[0.78,...fo(0)]],p);
      else f.L=K([[0.22,...fo(OPEN)],[0.3,...O.pouch(R)],[0.38,...O.pouch(R,0.01)],[0.48,...S(0.1)],[0.54,...S(0.045)],[0.6,...S(0.016)],[0.66,...fo(OPEN)],[0.78,...fo(0)],[1,...RS]],p);
      f.hold=p>0.38&&p<0.61?'shells':null; f.holdX=[0.036,0,0]; f.holdR=[p>0.44?OPEN:0,0,0];
      f.cues=[[0.07,'brkOpen'],[0.16,'eject'],[0.16,'ejectShells'],[0.38,'grab'],[0.57,'shellIn'],[0.6,'shellIn'],[0.76,'brkShut'],[0.765,'bump']];
      return f; },
    /* M1: the en-bloc clip pushed down with the thumb, the bolt slams home (a partly used clip is ejected first) */
    clip(p,e,R){ const u=R.u, ca=u.clipAt, f={}, SD=O.side(R), RS=O.rest(R);
      f.g=K([[0,0,0,0,0,0,0],[0.1,0.06,0.14,0.26,-0.04,0.02,-0.06],[0.64,0.06,0.16,0.28,-0.04,0.02,-0.06],[0.7,0.18,0.14,0.22,-0.04,0.03,-0.06],[0.76,0.04,0.1,0.2,-0.03,0.015,-0.04],[1,0,0,0,0,0,0]],p);
      const rk=e?null:rackR(R,0.04,0.3,0.06,true); if(rk) f.Rh=K(rk.Rh,p);
      f.charge=e?k1([[0.66,0.06],[0.69,0]],p):p<0.66?K(rk.charge,p)[0]:k1([[0.66,0.06],[0.69,0]],p);
      const A=h=>[...rel(R,ca,-0.03,h,0),...O.sideL]; /* hand on the left of the clip; the clip's bottom at the receiver top when h=0 */
      f.L=K([[0,...RS],[0.18,...O.pouch(R,-0.08)],[0.32,...O.pouch(R)],[0.4,...O.pouch(R,0.01)],[0.52,...A(0.09)],[0.56,...A(0.06)],[0.62,...A(0.018)],[0.65,...A(0.006)],
        [0.69,...rel(R,ca,-0.08,0.03,0.03),...O.side(R)],[0.74,...rel(R,ca,-0.1,-0.03,0.05),...O.up(R)],[0.9,...RS]],p);
      f.hold=p>0.4&&p<0.645?'clip':null; f.holdX=[0.03,0.012,0];
      f.cues=[[0.4,'grab'],[0.62,'rMagIn'],[0.68,'boltFwd'],[0.685,'bump']].concat(rk?[...rk.cues,[0.24,'ping'],[0.24,'ejectClip']]:[]);
      return f; },
    /* revolver: swing the cylinder out, punch the ejector, speedloader in, flick it shut */
    rev(p,e,R){ const u=R.u, piv=u.cylPiv, C0=u.cylC, f={}, OUT=1.25, SD=O.side(R), RS=O.rest(R);
      f.cyl=k1([[0.08,0],[0.15,OUT],[0.72,OUT],[0.77,0]],p);
      f.g=K([[0,0,0,0,0,0,0],[0.08,0.1,0.22,0.32,-0.04,0.03,0],[0.18,0.1,0.22,0.36,-0.04,0.03,0],[0.24,0.85,0.2,0.26,-0.04,0.0,0.02],[0.32,0.85,0.2,0.26,-0.04,0.0,0.02],[0.4,-0.4,0.26,0.34,-0.04,0.04,-0.02],
        [0.68,-0.42,0.26,0.36,-0.04,0.04,-0.02],[0.74,0.05,0.2,0.6,-0.04,0.03,0],[0.78,0.08,0.14,0.18,-0.03,0.02,0],[1,0,0,0,0,0,0]],p);
      const Cs=a=>rotAbout(C0,piv,0,0,a), S=(a,dx,dy,dz)=>[...rel(R,Cs(a),dx,dy,dz),...SD];
      const LD=k=>{ const c=Cs(OUT); return [...rel(R,c,-0.034,0,0.028+k),...SD]; }; /* speedloader k behind its seat */
      if((p>=0.08&&p<0.16)||(p>=0.7&&p<0.78)) f.L=S(f.cyl,-0.03,0,0.004);
      else f.L=K([[0,...RS],[0.04,...S(0,-0.045,-0.01,0.01)],[0.08,...S(0,-0.03,0,0.004)],[0.16,...S(OUT,-0.03,0,0.004)],[0.22,...S(OUT,-0.028,-0.004,-0.05)],[0.27,...S(OUT,-0.026,-0.004,-0.045)],[0.29,...S(OUT,-0.026,-0.004,-0.03)],
        [0.33,...S(OUT,-0.05,-0.04,-0.05)],[0.4,...O.pouch(R)],[0.48,...O.pouch(R,0.01)],[0.56,...LD(0.05)],[0.61,...LD(0.02)],[0.65,...LD(0)],
        [0.68,...LD(0.05)],[0.7,...S(OUT,-0.03,0,0.004)],[0.77,...S(0,-0.03,0,0.004)],[0.79,...S(0,-0.045,-0.01,0.01)],[0.95,...RS]],p);
      f.hold=p>0.47&&p<0.69?'loader':null; f.holdX=[0.034,0,0]; f.holdR=[0,0,OUT];
      f.cues=[[0.1,'cylOut'],[0.29,'eject'],[0.29,'ejectCasings'],[0.31,'casings'],[0.48,'grab'],[0.62,'shellIn'],[0.645,'shellIn'],[0.66,'twist'],[0.76,'cylIn'],[0.765,'bump']];
      return f; },
    /* crossbow: hook the string back to the latch, lay a bolt on the rail */
    xbow(p,e,R){ const u=R.u, rest=u.stringRest||0.1, f={}, DN=O.down, RS=O.rest(R);
      f.g=K([[0,0,0,0,0,0,0],[0.1,0.18,0.1,-0.16,-0.05,0.02,-0.12],[0.42,0.2,0.12,-0.18,-0.05,0.02,-0.12],[0.45,0.12,0.1,-0.16,-0.05,0.02,-0.12],[0.82,0.14,0.1,-0.18,-0.05,0.02,-0.12],[1,0,0,0,0,0,0]],p);
      f.fc=k1([[0.2,rest],[0.42,0]],p);
      const S=(fc,dy)=>[...rel(R,V3(0,u.arrowAt.y-0.01,-fc),0,0.022+(dy||0),0.006),...DN], A=(dx,dy,dz)=>[R.Lar.x+dx,R.Lar.y+dy,R.Lar.z+dz,...DN];
      if(p>=0.2&&p<0.43) f.L=S(f.fc);
      else f.L=K([[0,...RS],[0.08,...S(rest,0.04)],[0.18,...S(rest)],[0.2,...S(rest)],[0.43,...S(0)],[0.48,...S(0,0.04)],
        [0.56,...O.pouch(R)],[0.6,...O.pouch(R,0.01)],[0.7,...A(0,0.06,-0.02)],[0.78,...A(0,0.008,0)],[0.82,...A(0,0,0)],[0.86,...A(-0.02,0.03,0.02)],[0.97,...RS]],p);
      f.arrow=p<0.6?'gone':p<0.82?'hand':'seat';
      f.cues=[[0.22,'string'],[0.43,'latch'],[0.435,'bump'],[0.6,'grab'],[0.8,'shellIn']];
      return f; },
    /* flintlock: muzzle up, ball down the barrel, ramrod out, ram it twice, rod home, cock the hammer */
    flint(p,e,R){ const u=R.u, Mz=u.muzzle, f={}, RT=V3(0,(u.muzzle.y)-0.024,-0.3), SD=O.side(R), RS=O.rest(R);
      f.g=K([[0,0,0,0,0,0,0],[0.1,1.05,0.12,0.05,-0.05,-0.13,-0.12],[0.8,1.08,0.12,0.05,-0.05,-0.13,-0.12],[0.88,0.2,0.08,0.02,-0.02,-0.01,0],[0.93,0.24,0.06,0.0,-0.02,0,0],[1,0,0,0,0,0,0]],p);
      const Mu=(dz,dx)=>[...rel(R,Mz,-0.014+(dx||0),0,dz),...O.sideL]; /* hand just left of the bore line, dz along the bore */
      const Rd=dz=>[...rel(R,RT,-0.016,-0.004,dz),...SD];
      f.rodZ=k1([[0.42,0],[0.5,-0.2],[0.79,-0.2],[0.86,0]],p);
      f.L=K([[0,...RS],[0.1,...O.pouch(R,-0.06)],[0.18,...O.pouch(R)],[0.21,...O.pouch(R,0.01)],[0.29,...Mu(-0.04,-0.008)],[0.33,...Mu(-0.016,-0.008)],
        [0.38,...Rd(-0.01)],[0.42,...Rd(0)],[0.5,...Rd(-0.2)],[0.53,...Mu(-0.3)],[0.56,...Mu(-0.25)],
        [0.61,...Mu(-0.12)],[0.65,...Mu(-0.19)],[0.69,...Mu(-0.11)],[0.75,...Mu(-0.27)],[0.79,...Rd(-0.2)],[0.86,...Rd(0)],[0.96,...RS]],p);
      f.hold=p>0.2&&p<0.33?'ball':p>=0.5&&p<0.79?'rod':null; f.rodHome=!(p>=0.5&&p<0.79); f.holdX=f.hold==='rod'?[0.014,0,0]:[0.016,0,-0.004];
      f.cock=k1([[0.88,0],[0.93,0.62]],p);
      f.cues=[[0.2,'grab'],[0.33,'ballIn'],[0.43,'grab'],[0.61,'thud'],[0.69,'thud'],[0.86,'grab'],[0.9,'cock']];
      return f; },
    /* rocket pack at the muzzle: twist off, pull, new one on, twist to lock */
    tube(p,e,R){ const M=R.Lmag, f={}, SD=O.side(R), RS=O.rest(R);
      f.g=K([[0,0,0,0,0,0,0],[0.1,0.12,0.42,0.16,-0.05,0.03,-0.02],[0.62,0.14,0.44,0.18,-0.05,0.03,-0.02],[0.68,0.18,0.44,0.18,-0.05,0.035,-0.02],[0.74,0.12,0.42,0.16,-0.05,0.03,-0.02],[0.86,0.06,0.2,0.08,-0.02,0.012,-0.01],[1,0,0,0,0,0,0]],p);
      const at=(dx,dy,dz)=>[M.x+dx,M.y+dy,M.z+dz,...SD];
      f.L=K([[0,...RS],[0.08,...at(-0.03,-0.02,0.02)],[0.15,...at(0,0,0)],[0.21,...at(0,0,0)],[0.31,...at(-0.01,-0.01,-0.09)],[0.4,...O.pouch(R)],[0.48,...O.pouch(R,0.01)],
        [0.58,...at(0,0,-0.08)],[0.65,...at(0,0,0)],[0.71,...at(0,0,0)],[0.76,...at(-0.03,-0.03,0.02)],[0.92,...RS]],p);
      f.mag=p<0.21?'rot':p<0.33?'hand':p<0.48?'gone':p<0.65?'hand':'rot';
      f.magX=[0,0,0,0,0,p<0.15?0:p<0.33?k1([[0.15,0],[0.21,-0.6]],p):p<0.65?-0.6:k1([[0.65,-0.6],[0.71,0]],p)];
      f.cues=[[0.16,'twist'],[0.3,'rMagOut'],[0.33,'drop'],[0.48,'grab'],[0.65,'rMagIn'],[0.71,'catch'],[0.715,'bump']];
      return f; } };
  /* hand orientations for the newer families: forearm direction (from the hand toward the elbow) + palm normal, gun space */
  const O={ rest:R=>[0,0,0,...R.d0,...R.n0], up:R=>[...R.d0,0,1,0], side:R=>[...R.d0,1,0,0], down:[-0.5,-0.8,0.3,0,-1,0], downL:[-0.5,-0.8,0.3,0,-1,0], sideL:[-0.5,-0.8,0.3,1,0,0], sideD:R=>[-0.5,-0.8,0.3,1,0,0],
    pouch:(R,k)=>[-0.08,-0.27+(k||0),0.07,...R.d0,0,1,0] };

  /* ---------- drive one frame ---------- */
  /* while reloading the whole gun comes up and in toward the middle of the screen, so the hands and the magazine are in view */
  const LIFT={ar:[-0.03,0.04,-0.02],ak:[-0.03,0.04,-0.02],pistol:[-0.025,0.03,0],bolt:[-0.03,0.04,-0.02],pump:[-0.03,0.04,-0.02],p90:[-0.03,0.04,-0.02],lmg:[-0.03,0.04,-0.02],
    break:[-0.03,0.04,-0.01],clip:[-0.03,0.04,-0.02],rev:[-0.025,0.03,0],xbow:[-0.03,0.04,-0.02],flint:[-0.02,0.02,0],tube:[-0.03,0.04,-0.02]};
  const qT=new THREE.Quaternion(), eT=new THREE.Euler(), qG=new THREE.Quaternion(), eG=new THREE.Euler();
  /* hand offset [dx,dy,dz, rx, ry, twist, rz]: twist rolls the palm about the forearm */
  function setArm(P,off){ if(!P) return; const a=P.userData.at; P.position.set(a.x+off[0],a.y+off[1],a.z+off[2]); eT.set(off[3]||0,off[4]||0,off[6]||0); P.quaternion.setFromEuler(eT); if(off[5]){ qT.setFromAxisAngle(P.userData.axis,off[5]); P.quaternion.premultiply(qT); } }
  /* aim a hand: off = [dx,dy,dz, forearm dir xyz, palm normal xyz]. The forearm direction is in screen terms (the reload's own turn of the gun is taken out, so the arm keeps coming in from the lower left);
     the palm normal is in gun space. The forearm swings to dir, then rolls so the palm faces the normal */
  const qA=new THREE.Quaternion(), qB=new THREE.Quaternion(), vD=new THREE.Vector3(), vN=new THREE.Vector3(), vT=new THREE.Vector3(), vC=new THREE.Vector3(), vN0=new THREE.Vector3();
  function setAim(P,off,n0,qInv){ if(!P) return; const a=P.userData.at, ax=P.userData.axis; P.position.set(a.x+off[0],a.y+off[1],a.z+off[2]);
    vD.set(off[3],off[4],off[5]); if(vD.lengthSq()<1e-6) vD.copy(ax); vD.normalize(); if(qInv) vD.applyQuaternion(qInv); qA.setFromUnitVectors(ax,vD);
    vN.fromArray(n0).applyQuaternion(qA); vT.set(off[6],off[7],off[8]); vT.addScaledVector(vD,-vT.dot(vD));
    if(vT.lengthSq()>1e-6){ vT.normalize(); vN.addScaledVector(vD,-vN.dot(vD)).normalize(); qB.setFromAxisAngle(vD,Math.atan2(vC.crossVectors(vN,vT).dot(vD),vN.dot(vT))); qA.premultiply(qB); }
    else vT.copy(vN);
    P.quaternion.copy(qA); P.userData.n=(P.userData.n||new THREE.Vector3()).copy(vT); }
  function smooth(R,k,v,dt,rate){ const o=R.sm[k]; if(!o||o.length!==v.length){ R.sm[k]=v.slice(); return R.sm[k]; } const f=1-Math.exp(-(rate||28)*dt); for(let i=0;i<v.length;i++) o[i]+=(v[i]-o[i])*f; return o; }
  const seven=a=>a.length>=7?a:a.concat([0,0,0,0,0,0,0].slice(a.length));
  /* the right hand on the bolt knob (bolt rifles): weight w 0..1 */
  function knobOff(R){ const u=R.u, b=u.bolt; if(!b) return [0,0,0,0,0,0]; const H=R.HR;
    if(u.boltSlide&&u.knobAt){ const k=u.knobAt, dz=b.position.z-(b.userData.z0||0); return [k.x-H.x+0.004,k.y-H.y-0.01,k.z+dz-H.z+0.012,0.15,0,-0.3]; }
    const th=b.rotation.z, c=Math.cos(th), s=Math.sin(th);
    const kx=0.055*c+0.032*s, ky=0.055*s-0.032*c, x=b.position.x+kx, y=b.position.y+ky, z=b.position.z;
    return [x-H.x+0.006,y-H.y-0.012,z-H.z+0.014,0.2,0,-0.4]; }
  function boltHand(vm,w){ const R=vm.rl===undefined?prep(vm):vm.rl; if(!R||!R.Rt||R.fam!=='bolt') return; const k=knobOff(R); setArm(R.Rt,k.map(v=>v*w*0.6)); }
  function drop(R,obj,v,spin){ R.root.add(obj); R.drops.push({o:obj,t:0,v,w:spin||V3(4+Math.random()*3,0,2*(Math.random()-0.5))}); }
  function dropMag(R){ const u=R.u; if(!u.mag) return; const c=u.mag.clone(true); c.position.copy(u.mag.position); c.quaternion.copy(u.mag.quaternion);
    drop(R,c,R.fam==='tube'?V3(-0.1,-0.2,-0.15):V3(-0.06,R.fam==='pistol'?-0.5:-0.35,0.08)); }
  /* spent brass / clip / shells thrown out of the gun (gun space; they keep falling for a moment) */
  function spawnEvent(R,k){ const u=R.u;
    if(k==='ejectShells'&&u.brl){ for(const s of [-1,1]){ const sh=shellMesh(); sh.position.copy(rotAbout(V3(s*0.0118,u.brlHinge.y+0.03,u.brlHinge.z+0.02),u.brlHinge,-0.62,0,0)); sh.rotation.x=-0.62; drop(R,sh,V3(s*0.08+0.03,0.55,0.55),V3(6+Math.random()*3,0,s*2)); } }
    if(k==='ejectCasings'&&u.cyl){ const c=rotAbout(u.cylC,u.cylPiv,0,0,1.25); for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+0.5, m=casing(); m.position.set(c.x+Math.cos(a)*0.013,c.y+Math.sin(a)*0.013,c.z+0.02); drop(R,m,V3((Math.random()-0.5)*0.15,-0.25-Math.random()*0.15,0.35+Math.random()*0.15),V3(Math.random()*6,0,Math.random()*4)); } }
    if(k==='ejectClip'&&u.clipAt){ const m=emptyClip(); m.position.copy(u.clipAt).add(V3(0,0.01,0)); drop(R,m,V3(0.15,0.9,0.1),V3(9,0,4)); } }
  function stepDrops(R,dt){ for(let i=R.drops.length-1;i>=0;i--){ const d=R.drops[i]; d.t+=dt; d.v.y-=6*dt; d.o.position.addScaledVector(d.v,dt); d.o.rotation.x+=d.w.x*dt; d.o.rotation.z+=d.w.z*dt;
      if(d.t>0.9||d.o.position.y<-0.8){ R.root.remove(d.o); R.drops.splice(i,1); } } }
  /* me: the local actor; w,s: weapon and slot; pose: {px,py,pz,rx,ry,rz} offsets to add to (mutated). returns true if this gun is animated here */
  function apply(vm,me,w,s,dt,pose){ const R=vm.rl===undefined?prep(vm):vm.rl; if(!R) return false; const u=R.u;
    stepDrops(R,dt);
    const T=me.reloadT>0?me.reloadT:me.gunReloadT>0?me.gunReloadT:0, D=me.reloadD||w.reload||1, n=me.reloadN||0;
    const reloading=T>0&&dt>=0, p=reloading?clamp(1-T/D,0,1):1;
    if(reloading&&n!==R.n){ /* a new reload (or the next shell) */ if(R.fam==='pump'){ R.shellI=R.loading?(R.shellI||0)+1:0; } R.n=n; R.ev.clear(); R.empty=!!me.reloadEmpty; }
    if(R.fam==='pump'){ if(reloading&&!R.loading){ R.loading=true; R.pumpEmpty=!!me.reloadEmpty; } if(!reloading&&R.loading){ R.loading=false; if(R.pumpEmpty&&s&&s.mag>0) R.post=0.45; } }
    /* M1: the empty clip pings out on the last shot */
    const mag=s?s.mag:0;
    if(R.fam==='clip'&&!reloading&&R.lastMag>0&&mag===0){ snd('ping'); spawnEvent(R,'ejectClip'); }
    R.lastMag=mag;
    let f=null;
    if(reloading) f=SEQ[R.fam](p,R.empty,R);
    /* cues */
    if(f&&f.cues) for(const c of f.cues){ const k=c[0]+c[1]; if(p>=c[0]&&!R.ev.has(k)){ R.ev.add(k); if(c[1]==='drop') dropMag(R); else if(c[1]==='bump') R.bump=0.12; else if(c[1].startsWith('eject')&&c[1]!=='eject') spawnEvent(R,c[1]); else snd(c[1]); } }
    /* gun pose */
    let g=f&&f.g?f.g:[0,0,0,0,0,0];
    if(R.fam==='pump'){ const l=smooth(R,'load',[R.loading?1:0],dt,9)[0]; g=[0.08*l,0.18*l,-0.5*l,-0.01*l,0.018*l,0.02*l]; }
    if(R.fam==='pump'&&R.post>0){ R.post-=dt; const q=1-R.post/0.45, k=Math.sin(Math.min(1,q)*Math.PI); if(u.pump) u.pump.position.z=(u.pump.userData.z0||0)+k*0.09; if(q<0.1&&!R.ev.has('postP')){ R.ev.add('postP'); snd('pump'); } if(R.post<=0) R.ev.delete('postP'); }
    { const lw=R.fam==='pump'?R.sm.load[0]:reloading?ss(p/0.12)-ss((p-0.86)/0.14):0, lf=LIFT[R.fam]; g=g.slice(); g[3]+=lf[0]*lw; g[4]+=lf[1]*lw; g[5]+=lf[2]*lw; }
    if(R.bump>0){ R.bump-=dt; const k=Math.sin(Math.max(0,R.bump/0.12)*Math.PI); g=g.slice(); g[0]+=0.05*k; g[4]+=0.008*k; }
    pose.rx+=g[0]; pose.ry+=g[1]; pose.rz+=g[2]; pose.px+=g[3]; pose.py+=g[4]; pose.pz+=g[5];
    /* left hand */
    let L;
    if(R.aim){ L=smooth(R,'L',f&&f.L?f.L:O.rest(R),dt,reloading?40:14); qG.setFromEuler(eG.set(g[0],g[1],g[2])).invert(); setAim(R.L,L,R.n0,qG); }
    else { L=smooth(R,'L',seven(f&&f.L?f.L:[0,0,0,0,0,0]),dt,reloading?40:14); setArm(R.L,L); }
    /* magazine */
    if(u.mag&&R.m0){ const mode=f&&f.mag?f.mag:'seat';
      if(mode==='gone') u.mag.visible=false;
      else { u.mag.visible=true; const x=(f&&f.magX)||[0,0,0,0,0,0];
        if(mode==='hand'){ const hm=f.handMag==null?1:f.handMag; u.mag.position.set(R.m0.x+(L[0]-R.Lmag.x)*hm+x[0],R.m0.y+(L[1]-R.Lmag.y)*hm+x[1],R.m0.z+(L[2]-R.Lmag.z)*hm+x[2]); u.mag.rotation.set(x[3],x[4],x[5]); }
        else if(mode==='rot'){ u.mag.position.copy(R.m0); u.mag.rotation.set(x[3],x[4],x[5]); }
        else { u.mag.position.copy(R.m0); u.mag.rotation.set(0,0,0); }
        if((mode==='hand'||mode==='rot')&&f.magPiv!=null){ /* turn about the front lip, not the middle of the top */ const a=x[3], fz=f.magPiv; u.mag.position.y+=Math.sin(a)*fz; u.mag.position.z+=fz-Math.cos(a)*fz; } } }
    /* moving parts */
    if(u.charge&&R.c0){ const locked=R.fam==='clip'&&!reloading&&w&&w.mag&&mag===0; u.charge.position.z=R.c0.z+(f&&f.charge||0)+(locked?0.06:0); }
    if(u.slide&&R.s0){ const locked=!reloading&&s&&w&&w.mag&&s.mag===0&&!me.gunReloadT; u.slide.position.z=R.s0.z+(f&&f.slide!=null?f.slide:locked?0.026:0); }
    if(u.cover) turn(u.cover,u.coverHinge,f&&f.cover||0,0,0);
    if(u.brl) turn(u.brl,u.brlHinge,f&&f.brl||0,0,0);
    if(u.cyl) turn(u.cyl,u.cylPiv,0,0,f&&f.cyl||0);
    if(u.cock) turn(u.cock,u.cockPiv,f&&f.cock!=null?f.cock:mag>0?0.62:0,0,0);
    if(u.rod){ u.rod.visible=!f||f.rodHome!==false; u.rod.position.z=-(f&&f.rodZ||0); }
    if(u.setString){ const fc=f&&f.fc!=null?f.fc:mag>0?0:(u.stringRest||0.1); if(fc!==R.fc){ u.setString(fc); R.fc=fc; } }
    if(u.arrow){ const m=f&&f.arrow?f.arrow:mag>0?'seat':'gone'; u.arrow.visible=m!=='gone'; if(m==='hand') u.arrow.position.set(L[0]-R.Lar.x,L[1]-R.Lar.y,L[2]-R.Lar.z); else u.arrow.position.set(0,0,0); }
    /* things in the left hand */
    for(const k in R.held){ const h=R.held[k], on=!!(f&&f.hold===k); h.visible=on; if(!on) continue; const x=f.holdX||[0,0,0];
      if(R.aim){ h.position.copy(R.L.position).add(V3(x[0],x[1],x[2])); const r=f.holdR||[0,0,0]; h.rotation.set(r[0],r[1],r[2]); }
      else if(k==='shell') h.position.set(0.004+x[0],0.022+x[1],x[2]); }
    if(R.fam!=='bolt'&&R.Rt) setArm(R.Rt,smooth(R,'R',seven(f&&f.Rh?f.Rh:[0,0,0,0,0,0]),dt,reloading?40:14));
    if(R.fam==='bolt'&&u.bolt){ if(f){ if(!u.boltSlide) u.bolt.rotation.z=(f.boltUp||0)*1.15; u.bolt.position.z=u.bolt.userData.z0+(f.boltBack||0)*(u.boltSlide?0.06:0.085); setArm(R.Rt,knobOff(R).map(v=>v*0.6*(f.boltHand||0))); }
      else if(!(me.boltT>0)) setArm(R.Rt,[0,0,0,0,0,0]); }
    return true; }
  return {has,apply,boltHand,FAM};
})();
