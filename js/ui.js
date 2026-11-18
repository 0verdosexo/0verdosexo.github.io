/* ui.js — screens (main, tag hub, battle hub, loadout, settings, room browser, lobby), menu backdrop, pause/result/chat. */
'use strict';
const UI=(()=>{
  let cur='main', stack=[], lastSetup=null, lobbySel=null, loSlot='main';
  const scr=n=>$('scr-'+n);
  function show(n,push){ if(push!==false&&cur&&cur!==n&&n!=='game') stack.push(cur); if(n!=='loadout'&&typeof GunShow!=='undefined'&&GunShow.on) GunShow.close();
    if(n==='lobby'&&cur==='loadout'&&Net.room) Net.setMine({load:myLoad()}); document.querySelectorAll('.scr').forEach(e=>e.classList.toggle('on',e.id==='scr-'+n)); cur=n;
    document.body.classList.toggle('ingame',n==='game'); if(n!=='game') closeOverlays(); else if(Game.active&&Game.paused&&Game.state!=='end') $('pause').classList.add('on');
    lobbyView();
    if(n==='main') refreshMain(); if(n==='loadout') renderLoadout(); if(n==='battle') renderBattle(); if(n==='tag') renderTag(); if(n==='settings') renderSettings(); }
  function back(){ const p=stack.pop()||'main'; if(p==='lobby'&&!Net.room) return show('main',false); show(p,false); }
  function showLoading(on,msg){ $('loading').classList.toggle('on',!!on); if(msg) $('loadMsg').textContent=msg; if(!on) loadPct(null); lobbyView(); }
  /* loading screen: picture of the map being loaded, and a percent in the corner */
  let pctT=null, pctV=0, pctTimer=0;
  function loadBg(id){ const m=id&&SandTag.maps[id], L=$('loading'); L.classList.toggle('map',!!m); L.style.backgroundImage=m?`linear-gradient(180deg,rgba(9,9,11,.62),rgba(9,9,11,.38) 45%,rgba(9,9,11,.86)),url("${assetURL('assets/ui/bg_'+id+'.jpg')}")`:''; $('loadMapName').textContent=m?m.name:''; }
  function loadPct(p){ const el=$('loadPct'), bar=$('loadBar'); if(p==null){ pctT=null; pctV=0; clearInterval(pctTimer); pctTimer=0; el.textContent=''; bar.style.width=''; bar.classList.remove('real'); $('loadPctBar').style.width='0'; $('loadPctBox').classList.remove('on'); $('loading').classList.remove('map'); $('loading').style.backgroundImage=''; return; }
    pctT=Math.max(pctT||0,Math.min(100,p)); bar.classList.add('real'); const paint=()=>{ if(pctT==null) return; pctV=pctT-pctV>0.5?pctV+Math.max(0.6,(pctT-pctV)*0.25):pctT; el.textContent=Math.round(pctV)+'%'; bar.style.width=pctV+'%'; $('loadPctBar').style.width=pctV+'%'; };
    $('loadPctBox').classList.add('on');
    paint(); if(!pctTimer) pctTimer=setInterval(paint,60); }
  function toast(m,ms){ const d=document.createElement('div'); d.textContent=m; $('toastG').appendChild(d); setTimeout(()=>d.remove(),ms||2600); }
  const overlayOpen=()=>$('pause').classList.contains('on')||$('result').classList.contains('on')||chatOn;
  function closeOverlays(){ $('pause').classList.remove('on'); $('result').classList.remove('on'); }
  /* segmented buttons */
  function seg(id,val,on){ const el=$(id); el.querySelectorAll('button').forEach(b=>{ b.classList.toggle('on',b.dataset.v===String(val)); b.onclick=()=>{ el.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); on(b.dataset.v); Sfx.play('click'); }; }); }
  function mapCards(id,val,on,small){ const el=$(id); el.innerHTML=''; const sw={desert:'#e0a060',plaza:'#9cc8ff',cyber:'#ff2d7a',factory:'#b08a5a'};
    for(const mid of SandTag.mapOrder){ const m=SandTag.maps[mid]; const b=document.createElement('button'); b.className='map-card'+(mid===val?' on':''); b.innerHTML=`<i class="sw img" style="background-image:url(&quot;${assetURL('assets/ui/bg_'+mid+'.jpg')}&quot;)"></i><b>${esc(m.name)}</b><span>${esc(m.desc||'')}</span>`;
      b.onclick=()=>{ el.querySelectorAll('.map-card').forEach(x=>x.classList.toggle('on',x===b)); on(mid); Sfx.play('click'); menuMap(mid); }; el.appendChild(b); } }
  /* ---------- main ---------- */
  function refreshMain(){ renderBoard(); $('mName').value=prefs.name||''; $('lbName').textContent=prefs.name||''; const xp=prefs.xp||0, lvl=1+Math.floor(Math.sqrt(xp/100)); const a=100*(lvl-1)*(lvl-1), b=100*lvl*lvl; $('mLevel').textContent='레벨 '+lvl; $('mXp').style.width=Math.round((xp-a)/(b-a)*100)+'%'; }
  function bindMain(){
    $('mName').addEventListener('change',()=>{ prefs.name=cleanName($('mName').value); $('mName').value=prefs.name; $('lbName').textContent=prefs.name; savePrefs(); });
    /* the board: pick battle / tag, map, mode, then start */
    const cyc=(list,cur,d)=>list[(list.indexOf(cur)+d+list.length)%list.length];
    const mapStep=d=>{ const o=prefs[kindNow()]; o.map=cyc(SandTag.mapOrder,o.map,d); savePrefs(); Sfx.play('click'); renderBoard(); };
    $('lbMapPrev').onclick=()=>mapStep(-1); $('lbMapNext').onclick=()=>mapStep(1); $('lbMapImg').onclick=()=>mapStep(1);
    const modeStep=d=>{ if(kindNow()==='battle'){ prefs.battle.mode=cyc(BMODE_IDS,prefs.battle.mode,d); } else { const t=prefs.tag, R=['any','run','seek']; t.role=cyc(R,t.role||'any',d); } savePrefs(); Sfx.play('click'); renderBoard(); };
    $('lbModePrev').onclick=()=>modeStep(-1); $('lbModeNext').onclick=()=>modeStep(1);
    $('lbMore').onclick=()=>{ Sfx.unlock(); show(kindNow()); }; $('hmStart').onclick=()=>startOffline(kindNow()); $('lbCreate').onclick=()=>createRoom(kindNow());
    $('navPlay').onclick=()=>show('main',false);
    $('goLoadout').onclick=()=>show('loadout'); $('goSettings').onclick=()=>show('settings'); $('goBrowse').onclick=()=>openBrowse();
    $('joinBtn').onclick=()=>joinRoom($('joinCode').value); $('joinCode').addEventListener('keydown',e=>{ if(e.key==='Enter') joinRoom($('joinCode').value); });
    document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{ Sfx.play('click'); back(); });
  }
  const kindNow=()=>prefs.lobbyKind==='tag'?'tag':'battle';
  function renderBoard(){ const k=kindNow(), o=prefs[k]; o.map=SandTag.okMap(o.map); const m=SandTag.maps[o.map];
    seg('lbKind',k,v=>{ prefs.lobbyKind=v; savePrefs(); renderBoard(); });
    $('lbMapName').textContent=m.name; $('lbMapImg').style.backgroundImage=`url("${assetURL('assets/ui/bg_'+o.map+'.jpg')}")`;
    if(k==='battle'){ const b=prefs.battle, d=BMODES[b.mode]||BMODES.tdm; $('lbModeKind').textContent=d.team?'모드 · 팀전':'모드 · 개인전'; $('lbModeName').textContent=d.name;
      $('lbInfo').textContent=`봇 ${b.mode==='duel'?1:b.bots}명 · ${({easy:'쉬움',normal:'보통',hard:'어려움'})[b.diff||'normal']}`; $('hmStartSub').textContent=d.name+' · '+m.name; }
    else { const t=prefs.tag; $('lbModeKind').textContent='내 역할'; $('lbModeName').textContent=({any:'무작위',run:'도망자',seek:'술래'})[t.role||'any'];
      $('lbInfo').textContent=`${t.players}명 · 술래 ${seekerCount(t.players)}명 · ${({easy:'쉬움',normal:'보통',hard:'어려움'})[t.diff||'normal']}`; $('hmStartSub').textContent='술래잡기 · '+m.name; }
    seg('lbChar',prefs.char?1:0,v=>{ prefs.char=+v; savePrefs(); lobbyChar(); });
    menuMap(o.map); lobbyChar(); }
  function lobbyChar(){ const L=prefs.loadout; LobbyShow.setChar({look:prefs.char?1:0,gun:L.main,att:prefs.gunAtt[L.main]}); }
  /* the 3D operator is drawn only while the lobby itself is on screen */
  function lobbyView(){ const want=cur==='main'&&!Game.active&&!$('loading').classList.contains('on'); if(want){ LobbyShow.open($('lbStage')); lobbyChar(); } else if(LobbyShow.on) LobbyShow.close(); }
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
    loadSummary('bLoad'); menuMap(b.map); }
  /* a one-line summary of the loadout (gun 1 / gun 2 / melee) */
  function loadSummary(id){ const L=prefs.loadout, e=$(id); if(!e) return; const n=k=>WPN[L[k]]?WPN[L[k]].name:'-';
    e.innerHTML=`<span><small>1번</small><b>${esc(n('main'))}</b></span><span><small>2번</small><b>${esc(n('side'))}</b></span><span><small>근접</small><b>${esc(n('melee'))}</b></span>`; }
  function bindBattle(){ $('bStart').onclick=()=>startOffline('battle'); $('bCreate').onclick=()=>createRoom('battle'); $('bBrowse').onclick=()=>openBrowse(); $('bEditLoad').onclick=()=>show('loadout'); }
  /* ---------- loadout + gunsmith ----------
     One loadout. Gun slot 1 and gun slot 2 take any firearm; each gun remembers its own attachments (prefs.gunAtt). */
  const SLOTS=[['main','1번 총기'],['side','2번 총기'],['melee','근접 무기'],['thr','투척'],['spec','특수 장비'],['p0','퍼크 1'],['p1','퍼크 2']];
  let loSub='scope';
  const isGunSlot=k=>k==='main'||k==='side';
  function slotName(L,k){ if(k==='thr') return TH[L.thr]?TH[L.thr].name:'-'; if(k==='spec') return SP[L.spec]?SP[L.spec].name:'-'; if(k==='p0'||k==='p1'){ const p=L.perks[+k[1]]; return PERKS[p]?PERKS[p].name:'-'; } return WPN[L[k]]?WPN[L[k]].name:'-'; }
  const gunAtt=id=>attClean(id,prefs.gunAtt[id]);
  const gunSub=(id,w)=>w.mode==='melee'?'근접':`${w.dmg}${w.pellets>1?'×'+w.pellets:''} 피해 · ${w.mag}발`;
  function renderLoadout(){ const L=prefs.loadout, gun=isGunSlot(loSlot), id=gun||loSlot==='melee'?L[loSlot]:null, w=id?WPN[id]:null;
    $('loSlots').innerHTML=SLOTS.map(([k,n])=>`<button class="lo-slot${k===loSlot?' on':''}" data-k="${k}"><span><small>${n}</small><b>${esc(slotName(L,k))}</b></span><span>›</span></button>`).join('');
    $('loSlots').querySelectorAll('.lo-slot').forEach(b=>b.onclick=()=>{ loSlot=b.dataset.k; loSub=isGunSlot(loSlot)?'scope':'pick'; Sfx.play('click'); renderLoadout(); });
    const canAtt=gun&&w&&w.att; if(gun&&!canAtt) loSub='gun'; if(gun&&canAtt&&loSub!=='gun'&&(!w.att[loSub]||w.att[loSub].length<2)) loSub=ATT_SLOTS.find(k=>w.att[k]&&w.att[k].length>1)||'gun';
    /* centre: the 3D model with the five part tiles around it */
    const show3d=loSlot!=='p0'&&loSlot!=='p1', showId=loSlot==='thr'?L.thr:loSlot==='spec'?L.spec:id; $('gsView').classList.toggle('noview',!show3d);
    $('gsName').textContent=slotName(L,loSlot); $('gsCat').textContent=gun&&w?(CATS[w.cat]||''):SLOTS.find(x=>x[0]===loSlot)[1];
    const tiles=$('gsTiles'); tiles.innerHTML='';
    if(gun&&w){ const A=gunAtt(id)||{};
      for(const k of ATT_SLOTS){ const list=w.att&&w.att[k]||[], ok=list.length>1; const b=document.createElement('button'); b.className='gs-tile t-'+k+(loSub===k?' on':'')+(ok?'':' off'); b.disabled=!ok;
        const set=ok&&A[k]!==list[0]; b.innerHTML=`<small>${ATT_SLOT_NAMES[k]}</small><b class="${set?'set':''}">${ok?esc(ATT[k][A[k]].name):'장착 불가'}</b>`; b.onclick=()=>{ loSub=k; Sfx.play('click'); renderLoadout(); }; tiles.appendChild(b); } }
    $('gsSwap').style.display=gun?'':'none'; $('gsSwap').classList.toggle('acc',loSub==='gun'); $('gsSwap').onclick=()=>{ loSub='gun'; Sfx.play('click'); renderLoadout(); };
    $('gsReset').style.display=canAtt?'':'none'; $('gsReset').onclick=()=>{ delete prefs.gunAtt[id]; savePrefs(); Sfx.play('click'); renderLoadout(); };
    $('gsNoAtt').style.display=gun&&!canAtt?'':'none'; $('gsPerk').textContent=show3d?'':'퍼크는 경기 내내 적용되는 능력이에요.';
    if(show3d){ if(!GunShow.on){ GunShow.open($('gsStage')); GunShow.bindDrag($('gsView')); } GunShow.set(showId,gun?gunAtt(id):null); } else if(GunShow.on){ GunShow.close(); }
    /* right: what can go in the picked slot */
    const pick=$('loPick'); pick.innerHTML='';
    const addCat=t=>{ const d=document.createElement('div'); d.className='pick-cat'; d.textContent=t; pick.appendChild(d); };
    const addPick=(name,sub,sel,on,info)=>{ const b=document.createElement('button'); b.className='pick'+(sel?' on':''); b.innerHTML=`<b>${esc(name)}</b><span>${esc(sub||'')}</span>`; b.onclick=()=>{ on(); savePrefs(); renderLoadout(); Sfx.play('click'); };
      b.onmouseenter=()=>stats(info); b.onmouseleave=()=>stats(curInfo()); pick.appendChild(b); return b; };
    const curInfo=()=>gun?{w:wpnWith(id,gunAtt(id)),base:WPN[id]}:loSlot==='melee'?{w:WPN[L.melee]}:loSlot==='thr'?{t:TH[L.thr]}:loSlot==='spec'?{t:SP[L.spec]}:{t:PERKS[L.perks[+loSlot[1]]]};
    if(gun&&loSub!=='gun'){ $('loPickT').textContent=ATT_SLOT_NAMES[loSub]+' 고르기'; const A=gunAtt(id);
      for(const o of w.att[loSub]){ const a=Object.assign({},A,{[loSub]:o}); addPick(ATT[loSub][o].name,ATT[loSub][o].desc,A[loSub]===o,()=>{ prefs.gunAtt[id]=a; },{w:wpnWith(id,a),base:WPN[id]}); } }
    else if(gun||loSlot==='melee'){ $('loPickT').textContent=(gun?(loSlot==='main'?'1번':'2번')+' 총기':'근접 무기')+' 고르기';
      const ids=gun?GUNS.concat(['shield']):MELEES, other=gun?L[loSlot==='main'?'side':'main']:null; let lastCat=null;
      for(const g of ids){ const x=WPN[g]; if(!x) continue; if(x.cat!==lastCat){ addCat(CATS[x.cat]||x.cat); lastCat=x.cat; }
        const b=addPick(x.name,g===other?'다른 칸에서 사용 중 · 누르면 서로 바꿔요':gunSub(g,x),L[loSlot]===g,()=>{ if(g===other) L[loSlot==='main'?'side':'main']=L[loSlot]; L[loSlot]=g; if(gun&&x.att) loSub='scope'; },{w:gun?wpnWith(g,gunAtt(g)):x,base:x}); if(g===other) b.classList.add('used'); } }
    else if(loSlot==='thr'){ $('loPickT').textContent='투척 고르기'; for(const t in TH) addPick(TH[t].name,`${TH[t].count}개`,L.thr===t,()=>{ L.thr=t; },{t:TH[t]}); }
    else if(loSlot==='spec'){ $('loPickT').textContent='특수 장비 고르기'; for(const t in SP) addPick(SP[t].name,SP[t].cd?`재사용 ${SP[t].cd}초`:'항상 사용',L.spec===t,()=>{ L.spec=t; },{t:SP[t]}); }
    else { const i=+loSlot[1]; $('loPickT').textContent='퍼크 고르기'; for(const t of PERK_IDS) addPick(PERKS[t].name,PERKS[t].desc,L.perks[i]===t,()=>{ L.perks[i]=t; },{t:PERKS[t]}); }
    stats(curInfo()); }
  /* stat bars; with info.base the numbers that attachments changed are coloured (green = better, red = worse) */
  function stats(info){ const el=$('loStats'); if(!info) return; if(info.w){ const w=info.w, b=info.base||w;
      const bar=(n,v,txt,d)=>`<div class="stat${d>0?' up':d<0?' dn':''}"><span>${n}<b>${txt}</b></span><i><b style="width:${Math.round(clamp(v,0,1)*100)}%"></b></i></div>`;
      const dif=(k,inv)=>{ const x=w[k], y=b[k]; return Math.abs(x-y)<1e-6?0:((x>y)!==!!inv?1:-1); };
      const zm=w.mode==='melee'?'':bar('조준 배율',(1/w.zoom-1)/6,({iron:'기계식',reddot:'도트',holo:'홀로'}[w.optic]||('×'+(0.82/w.zoom).toFixed(1))),w.zoom<b.zoom-1e-6?1:w.zoom>b.zoom+1e-6?-1:0)+bar('조준 속도',(w.adsSpd||1)/1.6,Math.round((w.adsSpd||1)*100)+'%',(w.adsSpd||1)>1.001?1:(w.adsSpd||1)<0.999?-1:0);
      el.innerHTML=`<h2>${esc(w.name)}</h2><p>${esc(CATS[w.cat]||'')} · ${esc(w.desc||'')}</p>`+(w.mode==='melee'?bar('피해',w.dmg/100,w.dmg,0)+bar('공격 속도',0.4/w.rate,(1/w.rate).toFixed(1)+'/초',0)+bar('사거리',w.reach/3,w.reach+'m',0):
        bar('피해',w.dmg*w.pellets/110,w.dmg+(w.pellets>1?' × '+w.pellets:''),0)+bar('연사력',w.rpm/1250,w.rpm+' RPM',0)+bar('사거리',w.far/150,Math.round(w.range)+'~'+Math.round(w.far)+'m',dif('far'))+bar('정확도',1-w.spread/9,'',dif('spread',true))+bar('반동 제어',1-w.recoil/5,'',dif('recoil',true))+((w.hip||1)!==1?bar('지향 사격',1-(w.hip||1)*0.5,'퍼짐 '+Math.round(((w.hip||1)-1)*100)+'%',1):'')
        +bar('탄창',w.mag/100,w.mag+' / '+w.res,dif('mag'))+bar('장전',1-w.reload/5,w.reload+'초',dif('reload',true))+zm)+bar('이동 속도',(w.speed||1)-0.5,Math.round((w.speed||1)*100)+'%',dif('speed'))
        +(w.silent&&!b.silent?'<p class="tagline">소음기: 총소리가 작고 미니맵에 거의 안 보여요</p>':''); }
    else if(info.t) el.innerHTML=`<h2>${esc(info.t.name)}</h2><p>${esc(info.t.desc||'')}</p>`; }
  /* ---------- settings ---------- */
  function renderSettings(){
    seg('sGfx',prefs.gfx,v=>{ prefs.gfx=v; savePrefs(); R.applyQuality(QUALITY_PRESETS[v]); toast('그래픽 품질: '+QUALITY_PRESETS[v].name+(Game.active?'':' (다음 맵부터 완전히 적용)')); });
    const rng=(id,k,fmt)=>{ const e=$(id); e.value=prefs[k]; const lab=()=>$(id+'L').textContent=fmt(+e.value); lab(); e.oninput=()=>{ prefs[k]=+e.value; lab(); savePrefs(); if(k==='vol') Sfx.setVolume(); }; };
    rng('sSens','sens',v=>v.toFixed(2)); rng('sFov','hfov',v=>v+'°'); rng('sVol','vol',v=>Math.round(v*100)+'%');
    seg('sSound',prefs.sound===false?0:1,v=>{ prefs.sound=v==='1'; savePrefs(); Sfx.setVolume(); }); seg('sCtrl',prefs.ctrl||'auto',v=>{ prefs.ctrl=v; savePrefs(); applyCtrl(); });
    seg('sInv',prefs.invertY?1:0,v=>{ prefs.invertY=v==='1'; savePrefs(); }); $('sLayout').onclick=()=>BtnLayout.open(); seg('sAutoFire',prefs.autoFire===false?0:1,v=>{ prefs.autoFire=v==='1'; savePrefs(); }); seg('sAdsMode',prefs.adsMode==='hold'?'hold':'toggle',v=>{ prefs.adsMode=v; savePrefs(); }); seg('sDmgNum',prefs.dmgNum===false?0:1,v=>{ prefs.dmgNum=v==='1'; savePrefs(); }); seg('sAssist',prefs.aimAssist===false?0:1,v=>{ prefs.aimAssist=v==='1'; savePrefs(); }); seg('sGlow',prefs.glow==null?1:prefs.glow,v=>{ prefs.glow=+v; savePrefs(); R.setBloom(); }); seg('sAuto',prefs.gfxAuto===false?0:1,v=>{ prefs.gfxAuto=v==='1'; savePrefs(); }); seg('sFps',prefs.showFps?1:0,v=>{ prefs.showFps=v==='1'; savePrefs(); }); seg('sCross',prefs.crossColor||'#ffffff',v=>{ prefs.crossColor=v; savePrefs(); document.body.style.setProperty('--cross',v); }); }
  function applyCtrl(){ const t=prefs.ctrl==='touch'||(prefs.ctrl!=='kb'&&isTouch); document.body.classList.toggle('touch',t); }
  /* ---------- offline start ---------- */
  function randomLoadout(R){ const r=R||Math.random; const pickR=a=>a[(r()*a.length)|0]; const L={name:'봇',main:pickR(MAINS),side:pickR(SIDES),melee:pickR(MELEES),thr:pickR(Object.keys(TH)),spec:pickR(Object.keys(SP).filter(k=>k!=='repair')),perks:[pickR(PERK_IDS),pickR(PERK_IDS)]};
    /* bots carry a few random parts so their guns do not all look alike (never a long scope: they fight at every range) */
    const ra=id=>{ const w=WPN[id]; if(!w||!w.att) return null; const a={}; for(const k of ATT_SLOTS){ const list=(w.att[k]||[]).filter(o=>k!=='scope'||!ATT.scope[o].scope||o===w.att.scope[0]); a[k]=list.length&&r()<0.45?pickR(list):list[0]; } return attClean(id,a); };
    L.att=[ra(L.main),ra(L.side)]; return L; }
  function startOffline(kind){
    Sfx.unlock(); const myId='me'; const players=[]; const me={id:'me',name:prefs.name||'나',owner:myId,load:myLoad()};
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
    const pl=p=>`<div class="pl${p.id===Net.myId?' me':''}"><i class="dot" style="background:${isTag?'#ff8a1f':TEAM_COLORS[p.team||0]}"></i><b>${esc(p.name)}${p.id===r.host?' 👑':''}</b>${isTag?`<span class="tagc">${{any:'무작위',run:'도망자 희망',seek:'술래 희망'}[p.pref||'any']}</span>`:''}${p.ready||p.id===r.host?'<span class="rdy">준비</span>':''}${host&&p.id!==Net.myId?`<button class="kick" data-k="${p.id}" title="내보내기">✕</button>`:''}</div>`;
    const team=!isTag&&BMODES[s.mode].team;
    $('lbPlayers').innerHTML=team?`<div class="teams"><div><h4 style="color:${TEAM_COLORS[0]}">블루</h4>${r.players.filter(p=>!p.team).map(pl).join('')}</div><div><h4 style="color:${TEAM_COLORS[1]}">레드</h4>${r.players.filter(p=>p.team).map(pl).join('')}</div></div>`:r.players.map(pl).join('');
    $('lbPlayers').querySelectorAll('.kick').forEach(b=>b.onclick=()=>Net.kick(b.dataset.k));
    const mine=r.players.find(p=>p.id===Net.myId)||{};
    let mh=''; if(isTag) mh+=`<label class="lbl">내 역할 희망</label><div class="seg" id="lmRole"><button data-v="any">무작위</button><button data-v="run">도망자</button><button data-v="seek">술래</button></div>`;
    else { if(team) mh+=`<label class="lbl">팀</label><div class="seg" id="lmTeam"><button data-v="0">블루</button><button data-v="1">레드</button></div>`; mh+=`<label class="lbl">로드아웃</label><div class="load-sum" id="lmLoad"></div><button class="btn small wide" id="lmEdit" style="margin-top:8px">로드아웃·총기 커스텀</button>`; }
    $('lbMine').innerHTML=mh;
    if(isTag) seg('lmRole',mine.pref||'any',v=>Net.setMine({pref:v})); else { if(team) seg('lmTeam',mine.team||0,v=>Net.setMine({team:+v})); loadSummary('lmLoad'); $('lmEdit').onclick=()=>show('loadout'); }
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
    $('lbShare').onclick=()=>{ const url=location.origin+location.pathname+'?room='+Net.code; if(navigator.share) navigator.share({title:'CODE-NAME',text:'같이 하자! 방 코드 '+Net.code,url}).catch(()=>{}); else { copy(url); toast('참가 링크를 복사했어요'); } };
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
    const ed=()=>document.body.classList.contains('le-edit');
    $('tPause').addEventListener('touchstart',e=>{ if(ed()) return; e.preventDefault(); pause(); },{passive:false}); $('tPause').onclick=()=>{ if(!ed()) pause(); };
    $('pLayout').onclick=()=>BtnLayout.open();
    $('tBoard').addEventListener('touchstart',e=>{ if(ed()) return; e.preventDefault(); HUD.toggleBoard(); },{passive:false});
    $('rMain').onclick=()=>{ quit(); }; $('rAgain').onclick=()=>{ $('result').classList.remove('on'); if(Game.online){ if(Net.host) Net.backToLobby(); Game.stop(); show('lobby',false); renderLobby(); } else if(lastSetup){ lastSetup.seed=(Math.random()*1e9)|0; Game.start(lastSetup); } };
    addEventListener('keydown',e=>{ if(cur!=='game'||chatOn) return; if(e.code==='Escape'){ /* pointer lock exit triggers pause */ } });
    Bus.on('lock',locked=>{ if(!locked&&Game.active&&Game.state!=='end'&&!chatOn&&!isTouch&&cur==='game') pause(); lockHint(); });
    Bus.on('lockfail',()=>lockHint()); setInterval(lockHint,500);
    Bus.on('end',r=>showResult(r));
  }
  /* "click to play" hint whenever the mouse is not captured on the play screen (the browser can refuse the automatic capture after a long load) */
  function lockHint(){ const kb=!isTouch&&!document.body.classList.contains('touch'); const on=kb&&Game.active&&cur==='game'&&Game.state!=='end'&&Game.state!=='loading'&&!Input.locked&&!overlayOpen()&&!$('loading').classList.contains('on');
    const e=$('hClick'); if(e) e.classList.toggle('on',!!on); }
  function pause(){ if(!Game.active) return; $('pause').classList.add('on'); if(!Game.online) Game.paused=true; Input.exitLock(); }
  function resume(){ $('pause').classList.remove('on'); Game.paused=false; if(cur!=='game'){ show('game',false); } if(!isTouch) Input.requestLock(); }
  function quit(){ $('pause').classList.remove('on'); $('result').classList.remove('on'); Game.stop(); if(Game.online){ Net.leave(); } show('main',false); stack=[]; }
  function showResult(r){ setTimeout(()=>{ const me=Game.me; let title='', sub='', win=false;
      if(Game.kind==='tag'){ win=me&&r.winRole===me.role; title=r.winRole==='run'?'도망자 승리!':'술래 승리!'; sub=`탈출 ${r.esc}명 / 필요 ${r.need}명`+(r.why==='time'?' · 시간 종료':''); }
      else if(r.winTeam!=null){ win=me&&r.winTeam===me.team; title=r.winTeam<0?'무승부':TEAM_NAMES[r.winTeam]+' 팀 승리!'; sub=`${r.score[0]} : ${r.score[1]}`; }
      else { const w=Game.byId.get(r.winner); win=me&&r.winner===me.id; title=w?w.name+' 승리!':'경기 종료'; }
      $('rTitle').textContent=title; $('rTitle').className=win?'win':''; $('rSub').textContent=sub; $('rBoard').innerHTML=HUD.boardHTML(); $('rXp').textContent=me?`이번 경기 경험치 +${Math.round(me.kills*10+me.score*0.5+(win?100:30))}`:'';
      $('rAgain').textContent=Game.online?(Net.host?'대기실로':'대기실로'):'다시 하기'; $('result').classList.add('on'); },1600); }
  /* ---------- menu backdrop: a picture of the selected map (no 3D map is built for the menus) ---------- */
  function menuMap(id){ id=SandTag.okMap(id); /* absolute address: a url() inside a custom property is otherwise resolved against the stylesheet's folder */
    document.body.style.setProperty('--mapbg',`url("${assetURL('assets/ui/bg_'+id+'.jpg')}")`); LobbyShow.setBg(id); }
  function init(){ document.body.classList.add('nobg'); bindMain(); bindTag(); bindBattle(); bindBrowse(); bindLobby(); bindGame(); applyCtrl(); document.body.style.setProperty('--cross',prefs.crossColor||'#fff'); $('ver').textContent='v'+GAME_VERSION; BtnLayout.init(); }
  return {init,show,back,showLoading,loadBg,loadPct,toast,overlayOpen,openChat,closeChat,menuMap,renderLobby,startOffline,randomLoadout,get cur(){return cur;}};
})();

