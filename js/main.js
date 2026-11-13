/* main.js — frame loop, menus, version badge, boot */
let baseFov=72;
/* seeker sees a 60° horizontal slice: convert to the vertical fov three.js uses */
function seekerFov(){ return 2*Math.atan(Math.tan(30*Math.PI/180)/camera.aspect)*180/Math.PI; }
function resize(){ const w=innerWidth,h=innerHeight; gfxResize(w,h); camera.aspect=w/h; baseFov=w<h?84:72; camera.fov=baseFov; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();
let lastT=performance.now(), bob=0, countLast=0;
function pvpTick(dt){
  const me=S.me, o=S.opp;
  NET.sendT-=dt; if(NET.sendT<=0){ NET.sendT=0.09;
    netGame({t:'s',x:+me.x.toFixed(2),y:+me.y.toFixed(2),z:+me.z.toFixed(2),yaw:+me.yaw.toFixed(3),mv:me.moving?1:0,ns:me.noisy?1:0,sl:(me.slideT>0||me.crouch)?1:0,air:me.gr?0:1,hp:me.hp,rl:reloadLocked()?1:0}); }
  const k=Math.min(1,dt*10); o.x+=(o.tx-o.x)*k; o.y+=(o.ty-o.y)*k; o.z+=(o.tz-o.z)*k;
  let dy=o.tyaw-o.yaw; dy=Math.atan2(Math.sin(dy),Math.cos(dy)); o.yaw+=dy*k;
  if(S.phase==='play'&&S.game==='tag'){
    if(S.role==='seeker'&&canCatch(CATCH_R)) endGame('seeker','catch');
    else if(S.role==='runner'&&Math.hypot(o.x-me.x,o.z-me.z)<1.2&&Math.abs(o.y-me.y)<1.5) endGame('seeker','catch');
  }
}
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now; perfT+=dt;
  for(const o of orbs){ if(o.taken) continue; const u=o.g.userData; u.s.position.y=1.2+Math.sin(perfT*2.4+u.i)*.18; u.h.position.y=u.s.position.y; }
  portalMeshes.forEach(p=>{ p.disc.rotation.z-=dt*2.2; const dim=S.role==='runner'&&S.me.tpCD>0&&S.phase==='play';
    p.disc.material.opacity=dim?0.25:0.85; p.pulse=Math.max(0,(p.pulse||0)-dt*1.5); const s=1+p.pulse*0.35; p.ring.scale.set(s,s,s); });
  if(doorGate.userData.target!==undefined) doorGate.position.y+=(doorGate.userData.target-doorGate.position.y)*Math.min(1,dt*3);
  if(S.phase==='countdown'){
    S.countdown-=dt; const c=$('count'); c.classList.remove('hidden'); const n=Math.max(1,Math.ceil(S.countdown)); setText('countNum',String(n));
    if(n!==countLast){ countLast=n; SFX.count(); }
    if(S.mode==='ai') physStep(AI,0,0,dt,false);
    if(S.countdown<=0){ S.phase='play'; countLast=0; c.classList.add('hidden'); SFX.go(); flash(S.game==='duel'?'싸워요! 상대를 찾아 쓰러뜨리세요':S.role==='runner'?'도망쳐요! 구슬을 모으세요':'도망자를 찾아요!','',1.4); }
  }
  if(S.phase==='play'){
    S.startT+=dt; updatePlayer(dt); checkPortals(); gunUpdate(dt);
    S.radarCD=Math.max(0,S.radarCD-dt); S.radarT=Math.max(0,S.radarT-dt);
    if(S.mode==='ai') aiUpdate(dt);
    if(S.collect&&S.phase==='play'){ const o=S.collect.o, me=S.me;
      if(o.taken||Math.hypot(o.x-me.x,o.z-me.z)>COLLECT_R+0.6||Math.abs(o.y-me.y)>2.2){ S.collect=null; SFX.bad(); flash('구슬에서 멀어져 수집이 취소됐어요','danger',1); }
      else { const before=S.collect.t; S.collect.t+=dt; if(Math.floor(before*2)!==Math.floor(S.collect.t*2)) SFX.tick(); if(S.collect.t>=CFG.collect){ S.collect=null; takeOrb(o); } } }
    if(S.role==='runner'&&S.doorOpen&&inDoor(S.me.x,S.me.z)) endGame('runner','escape');
  }
  if(S.phase==='roundover'){ S.startT+=dt; duelTick(dt); if(S.mode==='ai') physStep(AI,0,0,dt,false); }
  if(S.mode==='pvp'&&(S.phase==='play'||S.phase==='countdown'||S.phase==='roundover')) pvpTick(dt);
  combatVisuals(dt);
  const inGame=S.phase==='countdown'||S.phase==='play'||S.phase==='over'||S.phase==='roundover';
  if(inGame){
    const me=S.me, o=S.opp;
    me.eye+=((me.ph-0.13)-me.eye)*Math.min(1,dt*14);
    bob+=dt*(me.moving&&me.gr&&me.slideT<=0&&S.phase==='play'?(me.quiet?6:10):0);
    camera.position.set(me.x,me.y+me.eye+(me.moving&&me.gr?Math.sin(bob)*(me.quiet?0.025:0.05):0),me.z); camera.rotation.set(me.pitch,me.yaw,0); applyShake(dt);
    const kick=me.slideT>0?10*(me.slideT/SLIDE_T):0, tgtFov=(S.game==='tag'&&S.role==='seeker'?seekerFov():baseFov)+kick;
    if(Math.abs(camera.fov-tgtFov)>0.05){ camera.fov+=(tgtFov-camera.fov)*Math.min(1,dt*10); camera.updateProjectionMatrix(); }
    const om=oppModel();
    om.visible=o.present&&!(S.game==='duel'&&o.hp<=0); om.position.set(o.x,o.y,o.z); om.rotation.y=o.yaw; animHuman(om,o.moving,dt,o.slide,o.air);
    seekMarker.rotation.y+=dt*2;
    o.exposed=S.role==='seeker'&&o.present&&((CFG.zone&&inZone(o.x,o.z))||S.radarT>0);
    if(o.exposed) S.lastSeen={x:o.x,y:o.y,z:o.z,t:perfT};
    beam.visible=o.exposed; if(beam.visible) beam.position.set(o.x,o.y+30,o.z);
    if(S.phase!=='over'){ updateHud(dt); drawMinimap(); }
    if(S.game==='duel'&&o.hp<=0&&S.phase==='roundover'){ om.visible=true; om.rotation.x=0; om.position.y=o.y-0.6; }
  } else {
    const a=perfT*0.05, cx=W*CELL/2, cz=H*CELL/2;
    camera.position.set(cx+Math.cos(a)*92,74,cz+Math.sin(a)*92); camera.lookAt(cx,0,cz);
    if(camera.fov!==baseFov){ camera.fov=baseFov; camera.updateProjectionMatrix(); }
    runnerModel.visible=seekerModel.visible=false; beam.visible=false;
  }
  if(flashT>0){ flashT-=dt; $('banner').classList.remove('hidden'); if(flashT<=0) $('banner').classList.add('hidden'); }
  updateSun(camera.position.x,camera.position.z); updateDust(dt);
  renderFrame(dt);
}

