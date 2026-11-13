/* game.js — game state, input, player movement, abilities, round flow */
/* ===================== STATE ===================== */
const RUN_SPEED=8, QUIET_MUL=0.5, SLIDE_T=0.7, SLIDE_V=15, SLIDE_CD=2.2, TP_CD=8, RADAR_CD=10, RADAR_T=2.6, CATCH_R=1.5, CATCH_BTN=2.8, COLLECT_R=3;
const newEnt=()=>({hp:100,x:0,y:0,z:0,vy:0,gr:true,ph:PH,yaw:0,pitch:0,eye:PH-0.13,moving:false,quiet:false,noisy:false,slideT:0,slideCD:0,sdx:0,sdz:0,crouch:false,tpCD:0});
const S={mode:null,game:'tag',role:'runner',phase:'menu',gun:null,duel:{me:0,opp:0,target:3,round:1},shotPing:null,roundT:0,me:newEnt(),opp:{present:false,x:0,y:0,z:0,yaw:0,tx:0,ty:0,tz:0,tyaw:0,moving:false,noisy:false,slide:false,air:false,exposed:false,name:'',hp:100,rl:false},
  collected:new Set(),collect:null,doorOpen:false,countdown:0,startT:0,lastSeen:null,result:null,mid:null,radarCD:0,radarT:0,stats:null,stepT:0,beatT:0};
let perfT=0;
const orbTotal=()=>orbs.length;

/* ===================== INPUT ===================== */
const keys={};
const inGameInput=()=>S.phase==='play'||S.phase==='countdown';
addEventListener('keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')) return;
  keys[e.code]=true;
  if(!inGameInput()) return;
  if(e.code==='Space'){ doJump(); e.preventDefault(); }
  if(e.code==='KeyE') doAction();
  if(e.code==='KeyR') doReload();
  if(e.code==='KeyF') doFire();
  if(e.code==='KeyC'||e.code==='ControlLeft') doSlide();
  if(e.code==='KeyQ') doRadar();
  if(e.code==='KeyM') mmZoom=!mmZoom;
});
addEventListener('keyup',e=>{ keys[e.code]=false; });
addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
const joyEl=$('joy'), knob=$('knob'), touchEl=$('touch');
const joy={id:null,x:0,y:0}; let lookId=null, lookLast=null;
function tryLock(){ try{ const p=touchEl.requestPointerLock(); if(p&&p.catch) p.catch(()=>{}); }catch(_){} }
touchEl.addEventListener('pointerdown',e=>{
  if(!inGameInput()) return;
  if(prefs.ctrl==='kb'&&e.pointerType==='mouse'){ if(document.pointerLockElement===touchEl){ if(e.button===0){ if(hasGun()) doFire(); else doAction(); } return; } tryLock(); }
  const r=joyEl.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
  if(prefs.ctrl!=='kb'&&joy.id===null&&Math.hypot(e.clientX-cx,e.clientY-cy)<r.width*0.85){ joy.id=e.pointerId; updJoy(e); }
  else if(lookId===null){ lookId=e.pointerId; lookLast=[e.clientX,e.clientY]; }
  try{ touchEl.setPointerCapture(e.pointerId); }catch(_){}
});
touchEl.addEventListener('pointermove',e=>{
  if(e.pointerId===joy.id) updJoy(e);
  else if(e.pointerId===lookId&&lookLast){ const sens=(e.pointerType==='mouse'?0.0045:0.006)*prefs.sens;
    S.me.yaw-=(e.clientX-lookLast[0])*sens; S.me.pitch=Math.max(-1.1,Math.min(0.9,S.me.pitch-(e.clientY-lookLast[1])*sens)); lookLast=[e.clientX,e.clientY]; }
});
function endPtr(e){ if(e.pointerId===joy.id){ joy.id=null; joy.x=joy.y=0; knob.style.transform='translate(-50%,-50%)'; knob.classList.remove('quiet'); } if(e.pointerId===lookId){ lookId=null; lookLast=null; } }
touchEl.addEventListener('pointerup',endPtr); touchEl.addEventListener('pointercancel',endPtr);
function updJoy(e){ const r=joyEl.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, max=r.width*0.38;
  let dx=e.clientX-cx, dy=e.clientY-cy; const L=Math.hypot(dx,dy); if(L>max){ dx*=max/L; dy*=max/L; }
  joy.x=dx/max; joy.y=dy/max; knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  knob.classList.toggle('quiet',Math.hypot(joy.x,joy.y)>0.12&&Math.hypot(joy.x,joy.y)<0.62); }
