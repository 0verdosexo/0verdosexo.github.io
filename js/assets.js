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
    const one=(file,srgb)=>{ const t=new THREE.Texture(); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=maxAniso; if(srgb) t.colorSpace=THREE.SRGBColorSpace; t.userData.clones=[];
      const ready=img=>{ t.image=img; t.needsUpdate=true; for(const c of t.userData.clones) c.needsUpdate=true; t.userData.ready=true; };
      track(new Promise(res=>texLoader.load(dir+file,lt=>{ ready(lt.image); res(); },undefined,()=>{ failed.push(name+'/'+file);
        if(srgb) ready(noiseTex(FALLBACK_COL[name]||'#888',0.18).image);
        else ready(canvasTex(4,4,(g,w,h)=>{ g.fillStyle=file.startsWith('nor')?'rgb(128,128,255)':'rgb(255,230,0)'; g.fillRect(0,0,w,h); }).image); res(); })));
      return t; };
    set.map=one('diff.webp',true); if(!(typeof QUALITY!=='undefined'&&QUALITY.lite)){ set.normalMap=one('nor.webp',false); set.armMap=one('arm.webp',false); }
    texCache.set(name,set); return set;
  }
  function tiled(t,tile){ const c=t.clone(); c.repeat.set(1/tile,1/tile); t.userData.clones.push(c); if(t.userData.ready) c.needsUpdate=true; return c; }
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
  function model(name){
    if(modelCache.has(name)) return modelCache.get(name);
    const p=track(new Promise(res=>gltf.load(BASE+'models/'+name+'.glb',g=>{
      g.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; const ms=Array.isArray(o.material)?o.material:[o.material];
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
  desert:{ hdri:'desert', exposure:0.92, fog:'#d9c4a2', fogD:[90,420], sun:{color:'#fff1d6',int:3.2,dir:[-0.55,0.72,0.42]}, hemi:0.25, envInt:0.9, bgInt:1.0, bloom:[0.25,0.5,0.88],
    ground:{tex:'sand_ripple',tile:5,nor:1.4,color:'#d9b98c'}, cliff:{tex:'rock_cliff',tile:7,nor:1.6,color:'#e0c2a5'}, cliffKind:'rock', void:'#120c08'},
  plaza:{ hdri:'plaza', exposure:1.05, fog:'#cfdbe8', fogD:[110,480], sun:{color:'#fffaf0',int:3.0,dir:[0.45,0.8,0.3]}, hemi:0.3, envInt:1.0, bgInt:1.0, bloom:[0.2,0.45,0.9],
    ground:{tex:'plaza_tiles',tile:4,nor:0.8,color:'#f4f4f2'}, cliff:{tex:'plaster',tile:3,color:'#f5f6f8'}, cliffKind:'facade_white', void:'#0b1018'},
  cyber:{ hdri:'cyber', exposure:1.15, fog:'#1a1430', fogD:[30,230], sun:{color:'#8fa8ff',int:0.55,dir:[0.3,0.8,-0.5]}, hemi:0.12, envInt:0.55, bgInt:0.55, bloom:[0.85,0.55,0.62],
    ground:{tex:'asphalt',tile:5,rough:0.55,nor:1,color:'#b8b8c4'}, cliff:{tex:'concrete_cracked',tile:4,color:'#5a5868'}, cliffKind:'facade_city', void:'#05040a', night:true, rain:true},
  factory:{ hdri:'factory', exposure:1.0, fog:'#a9a49a', fogD:[60,330], sun:{color:'#ffe6c4',int:2.4,dir:[-0.4,0.65,-0.55]}, hemi:0.28, envInt:0.85, bgInt:0.9, bloom:[0.25,0.5,0.88],
    ground:{tex:'concrete_cracked',tile:5,nor:1.1,color:'#8f8a82'}, cliff:{tex:'factory_wall',tile:4}, cliffKind:'wall_factory', void:'#0a0806', dust:true}
};
/* building styles: exterior wall, interior side, floor, ceiling, roof top, trim (parapets/rails), pillar */
const STYLES={
  white:{ext:{tex:'plaster',tile:3,color:'#f3ead8'},int:{tex:'plaster',tile:3,color:'#ece6da'},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3,color:'#f6f2ea'},roof:{tex:'concrete_worn',tile:4},trim:{tex:'concrete_worn',tile:2,color:'#d8d2c4'},accent:'#3c78b4'},
  metal:{ext:{tex:'metal_panel',tile:2.5,metalMap:true,color:'#c9ccd0'},int:{tex:'plaster',tile:3,color:'#d9dbde'},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'metal_panel',tile:2,color:'#9aa0a6',metalMap:true},roof:{tex:'concrete_worn',tile:4},trim:{tex:'blue_metal',tile:2,metalMap:true},accent:'#2a6fb8'},
  ruin:{ext:{tex:'sandstone',tile:3},int:{tex:'concrete_cracked',tile:3,color:'#cfc3b2'},floor:{tex:'concrete_cracked',tile:3},ceil:{tex:'concrete_worn',tile:3},roof:{tex:'concrete_cracked',tile:4},trim:{tex:'concrete_worn',tile:2},accent:'#a0602a'},
  corrugated:{ext:{tex:'corrugated',tile:2.5,metalMap:true,color:'#e0b090'},int:{tex:'metal_panel',tile:2.5,metalMap:true},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'corrugated',tile:2.5,metalMap:true,color:'#9a9a9a'},roof:{tex:'corrugated',tile:3,metalMap:true,color:'#a0a0a0'},trim:{tex:'rust_metal',tile:2,metalMap:true},accent:'#c06020'},
  concrete:{ext:{tex:'concrete_worn',tile:3},int:{tex:'plaster',tile:3},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3},roof:{tex:'concrete_worn',tile:4},trim:{tex:'concrete_worn',tile:2,color:'#c8c4bc'},accent:'#888888'},
  neo:{ext:{tex:'white_panel',tile:3,color:'#ffffff'},int:{tex:'plaster',tile:2.5,color:'#f2f4f6'},floor:{tex:'plaza_tiles',tile:2.5,color:'#f0f0ee'},ceil:{tex:'plaster',tile:3,color:'#ffffff'},roof:{tex:'plaza_tiles',tile:3},trim:{tex:'blue_metal',tile:2,metalMap:true,color:'#9cc4ff'},accent:'#2f7fe0',glass:'#5aa9ff'},
  neon:{ext:{tex:'concrete_cracked',tile:3,color:'#6b6878'},int:{tex:'metal_panel',tile:2.5,metalMap:true,color:'#5d5f6a'},floor:{tex:'plaza_tiles',tile:2,color:'#4a4a58',rough:0.45},ceil:{tex:'metal_panel',tile:2,color:'#3a3b44',metalMap:true},roof:{tex:'concrete_worn',tile:4,color:'#6a6a70'},trim:{tex:'metal_panel',tile:2,metalMap:true,color:'#444'},accent:'#ff2d7a',neon:true},
  garage:{ext:{tex:'concrete_worn',tile:3,color:'#b8b6b2'},int:{tex:'concrete_worn',tile:3},floor:{tex:'asphalt',tile:4,color:'#8a8a90'},ceil:{tex:'concrete_worn',tile:3},roof:{tex:'asphalt',tile:4,color:'#7a7a80'},trim:{tex:'concrete_worn',tile:2,color:'#d8c24a'},accent:'#ffd02d'},
  shop:{ext:{tex:'brick',tile:2.5,color:'#9a8a8a'},int:{tex:'plaster',tile:3,color:'#b8b0a8'},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3,color:'#a8a29a'},roof:{tex:'concrete_worn',tile:4,color:'#77757a'},trim:{tex:'metal_panel',tile:2,metalMap:true,color:'#555'},accent:'#2de1ff',neon:true},
  factory:{ext:{tex:'factory_brick',tile:3},int:{tex:'factory_wall',tile:3,color:'#b4b0a6'},floor:{tex:'concrete_cracked',tile:4,color:'#9a958c'},ceil:{tex:'rust_sheet',tile:3,metalMap:true,color:'#9a9a9a'},roof:{tex:'rust_sheet',tile:3,metalMap:true},trim:{tex:'rust_metal',tile:2,metalMap:true},accent:'#d0a020'},
  office:{ext:{tex:'factory_wall',tile:3,color:'#c4bfb4'},int:{tex:'plaster',tile:3,color:'#c8c2b5'},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3,color:'#bdb7aa'},roof:{tex:'concrete_worn',tile:4},trim:{tex:'rust_metal',tile:2,metalMap:true},accent:'#4a7a9a'},
  brick:{ext:{tex:'brick',tile:2.5},int:{tex:'plaster',tile:3},floor:{tex:'concrete_floor',tile:3},ceil:{tex:'plaster',tile:3},roof:{tex:'concrete_worn',tile:4},trim:{tex:'concrete_worn',tile:2},accent:'#a05030'}
};
/* prop defaults: scale and whether it casts shadows */
const PROP_DEF={barrel_rust:{s:1.25},barrel_blue:{s:1.25},barrier:{s:1.3},barrier2:{s:1.3},boulder_a:{s:2},boulder_b:{s:1.5},boulder_c:{s:1.6},
  cardboard:{s:1.4},crate_wood:{s:2},crate_wood2:{s:1.6},generator:{s:2},hand_truck:{s:1.2},hydrant:{s:1.1},jerrycan:{s:1.2},lamp_modern:{s:1.25,light:'#fff2dc',ly:5.2},
  lamp_street:{s:1.6,light:'#ffd9a0',ly:6},lpg_tank:{s:1.6},mil_crate:{s:1.5},pipes:{s:1.4},plastic_crate:{s:1.3},potted_plant:{s:1.5},propane:{s:1.3},
  security_light:{s:1.5,light:'#ffffff'},shelves:{s:0.13},shrub:{s:3},storage_cart:{s:1.3},tool_cart:{s:1.2},trash_can:{s:1.2},utility_box:{s:1.4},
  wall_lamp:{s:1.4,light:'#ffcf8a'},manhole:{s:1.3},airduct:{s:1.2},ammo_box:{s:1.6}};