/* ===================== MENUS ===================== */
function bindSeg(id,key,onSet){ const box=$(id); const upd=()=>box.querySelectorAll('.seg').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.v===prefs[key])));
  box.querySelectorAll('.seg').forEach(b=>b.onclick=()=>{ prefs[key]=b.dataset.v; LS.set(key,prefs[key]); upd(); SFX.ui(); onSet&&onSet(); }); upd(); }
bindSeg('ctrlSeg','ctrl',()=>document.body.classList.toggle('kb',prefs.ctrl==='kb')); document.body.classList.toggle('kb',prefs.ctrl==='kb');
bindSeg('modeSeg','mode',updBest); bindSeg('diffSeg','diff',updBest);
$('aiGun').checked=!!prefs.aiGun; $('aiGun').onchange=()=>{ prefs.aiGun=$('aiGun').checked; LS.set('aiGun',prefs.aiGun); updBest(); }; bindSeg('themeSeg','theme',()=>applyTheme(prefs.theme));
function buildMapSeg(){ const box=$('mapSeg'); box.textContent=''; box.style.setProperty('--n',Math.min(3,MAP_LIST.length));
  for(const e of MAP_LIST){ const b=document.createElement('button'); b.className='seg'; b.dataset.v=e.id; b.setAttribute('role','radio'); b.textContent=e.name; box.append(b); }
  bindSeg('mapSeg','map',async()=>{ $('goAi').disabled=true; const ok=await ensureMap(prefs.map); $('goAi').disabled=false;
    if(!ok&&MAP){ prefs.map=MAP.id; LS.set('map',prefs.map); buildMapSeg(); } updBest(); updMapDesc(); }); updMapDesc(); }