document.addEventListener('mousemove',e=>{ if(document.pointerLockElement!==touchEl||!inGameInput()) return;
  S.me.yaw-=e.movementX*0.0025*prefs.sens; S.me.pitch=Math.max(-1.1,Math.min(0.9,S.me.pitch-e.movementY*0.0025*prefs.sens)); });
document.addEventListener('pointerlockchange',()=>{ $('lockTip').textContent=document.pointerLockElement?'Esc를 누르면 마우스 고정이 풀려요':'화면을 클릭하면 마우스로 시점을 돌릴 수 있어요'; });
for(const [id,fn] of [['act',()=>doAction()],['jump',()=>doJump()],['fire',()=>doFire()],['reload',()=>doReload()]]) $(id).addEventListener('pointerdown',e=>{ e.stopPropagation(); e.preventDefault(); fn(); });

/* ===================== GAMEPLAY ===================== */
function nearestOrb(){ let best=null,bd=1e9; const me=S.me;
  for(const o of orbs){ if(o.taken||Math.abs(o.y-me.y)>2) continue; const d=Math.hypot(o.x-me.x,o.z-me.z); if(d<bd){ bd=d; best=o; } } return best?{o:best,d:bd}:null; }
function canCatch(r){ const o=S.opp; return S.game==='tag'&&o.present&&Math.hypot(o.x-S.me.x,o.z-S.me.z)<r&&Math.abs(o.y-S.me.y)<1.8; }
function doAction(){
  if(S.phase!=='play') return;
  if(S.game==='duel'){ doSlide(); return; }
  if(S.role==='runner'){
    if(S.collect) return;
    const n=nearestOrb(); if(n&&n.d<=COLLECT_R&&S.me.gr){ S.collect={o:n.o,t:0}; SFX.tick(); return; }
    doSlide();
  } else {
    if(canCatch(CATCH_BTN)){ endGame('seeker','catch'); return; }
    doRadar();
  }
}
function doJump(){
  if(S.phase!=='play') return; const me=S.me; if(!me.gr||reloadLocked()) return;
  if(me.slideT>0||me.crouch){ if(!headroom(me,PH)) return; me.slideT=0; me.crouch=false; me.ph=PH; }
  me.vy=JUMP_V; me.gr=false; S.stats.jumps++; SFX.jump(); S.collect=null;
}
function moveInput(){
  let f=-joy.y, s=joy.x; const jm=Math.hypot(joy.x,joy.y);
  if(keys.KeyW||keys.ArrowUp) f+=1; if(keys.KeyS||keys.ArrowDown) f-=1; if(keys.KeyD) s+=1; if(keys.KeyA) s-=1;
  const L=Math.hypot(f,s); if(L>1){ f/=L; s/=L; }
  const quiet=(keys.ShiftLeft||keys.ShiftRight)||(joy.id!==null&&jm>0.12&&jm<0.62);
  return {f,s,mag:Math.min(1,L),quiet};
}
function doSlide(){
  if(S.phase!=='play'||S.role==='seeker'||reloadLocked()) return; const me=S.me;
  if(!me.gr||me.slideT>0||me.slideCD>0){ if(me.slideCD>0) SFX.bad(); return; }
  const mi=moveInput(), sy=Math.sin(me.yaw), cy=Math.cos(me.yaw);
  let dx=-sy*mi.f+cy*mi.s, dz=-cy*mi.f-sy*mi.s; const L=Math.hypot(dx,dz);
  if(L<0.2){ dx=-sy; dz=-cy; } else { dx/=L; dz/=L; }
  me.sdx=dx; me.sdz=dz; me.slideT=SLIDE_T; me.slideCD=SLIDE_CD; me.ph=PH_SLIDE; me.crouch=true; S.collect=null; S.stats.slides++; SFX.slide();
}
function doRadar(){
  if(S.phase!=='play'||S.role!=='seeker'||S.game!=='tag') return;
  if(!CFG.radar){ flash('이 방은 레이더가 꺼져 있어요','danger',1); return; }
  if(S.radarCD>0){ SFX.bad(); return; }
  S.radarCD=RADAR_CD; S.radarT=RADAR_T; S.stats.radars++; SFX.radar(); flash('레이더! 도망자 위치가 잠깐 보여요','portal',1.6);
  if(S.mode==='pvp') netGame({t:'radar'});
}
function takeOrb(o,remote){
  if(o.taken) return; o.taken=true; o.g.visible=false; S.collected.add(orbs.indexOf(o)); updOrbChip();
  const n=S.collected.size;
  if(S.role==='runner'){ SFX.collect(); if(n<orbTotal()) flash(`구슬 ${n}개 획득`,'good',1.1); }
  if(n>=orbTotal()&&!S.doorOpen){ S.doorOpen=true; setDoor(true); SFX.door();
    flash(S.role==='runner'?`${doorName()}이 열렸어요! 술래 쪽 ${doorName()}으로 탈출하세요`:`도망자가 구슬을 다 모았어요! ${doorName()}을 지키세요`,S.role==='runner'?'good':'danger',3.5); }
  if(!remote&&S.mode==='pvp') netGame({t:'orb',i:orbs.indexOf(o)});
}
function updOrbChip(){ if(S.game==='duel'){ $('orbCount').innerHTML=`나 <b>${S.duel.me}</b> : ${S.duel.opp} 상대 (${S.duel.target}승)`; return; }
  $('orbCount').innerHTML=(S.role==='runner'?'구슬 ':'도망자 구슬 ')+`<b>${S.collected.size}</b> / ${orbTotal()}`; }
