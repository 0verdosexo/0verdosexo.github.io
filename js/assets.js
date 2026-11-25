/* assets.js — loads the CC0 assets (Poly Haven textures/HDRIs/props, Quaternius character) with procedural fallbacks.
   Every loader resolves even when a file is missing, so the game always runs. */
'use strict';
const Assets=(()=>{
  const BASE='assets/';
  const texLoader=new THREE.TextureLoader();
  const gltf=new THREE.GLTFLoader(); gltf.setMeshoptDecoder(THREE.MeshoptDecoder);
  const hdr=new THREE.HDRLoader();
  const texCache=new Map(), matCache=new Map(), modelCache=new Map();
  let maxAniso=4, pending=0, done=0; const failed=[];
  const progress=()=>Bus.emit('load-progress',{done,pending});
  function track(p){ pending++; progress(); return p.finally(()=>{ done++; progress(); }); }
  /* ---------- procedural fallbacks ---------- */
  function canvasTex(w,h,draw,srgb){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=maxAniso; if(srgb) t.colorSpace=THREE.SRGBColorSpace; return t; }
  function noiseTex(base,amp){ return canvasTex(128,128,(g,w,h)=>{ g.fillStyle=base; g.fillRect(0,0,w,h); const R=mulberry(hashStr(base));
    for(let i=0;i<1400;i++){ const v=(R()-0.5)*amp; g.fillStyle=v>0?`rgba(255,255,255,${v})`:`rgba(0,0,0,${-v})`; g.fillRect(R()*w,R()*h,1+R()*3,1+R()*3); } },true); }
  const FALLBACK_COL={sand_ripple:'#c9a878',rock_cliff:'#8a6a52',plaster:'#e8e2d6',white_panel:'#f4f5f6',sandstone:'#c8a882',tread_plate:'#8a8d90',shutter:'#8a8a86',concrete_floor:'#9a958c',concrete_worn:'#a39f97',concrete_cracked:'#8f8b85',
    plaza_tiles:'#d9d9d6',grass:'#5b7a3a',metal_panel:'#8e9296',blue_metal:'#3d6d9e',corrugated:'#8b6d55',brick:'#8a4b3a',factory_brick:'#7a4a38',
    factory_wall:'#77736b',rust_metal:'#7a4a2a',rust_sheet:'#86553a',asphalt:'#3a3a3c',grate:'#55585c'};
  /* ---------- PBR texture sets (diff / normal / ARM = ao,rough,metal) ---------- */
  function texSet(name){
    if(texCache.has(name)) return texCache.get(name);
    const set={}; const dir=BASE+'tex/'+name+'/';
    const one=(file,srgb)=>{ const t=new THREE.Texture(); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=maxAniso; if(srgb) t.colorSpace=THREE.SRGBColorSpace; CLONES.set(t,[]);
      const ready=img=>{ t.image=img; t.needsUpdate=true; for(const c of CLONES.get(t)) c.needsUpdate=true; t.userData.ready=true; };
      track(new Promise(res=>texLoader.load(dir+file,lt=>{ ready(lt.image); res(); },undefined,()=>{ failed.push(name+'/'+file);
        if(srgb) ready(noiseTex(FALLBACK_COL[name]||'#888',0.18).image);
        else ready(canvasTex(4,4,(g,w,h)=>{ g.fillStyle=file.startsWith('nor')?'rgb(128,128,255)':'rgb(255,230,0)'; g.fillRect(0,0,w,h); }).image); res(); })));
      return t; };
    set.map=one('diff.webp',true); if(!(typeof QUALITY!=='undefined'&&QUALITY.lite)){ set.normalMap=one('nor.webp',false); set.armMap=one('arm.webp',false); }
    texCache.set(name,set); return set;
  }
  /* tiled copies share the loaded picture; the list of copies lives outside userData because three.js deep-copies userData with JSON on every clone(),
     and with the pictures already loaded (second map onward) that turned every copy into a full image encode — the slow loading after leaving a match */
  const CLONES=new WeakMap(), TILED=new Map();
  function tiled(t,tile){ let byT=TILED.get(t); if(!byT){ byT=new Map(); TILED.set(t,byT); } if(byT.has(tile)) return byT.get(tile);
    const c=t.clone(); c.repeat.set(1/tile,1/tile); (CLONES.get(t)||[]).push(c); if(t.userData.ready) c.needsUpdate=true; byT.set(tile,c); return c; }
  /* material description → MeshStandardMaterial (cached by key) */
  function pbr(key,o){
    if(matCache.has(key)) return matCache.get(key);
    const m=new THREE.MeshStandardMaterial({color:o.color||'#ffffff',roughness:o.rough!=null?o.rough:1,metalness:o.metal!=null?o.metal:0,envMapIntensity:o.env!=null?o.env:1});
    if(o.tex&&!(typeof QUALITY!=='undefined'&&QUALITY.flatTex)){ const s=texSet(o.tex), tile=o.tile||2;
      m.map=tiled(s.map,tile);
      if(!(typeof QUALITY!=='undefined'&&QUALITY.lite)){ m.normalMap=tiled(s.normalMap,tile); m.normalScale.set(o.nor||1,-(o.nor||1));
        const arm=tiled(s.armMap,tile); m.aoMap=arm; m.roughnessMap=arm; m.metalnessMap=o.metalMap?arm:null; m.aoMapIntensity=o.ao!=null?o.ao:0.8; if(o.metalMap) m.metalness=1; }
      else { m.roughness=o.rough!=null?o.rough:0.85; if(o.metalMap) m.metalness=0.6; } }
    else if(o.tex) m.color.set(FALLBACK_COL[o.tex]||o.color||'#888').multiply(new THREE.Color(o.color||'#fff'));
    if(o.emissive){ m.emissive=new THREE.Color(o.emissive); m.emissiveIntensity=o.ei||1; }
    if(o.transparent){ m.transparent=true; m.opacity=o.opacity||0.5; m.depthWrite=false; }
    if(o.side) m.side=o.side;
    m.name=key; matCache.set(key,m); return m;
  }
  /* ---------- props (GLB) ---------- */
  const toStd=m=>{ if(!m||!m.isMeshPhysicalMaterial) return m; const s=new THREE.MeshStandardMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(s,m); s.type='MeshStandardMaterial'; m.dispose(); return s; };
  function model(name){
    if(modelCache.has(name)) return modelCache.get(name);
    const p=track(new Promise(res=>gltf.load(BASE+'models/'+name+'.glb',g=>{
      g.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true;
        if(Array.isArray(o.material)) o.material=o.material.map(toStd); else o.material=toStd(o.material); const ms=Array.isArray(o.material)?o.material:[o.material];
        ms.forEach(m=>{ if(m.map) m.map.anisotropy=maxAniso; m.envMapIntensity=1; }); } });
      const box=new THREE.Box3().setFromObject(g.scene); res({scene:g.scene,box,animations:g.animations});
    },undefined,()=>{ failed.push('model '+name); res(null); })));
    modelCache.set(name,p); return p;
  }
  /* ---------- environment (HDRI) ---------- */
  function env(name,big){
    const out={hdr:null,bg:null};
    const a=track(new Promise(res=>hdr.load(BASE+'hdri/'+name+'.hdr',t=>{ t.mapping=THREE.EquirectangularReflectionMapping; out.hdr=t; res(); },undefined,()=>{ failed.push('hdri '+name); res(); })));
    const b=track(new Promise(res=>texLoader.load(BASE+'hdri/'+name+(big?'_bg.webp':'_bg_s.webp'),t=>{ t.mapping=THREE.EquirectangularReflectionMapping; t.colorSpace=THREE.SRGBColorSpace; out.bg=t; res(); },undefined,()=>{ failed.push('bg '+name); res(); })));
    return Promise.all([a,b]).then(()=>out);
  }
  /* ---------- character ---------- */
  let charP=null;
  function character(){ if(!charP) charP=model('char_m'); return charP; }
  function setAniso(a){ maxAniso=a; }
  function resetMaterials(){ matCache.clear(); }
  return {texSet,pbr,model,env,character,canvasTex,noiseTex,failed,setAniso,resetMaterials,get pending(){return pending;},get done(){return done;}};
})();

