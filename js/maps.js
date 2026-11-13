/* maps.js — map registry and loader. Map files live in /maps and call SandTag.registerMap({...}).
   Script tags are used (not fetch) so the game also runs when index.html is opened directly from disk. */
const MAP_DEFS={}; let MAP_LIST=[]; const mapWaiters={};
window.SandTag={
  registerMap(def){ if(!def||typeof def.id!=='string') return; MAP_DEFS[def.id]=def; (mapWaiters[def.id]||[]).forEach(f=>f(def)); delete mapWaiters[def.id]; },
  setMapList(list){ MAP_LIST=(Array.isArray(list)?list:[]).filter(m=>m&&typeof m.id==='string'&&typeof m.file==='string'); }
};
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=false;
  s.onload=()=>res(); s.onerror=()=>rej(new Error(src+' 파일을 불러오지 못했어요')); document.head.append(s); }); }
async function loadMapList(){ await loadScript('maps/index.js?v='+GAME_VERSION); if(!MAP_LIST.length) throw new Error('maps/index.js 에 맵이 하나도 없어요'); }
async function loadMapDef(id){
  if(MAP_DEFS[id]) return MAP_DEFS[id];
  const e=MAP_LIST.find(m=>m.id===id); if(!e) throw new Error('맵 목록에 없는 맵이에요: '+id);
  const got=new Promise(res=>{ (mapWaiters[id]=mapWaiters[id]||[]).push(res); });
  await loadScript('maps/'+e.file+'?v='+GAME_VERSION);
  return Promise.race([got,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`maps/${e.file} 를 읽었지만 id가 '${id}'인 맵이 등록되지 않았어요. 파일 안의 id나 문법 오류를 확인하세요.`)),2500))]);
}
const mapName=id=>{ const e=MAP_LIST.find(m=>m.id===id); return e?e.name:(MAP_DEFS[id]&&MAP_DEFS[id].name)||id; };
let mapSwitch=Promise.resolve(true);
function ensureMap(id){
  mapSwitch=mapSwitch.then(async()=>{
    if(MAP&&MAP.id===id) return true;
    try{ const def=await loadMapDef(id); setMapData(def); rebuildWorld(); if(S.phase==='menu'||S.phase==='lobby') spawnOrbs(pickOrbs(1,10)); updMapWarn(); return true; }
    catch(err){ console.error(err); showMapError(err.message); return false; }
  });
  return mapSwitch;
}