let flashT=0;
function flash(msg,cls,dur){ const b=$('banner'); b.textContent=msg; b.className='hud '+(cls||''); flashT=dur; }
function fxFlash(){ const f=$('fx'); f.style.transition='none'; f.style.opacity='.85'; requestAnimationFrame(()=>{ f.style.transition='opacity .6s'; f.style.opacity='0'; }); }
const TIPS=['조이스틱을 살짝만 밀면 발소리 없이 걸어요.','줄무늬 낮은 통로는 슬라이딩으로만 지나갈 수 있어요.','보라색 텔레포트 문으로 단숨에 반대편으로 갈 수 있어요.',
  '옥상과 구름다리 위 구슬은 경사로로 올라가서 먹어요.','노란 구역에서는 술래에게 위치가 드러나요.','상자 위로 점프하면 길을 줄일 수 있어요.','술래는 레이더로 잠깐 도망자 위치를 볼 수 있어요.'];
const TIPS_DUEL=['R로 재장전해요. 3초 동안 움직일 수 없으니 숨어서 하세요.','머리를 맞히면 피해가 1.5배예요.','상대가 총을 쏘면 미니맵에 잠깐 위치가 보여요.','뛰면 가까운 상대에게 발소리 방향이 보여요.','슬라이딩과 점프로 총알을 피하세요.'];
const TIPS_SEEK=['총이 켜진 방이라면 도망자를 쏴서 체력을 깎을 수 있어요. 머리를 맞히면 더 아파요.','도망자가 노란 구역에 들어오면 미니맵에 보여요.','가까이서 뛰는 도망자의 발소리 방향이 화면에 표시돼요.','Q 또는 상황 버튼으로 레이더를 쓰면 도망자 위치가 잠깐 보여요.','구슬이 사라지는 곳을 미니맵으로 지켜보세요.'];

