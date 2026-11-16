/* boot.js — loads three.js (ES modules) and exposes it as window.THREE, then loads the game's classic scripts in order. */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
window.THREE=Object.assign({},T,{GLTFLoader,HDRLoader,EffectComposer,RenderPass,UnrealBloomPass,OutputPass,GTAOPass,SMAAPass,ShaderPass,
  SkeletonUtils,mergeGeometries,mergeVertices,RoundedBoxGeometry,MeshoptDecoder});
const SCRIPTS=['lib/mqtt.min.js','js/util.js','js/version.js','js/data.js','js/mapgen.js','js/core.js','maps/index.js'];
const LATE=['js/assets.js','js/render.js','js/world.js','js/avatar.js','js/guns.js','js/fx.js','js/audio.js','js/input.js',
  'js/actors.js','js/weapons.js','js/tag.js','js/modes.js','js/bots.js','js/relay.js','js/net.js','js/minimap.js','js/hud.js','js/game.js','js/ui.js','js/main.js'];
const V='?v='+Date.now().toString(36).slice(0,-3);
function load(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src+V; s.async=false; s.onload=res; s.onerror=()=>rej(new Error(src)); document.head.appendChild(s); }); }
window.SandTag={maps:{},mapOrder:[],registerMap(d){ this.maps[d.id]=d; if(!this.mapOrder.includes(d.id)) this.mapOrder.push(d.id); }};
(async()=>{
  try{
    for(const s of SCRIPTS) await load(s);
    for(const m of (window.MAP_FILES||[])) await load('maps/'+m+'.js');
    for(const s of (window.BOOT_LATE||LATE)) await load(s);
    window.dispatchEvent(new Event('sandtag-ready'));
  }catch(e){ const el=document.getElementById('bootErr'); if(el){ el.textContent='불러오기 실패: '+e.message+' — 웹 서버(https)로 열었는지 확인해 주세요.'; el.style.display='block'; } console.error(e); }
})();