/* ---------- touch button layout editor: drag controls anywhere, resize the picked one, saved per device ---------- */
const BtnLayout=(()=>{
  const KEYS={joy:'#joy',fire:'.tb.fire',fire2:'.tb.fire2',ads:'.tb.ads',jump:'.tb.jump',crouch:'.tb.crouch',reload:'.tb.reload',use:'.tb.use',throw:'.tb.throw',special:'.tb.special',radar:'.tb.radar',menu:'#tPause',board:'#tBoard'};
  const NAMES={joy:'이동',fire:'발사',fire2:'왼쪽 발사',ads:'조준',jump:'점프',crouch:'앉기',reload:'장전',use:'줍기',throw:'투척',special:'특수',radar:'레이더',menu:'일시정지',board:'점수판'};
  const JOY=136, KNOB=58;
  let editing=false, tmp={}, sel=null, drag=null, fromGame=false;
  const el=k=>document.querySelector('#touch '+KEYS[k]);
  function place(k,v){ const e=el(k); if(!e) return;
    if(k==='joy'){ const kn=$('joyKnob');
      if(!v){ e.style.left=e.style.bottom=e.style.width=e.style.height=''; kn.style.width=kn.style.height=kn.style.margin=''; delete e.dataset.homeL; delete e.dataset.homeB; return; }
      const sz=JOY*(v.s||1), R=sz/2, ks=KNOB*(v.s||1); e.style.width=e.style.height=sz+'px'; kn.style.width=kn.style.height=ks+'px'; kn.style.margin=(-ks/2)+'px';
      e.dataset.homeL=`calc(${(v.x*100).toFixed(3)}vw - ${R}px)`; e.dataset.homeB=`calc(${((1-v.y)*100).toFixed(3)}vh - ${R}px)`;
      if(!e.classList.contains('act')){ e.style.left=e.dataset.homeL; e.style.bottom=e.dataset.homeB; } return; }
    if(!v){ e.style.left=e.style.top=e.style.right=e.style.bottom=e.style.transform=''; return; }
    e.style.left=(v.x*100).toFixed(3)+'vw'; e.style.top=(v.y*100).toFixed(3)+'vh'; e.style.right='auto'; e.style.bottom='auto'; e.style.transform=`translate(-50%,-50%) scale(${v.s||1})`; }
  function apply(L){ L=L||prefs.btnLayout||{}; for(const k in KEYS) place(k,L[k]); if(editing) overlaps(); }
  /* buttons that cover each other get a red outline while editing */
  function overlaps(){ const R={}; for(const k in KEYS){ const e=el(k); if(e) R[k]=e.getBoundingClientRect(); }
    const hit=new Set(), ks=Object.keys(R);
    for(let i=0;i<ks.length;i++) for(let j=i+1;j<ks.length;j++){ const a=R[ks[i]], b=R[ks[j]]; const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left), iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(ix>6&&iy>6){ hit.add(ks[i]); hit.add(ks[j]); } }
    for(const k of ks) el(k).classList.toggle('le-hit',hit.has(k)); }
  function center(k){ const r=el(k).getBoundingClientRect(); return {x:(r.left+r.width/2)/innerWidth,y:(r.top+r.height/2)/innerHeight}; }
  function entry(k){ if(!tmp[k]){ const c=center(k); tmp[k]={x:c.x,y:c.y,s:1}; } return tmp[k]; }
  function select(k){ sel=k; for(const q in KEYS){ const e=el(q); if(e) e.classList.toggle('le-sel',q===k); }
    $('leSel').textContent=NAMES[k]; const s=tmp[k]?tmp[k].s||1:1; $('leSize').value=s; $('leSizeL').textContent=Math.round(s*100)+'%'; }
  function open(){ if(editing) return; editing=true; fromGame=!!(Game.active&&UI.cur==='game'); tmp=JSON.parse(JSON.stringify(prefs.btnLayout||{}));
    if(fromGame&&!Game.online) Game.paused=true; Input.exitLock&&Input.exitLock();
    document.body.classList.add('le-edit'); document.body.classList.toggle('le-mock',!fromGame); apply(tmp); select('fire'); }
  function close(save){ if(!editing) return; editing=false; drag=null;
    if(save){ prefs.btnLayout=tmp; savePrefs(); UI.toast('버튼 배치를 저장했어요'); }
    apply(prefs.btnLayout); for(const q in KEYS){ const e=el(q); if(e) e.classList.remove('le-sel','le-hit'); }
    document.body.classList.remove('le-edit','le-mock'); if(fromGame&&Game.active) $('pause').classList.add('on'); }
  function init(){ for(const k in KEYS){ const e=el(k); if(e){ e.dataset.lk=k; e.dataset.name=NAMES[k]; } }
    const T=$('touch');
    T.addEventListener('pointerdown',e=>{ if(!editing) return; const t=e.target.closest('[data-lk]'); if(!t) return; e.preventDefault(); e.stopPropagation();
      const k=t.dataset.lk; select(k); const r=t.getBoundingClientRect(); drag={k,id:e.pointerId,dx:r.left+r.width/2-e.clientX,dy:r.top+r.height/2-e.clientY};
      try{ t.setPointerCapture(e.pointerId); }catch(_){} },true);
    addEventListener('pointermove',e=>{ if(!drag||e.pointerId!==drag.id) return; const v=entry(drag.k), m=24;
      v.x=clamp(e.clientX+drag.dx,m,innerWidth-m)/innerWidth; v.y=clamp(e.clientY+drag.dy,m,innerHeight-m)/innerHeight; place(drag.k,v); overlaps(); });
    const end=e=>{ if(drag&&e.pointerId===drag.id) drag=null; }; addEventListener('pointerup',end); addEventListener('pointercancel',end);
    T.addEventListener('click',e=>{ if(editing){ e.preventDefault(); e.stopPropagation(); } },true);
    $('leSize').addEventListener('input',()=>{ if(!sel) return; const v=entry(sel); v.s=+$('leSize').value; $('leSizeL').textContent=Math.round(v.s*100)+'%'; place(sel,v); overlaps(); });
    $('leReset').onclick=()=>{ tmp={}; apply(tmp); select(sel||'fire'); };
    $('leCancel').onclick=()=>close(false); $('leSave').onclick=()=>close(true);
    $('leFlip').onclick=()=>$('leBar').classList.toggle('low');
    addEventListener('resize',()=>{ if(!editing) apply(); });
    apply(); }
  return {init,open,close,apply,get editing(){return editing;}};
})();