function duelSide(){ const hostA=S.duel.round%2===1, iAmHost=S.mode==='ai'?true:!!NET.isHost; return iAmHost===hostA?'A':'B'; }
function placePlayers(){
  let sp,op;
  if(S.game==='duel'){ const a=duelSide()==='A'; sp=a?SPAWN_RUN:SPAWN_SEEK; op=a?SPAWN_SEEK:SPAWN_RUN; }
  else { sp=S.role==='runner'?SPAWN_RUN:SPAWN_SEEK; op=S.role==='runner'?SPAWN_SEEK:SPAWN_RUN; }
  Object.assign(S.me,newEnt(),{x:sp.x,z:sp.z,yaw:sp.yaw});
  Object.assign(S.opp,{x:op.x,y:0,z:op.z,tx:op.x,ty:0,tz:op.z,yaw:op.yaw,tyaw:op.yaw,moving:false,noisy:false,slide:false,air:false,exposed:false,hp:100,rl:false});
  S.shotPing=null; gunReset(); clearTracers();
}
function resetRound(seed){
  S.collected=new Set(); S.collect=null; S.doorOpen=false; S.lastSeen=null; S.result=null; S.radarCD=S.role==='seeker'?5:0; S.radarT=0;
  S.stats={jumps:0,slides:0,tps:0,radars:0,dist:0,shots:0,hits:0,heads:0}; setDoor(false); applyTheme(CFG.theme);
  if(S.game==='duel'){ S.duel={me:0,opp:0,target:CFG.kills,round:1}; S.role='duel'; spawnOrbs([]); } else spawnOrbs(pickOrbs(seed,CFG.orbs));
  placePlayers(); updOrbChip();
  const rc=$('roleChip'); rc.textContent=S.game==='duel'?'1:1 총싸움':S.role==='runner'?'도망자':'술래'; rc.className='chip role-'+(S.game==='duel'?'seeker':S.role);
  const om=oppModel(); runnerModel.visible=om===runnerModel; seekerModel.visible=om===seekerModel; seekMarker.visible=S.game==='tag';
  setNameTag(S.mode==='pvp'?S.opp.name:null); if(nameTag) om.add(nameTag);
  $('oppChip').classList.toggle('hidden',S.mode!=='pvp');
  portalMeshes.forEach(p=>p.g.visible=CFG.tp);
  setOppGun(oppHasGun());
}
const oppModel=()=>S.game==='duel'||S.role==='runner'?seekerModel:runnerModel;
function startRound(seed){
  resetRound(seed); if(S.mode==='ai') aiReset();
  S.phase='countdown'; S.countdown=3.2; S.startT=0; showHud(true); showOverlay(null);
  const tips=S.game==='duel'?TIPS_DUEL:S.role==='runner'?TIPS:TIPS_SEEK; $('tip').textContent='팁: '+tips[(Math.random()*tips.length)|0];
}
function showHud(on){
  ['status','mmWrap','act','jump','cross'].forEach(i=>$(i).classList.toggle('hidden',!on));
  const gun=on&&hasGun(); $('fire').classList.toggle('hidden',!gun); $('reload').classList.toggle('hidden',!gun);
  $('hpBox').classList.toggle('hidden',!on||(S.game==='tag'&&S.role==='seeker')); $('blind').classList.toggle('hidden',!on||!(S.game==='tag'&&S.role==='seeker'));
  $('joy').classList.toggle('hidden',!on||prefs.ctrl==='kb'); $('keys').classList.toggle('hidden',!on||prefs.ctrl!=='kb');
  if(!on){ ['banner','count','vig','steps','hurt','dmgDir'].forEach(i=>{ const el=$(i); if(i==='vig'||i==='steps'||i==='hurt'||i==='dmgDir') el.style.opacity=0; else el.classList.add('hidden'); });
    if(document.pointerLockElement){ try{ document.exitPointerLock(); }catch(_){} } }
}
function showOverlay(id){ ['menu','online','lobby','over'].forEach(i=>$(i).classList.toggle('hidden',i!==id)); }