function updMapDesc(){ const d=MAP_DEFS[prefs.map]; $('mapDesc').textContent=d&&d.desc?d.desc:''; }
(function(){ const box=$('gfxSeg'); const upd=()=>box.querySelectorAll('.seg').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.v===prefs.gfx)));
  box.querySelectorAll('.seg').forEach(b=>b.onclick=()=>{ if(b.dataset.v===prefs.gfx) return; prefs.gfx=b.dataset.v; LS.set('gfx',prefs.gfx); upd(); $('gfxNote').textContent='적용하려고 새로 고치는 중이에요…'; setTimeout(()=>location.reload(),250); }); upd(); })();
$('sens').value=prefs.sens; $('sens').oninput=()=>{ prefs.sens=+$('sens').value; LS.set('sens',prefs.sens); };
$('sndChk').checked=!!prefs.sound; $('sndChk').onchange=()=>{ prefs.sound=$('sndChk').checked; LS.set('sound',prefs.sound); updSnd(); };
function updSnd(){ $('sndBtn').textContent=prefs.sound?'🔊':'🔇'; $('sndChk').checked=!!prefs.sound; }
$('sndBtn').addEventListener('pointerdown',e=>e.stopPropagation()); $('sndBtn').onclick=()=>{ prefs.sound=!prefs.sound; LS.set('sound',prefs.sound); updSnd(); }; updSnd();
function updBest(){ const b=LS.get('best-'+prefs.map+'-'+prefs.diff,null), D=DIFF[prefs.diff]||DIFF.normal, mn=mapName(prefs.map);
  if(prefs.mode==='duel'){ $('bestNote').textContent=`${mn}, AI ${D.label}: 1:1 총싸움, 3번 먼저 쓰러뜨리면 승리.`; $('aiSub').textContent=`AI와 총으로 1:1 대결해요 (난이도 ${D.label})`; return; }
  $('bestNote').textContent=b===null?`${mn}, AI ${D.label}: 아직 탈출 기록이 없어요.`:`${mn}, AI ${D.label}: 최고 탈출 기록 ${b}초.`;
  $('aiSub').textContent=`혼자서 AI 술래를 피해 탈출해요 (난이도 ${D.label}${prefs.aiGun?', 술래 총 켜짐':''})`; }
$('goAi').onclick=async()=>{ netReset(); $('goAi').disabled=true; const ok=await ensureMap(prefs.map); $('goAi').disabled=false; if(!ok) return;
  S.mode='ai'; S.game=prefs.mode==='duel'?'duel':'tag'; S.role=S.game==='duel'?'duel':'runner';
  CFG=sanitizeCfg(Object.assign({},DEF_CFG,{theme:prefs.theme,map:prefs.map,mode:S.game,gun:!!prefs.aiGun})); S.opp.present=true; S.opp.name=''; startRound((Math.random()*1e9)|0); };