/* ---------- material palette per theme ----------
   Every surface the world builder makes asks for a material by role (ground, cliff, wall_<style>, ...). */
const THEMES={
  /* golden hour: low warm sun, long shadows, dusty orange haze */
  desert:{ hdri:'desert', exposure:0.9, fog:'#e2a878', fogD:[35,300], sun:{color:'#ffb273',int:3.6,dir:[0.74,0.42,0.53]}, hemi:0.34, envInt:0.85, bgInt:1.0, bloom:[0.34,0.5,0.86],
    ground:{tex:'sand_ripple',tile:5,nor:1.5,color:'#d2a878'}, cliff:{tex:'rock_cliff',tile:14,nor:1.1,color:'#c29a7c'}, cliffKind:'rock', void:'#120c08', warm:true},
  /* blue hour: the sun is gone, windows and lamps are on */
  plaza:{ hdri:'plaza', exposure:0.92, fog:'#514c78', fogD:[35,300], sun:{color:'#c9aaff',int:0.7,dir:[0.62,0.6,0.5]}, hemi:0.2, envInt:0.55, bgInt:1.0, bloom:[0.36,0.45,0.84],
    ground:{tex:'plaza_tiles',tile:4,nor:0.9,rough:0.38,color:'#8f93a6'}, cliff:{tex:'plaster',tile:3,color:'#9fa2b8'}, cliffKind:'facade_white', void:'#0b1018', dusk:true},
  cyber:{ hdri:'cyber', exposure:1.15, fog:'#1a1430', fogD:[30,230], sun:{color:'#8fa8ff',int:0.55,dir:[0.3,0.8,-0.5]}, hemi:0.12, envInt:0.55, bgInt:0.55, bloom:[0.5,0.45,0.8],
    ground:{tex:'asphalt',tile:5,rough:0.55,nor:1,color:'#b8b8c4'}, cliff:{tex:'concrete_cracked',tile:4,color:'#5a5868'}, cliffKind:'facade_city', void:'#05040a', night:true, rain:true},
  /* bright hazy day in an industrial yard: strong sun, crisp shadows, light haze in the distance */
  factory:{ hdri:'factory', exposure:0.95, fog:'#c3ccd4', fogD:[70,400], sun:{color:'#fff1d8',int:3.3,dir:[0.45,0.8,0.3]}, hemi:0.3, envInt:0.9, bgInt:1.0, bloom:[0.2,0.45,0.92],
    ground:{tex:'pad',tile:6,nor:1.2,rough:0.9,color:'#a8a49b'}, road:{tex:'asphalt',tile:5,nor:1,rough:0.85,color:'#8d8d92'}, cliff:{tex:'precast',tile:4.2,nor:1.2,color:'#c9c5bb'}, cliffKind:'wall_factory', void:'#0a0806', dust:true, yard:true},
  /* overcast morning after rain on the steppe: flat grey light, low haze, wet ground */
  kursk:{ hdri:'kursk', exposure:1.0, fog:'#a7adb3', fogD:[60,620], sun:{color:'#f6e7cf',int:1.65,dir:[0.42,0.66,0.55]}, hemi:0.36, envInt:0.8, bgInt:1.0, bloom:[0.12,0.45,0.95],
    ground:{tex:'grass',tile:4.5,nor:1.0,rough:0.92,color:'#98996e'}, cliff:{tex:'rock_cliff',tile:8,color:'#6e5c48'}, cliffKind:'none', void:'#0a0806'}
};
/* building styles: exterior wall, interior side, floor, ceiling, roof top, trim (parapets/rails), pillar */
const STYLES={
  white:{ext:{tex:'plaster',tile:3,color:'#e6d6bb'},int:{tex:'plaster',tile:3,color:'#cdbfa6'},floor:{tex:'concrete_floor',tile:3,color:'#a59a8a'},ceil:{tex:'plaster',tile:3,color:'#c9bda8'},roof:{tex:'concrete_worn',tile:4},trim:{tex:'concrete_worn',tile:2,color:'#d8d2c4'},accent:'#3c78b4'},
  metal:{ext:{tex:'metal_panel',tile:2.5,metalMap:true,color:'#c9ccd0'},int:{tex:'plaster',tile:3,color:'#d9dbde'},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'metal_panel',tile:2,color:'#9aa0a6',metalMap:true},roof:{tex:'concrete_worn',tile:4},trim:{tex:'blue_metal',tile:2,metalMap:true},accent:'#2a6fb8'},
  ruin:{ext:{tex:'sandstone',tile:2,color:'#c4ad8e'},int:{tex:'plaster',tile:3,color:'#b3a188'},floor:{tex:'concrete_floor',tile:3,color:'#8d8376'},ceil:{tex:'concrete_worn',tile:3,color:'#9a9184'},roof:{tex:'concrete_cracked',tile:4},trim:{tex:'concrete_worn',tile:2},accent:'#a0602a'},
  corrugated:{ext:{tex:'rusty_corr',tile:3,metalMap:true,color:'#c9b4a6'},int:{tex:'metal_panel',tile:2.5,metalMap:true},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'corrugated',tile:2.5,metalMap:true,color:'#9a9a9a'},roof:{tex:'corrugated',tile:3,metalMap:true,color:'#a0a0a0'},trim:{tex:'rust_metal',tile:2,metalMap:true},accent:'#c06020'},
  concrete:{ext:{tex:'concrete_worn',tile:3,color:'#d6c7b0'},int:{tex:'plaster',tile:3,color:'#c6b9a3'},floor:{tex:'concrete_floor',tile:3,color:'#9c9285'},ceil:{tex:'plaster',tile:3,color:'#bdb2a0'},roof:{tex:'concrete_worn',tile:4},trim:{tex:'concrete_worn',tile:2,color:'#c8c4bc'},accent:'#888888'},
  neo:{ext:{tex:'white_panel',tile:3,color:'#d9dceb'},int:{tex:'plaster',tile:2.5,color:'#d6d2c8'},floor:{tex:'plaza_tiles',tile:2.5,color:'#b9b6b0',rough:0.45},ceil:{tex:'plaster',tile:3,color:'#d8d4ca'},roof:{tex:'plaza_tiles',tile:3},trim:{tex:'blue_metal',tile:2,metalMap:true,color:'#9cc4ff'},accent:'#2f7fe0',glass:'#5aa9ff'},
  neon:{ext:{tex:'concrete_cracked',tile:3,color:'#6b6878'},int:{tex:'metal_panel',tile:2.5,metalMap:true,color:'#5d5f6a'},floor:{tex:'plaza_tiles',tile:2,color:'#4a4a58',rough:0.45},ceil:{tex:'metal_panel',tile:2,color:'#3a3b44',metalMap:true},roof:{tex:'concrete_worn',tile:4,color:'#6a6a70'},trim:{tex:'metal_panel',tile:2,metalMap:true,color:'#444'},accent:'#ff2d7a',neon:true},
  garage:{ext:{tex:'concrete_worn',tile:3,color:'#b8b6b2'},int:{tex:'concrete_worn',tile:3},floor:{tex:'asphalt',tile:4,color:'#8a8a90'},ceil:{tex:'concrete_worn',tile:3},roof:{tex:'asphalt',tile:4,color:'#7a7a80'},trim:{tex:'concrete_worn',tile:2,color:'#d8c24a'},accent:'#ffd02d'},
  shop:{ext:{tex:'brick',tile:2.5,color:'#9a8a8a'},int:{tex:'plaster',tile:3,color:'#b8b0a8'},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3,color:'#a8a29a'},roof:{tex:'concrete_worn',tile:4,color:'#77757a'},trim:{tex:'metal_panel',tile:2,metalMap:true,color:'#555'},accent:'#2de1ff',neon:true},
  factory:{ext:{tex:'factory_brick',tile:3},int:{tex:'factory_wall',tile:3,color:'#b4b0a6'},floor:{tex:'concrete_floor',tile:4,color:'#85827b'},ceil:{tex:'rust_sheet',tile:3,metalMap:true,color:'#9a9a9a'},roof:{tex:'rust_sheet',tile:3,metalMap:true},trim:{tex:'rust_metal',tile:2,metalMap:true},accent:'#d0a020'},
  office:{ext:{tex:'factory_wall',tile:3,color:'#c4bfb4'},int:{tex:'plaster',tile:3,color:'#c8c2b5'},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3,color:'#bdb7aa'},roof:{tex:'concrete_worn',tile:4},trim:{tex:'rust_metal',tile:2,metalMap:true},accent:'#4a7a9a'},
  brick:{ext:{tex:'brick',tile:2.5},int:{tex:'plaster',tile:3},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3},roof:{tex:'concrete_worn',tile:4},trim:{tex:'concrete_worn',tile:2},accent:'#a05030'}
};
/* prop defaults: scale and whether it casts shadows */
const PROP_DEF={barrel_rust:{s:1.25},barrel_blue:{s:1.25},barrier:{s:1.3},barrier2:{s:1.3},boulder_a:{s:2},boulder_b:{s:1.5},boulder_c:{s:1.6},
  cardboard:{s:1.4},crate_wood:{s:2},crate_wood2:{s:1.6},generator:{s:2},hand_truck:{s:1.2},hydrant:{s:1.1},jerrycan:{s:1.2},lamp_modern:{s:1.25,light:'#fff2dc',ly:5.2},
  lamp_street:{s:1.6,light:'#ffd9a0',ly:6},lpg_tank:{s:1.6},mil_crate:{s:1.5},pipes:{s:1.4},plastic_crate:{s:1.3},potted_plant:{s:1.5},propane:{s:1.3},
  security_light:{s:1.5,light:'#ffffff'},shelves:{s:0.13},shrub:{s:3},storage_cart:{s:1.3},tool_cart:{s:1.2},trash_can:{s:1.2},utility_box:{s:1.4},
  wall_lamp:{s:1.4,light:'#ffcf8a'},manhole:{s:1.3},airduct:{s:1.2},ammo_box:{s:1.6}};