function endGame(winner,why,remote){
  if(S.phase==='over') return;
  S.phase='over'; S.collect=null; S.result=winner;
  if(S.mode==='pvp'&&!remote&&!(S.game==='duel'&&why==='duel')) netGame({t:'end',w:S.game==='duel'?(winner==='me'?'sender':'you'):winner,why:why||''});
  if(S.mode==='pvp') onlineGameEnded(winner,why);
  const iWin=S.game==='duel'?winner==='me':winner===S.role, secs=Math.round(S.startT), t=$('resTitle'), sub=$('resSub'), st=S.stats;
  if(why==='left'){ t.textContent='상대가 나갔어요'; t.className='result lose'; sub.textContent='대기실에서 다시 상대를 기다릴 수 있어요.'; }
  else if(why==='hostleft'){ t.textContent='방이 닫혔어요'; t.className='result lose'; sub.textContent='방장과 연결이 끊겼어요.'; }
  else if(why==='forfeit'){ t.textContent=iWin?'상대가 기권했어요':'기권했어요'; t.className='result '+(iWin?'win':'lose'); sub.textContent=iWin?'이번 판은 내 승리예요.':'이번 판은 상대 승리로 기록돼요.'; }
  else if(S.game==='duel'){ t.textContent=iWin?'승리!':'패배'; t.className='result '+(iWin?'win':'lose');
    sub.textContent=`최종 점수 ${S.duel.me} : ${S.duel.opp}. ${S.duel.target}번 먼저 쓰러뜨린 쪽이 이겨요.`; }
  else if(S.role==='runner'&&why==='shot'){ t.textContent='쓰러졌어요'; t.className='result lose'; sub.textContent=`술래의 총에 맞아 체력이 0이 됐어요. 모은 구슬 ${S.collected.size}/${orbTotal()}개.`; }
  else if(S.role==='seeker'&&why==='shot'){ t.textContent='도망자를 쓰러뜨렸어요!'; t.className='result win'; sub.textContent=`${secs}초 만에 총으로 쓰러뜨렸어요.`; }
  else if(S.role==='runner'){ t.textContent=iWin?'탈출 성공!':'잡혔어요'; t.className='result '+(iWin?'win':'lose');
    sub.textContent=iWin?`구슬 ${orbTotal()}개를 모아 ${secs}초 만에 ${doorName()}으로 빠져나왔어요.`:`술래에게 잡혔어요. 모은 구슬 ${S.collected.size}/${orbTotal()}개.`; }
  else { t.textContent=iWin?'도망자를 잡았어요!':'도망자가 탈출했어요'; t.className='result '+(iWin?'win':'lose');
    sub.textContent=iWin?`${secs}초 만에 잡았어요.`:`구슬을 다 모은 도망자가 ${doorName()}으로 빠져나갔어요.`; }
  if(S.mode==='ai'&&iWin&&why==='escape'){ const key='best-'+MAP.id+'-'+prefs.diff, best=LS.get(key,null); if(best===null||secs<best){ LS.set(key,secs); sub.textContent+=` 새 최고 기록이에요!`; } updBest(); }
  const acc=st.shots?Math.round(st.hits/st.shots*100)+'%':'-';
  const cells=S.game==='duel'?[['점수',`${S.duel.me} : ${S.duel.opp}`],['시간',secs+'초'],['명중률',acc],['헤드샷',(st.heads||0)+'번'],['슬라이딩',st.slides+'번'],['이동 거리',Math.round(st.dist)+'m']]:S.role==='runner'?[['버틴 시간',secs+'초'],['구슬',`${S.collected.size}/${orbTotal()}`],['이동 거리',Math.round(st.dist)+'m'],['슬라이딩',st.slides+'번'],['점프',st.jumps+'번'],['텔레포트',st.tps+'번']]
    :[['시간',secs+'초'],['도망자 구슬',`${S.collected.size}/${orbTotal()}`],['이동 거리',Math.round(st.dist)+'m'],['레이더',st.radars+'번'],['명중률',acc],['결과',iWin?'승리':'패배']];
  const sd=$('stats'); sd.textContent=''; for(const [a,b] of cells){ const d=document.createElement('div'); const bb=document.createElement('b'); bb.textContent=b; d.append(bb,a); sd.append(d); }
  $('again').textContent=S.mode==='pvp'?'대기실로':'다시 하기';
  if(why!=='left'&&why!=='hostleft'&&why!=='forfeit') (iWin?SFX.win:SFX.lose)();
  flash(why==='left'||why==='hostleft'?'연결이 끊겼어요':S.game==='duel'?(iWin?'승리!':'패배'):iWin?(S.role==='runner'?'탈출!':'잡았다!'):(S.role==='runner'?'잡혔어요!':'놓쳤어요!'),iWin?'good':'danger',1);
  setTimeout(()=>{ if(S.phase==='over'){ showHud(false); showOverlay('over'); } },1000);
}

