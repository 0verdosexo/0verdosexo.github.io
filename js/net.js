/* net.js — online rooms over the relay: host-authoritative lobby, game sync */
const PROTO=3, PREFIX='sandtag3-';
const NET={peer:null,conn:null,isHost:false,code:null,lastRecv:0,rtt:null,pend:null,pingT:null,sendT:0};
let NSID=0, L=null;
const other=r=>r==='runner'?'seeker':r==='seeker'?'runner':null;
const roleName=r=>r==='runner'?'도망자':r==='seeker'?'술래':'미정';
function genCode(bi){ const ch='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=ch[(Math.random()*ch.length)|0];
  if(bi!=null){ const firsts=[...ch].filter((_,i)=>i%BROKERS.length===bi); s=firsts[(Math.random()*firsts.length)|0]+s.slice(1); } return s; }
const cleanName=s=>String(s||'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,10)||'플레이어';
let noteHold=0;
function lbNote(msg,kind){ noteHold=performance.now()+2600; note('lbNote',msg,kind,true); }
function note(id,msg,kind,force){ if(id==='lbNote'&&!force&&performance.now()<noteHold) return; const n=$(id); n.textContent=msg||''; n.className='note'+(kind==='err'?' err':kind==='ok'?' ok':''); }
function netSend(m){ const c=NET.conn; if(c&&c.open){ try{ c.send(m); }catch(_){} } }
function netGame(m){ m.mid=S.mid; netSend(m); }
function netReset(){ NSID++; clearInterval(NET.pingT); const c=NET.conn,p=NET.peer;
  clearTimeout(NET.recoverT); Object.assign(NET,{peer:null,conn:null,isHost:false,code:null,lastRecv:0,rtt:null,pend:null,pingT:null,recoverT:null,confirmed:false,connT:0,wasOnline:false}); L=null; keepAwake(false);
  try{ c&&c.close(); }catch(_){} try{ p&&p.destroy(); }catch(_){} setBusy(false); }
function setBusy(b){ $('createBtn').disabled=b; $('joinBtn').disabled=b; }
function netErrMsg(e){ const t=e&&e.type; if(t==='browser-incompatible') return '온라인 연결 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 페이지를 새로 고쳐 주세요.';
  if(t==='peer-unavailable') return '그 코드의 방을 찾지 못했어요. 코드를 다시 확인해 주세요.'; return '중계 서버에 접속하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요. 학교나 회사 와이파이라면 모바일 데이터로 바꿔 보세요.'; }
function sanitizeCfg(c){ c=c||{}; const pick=(v,list,d)=>list.includes(v)?v:d;
  const ids=MAP_LIST.map(m=>m.id);
  return {map:pick(c.map,ids,ids[0]),orbs:pick(c.orbs,[5,8,10,12,15],10),seekMul:pick(c.seekMul,[0.9,0.95,1],0.95),collect:pick(c.collect,[1.5,2,3],2),theme:pick(c.theme,['day','sunset','night'],'sunset'),
    zone:c.zone!==false,tp:c.tp!==false,radar:c.radar!==false,swap:c.swap!==false,
    mode:pick(c.mode,['tag','duel'],'tag'),gun:c.gun===true,mag:pick(c.mag,[10,5,20],10),reload:pick(c.reload,[3,5,10],3),dmg:pick(c.dmg,[10,20,34],10),kills:pick(c.kills,[3,1,5],3)}; }
function sanitizeL(x){ if(!x||typeof x!=='object') return null; const pl=p=>p&&typeof p==='object'?{name:cleanName(p.name),role:['runner','seeker'].includes(p.role)?p.role:null,ready:!!p.ready,ver:String(p.ver||'?').slice(0,12)}:null;
  return {code:String(x.code||'').slice(0,6),cfg:sanitizeCfg(x.cfg),host:pl(x.host)||{name:'방장',role:null},guest:pl(x.guest),score:{h:+(x.score&&x.score.h)||0,g:+(x.score&&x.score.g)||0},phase:x.phase==='game'?'game':'lobby',round:+x.round||0}; }
function bindConn(c,sid){
  c.on('data',m=>{ if(sid!==NSID) return; NET.lastRecv=performance.now(); try{ onMsg(m); }catch(err){ console.error(err); } });
  c.on('close',()=>{ if(sid!==NSID||NET.conn!==c) return; onConnLost(); });
  c.on('error',()=>{});
}
const PEER_OPTS={};
const NET_FATAL=['browser-incompatible','ssl-unavailable','invalid-key','invalid-id'];
const isInApp=/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent||'');
let wakeLock=null;
function keepAwake(on){ try{ if(on&&!wakeLock&&navigator.wakeLock) navigator.wakeLock.request('screen').then(w=>{ wakeLock=w; w.addEventListener('release',()=>{ wakeLock=null; }); }).catch(()=>{});
  if(!on&&wakeLock){ wakeLock.release().catch(()=>{}); wakeLock=null; } }catch(_){} }
