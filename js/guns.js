/* guns.js — procedural weapon, throwable and gadget models (one builder per family, tuned per weapon).
   Gun space: origin = right-hand grip, barrel toward -Z, Y up, metres. userData: muzzle, sight (y of sight line), handL, mag, pump, len */
'use strict';
const Guns=(()=>{
  const M={};
  function mats(){ if(M.metal) return M;
    const tx=typeof Assets!=='undefined'&&Assets.pbr;
    M.metal=tx?Assets.pbr('gun_metal',{tex:'metal_panel',tile:0.35,color:'#3c4046',rough:0.9,metal:0.85,nor:0.4}):new THREE.MeshStandardMaterial({color:'#2b2e33',roughness:0.38,metalness:0.85});
    M.metal2=tx?Assets.pbr('gun_metal2',{tex:'metal_panel',tile:0.3,color:'#666b73',rough:0.7,metal:0.9,nor:0.3}):new THREE.MeshStandardMaterial({color:'#4a4e55',roughness:0.32,metalness:0.9});
    M.poly=tx?Assets.pbr('gun_poly',{tex:'plaster',tile:0.12,color:'#3a3c41',rough:1,metal:0.05,nor:0.8}):new THREE.MeshStandardMaterial({color:'#2a2c31',roughness:0.55,metalness:0.15});
    M.tan=new THREE.MeshStandardMaterial({color:'#b59a6e',roughness:0.6,metalness:0.1});
    M.od=new THREE.MeshStandardMaterial({color:'#4b5233',roughness:0.6,metalness:0.1});
    M.wood=new THREE.MeshStandardMaterial({color:'#7a4a26',roughness:0.55,metalness:0.0});
    M.woodL=new THREE.MeshStandardMaterial({color:'#a8743e',roughness:0.5,metalness:0.0});
    M.brass=new THREE.MeshStandardMaterial({color:'#c9a24a',roughness:0.3,metalness:1});
    M.chrome=new THREE.MeshStandardMaterial({color:'#d8dade',roughness:0.15,metalness:1});
    M.lens=new THREE.MeshStandardMaterial({color:'#0a1a3a',roughness:0.05,metalness:0.6,emissive:'#081840',emissiveIntensity:0.6});
    M.dot=new THREE.MeshBasicMaterial({color:'#ff2b2b'});
    M.red=new THREE.MeshStandardMaterial({color:'#b3261e',roughness:0.45,metalness:0.2});
    M.blade=new THREE.MeshStandardMaterial({color:'#c9ccd2',roughness:0.18,metalness:1});
    M.glove=tx?Assets.pbr('gun_glove',{tex:'concrete_floor',tile:0.08,color:'#4a423a',rough:1,nor:0.6}):new THREE.MeshStandardMaterial({color:'#2a2622',roughness:0.85});
    M.sleeve=tx?Assets.pbr('gun_sleeve',{tex:'plaster',tile:0.15,color:'#2f3528',rough:1,nor:1.2}):new THREE.MeshStandardMaterial({color:'#5b5f4a',roughness:0.9});
    M.skin=new THREE.MeshStandardMaterial({color:'#c99a78',roughness:0.7});
    M.glowB=new THREE.MeshBasicMaterial({color:'#4fd1ff'}); M.glowO=new THREE.MeshBasicMaterial({color:'#ff9b3d'}); M.glowG=new THREE.MeshBasicMaterial({color:'#5dff8a'});
    M.snow=new THREE.MeshStandardMaterial({color:'#e8f4ff',roughness:0.4,metalness:0.1});
    M.shield=new THREE.MeshStandardMaterial({color:'#2e3238',roughness:0.4,metalness:0.7});
    M.glass=new THREE.MeshStandardMaterial({color:'#9fd0ff',roughness:0.05,transparent:true,opacity:0.35});
    return M; }
  const RB=(w,h,d,r)=>new THREE.RoundedBoxGeometry(w,h,d,2,Math.min(r!=null?r:0.006,Math.min(w,h,d)/2.2));
  function add(g,geo,mat,x,y,z,rx,ry,rz){ const m=new THREE.Mesh(geo,mat); m.position.set(x||0,y||0,z||0); if(rx||ry||rz) m.rotation.set(rx||0,ry||0,rz||0); m.castShadow=true; g.add(m); return m; }
  const cylZ=(r,l,s)=>{ const g=new THREE.CylinderGeometry(r,r,l,s||12); g.rotateX(Math.PI/2); return g; };
  /* ---- families ---- */
  function grip(g,mat,angle){ add(g,RB(0.03,0.1,0.04,0.008),mat,0,-0.04,0.008,angle||0.25,0,0); add(g,new THREE.TorusGeometry(0.022,0.004,6,12,Math.PI),M.metal,0,-0.005,-0.035,0,Math.PI/2,Math.PI); }
  function mag(g,mat,z,len,curve,y0){ const m=new THREE.Group(); const n=curve?3:1; for(let i=0;i<n;i++){ add(m,RB(0.026,len/n+0.004,0.05,0.004),mat,0,-i*len/n,-i*curve*0.025,i*curve*0.18,0,0); }
    m.position.set(0,y0!=null?y0:-0.02,z); g.add(m); return m; }
  function rifle(id){
    const g=new THREE.Group(); const u=g.userData; let L=0.82, recv=M.poly, furn=M.poly, accent=M.metal;
    const S={m4:{},ak47:{furn:M.wood,curve:1},scar:{recv:M.tan,furn:M.tan},falcon:{L:0.95,furn:M.od},famas:{bull:true,handle:true},g36:{handle:true,furn:M.poly},m249:{L:0.98,lmg:true}}[id]||{};
    if(S.L) L=S.L; if(S.recv) recv=S.recv; if(S.furn) furn=S.furn;
    if(S.bull){ // bullpup: grip forward, mag behind grip
      add(g,RB(0.055,0.1,0.55,0.012),recv,0,0.045,-0.08); add(g,cylZ(0.011,0.2),M.metal,0,0.06,-0.45); add(g,RB(0.04,0.04,0.3,0.01),M.metal2,0,0.12,-0.12);
      grip(g,M.poly); u.mag=mag(g,M.metal,0.12,0.12,0,-0.01); u.muzzle=new THREE.Vector3(0,0.06,-0.56); u.sight=0.14; u.handL=new THREE.Vector3(-0.01,0.0,-0.27); u.len=0.75; return g; }
    add(g,RB(0.054,0.085,0.36,0.01),recv,0,0.045,-0.1);
    add(g,RB(0.06,0.07,0.28,0.012),furn,0,0.045,-0.4);
    add(g,cylZ(0.011,L*0.3),M.metal,0,0.05,-0.54-L*0.15+0.06);
    add(g,cylZ(0.016,0.05),M.metal2,0,0.05,-0.54-L*0.3+0.05);
    add(g,RB(0.045,0.085,0.24,0.012),furn,0,0.025,0.19,-0.06,0,0);
    add(g,RB(0.05,0.11,0.03,0.008),M.poly,0,0.01,0.31);
    add(g,RB(0.022,0.012,0.3,0.003),M.metal,0,0.093,-0.15);
    grip(g,M.poly);
    if(S.lmg){ const bm=new THREE.Group(); add(bm,RB(0.1,0.1,0.12,0.01),M.od,0.02,0,0); bm.position.set(0,-0.03,-0.09); g.add(bm); u.mag=bm;
      for(const s of [-1,1]) add(g,cylZ(0.006,0.22),M.metal,s*0.03,-0.04,-0.55,0.9*s*0,0,s*0.35); }
    else u.mag=mag(g,M.metal,-0.08,0.13,S.curve?1:0.4);
    if(S.handle){ add(g,RB(0.03,0.05,0.16,0.008),M.poly,0,0.12,-0.1); add(g,cylZ(0.016,0.08),M.lens,0,0.13,-0.12); u.sight=0.135; }
    else { add(g,RB(0.035,0.035,0.07,0.006),M.metal,0,0.115,-0.1); add(g,new THREE.PlaneGeometry(0.018,0.018),M.glass,0,0.122,-0.135); add(g,new THREE.SphereGeometry(0.002,6,4),M.dot,0,0.122,-0.13); u.sight=0.122; }
    u.muzzle=new THREE.Vector3(0,0.05,-0.54-L*0.3+0.02); u.handL=new THREE.Vector3(-0.01,0.0,-0.38); u.len=L; return g;
  }
  function smg(id){
    const g=new THREE.Group(), u=g.userData; const S={smg9:{},microsmg:{compact:true},p50:{top:true},vector:{vec:true}}[id]||{};
    add(g,RB(0.05,0.085,0.28,0.012),S.vec?M.tan:M.poly,0,0.04,-0.06);
    add(g,cylZ(0.012,0.1),M.metal,0,0.05,-0.24); add(g,cylZ(0.017,0.05),M.metal2,0,0.05,-0.3);
    grip(g,M.poly,S.vec?0.1:0.25);
    if(!S.compact){ add(g,RB(0.02,0.06,0.2,0.005),M.metal,0,0.03,0.17); add(g,RB(0.04,0.08,0.025,0.006),M.poly,0,0.02,0.27); }
    if(S.top){ const m=new THREE.Group(); add(m,RB(0.045,0.035,0.26,0.008),M.poly,0,0,0); m.position.set(0,0.1,-0.06); g.add(m); u.mag=m; }
    else u.mag=mag(g,M.metal,S.vec?-0.02:-0.07,S.compact?0.11:0.15,0);
    add(g,RB(0.03,0.03,0.05,0.005),M.metal,0,0.1,-0.06); add(g,new THREE.SphereGeometry(0.002,6,4),M.dot,0,0.105,-0.085); u.sight=0.105;
    u.muzzle=new THREE.Vector3(0,0.05,-0.33); u.handL=S.compact?new THREE.Vector3(-0.005,-0.05,-0.08):new THREE.Vector3(-0.01,0.0,-0.18); u.len=0.5; return g;
  }
  function shotgun(id){
    const g=new THREE.Group(), u=g.userData;
    if(id==='sawed'){ add(g,RB(0.06,0.06,0.16,0.01),M.metal,0,0.04,-0.05); for(const s of [-1,1]) add(g,cylZ(0.017,0.32),M.metal2,s*0.017,0.055,-0.25);
      add(g,RB(0.05,0.05,0.18,0.012),M.wood,0,0.035,-0.25); add(g,RB(0.035,0.12,0.06,0.012),M.wood,0,-0.03,0.04,0.45,0,0);
      u.muzzle=new THREE.Vector3(0,0.055,-0.42); u.sight=0.085; u.handL=new THREE.Vector3(0,-0.0,-0.24); u.len=0.5; return g; }
    const auto=id==='autosg';
    add(g,RB(0.055,0.085,0.3,0.012),auto?M.poly:M.metal,0,0.045,-0.08);
    add(g,cylZ(0.016,0.5),M.metal,0,0.07,-0.45); add(g,cylZ(0.013,0.42),M.metal2,0,0.035,-0.42);
    const pump=new THREE.Group(); add(pump,RB(0.055,0.05,0.17,0.014),auto?M.poly:M.wood,0,0,0); pump.position.set(0,0.035,-0.38); g.add(pump); u.pump=pump;
    add(g,RB(0.045,0.09,0.26,0.014),auto?M.poly:M.wood,0,0.02,0.2,-0.1,0,0); grip(g,M.poly);
    if(auto){ const d=new THREE.Group(); add(d,new THREE.CylinderGeometry(0.06,0.06,0.07,16),M.poly,0,0,0,0,0,Math.PI/2); d.position.set(0,-0.04,-0.08); g.add(d); u.mag=d; }
    add(g,new THREE.SphereGeometry(0.004,6,4),M.brass,0,0.092,-0.69); u.sight=0.095;
    u.muzzle=new THREE.Vector3(0,0.07,-0.71); u.handL=new THREE.Vector3(-0.01,-0.0,-0.38); u.len=0.9; return g;
  }
  function sniper(id){
    const g=new THREE.Group(), u=g.userData;
    if(id==='mrl'){ add(g,cylZ(0.055,0.7),M.od,0,0.07,-0.15); add(g,cylZ(0.06,0.04),M.metal,0,0.07,-0.5); add(g,cylZ(0.06,0.04),M.metal,0,0.07,0.2);
      for(let i=0;i<3;i++) add(g,cylZ(0.012,0.06),M.red,(i-1)*0.025,0.07,-0.52); grip(g,M.poly); add(g,RB(0.03,0.05,0.08,0.006),M.metal,0,0.14,-0.05); add(g,cylZ(0.012,0.04),M.lens,0,0.15,-0.06);
      u.muzzle=new THREE.Vector3(0,0.07,-0.52); u.sight=0.15; u.handL=new THREE.Vector3(-0.01,0.0,-0.3); u.len=0.8; u.mag=null; return g; }
    const wood=id==='m1', L=id==='heavysr'||id==='piercesr'?1.12:id==='m1'?1.0:0.95;
    add(g,RB(0.05,0.075,0.34,0.01),wood?M.metal:M.metal,0,0.05,-0.08);
    add(g,RB(0.055,0.06,0.42,0.012),wood?M.wood:(id==='lightsr'?M.tan:M.od),0,0.03,-0.36);
    add(g,cylZ(id==='heavysr'?0.016:0.011,L*0.45),M.metal,0,0.06,-0.4-L*0.2);
    add(g,cylZ(0.02,0.06),M.metal2,0,0.06,-0.4-L*0.45+0.02);
    add(g,RB(0.045,0.1,0.3,0.014),wood?M.wood:(id==='lightsr'?M.tan:M.od),0,0.015,0.22,-0.12,0,0); add(g,RB(0.045,0.12,0.03,0.008),M.poly,0,0.0,0.36);
    grip(g,M.poly,0.3);
    if(id!=='m1'){ add(g,cylZ(0.02,0.3),M.metal,0,0.135,-0.08); add(g,cylZ(0.027,0.06),M.metal,0,0.135,-0.23); add(g,cylZ(0.025,0.05),M.metal,0,0.135,0.06);
      add(g,new THREE.CircleGeometry(0.024,16),M.lens,0,0.135,-0.262); for(const s of [-0.05,0.02]) add(g,RB(0.012,0.04,0.015,0.003),M.metal,0,0.1,s-0.03); u.sight=0.135; u.scope=true;
      add(g,cylZ(0.006,0.05),M.metal2,0.045,0.06,0.02,0,Math.PI/2,0); }
    else { add(g,RB(0.01,0.02,0.01,0.002),M.metal,0,0.1,-0.82); u.sight=0.1; }
    u.mag=mag(g,M.metal,-0.06,0.07,0); u.muzzle=new THREE.Vector3(0,0.06,-0.4-L*0.45); u.handL=new THREE.Vector3(-0.01,-0.0,-0.4); u.len=L; return g;
  }
  function pistol(id){
    const g=new THREE.Group(), u=g.userData;
    if(id==='crossbow'){ add(g,RB(0.04,0.05,0.42,0.01),M.wood,0,0.03,-0.12); grip(g,M.poly,0.3);
      const bow=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.008,6,24,Math.PI*0.7),M.metal); bow.rotation.set(-Math.PI/2,0,Math.PI*0.15+Math.PI); bow.position.set(0,0.05,-0.18); g.add(bow);
      const str=new THREE.Mesh(new THREE.CylinderGeometry(0.0015,0.0015,0.36,4),M.chrome); str.rotation.z=Math.PI/2; str.position.set(0,0.05,-0.12); g.add(str);
      add(g,cylZ(0.004,0.32),M.metal2,0,0.065,-0.2); add(g,new THREE.ConeGeometry(0.008,0.03,6),M.blade,0,0.065,-0.37,-Math.PI/2,0,0);
      u.muzzle=new THREE.Vector3(0,0.065,-0.37); u.sight=0.085; u.handL=new THREE.Vector3(-0.01,-0.0,-0.22); u.len=0.5; u.two=true; return g; }
    if(id==='flintlock'){ add(g,cylZ(0.011,0.32),M.metal,0,0.05,-0.2); add(g,cylZ(0.014,0.02),M.brass,0,0.05,-0.36); add(g,RB(0.03,0.04,0.18,0.01),M.wood,0,0.035,-0.12);
      add(g,RB(0.032,0.11,0.05,0.014),M.wood,0,-0.02,0.03,0.6,0,0); add(g,RB(0.01,0.03,0.02,0.003),M.brass,0.018,0.07,-0.02);
      u.muzzle=new THREE.Vector3(0,0.05,-0.37); u.sight=0.07; u.len=0.4; return g; }
    if(id==='shuriken'){ const sh=new THREE.Shape(); for(let i=0;i<8;i++){ const a=i/8*Math.PI*2, r=i%2?0.018:0.06; sh[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r); }
      const geo=new THREE.ExtrudeGeometry(sh,{depth:0.004,bevelEnabled:false}); add(g,geo,M.blade,0,0.05,-0.08,Math.PI/2.4,0,0); u.muzzle=new THREE.Vector3(0,0.05,-0.1); u.sight=0.06; u.len=0.15; u.thrown=true; return g; }
    if(id==='revolver'){ add(g,RB(0.03,0.05,0.09,0.008),M.chrome,0,0.05,-0.03); add(g,cylZ(0.026,0.05,8),M.chrome,0,0.045,-0.04); add(g,cylZ(0.01,0.16),M.chrome,0,0.065,-0.15);
      add(g,RB(0.03,0.1,0.045,0.014),M.wood,0,-0.03,0.02,0.35,0,0); add(g,RB(0.004,0.012,0.008,0.002),M.chrome,0,0.08,-0.22);
      u.muzzle=new THREE.Vector3(0,0.065,-0.23); u.sight=0.082; u.len=0.32; return g; }
    const big=id==='deagle', S={p1912:{c:M.metal},deagle:{c:M.chrome},auto75:{c:M.poly,ext:true},burst9:{c:M.metal2}}[id]||{c:M.metal};
    const sl=big?0.25:0.19; add(g,RB(big?0.036:0.03,big?0.045:0.035,sl,0.006),S.c,0,0.065,-sl/2+0.03);
    add(g,RB(0.028,0.03,sl*0.8,0.006),M.poly,0,0.035,-sl/2+0.04); add(g,RB(0.03,0.1,0.045,0.012),M.poly,0,-0.01,0.025,0.3,0,0);
    add(g,new THREE.TorusGeometry(0.018,0.003,6,10,Math.PI),M.poly,0,0.02,-0.025,0,Math.PI/2,Math.PI);
    add(g,RB(0.004,0.01,0.008,0.002),M.metal,0,0.09,-sl+0.04);
    const mg=new THREE.Group(); add(mg,RB(0.024,S.ext?0.14:0.06,0.035,0.004),M.metal,0,-0.03,0); mg.position.set(0,-0.03,0.03); g.add(mg); u.mag=mg;
    u.muzzle=new THREE.Vector3(0,0.065,-sl+0.02); u.sight=0.09; u.len=sl; return g;
  }
  function melee(id){
    const g=new THREE.Group(), u=g.userData; u.melee=true;
    if(id==='knife'){ add(g,RB(0.025,0.03,0.11,0.008),M.poly,0,0,0.02); add(g,RB(0.04,0.008,0.012,0.002),M.metal,0,0,-0.04);
      const sh=new THREE.Shape(); sh.moveTo(0,0); sh.lineTo(0.17,0); sh.lineTo(0.2,0.012); sh.lineTo(0.16,0.03); sh.lineTo(0,0.03); const bl=new THREE.ExtrudeGeometry(sh,{depth:0.003,bevelEnabled:false});
      const b=add(g,bl,M.blade,0.0015,-0.015,-0.045,0,Math.PI/2,0); u.len=0.3; }
    else if(id==='axe'){ add(g,new THREE.CylinderGeometry(0.014,0.016,0.62,8),M.wood,0,0,-0.2,Math.PI/2,0,0); add(g,RB(0.02,0.16,0.12,0.006),M.red,0,0.04,-0.48); add(g,RB(0.022,0.04,0.12,0.004),M.blade,0,0.12,-0.48); add(g,RB(0.03,0.08,0.04,0.004),M.metal,0,-0.05,-0.48); u.len=0.65; }
    else if(id==='shield'){ add(g,RB(0.5,0.75,0.04,0.02),M.shield,-0.08,0.05,-0.12); add(g,RB(0.24,0.06,0.045,0.01),M.glass,-0.08,0.28,-0.12); add(g,new THREE.PlaneGeometry(0.42,0.05),M.dot,-0.08,-0.15,-0.098); u.shield=true; u.len=0.4; }
    else { u.fists=true; u.len=0.1; }
    u.muzzle=new THREE.Vector3(0,0,-0.3); u.sight=0.05; return g;
  }
  function other(id){
    if(id==='shield') return melee('shield');
    const g=new THREE.Group(), u=g.userData; // snow cannon
    add(g,cylZ(0.05,0.55),M.snow,0,0.06,-0.18); add(g,cylZ(0.065,0.06),M.glowB,0,0.06,-0.47); add(g,new THREE.SphereGeometry(0.07,14,10),M.metal2,0,0.02,0.12); grip(g,M.poly);
    add(g,RB(0.03,0.04,0.12,0.008),M.poly,0,0.13,-0.1); u.muzzle=new THREE.Vector3(0,0.06,-0.5); u.sight=0.15; u.handL=new THREE.Vector3(-0.01,-0.0,-0.3); u.len=0.7; return g;
  }
  /* throwables & specials (held in hand) */
  function item(kind){
    const g=new THREE.Group(), u=g.userData; u.item=true;
    switch(kind){
      case 'frag': add(g,new THREE.SphereGeometry(0.035,12,10),M.od,0,0.03,-0.05); add(g,RB(0.012,0.03,0.04,0.003),M.metal,0,0.07,-0.05); add(g,new THREE.TorusGeometry(0.012,0.002,4,10),M.chrome,0.015,0.08,-0.05); break;
      case 'smoke': case 'flash': case 'stun': add(g,new THREE.CylinderGeometry(0.028,0.028,0.11,12),kind==='smoke'?M.od:kind==='flash'?M.metal2:M.tan,0,0.04,-0.05); add(g,RB(0.012,0.03,0.04,0.003),M.metal,0,0.11,-0.05); break;
      case 'sticky': add(g,new THREE.SphereGeometry(0.035,12,10),M.poly,0,0.03,-0.05); add(g,new THREE.SphereGeometry(0.012,8,6),M.glowO,0,0.065,-0.05); break;
      case 'repulse': case 'implode': add(g,new THREE.IcosahedronGeometry(0.04,1),M.metal2,0,0.03,-0.05); add(g,new THREE.TorusGeometry(0.045,0.005,6,16),kind==='repulse'?M.glowB:M.glowG,0,0.03,-0.05); break;
      case 'c4': add(g,RB(0.1,0.04,0.06,0.006),M.tan,0,0.02,-0.05); add(g,RB(0.03,0.02,0.04,0.004),M.poly,0.02,0.05,-0.05); add(g,new THREE.SphereGeometry(0.005,6,4),M.dot,0.03,0.062,-0.04); break;
      case 'mine': add(g,new THREE.CylinderGeometry(0.08,0.08,0.035,16),M.od,0,0.02,-0.06); add(g,new THREE.CylinderGeometry(0.02,0.02,0.02,10),M.metal,0,0.045,-0.06); break;
      case 'rocket': add(g,cylZ(0.05,0.9),M.od,0,0.09,-0.12); add(g,new THREE.ConeGeometry(0.045,0.12,10),M.od,0,0.09,-0.62,-Math.PI/2,0,0); grip(g,M.poly); add(g,RB(0.03,0.05,0.06,0.006),M.metal,-0.05,0.15,-0.1); u.muzzle=new THREE.Vector3(0,0.09,-0.6); break;
      case 'ammo': add(g,RB(0.16,0.09,0.09,0.01),M.od,0,0.02,-0.08); add(g,RB(0.05,0.012,0.02,0.003),M.brass,0,0.07,-0.08); break;
      case 'health': add(g,RB(0.15,0.1,0.08,0.012),M.blade,0,0.02,-0.08); add(g,RB(0.06,0.02,0.002,0),M.red,0,0.02,-0.039); add(g,RB(0.02,0.06,0.002,0),M.red,0,0.02,-0.039); break;
      case 'repair': add(g,RB(0.02,0.02,0.22,0.004),M.chrome,0,0.02,-0.1); add(g,new THREE.TorusGeometry(0.025,0.008,6,12,Math.PI*1.5),M.chrome,0,0.02,-0.22,Math.PI/2,0,0); break;
      case 'wall': case 'trophy': add(g,RB(0.12,0.08,0.06,0.01),M.poly,0,0.02,-0.06); add(g,RB(0.05,0.012,0.002,0),kind==='wall'?M.glowB:M.glowO,0,0.04,-0.029); break;
    }
    if(!u.muzzle) u.muzzle=new THREE.Vector3(0,0.05,-0.1); u.sight=0.08; u.len=0.2; return g;
  }
  const cache=new Map();
  function make(id){
    mats(); let g;
    if(TH[id]) g=item(TH[id].kind==='grenade'?'frag':TH[id].kind); else if(SP[id]) g=item(id);
    else { const w=WPN[id]||WPN.m4;
      g=w.cat==='ar'?rifle(id):w.cat==='smg'?smg(id):w.cat==='sg'?shotgun(id):w.cat==='sr'?sniper(id):w.cat==='pistol'?pistol(id):w.cat==='melee'?melee(id):other(id); }
    g.userData.id=id; return g;
  }
  /* shared geometry per id for many third-person copies */
  function tp(id){
    if(!cache.has(id)){ const g=make(id); g.updateMatrixWorld(true); const byMat=new Map();
      g.traverse(o=>{ if(!o.isMesh) return; const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
        for(const k of Object.keys(geo.attributes)) if(!['position','normal','uv'].includes(k)) geo.deleteAttribute(k); if(!geo.attributes.uv) geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
        (byMat.get(o.material)||byMat.set(o.material,[]).get(o.material)).push(geo); });
      const out=new THREE.Group(); for(const [m,list] of byMat){ const geo=THREE.mergeGeometries(list,false); if(geo){ const mesh=new THREE.Mesh(geo,m); mesh.castShadow=true; out.add(mesh); } }
      out.userData=Object.assign({},g.userData); cache.set(id,out); }
    const src=cache.get(id); const c=src.clone(true); c.userData=Object.assign({},src.userData); return c; }
  /* first-person arms holding a gun: returns {group, gun, armR, armL} */
  function viewmodel(id){
    mats(); const root=new THREE.Group(); const gun=make(id); root.add(gun); const u=gun.userData;
    const arm=(hx,hy,hz,ex,ey,ez,left)=>{ const a=new THREE.Group(); const h=new THREE.Vector3(hx,hy,hz), e=new THREE.Vector3(ex,ey,ez); const L=h.distanceTo(e);
      const fore=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.042,L,10),M.sleeve); fore.position.copy(h).add(e).multiplyScalar(0.5); fore.lookAt(e); fore.rotateX(Math.PI/2); a.add(fore);
      const cuff=new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.034,0.04,10),M.glove); cuff.position.copy(h).lerp(e,0.12); cuff.quaternion.copy(fore.quaternion); a.add(cuff);
      const hand=new THREE.Mesh(RB(0.055,0.05,0.09,0.02),M.glove); hand.position.copy(h); hand.rotation.x=left?0.2:-0.25; a.add(hand); root.add(a); return a; };
    const armR=arm(0.012,-0.045,0.035,0.16,-0.32,0.36,false);
    let armL=null; if(u.handL&&!u.melee) armL=arm(u.handL.x-0.02,u.handL.y-0.035,u.handL.z,-0.26,-0.36,u.handL.z+0.34,true);
    else if(u.fists||u.item) armL=arm(-0.22,-0.03,-0.08,-0.3,-0.3,0.35,true);
    if(u.fists){ gun.visible=false; armR.position.x+=0.02; }
    return {group:root,gun,armR,armL};
  }
  return {make,tp,viewmodel,mats};
})();
