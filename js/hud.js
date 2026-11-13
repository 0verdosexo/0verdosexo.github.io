/* hud.js — on-screen status, action button state, warnings */
const txtCache=new Map();
function setText(id,s){ if(txtCache.get(id)!==s){ txtCache.set(id,s); $(id).textContent=s; } }
function setHTML(id,s){ if(txtCache.get(id)!==s){ txtCache.set(id,s); $(id).innerHTML=s; } }
function updateHud(dt){
  const me=S.me, o=S.opp, d=o.present?Math.hypot(o.x-me.x,o.z-me.z):999, d3=o.present?Math.hypot(d,o.y-me.y):999, act=$('act');
  let cls='', label='', p=0, pc='var(--orb)';
  if(S.game==='duel'){
    if(me.slideCD>0){ cls='cool'; label='슬라이딩'; p=1-me.slideCD/SLIDE_CD; pc='rgba(255,247,236,.6)'; } else { cls='slide'; label='슬라이딩'; }
  } else if(S.role==='runner'){ const n=nearestOrb();
    if(S.collect){ cls='ready'; label='수집 중'; p=S.collect.t/CFG.collect; }
    else if(n&&n.d<=COLLECT_R&&me.gr){ cls='ready'; label='수집'; }
    else if(me.slideCD>0){ cls='cool'; label='슬라이딩'; p=1-me.slideCD/SLIDE_CD; pc='rgba(255,247,236,.6)'; }
    else { cls='slide'; label='슬라이딩'; }
  } else {
    if(canCatch(CATCH_BTN)){ cls='catch'; label='잡기'; }
    else if(!CFG.radar){ cls='cool'; label='잡기'; }
    else if(S.radarCD>0){ cls='cool'; label='레이더<br>'+Math.ceil(S.radarCD); p=1-S.radarCD/RADAR_CD; pc='rgba(160,107,255,.85)'; }
    else { cls='radar'; label='레이더'; }
  }
  const c='hud rbtn '+cls; if(act.className!==c) act.className=c; setHTML('actLabel',label);
  act.style.setProperty('--p',p.toFixed(3)); act.style.setProperty('--pc',pc);
  if(S.game==='duel'){
    setText('hint',`상대를 찾아 쓰러뜨리세요. ${S.duel.target}번 먼저 쓰러뜨리면 승리.`+(o.present&&S.shotPing&&perfT-S.shotPing.t<3?'  총소리가 들렸어요!':''));
    const a=[]; a.push(me.slideCD>0?`<span class="off">슬라이딩 ${me.slideCD.toFixed(1)}초</span>`:'<span class="on">슬라이딩 준비</span>');
    a.push(me.noisy?'<span>👣 발소리 남</span>':me.moving?'<span class="on">🤫 조용히</span>':'<span>정지</span>'); setHTML('abil',a.join(''));
  } else if(S.role==='runner'){
    setText('hint',(S.doorOpen?`${doorName()}이 열렸어요! 술래 쪽 ${doorName()}으로 탈출하세요.`:`구슬을 모두 모으면 술래 쪽 ${doorName()}이 열려요.`)+(o.present?`  술래까지 ${Math.round(d3)}m`:''));
    const a=[]; a.push(me.slideCD>0?`<span class="off">슬라이딩 ${me.slideCD.toFixed(1)}초</span>`:'<span class="on">슬라이딩 준비</span>');
    if(CFG.tp) a.push(me.tpCD>0?`<span class="off">텔레포트 ${Math.ceil(me.tpCD)}초</span>`:'<span class="on">텔레포트 준비</span>');
    a.push(me.noisy?'<span>👣 발소리 남</span>':me.moving?'<span class="on">🤫 조용히</span>':'<span>정지</span>');
    setHTML('abil',a.join(''));
  } else {
    setText('hint',o.exposed?'도망자 위치가 보여요! 미니맵을 확인하세요.':'도망자는 숨어 있어요. 노란 구역, 레이더, 발소리로 찾으세요.');
    const a=[]; if(CFG.gun&&S.gun) a.push(S.gun.rl>0?`<span class="off">재장전 ${S.gun.rl.toFixed(1)}초</span>`:`<span class="on">탄 ${S.gun.ammo}/${CFG.mag}</span>`);
    if(CFG.radar) a.push(S.radarCD>0?`<span class="off">레이더 ${Math.ceil(S.radarCD)}초</span>`:'<span class="on">레이더 준비</span>');
    a.push(o.noisy&&d3<13?'<span>👣 발소리 들림</span>':'<span class="off">조용함</span>'); setHTML('abil',a.join(''));
  }
  if(S.mode==='pvp') setText('oppChip',`${S.opp.name}${NET.rtt!==null?'  '+NET.rtt+'ms':''}`);
  if(flashT<=0&&S.phase==='play'){
    const b=$('banner'); let msg='',bc='';
    if(S.role==='runner'&&CFG.zone&&inZone(me.x,me.z)) msg='노란 구역: 술래에게 내 위치가 보여요';
    else if(S.role==='runner'&&d3<12){ msg='술래가 가까워요!'; bc='danger'; }
    else if(reloadLocked()){ msg=`재장전 중 ${S.gun.rl.toFixed(1)}초 (움직일 수 없어요)`; bc='danger'; }
    else if(o.rl&&oppHasGun()&&S.game==='duel'){ msg='상대가 재장전 중이에요! 지금이 기회'; bc='good'; }
    else if(S.role==='seeker'&&o.exposed) msg='도망자 위치 노출 중!';
    else if(me.crouch&&me.slideT<=0){ msg='머리 위가 막혀서 숙인 채 이동 중'; bc='portal'; }
    if(msg){ if(b.textContent!==msg) b.textContent=msg; b.className='hud '+bc; } else b.classList.add('hidden');
  }
  const vig=$('vig'); if(S.role==='runner'&&S.phase==='play'){ const v=Math.max(0,Math.min(0.9,(14-d3)/10)); vig.style.opacity=(v*(0.75+0.25*Math.sin(perfT*6))).toFixed(2);
    if(d3<11){ S.beatT-=dt; if(S.beatT<=0){ SFX.beat(); S.beatT=0.45+d3/11*0.6; } } } else vig.style.opacity=0;
  const st=$('steps');
  // direction of the last shot that hit me
  const dd=$('dmgDir');
  if(S.hurtDir&&perfT-S.hurtDir.t<1.2){ const dx=S.hurtDir.x-me.x, dz=S.hurtDir.z-me.z, cc=Math.cos(me.yaw), ss=Math.sin(me.yaw), sx=dx*cc-dz*ss, sy=dx*ss+dz*cc;
    dd.style.transform=`translate(-50%,-50%) rotate(${Math.atan2(sx,-sy)}rad)`; dd.style.opacity=(1-(perfT-S.hurtDir.t)/1.2).toFixed(2); } else dd.style.opacity=0;
  // HP + ammo
  if(!$('hpBox').classList.contains('hidden')){ const hp=Math.max(0,me.hp); $('hpFill').style.width=hp+'%'; $('hpFill').classList.toggle('low',hp<=30); setText('hpTxt',`체력 ${hp}`); }
  if(S.gun&&S.gun.on){ const g=S.gun; setText('ammoTxt',g.rl>0?`재장전 ${g.rl.toFixed(1)}`:`${g.ammo}/${CFG.mag}`);
    const f=$('fire'); f.classList.toggle('cool',g.rl>0||g.ammo<=0); $('reload').classList.toggle('busy',g.rl>0);
    $('reload').style.setProperty('--p',g.rl>0?(1-g.rl/CFG.reload).toFixed(3):0); }
  if((S.role==='seeker'||S.game==='duel')&&o.present&&o.noisy&&d3<13&&!o.exposed&&S.phase==='play'){
    const dx=o.x-me.x, dz=o.z-me.z, cc=Math.cos(me.yaw), ss=Math.sin(me.yaw), sx=dx*cc-dz*ss, sy=dx*ss+dz*cc;
    st.style.transform=`translate(-50%,-50%) rotate(${Math.atan2(sx,-sy)}rad)`; st.style.opacity=Math.max(0.3,1-d3/13).toFixed(2);
    S.stepT-=dt; if(S.stepT<=0){ SFX.step(); S.stepT=0.32; }
  } else st.style.opacity=0;
}

