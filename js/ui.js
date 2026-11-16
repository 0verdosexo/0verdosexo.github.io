/* ui.js — screens (main, tag hub, battle hub, loadout, settings, room browser, lobby), menu backdrop, pause/result/chat. */
'use strict';
const UI=(()=>{
  let cur='main', stack=[], lastSetup=null, lobbySel=null, loI=0, loSlot='main', bgOn=false, bgT=0, bgRaf=0, bgMap=null;
  const scr=n=>$('scr-'+n);
  function show(n,push){ if(push!==false&&cur&&cur!==n&&n!=='game') stack.push(cur); document.querySelectorAll('.scr').forEach(e=>e.classList.toggle('on',e.id==='scr-'+n)); cur=n;
    document.body.classList.toggle('ingame',n==='game'); if(n!=='game') { closeOverlays(); if(!Game.active) menuBG(true); } else { menuBG(false); if(Game.active&&Game.paused&&Game.state!=='end') $('pause').classList.add('on'); }
    if(n==='main') refreshMain(); if(n==='loadout') renderLoadout(); if(n==='battle') renderBattle(); if(n==='tag') renderTag(); if(n==='settings') renderSettings(); }
  function back(){ const p=stack.pop()||'main'; if(p==='lobby'&&!Net.room) return show('main',false); show(p,false); }
  function showLoading(on,msg){ $('loading').classList.toggle('on',!!on); if(msg) $('loadMsg').textContent=msg; }
  function toast(m,ms){ const d=document.createElement('div'); d.textContent=m; $('toastG').appendChild(d); setTimeout(()=>d.remove(),ms||2600); }
  const overlayOpen=()=>$('pause').classList.contains('on')||$('result').classList.contains('on')||chatOn;
  function closeOverlays(){ $('pause').classList.remove('on'); $('result').classList.remove('on'); }
  /* segmented buttons */
  function seg(id,val,on){ const el=$(id); el.querySelectorAll('button').forEach(b=>{ b.classList.toggle('on',b.dataset.v===String(val)); b.onclick=()=>{ el.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); on(b.dataset.v); Sfx.play('click'); }; }); }
  function mapCards(id,val,on,small){ const el=$(id); el.innerHTML=''; const sw={desert:'#e0a060',plaza:'#9cc8ff',cyber:'#ff2d7a',factory:'#b08a5a'};
    for(const mid of SandTag.mapOrder){ const m=SandTag.maps[mid]; const b=document.createElement('button'); b.className='map-card'+(mid===val?' on':''); b.innerHTML=`<i class="sw" style="background:${sw[m.theme]||'#888'}"></i><b>${esc(m.name)}</b><span>${esc(m.desc||'')}</span>`;
      b.onclick=()=>{ el.querySelectorAll('.map-card').forEach(x=>x.classList.toggle('on',x===b)); on(mid); Sfx.play('click'); menuMap(mid); }; el.appendChild(b); } }
  /* ---------- main ---------- */
  function refreshMain(){ $('mName').value=prefs.name||''; const xp=prefs.xp||0, lvl=1+Math.floor(Math.sqrt(xp/100)); const a=100*(lvl-1)*(lvl-1), b=100*lvl*lvl; $('mLevel').textContent='레벨 '+lvl; $('mXp').style.width=Math.round((xp-a)/(b-a)*100)+'%'; }
  function bindMain(){
    $('mName').addEventListener('change',()=>{ prefs.name=cleanName($('mName').value); $('mName').value=prefs.name; savePrefs(); });
    $('goTag').onclick=()=>{ Sfx.unlock(); show('tag'); }; $('goBattle').onclick=()=>{ Sfx.unlock(); show('battle'); };
    $('goLoadout').onclick=()=>show('loadout'); $('goSettings').onclick=()=>show('settings'); $('goBrowse').onclick=()=>openBrowse();
    $('joinBtn').onclick=()=>joinRoom($('joinCode').value); $('joinCode').addEventListener('keydown',e=>{ if(e.key==='Enter') joinRoom($('joinCode').value); });
    document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{ Sfx.play('click'); back(); });
  }
  /* ---------- tag hub ---------- */
  function renderTag(){ const t=prefs.tag;
    mapCards('tMap',t.map,v=>{ t.map=v; savePrefs(); }); const n=$('tPlayers'); n.value=t.players; const lab=()=>{ $('tPlayersL').textContent=n.value+'명'; $('tSeekL').textContent='술래 '+seekerCount(+n.value)+'명'; }; lab();
    n.oninput=()=>{ t.players=+n.value; lab(); savePrefs(); };
    seg('tRole',t.role||'any',v=>{ t.role=v; savePrefs(); }); seg('tDiff',t.diff||'normal',v=>{ t.diff=v; savePrefs(); }); seg('tGun',t.seekerGun?1:0,v=>{ t.seekerGun=v==='1'; savePrefs(); }); seg('tTime',t.time||10,v=>{ t.time=+v; savePrefs(); });
    menuMap(t.map); }
  function bindTag(){ $('tStart').onclick=()=>startOffline('tag'); $('tCreate').onclick=()=>createRoom('tag'); $('tBrowse').onclick=()=>openBrowse(); }
  /* ---------- battle hub ---------- */
  function renderBattle(){ const b=prefs.battle; const g=$('bModes'); g.innerHTML='';
    for(const id of BMODE_IDS){ const m=BMODES[id]; const el=document.createElement('button'); el.className='mode-card'+(id===b.mode?' on':''); el.innerHTML=`<i>${m.team?'팀전':'개인전'}</i><b>${m.name}</b><span>${m.desc}</span>`;
      el.onclick=()=>{ g.querySelectorAll('.mode-card').forEach(x=>x.classList.toggle('on',x===el)); b.mode=id; savePrefs(); botsLabel(); Sfx.play('click'); }; g.appendChild(el); }
    mapCards('bMap',b.map,v=>{ b.map=v; savePrefs(); },true); const r=$('bBots'); r.value=b.bots; const botsLabel=()=>{ $('bBotsL').textContent=b.mode==='duel'?'1 (1:1 고정)':r.value+'명'; }; botsLabel(); r.oninput=()=>{ b.bots=+r.value; botsLabel(); savePrefs(); };
    seg('bDiff',b.diff||'normal',v=>{ b.diff=v; savePrefs(); });
    const L=$('bLoad'); L.innerHTML=prefs.loadouts.map((l,i)=>`<button data-v="${i}">${esc(l.name)}</button>`).join(''); seg('bLoad',prefs.cur||0,v=>{ prefs.cur=+v; savePrefs(); }); menuMap(b.map); }
  function bindBattle(){ $('bStart').onclick=()=>startOffline('battle'); $('bCreate').onclick=()=>createRoom('battle'); $('bBrowse').onclick=()=>openBrowse(); $('bEditLoad').onclick=()=>show('loadout'); }
  /* ---------- loadout editor ---------- */
  const SLOTS=[['main','주무기'],['side','보조무기'],['melee','근접'],['thr','투척'],['spec','특수'],['p0','퍼크 1'],['p1','퍼크 2']];
  function slotName(L,k){ if(k==='thr') return TH[L.thr]?TH[L.thr].name:'-'; if(k==='spec') return SP[L.spec]?SP[L.spec].name:'-'; if(k==='p0'||k==='p1'){ const p=L.perks[+k[1]]; return PERKS[p]?PERKS[p].name:'-'; } return WPN[L[k]]?WPN[L[k]].name:'-'; }
  function renderLoadout(){ const L=prefs.loadouts[loI];
    $('loTabs').innerHTML=prefs.loadouts.map((l,i)=>`<button class="${i===loI?'on':''}" data-i="${i}">${esc(l.name)}</button>`).join(''); $('loTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{ loI=+b.dataset.i; renderLoadout(); });
    $('loName').value=L.name; $('loName').onchange=()=>{ L.name=cleanName($('loName').value).slice(0,10); savePrefs(); renderLoadout(); };
    $('loSlots').innerHTML=SLOTS.map(([k,n])=>`<button class="lo-slot${k===loSlot?' on':''}" data-k="${k}"><span><small>${n}</small><b>${esc(slotName(L,k))}</b></span><span>›</span></button>`).join('');
    $('loSlots').querySelectorAll('.lo-slot').forEach(b=>b.onclick=()=>{ loSlot=b.dataset.k; renderLoadout(); });
    const pick=$('loPick'); pick.innerHTML=''; $('loPickT').textContent=SLOTS.find(s=>s[0]===loSlot)[1]+' 고르기';
    const addCat=t=>{ const d=document.createElement('div'); d.className='pick-cat'; d.textContent=t; pick.appendChild(d); };
    const addPick=(id,name,sub,sel,on,info)=>{ const b=document.createElement('button'); b.className='pick'+(sel?' on':''); b.innerHTML=`<b>${esc(name)}</b><span>${esc(sub||'')}</span>`; b.onclick=()=>{ on(); savePrefs(); renderLoadout(); Sfx.play('click'); }; b.onmouseenter=()=>stats(info); pick.appendChild(b); };
    if(loSlot==='main'||loSlot==='side'||loSlot==='melee'){
      let ids=loSlot==='main'?MAINS:loSlot==='side'?SIDES.concat(perkN(L,'overkill')?MAINS:[]):MELEES; if(loSlot==='main') ids=ids.concat(['shield']).filter((v,i,a)=>a.indexOf(v)===i);
      let lastCat=null; for(const id of ids){ const w=WPN[id]; if(!w) continue; if(w.cat!==lastCat){ addCat(CATS[w.cat]||w.cat); lastCat=w.cat; } addPick(id,w.name,w.mode==='melee'?'근접':`${w.dmg}${w.pellets>1?'×'+w.pellets:''} 피해 · ${w.mag}발`,L[loSlot]===id,()=>{ L[loSlot]=id; },{w}); } }
    else if(loSlot==='thr'){ for(const id in TH) addPick(id,TH[id].name,`${TH[id].count}개`,L.thr===id,()=>{ L.thr=id; },{t:TH[id]}); }
    else if(loSlot==='spec'){ for(const id in SP) addPick(id,SP[id].name,SP[id].cd?`재사용 ${SP[id].cd}초`:'항상 사용',L.spec===id,()=>{ L.spec=id; },{t:SP[id]}); }
    else { const i=+loSlot[1]; for(const id of PERK_IDS) addPick(id,PERKS[id].name,PERKS[id].desc,L.perks[i]===id,()=>{ L.perks[i]=id; if(L.perks.filter(p=>p==='overkill').length===0&&WPN[L.side]&&WPN[L.side].slot==='main') L.side='p1912'; },{t:PERKS[id]}); }
    const curInfo=loSlot==='main'||loSlot==='side'||loSlot==='melee'?{w:WPN[L[loSlot]]}:loSlot==='thr'?{t:TH[L.thr]}:loSlot==='spec'?{t:SP[L.spec]}:{t:PERKS[L.perks[+loSlot[1]]]}; stats(curInfo); }
  function stats(info){ const el=$('loStats'); if(!info) return; if(info.w){ const w=info.w; const bar=(n,v,txt)=>`<div class="stat"><span>${n}<b>${txt}</b></span><i><b style="width:${Math.round(clamp(v,0,1)*100)}%"></b></i></div>`;
      el.innerHTML=`<h2>${esc(w.name)}</h2><p>${esc(CATS[w.cat]||'')} · ${esc(w.desc||'')}</p>`+(w.mode==='melee'?bar('피해',w.dmg/100,w.dmg)+bar('공격 속도',0.4/w.rate,(1/w.rate).toFixed(1)+'/초')+bar('사거리',w.reach/3,w.reach+'m'):
        bar('피해',w.dmg*w.pellets/110,w.dmg+(w.pellets>1?' × '+w.pellets:''))+bar('연사력',w.rpm/1250,w.rpm+' RPM')+bar('사거리',w.far/150,w.range+'~'+w.far+'m')+bar('정확도',1-w.spread/9,'')+bar('반동 제어',1-w.recoil/5,'')+bar('탄창',w.mag/100,w.mag+' / '+w.res)+bar('장전',1-w.reload/5,w.reload+'초'))+bar('이동 속도',(w.speed||1)-0.5,Math.round((w.speed||1)*100)+'%'); }
    else if(info.t) el.innerHTML=`<h2>${esc(info.t.name)}</h2><p>${esc(info.t.desc||'')}</p>`; }
  /* ---------- settings ---------- */
  function renderSettings(){
    seg('sGfx',prefs.gfx,v=>{ prefs.gfx=v; savePrefs(); R.applyQuality(QUALITY_PRESETS[v]); toast('그래픽 품질: '+QUALITY_PRESETS[v].name+(Game.active?'':' (다음 맵부터 완전히 적용)')); });
    const rng=(id,k,fmt)=>{ const e=$(id); e.value=prefs[k]; const lab=()=>$(id+'L').textContent=fmt(+e.value); lab(); e.oninput=()=>{ prefs[k]=+e.value; lab(); savePrefs(); if(k==='vol') Sfx.setVolume(); }; };
    rng('sSens','sens',v=>v.toFixed(2)); rng('sFov','fov',v=>v+'°'); rng('sVol','vol',v=>Math.round(v*100)+'%');
    seg('sSound',prefs.sound===false?0:1,v=>{ prefs.sound=v==='1'; savePrefs(); Sfx.setVolume(); }); seg('sCtrl',prefs.ctrl||'auto',v=>{ prefs.ctrl=v; savePrefs(); applyCtrl(); });
    seg('sInv',prefs.invertY?1:0,v=>{ prefs.invertY=v==='1'; savePrefs(); }); seg('sFps',prefs.showFps?1:0,v=>{ prefs.showFps=v==='1'; savePrefs(); }); seg('sCross',prefs.crossColor||'#ffffff',v=>{ prefs.crossColor=v; savePrefs(); document.body.style.setProperty('--cross',v); }); }
  function applyCtrl(){ const t=prefs.ctrl==='touch'||(prefs.ctrl!=='kb'&&isTouch); document.body.classList.toggle('touch',t); }
  /* ---------- offline start ---------- */
  function randomLoadout(R){ const r=R||Math.random; const pickR=a=>a[(r()*a.length)|0]; return {name:'봇',main:pickR(MAINS),side:pickR(SIDES),melee:pickR(MELEES),thr:pickR(Object.keys(TH)),spec:pickR(Object.keys(SP).filter(k=>k!=='repair')),perks:[pickR(PERK_IDS),pickR(PERK_IDS)].map(p=>p==='overkill'?'kevlar':p)}; }
  function startOffline(kind){
    Sfx.unlock(); const myId='me'; const players=[]; const me={id:'me',name:prefs.name||'나',owner:myId,load:prefs.loadouts[prefs.cur||0]};
    let setup;
    if(kind==='tag'){ const t=prefs.tag, n=clamp(t.players,2,16), ns=seekerCount(n);
      players.push(me); for(let i=1;i<n;i++) players.push({id:'b'+i,name:Bots.botName(i-1),bot:true,owner:myId,diff:t.diff});
      assignRoles(players,ns,{me:t.role||'any'});
      setup={kind:'tag',map:t.map,players,cfg:{diff:t.diff,seekerGun:!!t.seekerGun,time:t.time||10}}; }
    else { const b=prefs.battle, def=BMODES[b.mode]; const nb=b.mode==='duel'?1:b.bots; players.push(Object.assign(me,{team:0}));
      for(let i=0;i<nb;i++) players.push({id:'b'+i,name:Bots.botName(i),bot:true,owner:myId,diff:b.diff,team:def.team?((i+1)%2):0,load:randomLoadout()});
      setup={kind:'battle',mode:b.mode,map:b.map,players,cfg:{diff:b.diff,ff:false}}; }
    Object.assign(setup,{host:true,online:false,myId,meId:'me',seed:(Math.random()*1e9)|0}); lastSetup=setup; Game.start(setup); }
  function assignRoles(players,ns,prefMap){ const want=p=>p.pref||prefMap&&p.id==='me'&&prefMap.me||'any';
    const seekers=players.filter(p=>want(p)==='seek'); const rest=players.filter(p=>want(p)==='any'&&!p.bot), bots=players.filter(p=>p.bot);
    const sh=a=>a.sort(()=>Math.random()-0.5); let pickS=sh(seekers).slice(0,ns); if(pickS.length<ns) pickS=pickS.concat(sh(rest).slice(0,ns-pickS.length)); if(pickS.length<ns) pickS=pickS.concat(sh(bots).slice(0,ns-pickS.length));
    if(pickS.length<ns) pickS=pickS.concat(sh(players.filter(p=>!pickS.includes(p))).slice(0,ns-pickS.length));
    for(const p of players) p.role=pickS.includes(p)?'seek':'run'; }
  /* ---------- online ---------- */
  async function createRoom(kind){ Sfx.unlock(); showLoading(true,'방 만드는 중…');
    const s=kind==='tag'?{map:prefs.tag.map,cap:Math.max(4,prefs.tag.players),fill:true,diff:prefs.tag.diff,seekerGun:!!prefs.tag.seekerGun,time:prefs.tag.time||10}:{mode:prefs.battle.mode,map:prefs.battle.map,cap:prefs.battle.mode==='duel'?2:8,fill:true,diff:prefs.battle.diff,ff:false};
    try{ await Net.create(kind,s); showLoading(false); show('lobby'); renderLobby(); }catch(e){ showLoading(false); toast('방을 만들 수 없어요: '+(e.message||e)); } }
  async function joinRoom(code){ Sfx.unlock(); code=String(code||'').toUpperCase().trim(); if(code.length!==5){ toast('코드는 5글자예요'); return; } showLoading(true,'방에 들어가는 중…');
    try{ await Net.join(code); showLoading(false); Net.stopBrowse(); show('lobby'); renderLobby(); }catch(e){ showLoading(false); toast(e.message||'들어갈 수 없어요'); } }
  function openBrowse(){ show('browse'); const list=$('brList'); list.innerHTML='<p class="muted">열린 방을 찾는 중…</p>';
    Net.browse(rooms=>{ const open=rooms.filter(r=>!r.started&&r.n<r.max); if(!open.length){ list.innerHTML='<p class="muted">열린 방이 없어요. 방을 만들어 친구를 불러 보세요.</p>'; return; }
      list.innerHTML=''; for(const r of open){ const d=document.createElement('div'); d.className='br-item'; const m=SandTag.maps[r.map];
        d.innerHTML=`<div><b>${esc(r.name)}의 방</b><br><span>${r.game==='tag'?'술래잡기':'배틀 · '+(BMODES[r.mode]?BMODES[r.mode].name:'')} · ${m?esc(m.name):''}</span></div><span class="n">${r.n}/${r.max}</span><button class="btn acc">참가</button>`;
        d.querySelector('button').onclick=()=>joinRoom(r.code); list.appendChild(d); } }); }
  function bindBrowse(){ $('brJoin').onclick=()=>joinRoom($('brCode').value); $('brRefresh').onclick=()=>openBrowse(); }
  /* ---------- lobby ---------- */
  function renderLobby(){ const r=Net.room; if(!r) return; const host=Net.host, isTag=r.game==='tag', s=r.settings;
    $('lbTitle').textContent=isTag?'술래잡기 대기실':'배틀 대기실'; $('lbCode').textContent=r.code||Net.code;
    $('lbSub').textContent=(isTag?'술래잡기':BMODES[s.mode].name)+' · '+(SandTag.maps[s.map]?SandTag.maps[s.map].name:'')+(s.fill?' · 빈자리 봇':'');
    $('lbCount').textContent=`${r.players.length}/${s.cap}`;
    const pl=p=>`<div class="pl${p.id===Net.myId?' me':''}"><i class="dot" style="background:${isTag?'#ffb547':TEAM_COLORS[p.team||0]}"></i><b>${esc(p.name)}${p.id===r.host?' 👑':''}</b>${isTag?`<span class="tagc">${{any:'무작위',run:'도망자 희망',seek:'술래 희망'}[p.pref||'any']}</span>`:''}${p.ready||p.id===r.host?'<span class="rdy">준비</span>':''}${host&&p.id!==Net.myId?`<button class="kick" data-k="${p.id}" title="내보내기">✕</button>`:''}</div>`;
    const team=!isTag&&BMODES[s.mode].team;
    $('lbPlayers').innerHTML=team?`<div class="teams"><div><h4 style="color:${TEAM_COLORS[0]}">블루</h4>${r.players.filter(p=>!p.team).map(pl).join('')}</div><div><h4 style="color:${TEAM_COLORS[1]}">레드</h4>${r.players.filter(p=>p.team).map(pl).join('')}</div></div>`:r.players.map(pl).join('');
    $('lbPlayers').querySelectorAll('.kick').forEach(b=>b.onclick=()=>Net.kick(b.dataset.k));
    const mine=r.players.find(p=>p.id===Net.myId)||{};
    let mh=''; if(isTag) mh+=`<label class="lbl">내 역할 희망</label><div class="seg" id="lmRole"><button data-v="any">무작위</button><button data-v="run">도망자</button><button data-v="seek">술래</button></div>`;
    else { if(team) mh+=`<label class="lbl">팀</label><div class="seg" id="lmTeam"><button data-v="0">블루</button><button data-v="1">레드</button></div>`; mh+=`<label class="lbl">로드아웃</label><div class="seg" id="lmLoad">${prefs.loadouts.map((l,i)=>`<button data-v="${i}">${esc(l.name)}</button>`).join('')}</div>`; }
    $('lbMine').innerHTML=mh;
    if(isTag) seg('lmRole',mine.pref||'any',v=>Net.setMine({pref:v})); else { if(team) seg('lmTeam',mine.team||0,v=>Net.setMine({team:+v})); seg('lmLoad',prefs.cur||0,v=>{ prefs.cur=+v; savePrefs(); Net.setMine({load:prefs.loadouts[+v]}); }); }
    /* settings */
    const S=$('lbSettings'); $('lbHostNote').textContent=host?'방장만 바꿀 수 있어요':'방장이 정해요';
    let h=''; if(!isTag){ h+=`<label class="lbl">모드</label><div class="seg" id="lsMode">${BMODE_IDS.map(id=>`<button data-v="${id}">${BMODES[id].name}</button>`).join('')}</div>`; }
    h+=`<label class="lbl">맵</label><div class="seg" id="lsMap">${SandTag.mapOrder.map(id=>`<button data-v="${id}">${esc(SandTag.maps[id].name)}</button>`).join('')}</div>`;
    h+=`<label class="lbl">정원 <b>${s.cap}명</b>${isTag?` <small class="muted">· 술래 ${seekerCount(s.cap)}명</small>`:''}</label><input type="range" id="lsCap" min="2" max="${!isTag&&s.mode==='duel'?2:16}" value="${s.cap}" ${host?'':'disabled'}>`;
    h+=`<div class="cols"><div><label class="lbl">빈자리</label><div class="seg" id="lsFill"><button data-v="1">봇으로 채우기</button><button data-v="0">비워 두기</button></div></div><div><label class="lbl">봇 난이도</label><div class="seg" id="lsDiff"><button data-v="easy">쉬움</button><button data-v="normal">보통</button><button data-v="hard">어려움</button></div></div></div>`;
    if(isTag) h+=`<div class="cols"><div><label class="lbl">술래 총</label><div class="seg" id="lsGun"><button data-v="0">없음</button><button data-v="1">있음</button></div></div><div><label class="lbl">제한 시간</label><div class="seg" id="lsTime"><button data-v="6">6분</button><button data-v="10">10분</button><button data-v="15">15분</button></div></div></div>`;
    else h+=`<label class="lbl">아군 사격</label><div class="seg" id="lsFF"><button data-v="0">끄기</button><button data-v="1">켜기</button></div>`;
    S.innerHTML=h; S.querySelectorAll('button').forEach(b=>b.disabled=!host);
    const set=o=>Net.setSettings(o);
    if(!isTag) seg('lsMode',s.mode,v=>set({mode:v,cap:v==='duel'?2:Math.max(s.cap,2)})); seg('lsMap',s.map,v=>{ set({map:v}); menuMap(v); }); seg('lsFill',s.fill?1:0,v=>set({fill:v==='1'})); seg('lsDiff',s.diff,v=>set({diff:v}));
    if(isTag){ seg('lsGun',s.seekerGun?1:0,v=>set({seekerGun:v==='1'})); seg('lsTime',s.time,v=>set({time:+v})); } else seg('lsFF',s.ff?1:0,v=>set({ff:v==='1'}));
    const cap=$('lsCap'); if(cap) cap.onchange=()=>set({cap:Math.max(+cap.value,r.players.length)});
    $('lbStart').style.display=host?'':'none'; $('lbReady').style.display=host?'none':''; $('lbReady').textContent=mine.ready?'준비 취소':'준비';
    const allReady=r.players.every(p=>p.ready||p.id===r.host); $('lbStart').disabled=!(allReady&&(r.players.length>=2||s.fill)); $('lbStart').textContent=allReady?'게임 시작':'모두 준비하면 시작';
    menuMap(s.map); }
  function bindLobby(){
    $('lbLeave').onclick=()=>{ Net.leave(); show('main',false); stack=[]; };
    $('lbCopy').onclick=()=>{ copy(Net.code); toast('코드를 복사했어요'); };
    $('lbShare').onclick=()=>{ const url=location.origin+location.pathname+'?room='+Net.code; if(navigator.share) navigator.share({title:'모래 요새',text:'같이 하자! 방 코드 '+Net.code,url}).catch(()=>{}); else { copy(url); toast('참가 링크를 복사했어요'); } };
    $('lbReady').onclick=()=>{ const me=Net.room&&Net.room.players.find(p=>p.id===Net.myId); Net.setReady(!(me&&me.ready)); };
    $('lbStart').onclick=()=>hostStart();
    const send=()=>{ const v=$('lbChatIn').value.trim(); if(!v) return; $('lbChatIn').value=''; const d={n:prefs.name,m:v}; Net.send('chat',d); Bus.emit('chat',d); };
    $('lbChatSend').onclick=send; $('lbChatIn').addEventListener('keydown',e=>{ if(e.key==='Enter') send(); });
    Bus.on('lobby',()=>{ if(cur==='lobby') renderLobby(); });
    Bus.on('chat',d=>{ const line=d.sys?`<div class="sys">${d.m}</div>`:`<div><b>${esc(d.n)}</b> ${esc(d.m)}</div>`; const L=$('lbChatLog'); L.insertAdjacentHTML('beforeend',line); L.scrollTop=1e9; });
    Bus.on('kicked',why=>{ toast(why||'방에서 나왔어요'); if(Game.active) Game.stop(); show('main',false); stack=[]; });
    Bus.on('hostleft',()=>{ toast('방장이 나가서 방이 닫혔어요'); Net.leave(); if(Game.active) Game.stop(); show('main',false); stack=[]; });
    Bus.on('netstart',setup=>{ startOnline(setup); });
    Bus.on('netback',()=>{ if(Game.active) Game.stop(); show('lobby',false); renderLobby(); });
  }
  function copy(t){ try{ navigator.clipboard.writeText(t); }catch(_){ const i=document.createElement('input'); i.value=t; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove(); } }
  function hostStart(){ const r=Net.room; if(!r||!Net.host) return; const s=r.settings, isTag=r.game==='tag'; const players=r.players.map(p=>({id:p.id,name:p.name,owner:p.id,team:p.team||0,pref:p.pref,load:p.load}));
    const cap=isTag?s.cap:(s.mode==='duel'?2:s.cap); let bi=0;
    if(s.fill) while(players.length<cap){ players.push({id:'b'+(bi),name:Bots.botName(bi),bot:true,owner:Net.myId,diff:s.diff,team:0,load:randomLoadout()}); bi++; }
    let setup;
    if(isTag){ assignRoles(players,seekerCount(players.length)); setup={kind:'tag',map:s.map,players,cfg:{diff:s.diff,seekerGun:!!s.seekerGun,time:s.time||10}}; }
    else { if(BMODES[s.mode].team){ const humans=players.filter(p=>!p.bot), bots=players.filter(p=>p.bot); let n0=humans.filter(p=>p.team===0).length, n1=humans.length-n0; for(const b of bots){ b.team=n0<=n1?0:1; if(b.team) n1++; else n0++; } }
      setup={kind:'battle',mode:s.mode,map:s.map,players,cfg:{diff:s.diff,ff:!!s.ff}}; }
    setup.seed=(Math.random()*1e9)|0; Net.startMatch(setup); startOnline(setup); }
  function startOnline(setup){ lastSetup=null; Game.start(Object.assign({},setup,{host:Net.host,online:true,myId:Net.myId,meId:Net.myId})); }
  /* ---------- in-game overlays ---------- */
  let chatOn=false;
  function openChat(){ if(!Game.online&&!Game.active) return; chatOn=true; Game.setChatOpen(true); const i=$('hChatIn'); i.style.display='block'; i.value=''; Input.exitLock(); setTimeout(()=>i.focus(),0); }
  function closeChat(){ chatOn=false; Game.setChatOpen(false); const i=$('hChatIn'); i.style.display='none'; i.blur(); if(Game.active&&!isTouch&&!overlayOpen()) Input.requestLock(); }
  function bindGame(){
    $('hChatIn').addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ const v=$('hChatIn').value.trim(); if(v){ const d={n:prefs.name,m:v}; if(Game.online) Net.send('chat',d); Bus.emit('chat',d); } closeChat(); } if(e.key==='Escape') closeChat(); });
    $('pResume').onclick=()=>resume(); $('pQuit').onclick=()=>quit(); $('pSettings').onclick=()=>{ $('pause').classList.remove('on'); stack.push('game'); document.querySelectorAll('.scr').forEach(e=>e.classList.toggle('on',e.id==='scr-settings')); cur='settings'; renderSettings(); };
    $('tPause').addEventListener('touchstart',e=>{ e.preventDefault(); pause(); },{passive:false}); $('tPause').onclick=()=>pause();
    $('tBoard').addEventListener('touchstart',e=>{ e.preventDefault(); HUD.toggleBoard(); },{passive:false});
    $('rMain').onclick=()=>{ quit(); }; $('rAgain').onclick=()=>{ $('result').classList.remove('on'); if(Game.online){ if(Net.host) Net.backToLobby(); Game.stop(); show('lobby',false); renderLobby(); } else if(lastSetup){ lastSetup.seed=(Math.random()*1e9)|0; Game.start(lastSetup); } };
    addEventListener('keydown',e=>{ if(cur!=='game'||chatOn) return; if(e.code==='Escape'){ /* pointer lock exit triggers pause */ } });
    Bus.on('lock',locked=>{ if(!locked&&Game.active&&Game.state!=='end'&&!chatOn&&!isTouch&&cur==='game') pause(); $('hClick').style.display=(!locked&&!isTouch&&Game.active&&cur==='game'&&!overlayOpen())?'block':'none'; });
    Bus.on('end',r=>showResult(r));
  }
  function pause(){ if(!Game.active) return; $('pause').classList.add('on'); if(!Game.online) Game.paused=true; Input.exitLock(); }
  function resume(){ $('pause').classList.remove('on'); Game.paused=false; if(cur!=='game'){ show('game',false); } if(!isTouch) Input.requestLock(); }
  function quit(){ $('pause').classList.remove('on'); $('result').classList.remove('on'); Game.stop(); if(Game.online){ Net.leave(); } show('main',false); stack=[]; }
  function showResult(r){ setTimeout(()=>{ const me=Game.me; let title='', sub='', win=false;
      if(Game.kind==='tag'){ win=me&&r.winRole===me.role; title=r.winRole==='run'?'도망자 승리!':'술래 승리!'; sub=`탈출 ${r.esc}명 / 필요 ${r.need}명`+(r.why==='time'?' · 시간 종료':''); }
      else if(r.winTeam!=null){ win=me&&r.winTeam===me.team; title=r.winTeam<0?'무승부':TEAM_NAMES[r.winTeam]+' 팀 승리!'; sub=`${r.score[0]} : ${r.score[1]}`; }
      else { const w=Game.byId.get(r.winner); win=me&&r.winner===me.id; title=w?w.name+' 승리!':'경기 종료'; }
      $('rTitle').textContent=title; $('rTitle').className=win?'win':''; $('rSub').textContent=sub; $('rBoard').innerHTML=HUD.boardHTML(); $('rXp').textContent=me?`이번 경기 경험치 +${Math.round(me.kills*10+me.score*0.5+(win?100:30))}`:'';
      $('rAgain').textContent=Game.online?(Net.host?'대기실로':'대기실로'):'다시 하기'; $('result').classList.add('on'); },1600); }
  /* ---------- menu backdrop: slow orbit over a map ---------- */
  async function menuMap(id){ if(Game.active||!id||(MAP&&MAP.id===id&&World.root)) return; bgMap=id; const def=SandTag.maps[id];
    try{ setMapData(def,{noNav:true}); const th=THEMES[def.theme]; await R.setTheme(th); await World.build(def,th); FX.init(); }catch(e){ console.error(e); } }
  function menuBG(on){ bgOn=on; cancelAnimationFrame(bgRaf); if(!on) return; let last=performance.now();
    const loop=now=>{ if(!bgOn||Game.active) return; bgRaf=requestAnimationFrame(loop); if(now-last<30||document.hidden) return; const dt=Math.min(0.05,(now-last)/1000); last=now; bgT+=dt;
      if(!MAP) return; const cx=W*CELL/2, cz=H*CELL/2, r=Math.max(W,H)*CELL*0.42; const a=bgT*0.04;
      R.camera.position.set(cx+Math.cos(a)*r,34+Math.sin(bgT*0.1)*4,cz+Math.sin(a)*r); R.camera.lookAt(cx,0,cz); R.camera.fov=55; R.camera.updateProjectionMatrix();
      World.update(dt,bgT); FX.update(dt); R.render(); };
    bgRaf=requestAnimationFrame(loop); }
  function init(){ bindMain(); bindTag(); bindBattle(); bindBrowse(); bindLobby(); bindGame(); applyCtrl(); document.body.style.setProperty('--cross',prefs.crossColor||'#fff'); $('ver').textContent='v'+GAME_VERSION; }
  return {init,show,back,showLoading,toast,overlayOpen,openChat,closeChat,menuMap,renderLobby,startOffline,randomLoadout,get cur(){return cur;}};
})();