$('goOnline').onclick=()=>{ $('nick').value=prefs.name; showOverlay('online'); };
$('onBack').onclick=()=>{ netReset(); showOverlay('menu'); };
$('createBtn').onclick=createRoom; $('joinBtn').onclick=joinRoom;
if(isInApp) $('inApp').classList.remove('hidden');
$('openExt').onclick=()=>{ const u=location.href; if(/KAKAOTALK/i.test(navigator.userAgent)) location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(u); else copyText(u).then(ok=>note('onNote',ok?'주소를 복사했어요. 크롬이나 사파리 주소창에 붙여 넣어 주세요.':'주소창의 주소를 복사해서 크롬이나 사파리로 열어 주세요.','ok')); };
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&NET.isHost){ scheduleHostRecover(NSID,0); if(S.phase==='lobby'){ renderLobby(); keepAwake(true); } } });
$('joinCode').addEventListener('input',()=>{ const v=$('joinCode').value.toUpperCase().replace(/[^A-Z0-9]/g,''); if(v!==$('joinCode').value) $('joinCode').value=v; });
$('joinCode').addEventListener('keydown',e=>{ if(e.key==='Enter') joinRoom(); });
$('pickRunner').onclick=()=>pickRole('runner'); $('pickSeeker').onclick=()=>pickRole('seeker');
$('mainBtn').onclick=()=>{ if(!L) return; SFX.ui(); if(NET.isHost) hostStart(); else if(L.guest){ netSend({t:'ready',v:!L.guest.ready}); } };
$('shuffleBtn').onclick=()=>{ if(!NET.isHost||!L||!L.guest) return; const r=Math.random()<.5?'runner':'seeker'; L.host.role=r; L.guest.role=other(r); L.guest.ready=false; SFX.ui(); broadcast(); };
$('kickBtn').onclick=()=>{ if(!NET.isHost||!L||!L.guest) return; const c=NET.conn; netSend({t:'kick'}); NET.conn=null; L.guest=null; setTimeout(()=>{ try{ c&&c.close(); }catch(_){} },400); broadcast(); };
$('leaveBtn').onclick=()=>{ netReset(); S.mode=null; S.phase='menu'; showOverlay('online'); note('onNote',''); applyTheme(prefs.theme); };
$('copyCode').onclick=async()=>{ if(L) lbNote((await copyText(L.code))?'방 코드를 복사했어요.':'복사하지 못했어요. 코드를 직접 알려 주세요.','ok'); };
$('copyLink').onclick=async()=>{ if(!L) return; const url=location.href.split('#')[0]+'#'+L.code; lbNote((await copyText(url))?'초대 링크를 복사했어요. 친구가 열면 코드가 자동으로 입력돼요.':'복사하지 못했어요.','ok'); };
function toMenu(){ if(S.mode==='pvp') netReset(); S.mode=null; S.phase='menu'; S.collect=null; showHud(false); showOverlay('menu'); applyTheme(prefs.theme); ensureMap(prefs.map); }
$('quit').addEventListener('pointerdown',e=>e.stopPropagation());
$('quit').onclick=()=>{ if(S.mode==='pvp'&&(S.phase==='play'||S.phase==='countdown'||S.phase==='roundover')){ endGame(S.game==='duel'?'opp':other(S.role),'forfeit'); return; } toMenu(); };
$('toMenu').onclick=toMenu;
$('again').onclick=()=>{
  if(S.mode==='ai'){ S.role=S.game==='duel'?'duel':'runner'; startRound((Math.random()*1e9)|0); return; }
  if(S.mode==='pvp'&&L&&(NET.isHost||NET.conn)){ goLobby(); return; }
  netReset(); S.mode=null; S.phase='menu'; showOverlay('online'); applyTheme(prefs.theme);
};
function checkHash(){ const m=/^#([A-Za-z0-9]{6})$/.exec(location.hash||''); if(m&&S.phase==='menu'&&!NET.peer){ $('nick').value=prefs.name; $('joinCode').value=m[1].toUpperCase(); showOverlay('online'); note('onNote','초대받은 방 코드가 입력됐어요. 닉네임을 확인하고 참가를 눌러요.','ok'); } }
addEventListener('hashchange',checkHash);

/* ===================== VERSION BADGE & UPDATE CHECK ===================== */
function verCmp(a,b){ const pa=String(a).split('.').map(Number), pb=String(b).split('.').map(Number); for(let i=0;i<3;i++){ const d=(pa[i]||0)-(pb[i]||0); if(d) return d; } return 0; }
let newVer=null;
function renderVer(){ const v=$('ver'); v.classList.toggle('new',!!newVer); v.textContent=newVer?`새 버전 v${newVer} 있음 · 눌러서 새로고침`:`v${GAME_VERSION}`; }
(function(){ const list=$('verList'); for(const [v,t] of GAME_CHANGES){ const li=document.createElement('li'); const b=document.createElement('b'); b.textContent='v'+v; li.append(b,' '+t); list.append(li); } })();
$('ver').addEventListener('pointerdown',e=>e.stopPropagation());
$('ver').onclick=()=>{ if(newVer){ location.reload(); return; } $('verPanel').classList.toggle('hidden'); };
$('verClose').onclick=()=>$('verPanel').classList.add('hidden');
$('verCheck').onclick=()=>checkUpdate(true);
async function checkUpdate(manual){
  if(location.protocol==='file:'){ if(manual) $('verNote').textContent='파일을 직접 연 상태에서는 업데이트를 확인할 수 없어요. 웹 주소로 열어 주세요.'; return; }
  if(manual) $('verNote').textContent='확인하는 중이에요…';
  try{ const r=await fetch('js/version.js?t='+Date.now(),{cache:'no-store'}); const txt=await r.text(); const m=/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/.exec(txt);
    if(!m) throw new Error('no version');
    if(verCmp(m[1],GAME_VERSION)>0){ newVer=m[1]; renderVer(); if(manual) $('verNote').textContent=`새 버전 v${m[1]}이 올라와 있어요. 새로고침하면 적용돼요.`; }
    else if(manual) $('verNote').textContent=`최신 버전이에요 (v${GAME_VERSION}).`;
  }catch(_){ if(manual) $('verNote').textContent='업데이트를 확인하지 못했어요. 인터넷 연결을 확인해 주세요.'; }
}
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkUpdate(false); });
setInterval(()=>checkUpdate(false),5*60*1000);