function hostOnline(){ const p=NET.peer; return !!(p&&!p.destroyed&&!p.disconnected); }
function startHeartbeat(sid){ clearInterval(NET.pingT); NET.pingT=setInterval(()=>{ if(sid!==NSID) return;
  if(NET.isHost){ const on=hostOnline(); if(on!==NET.wasOnline){ NET.wasOnline=on; if(S.phase==='lobby') renderLobby(); } if(!on) scheduleHostRecover(sid,0); }
  const c=NET.conn;
  if(c&&c.open){ netSend({t:'ping',ts:performance.now()});
    if((NET.confirmed||!NET.isHost)&&!NET.pend&&performance.now()-NET.lastRecv>9000){ NET.conn=null; try{ c.close(); }catch(_){} onConnLost(); } }
  if(NET.isHost&&c&&!NET.confirmed&&performance.now()-NET.connT>20000){ NET.conn=null; try{ c.close(); }catch(_){} }
},2000); }
/* ---------- host ---------- */
function createRoom(){
  const nm=cleanName($('nick').value); prefs.name=nm; LS.set('name',nm);
  if(typeof Peer!=='function'){ note('onNote','온라인 연결 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 페이지를 새로 고쳐 주세요.','err'); return; }
  netReset(); setBusy(true); note('onNote','방을 만드는 중이에요…'); const sid=NSID; let tries=0;
  const attempt=()=>{ const code=genCode(tries%BROKERS.length);
    if(tries>0) note('onNote',`다른 연결 서버로 방을 만드는 중이에요 (${tries+1}번째)…`);
    hostPeer(code,sid,true,(err)=>{ if(sid!==NSID) return;
      if(err&&err.type!=='browser-incompatible'&&++tries<6) attempt(); else { netReset(); note('onNote',netErrMsg(err),'err'); } }); };
  attempt();
}
function hostPeer(code,sid,first,onFirstFail){
  const p=new Peer(PREFIX+code.toLowerCase(),PEER_OPTS); let opened=false;
  const to=first?setTimeout(()=>{ if(!opened&&sid===NSID){ try{p.destroy();}catch(_){} onFirstFail({type:'server-timeout'}); } },15000):0;
  p.on('open',()=>{ if(sid!==NSID){ try{p.destroy();}catch(_){} return; } opened=true; clearTimeout(to); NET.peer=p; NET.wasOnline=true;
    if(first){ NET.isHost=true; NET.code=code;
      L={code,cfg:sanitizeCfg(Object.assign({},DEF_CFG,{theme:prefs.theme,map:MAP.id})),host:{name:prefs.name,role:null,ready:true,ver:GAME_VERSION},guest:null,score:{h:0,g:0},phase:'lobby',round:0};
      startHeartbeat(sid); enterLobby(); }
    else if(S.phase==='lobby') renderLobby(); });
  p.on('connection',c=>{ if(sid===NSID&&NET.peer===p) hostAccept(c,sid); });
  p.on('disconnected',()=>{ if(sid===NSID&&NET.peer===p){ if(S.phase==='lobby') renderLobby(); scheduleHostRecover(sid,800); } });
  p.on('error',e=>{ if(sid!==NSID) return;
    if(!opened){ clearTimeout(to); try{p.destroy();}catch(_){} if(first) onFirstFail(e); else scheduleHostRecover(sid,3000); return; }
    if(e.type==='peer-unavailable') return;
    if(NET_FATAL.includes(e.type)) return;
    scheduleHostRecover(sid,1500); });
  return p;
}
function scheduleHostRecover(sid,delay){
  if(NET.recoverT||sid!==NSID||!NET.isHost) return;
  NET.recoverT=setTimeout(()=>{ NET.recoverT=null; if(sid!==NSID||!NET.isHost) return;
    const p=NET.peer;
    if(p&&!p.destroyed&&p.disconnected){ try{ p.reconnect(); }catch(_){} }
    else if(!p||p.destroyed){ NET.peer=null; hostPeer(NET.code,sid,false); }
  },delay);
}
function hostAccept(c,sid){
  const busy=NET.conn&&NET.confirmed&&NET.conn.open&&performance.now()-NET.lastRecv<9000;
  if(busy||(L&&L.phase==='game')){ c.on('open',()=>{ try{ c.send({t:'full'}); }catch(_){} setTimeout(()=>{ try{c.close();}catch(_){} },600); }); return; }
  if(NET.conn){ const old=NET.conn; NET.conn=null; try{ old.close(); }catch(_){} if(L&&L.guest){ L.guest=null; } }
  NET.conn=c; NET.confirmed=false; NET.connT=performance.now(); NET.lastRecv=performance.now(); bindConn(c,sid);
}
/* ---------- guest ---------- */
function joinRoom(){
  const nm=cleanName($('nick').value); prefs.name=nm; LS.set('name',nm);
  const code=$('joinCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6){ note('onNote','방 코드 6자리를 입력해 주세요.','err'); return; }
  if(typeof Peer!=='function'){ note('onNote','온라인 연결 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 페이지를 새로 고쳐 주세요.','err'); return; }
  netReset(); setBusy(true); const sid=NSID, hostId=PREFIX+code.toLowerCase(), deadline=performance.now()+75000;
  let attempt=0, lastKind='', retryT=null, done=false, iceState='';
  NET.code=code; NET.pend=()=>{ done=true; clearTimeout(retryT); };
  note('onNote','연결 서버에 접속하는 중이에요…');
  const fail=(kind,e)=>{ if(done||sid!==NSID) return; done=true; clearTimeout(retryT); netReset(); note('onNote',joinFailMsg(kind,e,iceState),'err'); };
  const retry=(kind)=>{ if(done||sid!==NSID) return; lastKind=kind;
    if(performance.now()>deadline){ fail(kind); return; }
    note('onNote',kind==='nohost'?`방장을 찾는 중이에요 (${attempt}번째 시도). 방장이 게임 화면을 켜 두고 있어야 들어갈 수 있어요. 방장이 화면으로 돌아오면 자동으로 들어가요.`
      :`방장과 직접 연결이 잘 안 돼서 다시 시도하는 중이에요 (${attempt}번째 시도)…`);
    clearTimeout(retryT); retryT=setTimeout(tryConnect,2500); };
  const p=new Peer({broker:brokerOf(code)}); NET.peer=p;
  const srvTo=setTimeout(()=>{ if(!p.open&&!done) fail('server',{type:'server-timeout'}); },15000);
  function tryConnect(){
    if(done||sid!==NSID) return; if(p.destroyed){ fail('server',{type:'socket-closed'}); return; }
    if(p.disconnected){ try{ p.reconnect(); }catch(_){} retryT=setTimeout(tryConnect,2000); return; }
    attempt++; if(attempt===1) note('onNote','방을 찾았는지 확인하는 중이에요…');
    if(NET.conn){ const old=NET.conn; NET.conn=null; try{ old.close(); }catch(_){} }
    const c=p.connect(hostId); NET.conn=c; bindConn(c,sid);
    const iceWatch=setInterval(()=>{ const pc=c.peerConnection; if(pc){ iceState=pc.iceConnectionState||iceState; if(!c.open&&attempt>=1) note('onNote',`방장과 연결을 맺는 중이에요 (${attempt}번째 시도)…`); } },1000);
    const t=setTimeout(()=>{ clearInterval(iceWatch); if(!c.open&&NET.conn===c&&!done){ NET.conn=null; try{ c.close(); }catch(_){} retry('ice'); } },14000);
    c.on('open',()=>{ clearInterval(iceWatch); clearTimeout(t); if(sid!==NSID||done) return; NET.lastRecv=performance.now(); note('onNote','방에 들어가는 중이에요…');
      c.send({t:'hello',name:nm,v:PROTO,ver:GAME_VERSION}); NET.helloT=performance.now(); startHeartbeat(sid); });
    c.on('close',()=>{ clearInterval(iceWatch); clearTimeout(t); if(!done&&NET.conn===c){ NET.conn=null; retry('closed'); } });
  }
  p.on('open',()=>{ clearTimeout(srvTo); if(sid!==NSID){ try{p.destroy();}catch(_){} return; } tryConnect(); });
  p.on('error',e=>{ if(sid!==NSID) return;
    if(e.type==='peer-unavailable'){ if(!done) retry('nohost'); return; }
    if(done) return;
    if(NET_FATAL.includes(e.type)){ clearTimeout(srvTo); fail('browser',e); return; }
    if(!p.open&&attempt===0){ clearTimeout(srvTo); fail('server',e); return; }
    retry('server'); });
  p.on('disconnected',()=>{ if(sid===NSID&&!done){ try{ p.reconnect(); }catch(_){} } });
}
function joinFailMsg(kind,e,ice){
  const code=(e&&e.type)||kind;
  if(kind==='nohost') return '방을 찾지 못했어요. 코드가 맞는지, 그리고 방장이 게임 화면을 켜 둔 상태인지 확인해 주세요. 방장이 링크를 보내느라 다른 앱에 가 있으면 방이 잠시 닫혀요. (오류: 방 없음)';
  if(kind==='ice'||kind==='closed') return '방장과 연결이 자꾸 끊겨요. 인터넷 상태를 확인하고 다시 시도해 주세요. (오류: 연결 끊김)';
  if(kind==='browser') return '이 브라우저에서는 온라인 대결이 안 돼요. 카카오톡 등 앱 안에서 열었다면 크롬이나 사파리로 열어 주세요. (오류: '+code+')';
  return '중계 서버에 접속하지 못했어요. 인터넷 연결을 확인해 주세요. 학교나 회사 와이파이라면 모바일 데이터로 바꿔서 다시 해 보세요. (오류: '+code+')';
}
function enterLobby(){
  S.mode='pvp'; S.phase='lobby'; S.mid=null; setBusy(false); showHud(false); showOverlay('lobby'); buildCfgGrid(); renderLobby(); keepAwake(true);
  if(L) applyTheme(L.cfg.theme);
  try{ history.replaceState(null,'','#'+NET.code); }catch(_){}
}
function broadcast(){ if(!NET.isHost||!L) return; netSend({t:'lobby',L}); renderLobby(); }
function onConnLost(){
  if(NET.isHost){
    const wasGuest=NET.confirmed; NET.conn=null; NET.confirmed=false; if(!wasGuest){ if(L&&L.guest){ L.guest=null; broadcast(); } return; }
    const inGame=S.mode==='pvp'&&(S.phase==='play'||S.phase==='countdown');
    if(L){ L.guest=null; L.phase='lobby'; }
    if(inGame) endGame(null,'left',true); else if(S.phase==='lobby'){ renderLobby(); lbNote('상대가 방을 나갔어요. 새 친구를 기다리는 중이에요.','err'); }
  } else {
    if(NET.pend) return;
    const inGame=S.mode==='pvp'&&(S.phase==='play'||S.phase==='countdown');
    netReset();
    if(inGame) endGame(null,'hostleft',true);
    else if(S.phase!=='over'){ S.mode=null; S.phase='menu'; showHud(false); showOverlay('online'); note('onNote','방장과 연결이 끊겼어요.','err'); applyTheme(prefs.theme); }
  }
}
function onMsg(m){
  if(!m||typeof m!=='object') return;
  const t=m.t;
  if(t==='ping'){ netSend({t:'pong',ts:m.ts}); return; }
  if(t==='pong'){ if(typeof m.ts==='number') NET.rtt=Math.round(performance.now()-m.ts); if(S.phase==='lobby') renderLobby(); return; }
  if(NET.isHost){
    if(!L) return;
    if(t==='hello'){ NET.confirmed=true; const ver=String(m.ver||'?').slice(0,12); if(L.guest){ L.guest.name=cleanName(m.name); L.guest.ver=ver; broadcast(); return; } L.guest={name:cleanName(m.name),role:other(L.host.role),ready:false,ver}; SFX.ui(); broadcast(); lbNote(`${L.guest.name}님이 들어왔어요.`,'ok'); return; }
    if(t==='role'&&L.guest){ if((m.role==='runner'||m.role==='seeker')&&m.role!==L.host.role){ L.guest.role=m.role; L.guest.ready=false; } broadcast(); return; }
    if(t==='ready'&&L.guest){ L.guest.ready=!!m.v&&(!!L.guest.role||L.cfg.mode==='duel'); broadcast(); return; }
  } else {
    if(t==='lobby'){ const nl=sanitizeL(m.L); if(!nl) return; L=nl;
      if(!L.guest&&performance.now()-(NET.helloT||0)>800){ NET.helloT=performance.now(); netSend({t:'hello',name:prefs.name,v:PROTO,ver:GAME_VERSION}); }
      if(NET.pend){ NET.pend(); NET.pend=null; enterLobby(); ensureMap(L.cfg.map); return; }
      if(S.phase==='lobby'){ renderLobby(); applyTheme(L.cfg.theme); if(!MAP||MAP.id!==L.cfg.map) ensureMap(L.cfg.map); }
      else if(S.phase==='over'&&L.phase==='lobby'){ goLobby(); lbNote('방장이 대기실로 돌아왔어요.','ok'); }
      return; }
    if(t==='start'&&m.M){ startOnline(m.M); return; }
    if(t==='full'){ netReset(); S.mode=null; S.phase='menu'; showOverlay('online'); note('onNote','이 방은 이미 2명이 있거나 게임 중이에요. 판이 끝난 뒤 다시 시도해 주세요.','err'); return; }
    if(t==='kick'){ netReset(); S.mode=null; S.phase='menu'; showHud(false); showOverlay('online'); note('onNote','방장이 방에서 내보냈어요.','err'); applyTheme(prefs.theme); return; }
  }
  if(m.mid&&m.mid===S.mid) handleGameMsg(m);
}
const fin=v=>typeof v==='number'&&isFinite(v);
function handleGameMsg(m){
  const o=S.opp;
  if(m.t==='s'){ if(!fin(m.x)||!fin(m.y)||!fin(m.z)||!fin(m.yaw)) return;
    if(Math.hypot(m.x-o.tx,m.z-o.tz)>10){ o.x=m.x; o.y=m.y; o.z=m.z; }
    o.tx=m.x; o.ty=m.y; o.tz=m.z; o.tyaw=m.yaw; o.moving=!!m.mv; o.noisy=!!m.ns; o.slide=!!m.sl; o.air=!!m.air; o.rl=!!m.rl; if(fin(m.hp)) o.hp=Math.max(0,Math.min(100,m.hp)); S.oppSeen=performance.now(); return; }
  if(m.t==='shot'&&Array.isArray(m.e)&&m.e.length===3&&m.e.every(fin)){ if(S.phase==='play') oppShot(m.e,!!m.hit&&oppHasGun(),!!m.hd); return; }
  if(m.t==='dead'&&S.game==='duel'&&m.r===S.duel.round){ o.hp=0; duelRoundOver(true); return; }
  if(m.t==='orb'&&S.role==='seeker'&&fin(m.i)){ const ob=orbs[m.i]; if(ob) takeOrb(ob,true); return; }
  if(m.t==='tp'){ portalMeshes.forEach(p=>p.pulse=1); if(Math.min(...PORTALS.map(p=>Math.hypot(p.x-S.me.x,p.z-S.me.z)))<30) SFX.tp(); return; }
  if(m.t==='radar'&&S.role==='runner'){ SFX.radar(); flash('술래가 레이더를 썼어요! 내 위치가 잠깐 드러났어요','danger',2.2); return; }
  if(m.t==='end'&&S.phase!=='over'){ let w=m.w==='runner'||m.w==='seeker'?m.w:null; if(S.game==='duel') w=m.w==='you'?'me':m.w==='sender'?'opp':null; endGame(w,typeof m.why==='string'?m.why:'',true); }
}
async function startOnline(M){
  if(!M||typeof M!=='object'||typeof M.mid!=='string') return;
  const cfg=sanitizeCfg(M.cfg);
  if(!(await ensureMap(cfg.map))){ lbNote('이 맵을 불러오지 못했어요. 두 사람 모두 페이지를 새로 고쳐 주세요.','err'); return; }
  CFG=cfg; S.mode='pvp'; S.mid=M.mid;
  S.game=cfg.mode; const roles=M.roles||{}; S.role=S.game==='duel'?'duel':(NET.isHost?roles.h:roles.g); if(S.game==='tag'&&S.role!=='runner'&&S.role!=='seeker') return;
  const names=M.names||{}; S.opp.present=true; S.opp.name=cleanName(NET.isHost?names.g:names.h); S.oppSeen=performance.now();
  startRound((+M.seed)>>>0);
}
function onlineGameEnded(winner,why){
  if(!NET.isHost||!L) return;
  if(winner&&why!=='left'&&S.game==='duel'){ if(winner==='me') L.score.h++; else L.score.g++; }
  else if(winner&&why!=='left'){ if(winner===L.host.role) L.score.h++; else L.score.g++;
    if(L.cfg.swap&&L.guest){ const hr=L.host.role; L.host.role=L.guest.role; L.guest.role=hr; } }
  if(L.guest) L.guest.ready=false;
  if(why==='left') L.phase='lobby';
  broadcast();
}
function goLobby(){
  S.phase='lobby'; S.mid=null; S.mode='pvp'; S.collect=null; showHud(false); showOverlay('lobby');
  if(NET.isHost&&L){ L.phase='lobby'; broadcast(); } renderLobby(); if(L) applyTheme(L.cfg.theme);
}
/* ---------- lobby UI ---------- */
const CFG_DEFS=[
  ['mode','모드',[['tag','술래잡기'],['duel','1:1 총싸움']]],
  ['map','맵',null],
  ['orbs','구슬 개수',[[5,'5개'],[8,'8개'],[10,'10개'],[12,'12개'],[15,'15개']]],
  ['seekMul','술래 속도',[[0.9,'도망자의 0.9배'],[0.95,'0.95배 (기본)'],[1,'도망자와 같게']]],
  ['collect','구슬 수집 시간',[[1.5,'1.5초'],[2,'2초'],[3,'3초']]],
  ['theme','시간대',[['day','낮'],['sunset','노을'],['night','밤']]],
  ['zone','노란 구역 노출',[[true,'켜기'],[false,'끄기']]],
  ['tp','텔레포트 문',[[true,'켜기'],[false,'끄기']]],
  ['radar','술래 레이더',[[true,'켜기'],[false,'끄기']]],
  ['swap','판마다 역할 바꾸기',[[true,'켜기'],[false,'끄기']]],
  ['gun','술래 총',[[false,'끄기'],[true,'켜기']]],
  ['mag','탄창',[[10,'10발'],[5,'5발'],[20,'20발']]],
  ['reload','재장전 (못 움직임)',[[3,'3초'],[5,'5초'],[10,'10초']]],
  ['dmg','피해',[[10,'몸 10 / 머리 15'],[20,'몸 20 / 머리 30'],[34,'몸 34 / 머리 51']]],
  ['kills','목표 처치 수',[[3,'3번'],[1,'1번'],[5,'5번']]]
];
const CFG_SHOW={tag:['mode','map','orbs','seekMul','collect','theme','zone','tp','radar','swap','gun','mag','reload','dmg'],duel:['mode','map','theme','tp','mag','reload','dmg','kills']};
let cfgBuilt=false;
function buildCfgGrid(){
  if(cfgBuilt) return; cfgBuilt=true; const g=$('cfgGrid');
  for(const def of CFG_DEFS){ if(def[0]==='map') def[2]=MAP_LIST.map(m=>[m.id,m.name]); const [key,label,opts]=def;
    const lb=document.createElement('label'); lb.textContent=label; lb.htmlFor='cfg-'+key;
    const sel=document.createElement('select'); sel.className='sel'; sel.id='cfg-'+key;
    opts.forEach(([v,t],i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=t; sel.append(o); });
    sel.addEventListener('change',()=>{ if(!NET.isHost||!L) return; L.cfg[key]=opts[+sel.value][0]; if(key==='theme') applyTheme(L.cfg.theme); if(key==='map') ensureMap(L.cfg.map); broadcast(); });
    lb.id='cfgl-'+key; g.append(lb,sel);
  }
}
function renderLobby(){
  if(!L) return; const host=NET.isHost, me=host?L.host:L.guest, opp=host?L.guest:L.host;
  $('lbCode').textContent=L.code;
  const nt=$('lbNet');
  if(host){ const on=hostOnline(); nt.className='note '+(on?'ok':'err');
    nt.textContent=on?(L.guest?'🟢 방이 열려 있어요.':'🟢 방이 열려 있어요. 링크를 보낸 뒤 꼭 이 화면으로 돌아와서 켜 두세요. 다른 앱에 가 있는 동안은 친구가 들어올 수 없어요.')
      :'🟠 연결 서버와 다시 연결하는 중이에요. 이 화면을 켜 두세요.'; }
  else { nt.className='note ok'; nt.textContent='🟢 방장과 연결됐어요'+(NET.rtt!==null?` (핑 ${NET.rtt}ms)`:''); }
  const slot=(el,p,isHost,isMe)=>{ el.textContent=''; el.classList.toggle('me',!!isMe);
    const nm=document.createElement('span'); nm.className='nm'; const st=document.createElement('span'); st.className='st';
    if(!p){ nm.textContent='기다리는 중…'; st.textContent='친구에게 방 코드를 알려 주세요'; el.append(nm,st); return; }
    nm.textContent=(isHost?'👑 ':'')+p.name+(isMe?' (나)':'');
    const tg=document.createElement('span'); tg.className='tag '+(p.role||'none'); tg.textContent=roleName(p.role);
    st.textContent=isHost?'방장':(p.ready?'준비 완료':'준비 전'); if(!isMe&&NET.rtt!==null) st.textContent+=`, 핑 ${NET.rtt}ms`;
    el.append(nm,st,document.createElement('br'),tg); };
  slot($('slotH'),L.host,true,host); slot($('slotG'),L.guest,false,!host);
  for(const [id,role,who] of [['pickRunner','runner','whoRunner'],['pickSeeker','seeker','whoSeeker']]){
    const b=$(id), mine=me&&me.role===role, theirs=opp&&opp.role===role;
    b.classList.toggle('mine',!!mine); b.classList.toggle('other',!!theirs);
    $(who).textContent=mine?'나':theirs?opp.name:'비어 있음'; b.setAttribute('aria-pressed',String(!!mine)); }
  const duel=L.cfg.mode==='duel', show=CFG_SHOW[duel?'duel':'tag'];
  CFG_DEFS.forEach(([key,,opts])=>{ const sel=$('cfg-'+key); if(!sel) return; const i=opts.findIndex(o=>o[0]===L.cfg[key]); sel.value=String(Math.max(0,i)); sel.disabled=!host;
    let vis=show.includes(key); if(!duel&&['mag','reload','dmg'].includes(key)&&!L.cfg.gun) vis=false; sel.classList.toggle('hidden',!vis); $('cfgl-'+key).classList.toggle('hidden',!vis); });
  $('rolesLabel').classList.toggle('hidden',duel); $('rolesBox').classList.toggle('hidden',duel);
  $('cfgSum').textContent=(host?'방 설정 (방장)':'방 설정 (방장이 정해요)')+'  맵: '+mapName(L.cfg.map);
  const sc=$('score'); sc.textContent=''; if(L.score.h+L.score.g>0){ sc.append(L.host.name+' '); const b=document.createElement('b'); b.textContent=`${L.score.h} : ${L.score.g}`; sc.append(b,' '+(L.guest?L.guest.name:'참가자')); }
  $('shuffleBtn').classList.toggle('hidden',!host||!L.guest); $('kickBtn').classList.toggle('hidden',!host||!L.guest);
  const mb=$('mainBtn');
  const verBad=L.guest&&L.guest.ver!==L.host.ver;
  const rolesOk=duel||(L.guest&&L.host.role&&L.guest.role&&L.host.role!==L.guest.role);
  if(host){ const ok=L.guest&&rolesOk&&L.guest.ready&&!verBad; mb.textContent='게임 시작'; mb.disabled=!ok;
    if(verBad) note('lbNote',`게임 버전이 달라요 (방장 v${L.host.ver}, ${L.guest.name} v${L.guest.ver}). 두 사람 모두 페이지를 새로 고친 뒤 다시 들어와 주세요.`,'err');
    else if(!L.guest) note('lbNote','친구에게 방 코드나 초대 링크를 보내 주세요.');
    else if(!rolesOk) note('lbNote','두 사람 모두 역할을 골라야 해요.');
    else if(!L.guest.ready) note('lbNote',`${L.guest.name}님이 준비하면 시작할 수 있어요.`);
    else note('lbNote','모두 준비됐어요. 게임 시작을 눌러요!','ok'); }
  else { mb.textContent=me&&me.ready?'준비 취소':'준비'; mb.disabled=!(me&&(me.role||duel));
    if(verBad) note('lbNote',`게임 버전이 달라요 (방장 v${L.host.ver}, 나 v${GAME_VERSION}). 두 사람 모두 페이지를 새로 고친 뒤 다시 들어와 주세요.`,'err');
    else if(!duel&&(!me||!me.role)) note('lbNote','역할을 골라 주세요. 방장이 고른 역할은 고를 수 없어요.');
    else if(!me.ready) note('lbNote','준비를 누르면 방장이 게임을 시작할 수 있어요.');
    else note('lbNote','준비 완료! 방장이 시작하기를 기다리는 중이에요.','ok'); }
}
function pickRole(role){
  if(!L) return; SFX.ui();
  if(NET.isHost){ if(L.guest&&L.guest.role===role){ lbNote(`${L.guest.name}님이 이미 ${roleName(role)}를 골랐어요. 역할 섞기를 써 보세요.`,'err'); return; }
    L.host.role=role; if(L.guest){ if(!L.guest.role||L.guest.role===role) L.guest.role=other(role); L.guest.ready=false; } broadcast(); }
  else { if(L.host.role===role){ lbNote(`방장이 이미 ${roleName(role)}를 골랐어요.`,'err'); return; } netSend({t:'role',role}); note('lbNote','역할을 보내는 중이에요…'); }
}
async function hostStart(){
  if(!NET.isHost||!L||!L.guest) return; const duel=L.cfg.mode==='duel'; if(!((duel||(L.host.role&&L.guest.role&&L.host.role!==L.guest.role))&&L.guest.ready)||L.guest.ver!==L.host.ver) return;
  if(!(await ensureMap(L.cfg.map))) return; if(!L||!L.guest) return;
  const M={mid:genCode()+Date.now().toString(36),seed:(Math.random()*1e9)|0,roles:duel?{h:'duel',g:'duel'}:{h:L.host.role,g:L.guest.role},cfg:Object.assign({},L.cfg),names:{h:L.host.name,g:L.guest.name}};
  L.phase='game'; L.round++; netSend({t:'start',M}); broadcast(); startOnline(M);
}
async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(_){ try{ const ta=document.createElement('textarea'); ta.value=t; document.body.append(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok; }catch(__){ return false; } } }