function updatePlayer(dt){
  const me=S.me, mi=moveInput();
  me.slideCD=Math.max(0,me.slideCD-dt); me.tpCD=Math.max(0,me.tpCD-dt);
  if(keys.ArrowLeft) me.yaw+=2.2*dt; if(keys.ArrowRight) me.yaw-=2.2*dt;
  const base=S.role==='seeker'?RUN_SPEED*CFG.seekMul:RUN_SPEED;
  const sy=Math.sin(me.yaw), cy=Math.cos(me.yaw);
  let dx=(-sy*mi.f+cy*mi.s), dz=(-cy*mi.f-sy*mi.s), spd=base*(mi.quiet?QUIET_MUL:1);
  if(reloadLocked()){ dx=0; dz=0; }
  me.quiet=mi.quiet&&mi.mag>0.1;
  if(me.slideT>0){
    me.slideT-=dt; const k=Math.max(0,me.slideT/SLIDE_T); spd=base+(SLIDE_V-base)*k;
    const L=Math.hypot(dx,dz); if(L>0.2){ me.sdx+= (dx/L-me.sdx)*dt*2.5; me.sdz+=(dz/L-me.sdz)*dt*2.5; const n=Math.hypot(me.sdx,me.sdz); me.sdx/=n; me.sdz/=n; }
    dx=me.sdx; dz=me.sdz;
    if(me.slideT<=0){ me.slideT=0; }
  }
  if(me.crouch&&me.slideT<=0){ if(headroom(me,PH)){ me.crouch=false; me.ph=PH; } else spd=base*0.45; }
  const L=Math.hypot(dx,dz); if(L>1){ dx/=L; dz/=L; }
  const ox=me.x, oz=me.z;
  const land=physStep(me,dx*spd*dt,dz*spd*dt,dt,S.role==='runner'&&S.doorOpen);
  if(land>9) SFX.land();
  const moved=Math.hypot(me.x-ox,me.z-oz); S.stats.dist+=moved; me.moving=moved>spd*dt*0.15&&moved>0.002;
  me.noisy=S.role!=='seeker'&&((me.moving&&!me.quiet)||me.slideT>0||land>9);
  if(S.collect&&(!me.gr||me.slideT>0)) S.collect=null;
}
function checkPortals(){
  const me=S.me; if(!CFG.tp||S.role==='seeker'||me.tpCD>0||me.y>2) return;
  PORTALS.forEach((p,i)=>{ if(me.tpCD>0) return; if(Math.hypot(me.x-p.x,me.z-p.z)<1.3){
    const d=PORTALS[1-i]; me.x=d.ex; me.z=d.ez; me.y=0; me.vy=0; me.gr=true; me.yaw=d.eyaw; me.pitch=0; me.tpCD=TP_CD; me.slideT=0; me.crouch=false; me.ph=PH;
    S.stats.tps++; SFX.tp(); fxFlash(); flash('텔레포트!','portal',1); S.collect=null;
    if(S.mode==='ai') aiOnTeleport(i); if(S.mode==='pvp') netGame({t:'tp',from:i}); } });
}