/* ===================== BOOT ===================== */
function updMapWarn(){ const n=$('mapWarn'); if(MAP_WARNINGS.length){ n.textContent=`맵 검사: "${MAP.name}"에 확인할 점이 ${MAP_WARNINGS.length}개 있어요. 개발자 도구 콘솔을 보세요.`; n.classList.remove('hidden'); } else n.classList.add('hidden'); }
function showMapError(msg){ const n=$('mapWarn'); n.textContent='맵 오류: '+msg; n.classList.remove('hidden'); if(S.phase==='lobby') lbNote('맵 오류: '+msg,'err'); }
renderVer();
(async function boot(){
  $('goAi').disabled=true; $('goOnline').disabled=true;
  try{ await loadMapList(); }catch(err){ showMapError(err.message+' (maps 폴더가 index.html 옆에 있는지 확인하세요)'); return; }
  if(!MAP_LIST.some(m=>m.id===prefs.map)) prefs.map=MAP_LIST[0].id;
  buildMapSeg();
  if(!(await ensureMap(prefs.map))){ if(prefs.map!==MAP_LIST[0].id){ prefs.map=MAP_LIST[0].id; LS.set('map',prefs.map); buildMapSeg(); if(!(await ensureMap(prefs.map))) return; } else return; }
  applyTheme(prefs.theme); updBest(); updMapDesc(); $('goAi').disabled=false; $('goOnline').disabled=false; checkHash();
  requestAnimationFrame(frame); setTimeout(()=>checkUpdate(false),3000);
})();
