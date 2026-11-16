/* hud.js — in-game overlay: scores, timer, objectives, killfeed, health, ammo, crosshair, hit markers, prompts, scoreboard, death screen. */
'use strict';
const HUD=(()=>{
  let on=false, hitT=0, dmgA=0, flashA=0, msgT=0, boardForce=false, fpsV=0, lastHtml={}, deadShown=false; const feed=[];
  const set=(id,v,prop)=>{ const k=id+(prop||''); if(lastHtml[k]===v) return; lastHtml[k]=v; const e=$(id); if(!e) return; if(prop==='w') e.style.width=v; else if(prop==='html') e.innerHTML=v; else e.textContent=v; };
  function start(){ on=true; lastHtml={}; feed.length=0; $('hFeed').innerHTML=''; $('hToast').innerHTML=''; $('hChatLog').innerHTML=''; deadShown=false;
    const me=Game.me; document.body.classList.toggle('tagmode',Game.kind==='tag'); document.body.classList.toggle('seeker',!!(me&&me.role==='seek')); document.body.classList.toggle('gun',!!Game.cfg.seekerGun&&!!(me&&me.role==='seek'));
    $('hSeekVig').style.display=Game.kind==='tag'&&me&&me.role==='seek'?'block':'none'; $('hTop').classList.toggle('solo',Game.kind==='battle'&&!Game.teamMode);
    $('hTop').classList.toggle('tagbar',Game.kind==='tag'); Minimap.build();
    if(Game.kind==='tag') msg(me.role==='seek'?'당신은 술래':'당신은 도망자',me.role==='seek'?'도망자를 모두 잡으세요. 6초 뒤에 출발해요':'구슬을 모아 탈출문으로! 술래를 조심하세요',4);
    else msg(BMODES[Game.mode].name,BMODES[Game.mode].desc,4); }
  function stop(){ on=false; $('hBoard').style.display='none'; }
  function msg(b,s,dur){ $('hMsgB').textContent=b||''; $('hMsgS').textContent=s||''; $('hMsg').style.opacity=1; msgT=dur||2.2; }
  function toast(t){ const d=document.createElement('div'); d.textContent=t; $('hToast').appendChild(d); setTimeout(()=>d.remove(),3200); while($('hToast').children.length>4) $('hToast').firstChild.remove(); }
  const fmt=s=>{ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
  function update(dt){ if(!on) return; const me=Game.me; if(!me) return;
    /* top bar */
    if(Game.kind==='tag'){ const T=Tag.info(); if(T){ const got=T.orbs.filter(o=>o.taken).length; set('hScoreA',`${got}/${T.orbs.length}`); set('hNameA','구슬'); set('hScoreB',`${T.escaped}/${Math.ceil(T.runners/2)}`); set('hNameB','탈출');
        set('hTime',Game.state==='pre'?'준비':fmt(T.time)); set('hObj',T.release>0&&Game.state==='live'?`술래 출발까지 ${Math.ceil(T.release)}`:T.door?'탈출문 열림!':'','html');
        const run=Game.actors.filter(a=>a.role==='run'); const st=`<div>${me.role==='seek'?'<b style="color:#ff6a5a">술래</b>':'<b style="color:#7fb6ff">도망자</b>'}${me.jailed?' · 감옥':''}${me.escaped?' · 탈출 성공':''}</div><div>도망 중 ${run.filter(a=>!a.jailed&&!a.escaped).length} · 감옥 ${run.filter(a=>a.jailed).length} · 탈출 ${run.filter(a=>a.escaped).length}</div>`+
          (me.role==='seek'?`<div>레이더 ${me.radarCd>Game.t?Math.ceil(me.radarCd-Game.t)+'초':'준비 (Q)'}</div>`:'')+(me.role==='seek'&&Game.cfg.seekerGun&&me.slots[0]?`<div>총 ${me.gunReloadT>0?'장전 중 '+me.gunReloadT.toFixed(1):me.slots[0].mag+'/10'}</div>`:'');
        set('hTagInfo',st,'html'); } }
    else { const M=Modes.info(); if(M){ const def=BMODES[Game.mode];
        if(Game.teamMode){ set('hScoreA',String(M.score[0])); set('hScoreB',String(M.score[1])); set('hNameA','블루'+(Game.mode==='snd'?'':' / '+M.limit)); set('hNameB','레드'); }
        else { const sorted=Game.actors.slice().sort((a,b)=>Game.mode==='pk'?b.pkCp-a.pkCp:b.score-a.score); const lead=sorted[0]; set('hScoreA',Game.mode==='pk'?`${me.pkCp}/${PK?PK.cps.length-1:0}`:`${me.score}`); set('hNameA',Game.mode==='pk'?'체크포인트':`나 · 1위 ${lead?esc(lead.name)+' '+lead.score:''} / ${M.limit}`); }
        let t=M.time>0?fmt(M.time):'--:--', obj='';
        if(Game.mode==='dom') obj=M.pts.map(p=>`<span class="p" style="background:${p.own<0?'rgba(255,255,255,.15)':TEAM_COLORS[p.own]}">${p.n}</span>`).join('');
        if(Game.mode==='hp'&&M.hp) obj=`이동까지 ${Math.ceil(M.hp.t)}초${M.hp.cont?' · 경합!':''}`;
        if(Game.mode==='ctf') obj=M.flags.map(f=>`<span style="color:${TEAM_COLORS[f.team]}">${f.home?'기지':f.carrier?'탈취됨':'떨어짐'}</span>`).join(' · ');
        if(Game.mode==='upl'&&M.drive) obj=M.drive.carrier?(Game.byId.get(M.drive.carrier)?esc(Game.byId.get(M.drive.carrier).name)+' 운반 중':''):'드라이브 대기';
        if(Game.mode==='gg') obj=`무기 ${Math.min(me.ggLevel+1,GG_LADDER.length)}/${GG_LADDER.length}`;
        if(Game.mode==='snd'&&M.bomb){ t=M.bomb.planted?'💣 '+Math.ceil(M.bomb.timer):fmt(M.roundT); obj=`라운드 ${M.round} · 공격 <b style="color:${TEAM_COLORS[M.att]}">${TEAM_NAMES[M.att]}</b>`; }
        set('hTime',Game.state==='pre'?String(Math.ceil(Game.stateT)):t); set('hObj',obj,'html'); } }
    /* hp */
    set('hHpNum',String(Math.max(0,Math.ceil(me.hp)))); set('hHpBar',Math.round(me.hp/me.maxHp*100)+'%','w'); $('hHp').classList.toggle('low',me.hp<35);
    const stx=[]; if(me.slowT>0) stx.push('느려짐'); if(me.stunT>0) stx.push('기절'); if(me.spawnProt>0&&Game.kind==='battle') stx.push('보호'); if(me.carry==='flag') stx.push('코어 운반'); if(me.carry==='drive') stx.push('드라이브 운반'); if(me.carry==='bomb') stx.push('폭탄 소지');
    set('hStatus',stx.map(s=>`<span>${s}</span>`).join(''),'html');
    $('hHp').style.display=Game.kind==='tag'&&me.role==='seek'?'none':'';
    /* weapon */
    const s=curSlot(me), w=curW(me);
    if(Game.kind==='battle'&&w){ set('hWName',me.tool?'수리 도구':w.name); set('hAmmo',w.mode==='melee'||me.tool?'∞':String(s.mag)); set('hRes',w.mode==='melee'||me.tool?'':'/ '+s.res);
      set('hSlots',me.slots.map((x,i)=>`<span class="${i===me.cur?'on':''}">${i+1} ${esc(WPN[x.id].name)}</span>`).join(''),'html');
      const L=me.load, th=L&&TH[L.thr], sp=L&&SP[L.spec]; set('hThr',Game.mode==='gg'||Game.mode==='pk'||!th?'':`G ${th.name} ×${me.thrLeft}${th.kind==='c4'&&me.c4.length?' (G 폭파)':''}`);
      set('hSpec',Game.mode==='gg'||Game.mode==='pk'||!sp?'':`F ${sp.name}${me.specCd>0?' '+Math.ceil(me.specCd)+'초':''}`); $('hSpec').classList.toggle('cd',me.specCd>0); $('hWeap').style.display=''; }
    else if(Game.kind==='tag'&&me.role==='seek'&&Game.cfg.seekerGun&&s){ set('hWName','술래 권총'); set('hAmmo',me.gunReloadT>0?'장전':String(s.mag)); set('hRes','/ 10'); set('hSlots','','html'); set('hThr',''); set('hSpec',''); $('hWeap').style.display=''; }
    else $('hWeap').style.display='none';
    /* crosshair */
    const cr=$('hCross'); const scoped=w&&WPN[w.id]&&Guns&&me.adsT>0.85&&(w.scope); $('hScope').style.display=scoped&&me.alive?'block':'none';
    if(me.alive&&w&&w.mode!=='melee'&&!scoped&&(Game.kind==='battle'||(me.role==='seek'&&Game.cfg.seekerGun))){ cr.style.display=''; const sp=spreadOf(me,w); const h=innerHeight; const px=clamp(Math.tan(sp)/Math.tan(R.camera.fov*Math.PI/360)*h/2,2,120)+(me.adsT>0.6?0:3);
      const q=cr.children; q[0].style.top=(-px-8)+'px'; q[1].style.top=px+'px'; q[2].style.left=(-px-8)+'px'; q[3].style.left=px+'px'; for(let i=0;i<4;i++) q[i].style.opacity=me.adsT>0.6&&w.cat!=='sg'?0:1; }
    else if(me.alive&&(Game.kind==='tag'||w&&w.mode==='melee')){ cr.style.display=''; const q=cr.children; for(let i=0;i<4;i++) q[i].style.opacity=0; } else cr.style.display='none';
    /* hit marker / damage */
    if(hitT>0){ hitT-=dt; $('hHit').style.opacity=Math.min(1,hitT*8); } else $('hHit').style.opacity=0;
    dmgA=Math.max(0,dmgA-dt*1.4); const low=me.alive&&me.hp<me.maxHp*0.35&&Game.kind==='battle'?0.35+Math.sin(Game.t*4)*0.1:0; $('hDmg').style.opacity=Math.max(dmgA,low);
    flashA=Math.max(0,flashA-dt*0.45); $('hFlash').style.opacity=Math.min(1,flashA);
    if(msgT>0){ msgT-=dt; if(msgT<=0) $('hMsg').style.opacity=0; }
    if(Game.state==='pre'&&Game.stateT>0) msg(String(Math.ceil(Game.stateT)),Game.kind==='tag'?(me.role==='seek'?'술래는 6초 늦게 출발해요':'도망쳐!'):BMODES[Game.mode].name,0.3);
    /* death */
    const dead=!me.alive&&!me.jailed&&!me.escaped&&Game.state!=='end'; $('hDead').style.display=dead?'block':'none';
    if(dead){ const k=Game.byId.get(me.lastAttacker); set('hDeadB',k&&k!==me?esc(k.name)+'에게 쓰러졌어요':'쓰러졌어요'); set('hDeadS',Game.mode==='snd'?'다음 라운드까지 기다려요':me.respawnAt>0?`${Math.max(0,Math.ceil(me.respawnAt-Game.t))}초 뒤 부활`:''); }
    if(me.escaped) { $('hDead').style.display='block'; set('hDeadB','탈출 성공!'); set('hDeadS','남은 동료를 응원해요'); }
    /* scoreboard */
    const showB=(Input.sample&&lastScoreKey())||boardForce; $('hBoard').style.display=showB&&Game.state!=='end'?'block':'none'; if(showB&&((Game.t*4)|0)!==update._b){ update._b=(Game.t*4)|0; $('hBoard').innerHTML=boardHTML(); }
    $('hFps').style.display=prefs.showFps?'block':'none'; if(prefs.showFps) set('hFps',fpsV+' FPS');
    Minimap.draw();
  }
  let scoreDown=false; addEventListener('keydown',e=>{ if(e.code==='Tab') scoreDown=true; }); addEventListener('keyup',e=>{ if(e.code==='Tab') scoreDown=false; });
  const lastScoreKey=()=>scoreDown;
  function boardHTML(){ const rows=a=>`<tr class="${a===Game.me?'me':''}"><td>${esc(a.name)}${a.bot?'<span class="bot">봇</span>':''}</td><td>${Game.kind==='tag'?(a.role==='seek'?'술래':a.escaped?'탈출':a.jailed?'감옥':'도망'):a.score}</td><td>${a.kills}</td><td>${Game.kind==='tag'?a.score:a.deaths}</td><td>${Game.kind==='tag'?'':a.assists}</td></tr>`;
    const head=`<tr><th>이름</th><th>${Game.kind==='tag'?'상태':'점수'}</th><th>${Game.kind==='tag'?'잡음':'처치'}</th><th>${Game.kind==='tag'?'점수':'죽음'}</th><th>${Game.kind==='tag'?'':'도움'}</th></tr>`;
    const sort=l=>l.sort((a,b)=>b.score-a.score||b.kills-a.kills);
    if(Game.kind==='battle'&&Game.teamMode){ const M=Modes.info(); return `<div class="board">`+[0,1].map(t=>`<div class="tb" style="color:${TEAM_COLORS[t]}">${TEAM_NAMES[t]} ${M?M.score[t]:''}</div><table>${head}${sort(Game.actors.filter(a=>a.team===t)).map(rows).join('')}</table>`).join('')+`</div>`; }
    if(Game.kind==='tag') return `<div class="board"><div class="tb" style="color:#ff6a5a">술래</div><table>${head}${sort(Game.actors.filter(a=>a.role==='seek')).map(rows).join('')}</table><div class="tb" style="color:#7fb6ff">도망자</div><table>${head}${sort(Game.actors.filter(a=>a.role==='run')).map(rows).join('')}</table></div>`;
    return `<div class="board"><table>${head}${sort(Game.actors.slice()).map(rows).join('')}</table></div>`; }
  function toggleBoard(){ boardForce=!boardForce; }
  /* ---------- events ---------- */
  Bus.on('hitmark',e=>{ hitT=0.25; const h=$('hHit'); h.className=e.head?'head':''; Sfx.play(e.head?'headmark':'hitmark'); });
  Bus.on('hurt',e=>{ dmgA=Math.min(0.85,dmgA+e.d/60); const me=Game.me; if(!me||!e.from||e.from===me) return; const ang=Math.atan2(e.dirX-me.x,-(e.dirZ-me.z))+me.yaw;
    const i=document.createElement('i'); i.style.transform=`rotate(${ang}rad)`; $('hDir').appendChild(i); setTimeout(()=>i.remove(),1000); Sfx.play('hit_0'+(1+((Math.random()*3)|0)),{vol:0.35,rate:0.8}); });
  Bus.on('flashed',s=>{ flashA=Math.max(flashA,s); }); Bus.on('stunned',()=>toast('기절했어요!'));
  Bus.on('killfeed',({k,v,w,h})=>{ if(!on) return; const wn=w==='void'?'추락':w==='fall'?'낙하':WPN[w]?WPN[w].name:TH[w]?TH[w].name:w==='mrl'?'초소형 로켓':w==='barrel'?'폭발 드럼통':w==='bomb'?'폭탄':w;
    const col=a=>a?(Game.kind==='tag'?(a.role==='seek'?'#ff8a7a':'#9cc8ff'):Game.teamMode?TEAM_COLORS[a.team]:'#fff'):'#fff';
    const d=document.createElement('div'); d.innerHTML=k&&k!==v?`<b style="color:${col(k)}">${esc(k.name)}</b> <span class="${h?'hs':''}">[${esc(wn)}${h?' · 헤드샷':''}]</span> <b style="color:${col(v)}">${esc(v.name)}</b>`:`<b style="color:${col(v)}">${esc(v.name)}</b> [${esc(wn)}]`;
    $('hFeed').prepend(d); setTimeout(()=>d.remove(),6000); while($('hFeed').children.length>6) $('hFeed').lastChild.remove();
    const me=Game.me; if(k===me&&v!==me){ hitT=0.35; $('hHit').className='kill'; Sfx.play('kill'); toast(`${v.name} 처치${h?' (헤드샷)':''}`); }
    if(v===me&&Game.kind==='battle'){ Input.exitLock&&0; } });
  Bus.on('mev',d=>{ if(!on) return; const me=Game.me, nm=id=>{ const a=Game.byId.get(id); return a?a.name:''; }, tn=t=>TEAM_NAMES[t]+' 팀';
    const T={cap:()=>toast(`${tn(d.team)}이 ${d.n} 지점을 점령했어요`),hpmove:()=>msg('점령 지점 이동','새 하드포인트로 가세요',2),confirm:()=>toast(`${nm(d.a)} 인식표 확보`),deny:()=>toast(`${nm(d.a)} 인식표 회수`),
      steal:()=>msg(d.team===me.team?'우리 코어를 빼앗겼어요!':'적 코어 탈취!',nm(d.a),2.2),capture:()=>msg(`${tn(d.team)} 코어 점령!`,nm(d.a),2.5),'return':()=>toast(`${tn(d.team)} 코어가 돌아왔어요`),flagdrop:()=>toast(`${tn(d.team)} 코어가 떨어졌어요`),
      drive:()=>toast(`${nm(d.a)}가 드라이브를 잡았어요`),upload:()=>msg(`${tn(d.team)} 업로드 성공!`,nm(d.a),2.5),planted:()=>msg('폭탄 설치됨',`${d.s} 지점 · 35초`,2.5),defused:()=>msg('폭탄 해체!','',2),
      roundwin:()=>msg(`${tn(d.team)} 라운드 승리`,d.why,3.5),round:()=>msg(`라운드 ${d.r}`,`공격: ${tn(d.att)}`,2.5),ggup:()=>toast(`다음 무기: ${WPN[d.w]?WPN[d.w].name:''}`)};
    (T[d.t]||(()=>{}))(); });
  Bus.on('tagmsg',t=>{ if(on) toast(t); }); Bus.on('caught',()=>msg('잡혔어요!','감옥에서 동료의 구출을 기다려요',3)); Bus.on('go',()=>msg('시작!','',1.2));
  Bus.on('hold',h=>{ const e=$('hHold'); if(!h){ e.style.display='none'; return; } e.style.display='block'; $('hHoldC').style.strokeDashoffset=113*(1-clamp(h.p,0,1)); $('hHoldL').textContent=h.label; });
  Bus.on('prompt',t=>{ const e=$('hPrompt'); if(!t){ e.style.display='none'; return; } e.style.display='block'; e.textContent=isTouch?t.replace('E 길게','줍기 길게'):t; });
  Bus.on('fps',v=>{ fpsV=v; });
  Bus.on('chat',d=>{ if(!on) return; const e=document.createElement('div'); e.innerHTML=d.sys?`<span style="opacity:.7">${d.m}</span>`:`<b>${esc(d.n)}</b> ${esc(d.m)}`; $('hChatLog').appendChild(e); setTimeout(()=>e.remove(),9000); while($('hChatLog').children.length>6) $('hChatLog').firstChild.remove(); });
  return {start,stop,update,msg,toast,boardHTML,toggleBoard};
})();
