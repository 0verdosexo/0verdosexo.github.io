/* net.js — online rooms: lobby (players, settings, chat, ready), room browser, match start and in-game message routing.
   The host is authoritative for lobby and match rules; every client simulates its own player. */
'use strict';
const Net=(()=>{
  /* T = the way rooms reach each other (relay.js): our relay server when one is set, else public MQTT brokers */
  const T=Relay.T; let C=null, code=null, myId=uid(8), host=false, room=null, lastHost=0, hb=0, connected=false, stopBrowseFn=null, reHello=0;
  const lobbyT={hello:1,lobby:1,ready:1,pref:1,kick:1,full:1,bye:1,ping:1,start:1,back:1,setreq:1,takeover:1};
  /* how long a silent player is kept. Our relay server reports a dropped connection itself (a "bye" 8 s after the socket closed),
     so there the timers are only a fallback for a frozen app; public MQTT brokers report nothing, so they stay short there. */
  const LIM=T.kind==='server'?{lobby:45000,game:45000,load:90000,host:45000}:{lobby:12000,game:20000,load:60000,host:15000};
  /* ---------- host a room ---------- */
  async function create(game,settings){
    leave(); host=true; let err=null;
    for(let i=0;i<T.tries;i++){ code=T.newCode(i);
      try{ C=await T.open(code,{host:true,id:myId}); break; }catch(e){ err=e; C=null; } }
    if(!C) throw err||new Error('온라인 서버에 연결할 수 없어요');
    room={code,game,host:myId,settings:Object.assign({},settings),players:[me()],started:false};
    C.onmsg=onMsg; connected=true; advertise(); startHB(); Bus.emit('lobby',room); return room;
  }
  function me(){ return {id:myId,name:prefs.name||'플레이어',ready:false,team:0,pref:'any',load:myLoad(),ch:prefs.char?1:0,t:Date.now()}; }
  /* ---------- join ---------- */
  async function join(c){
    leave(); host=false; code=c.toUpperCase().trim(); if(code.length!==5) throw new Error('코드는 5글자예요');
    C=await T.open(code,{host:false,id:myId}); C.onmsg=onMsg; connected=true; lastHost=Date.now();
    return new Promise((res,rej)=>{ let tries=0; const iv=setInterval(()=>{ if(room){ clearInterval(iv); startHB(); res(room); return; } if(++tries>8){ clearInterval(iv); rej(new Error('방을 찾을 수 없어요. 코드를 확인해 주세요')); return; }
      send('hello',{p:me(),v:GAME_VERSION}); },900); send('hello',{p:me(),v:GAME_VERSION}); Net._joinRej=e=>{ clearInterval(iv); rej(e); }; });
  }
  /* chat from others: plain text only (a "system" line can only come from this game itself) */
  const cleanChat=d=>({n:String(d&&d.n||'').slice(0,20),m:String(d&&d.m||'').slice(0,200)});
  function leave(){ if(C){ C.onmsg=null; /* messages still arriving on the old room must not count for the next one */ if(host&&code){ T.advertise(C,null); send('bye',{}); } else if(code) send('bye',{}); setTimeout(((c)=>()=>T.close(c))(C),300); }
    C=null; code=null; room=null; host=false; connected=false; clearInterval(hb); }
  function send(t,d,volatile){ if(!C) return; T.send(C,{f:myId,t,d},volatile); }
  /* ---------- messages ---------- */
  function onMsg(m){ if(!m||m.f===myId) return; const {t,d,f}=m;
    if(room&&f===room.host) lastHost=Date.now();
    if(host&&room){ const p=room.players.find(x=>x.id===f); if(p) p.t=Date.now(); }
    if(t==='chat'){ if(room) Bus.emit('chat',cleanChat(d)); return; }
    if(lobbyT[t]) return lobbyMsg(t,d,f);
    if(Game.active&&room&&room.started) Game.handle(t,d,f);
  }
  function lobbyMsg(t,d,f){
    if(host){
      const p=room.players.find(x=>x.id===f); if(p) p.t=Date.now();
      if(t==='hello'){ if(room.started&&!p){ send('full',{to:f,why:'이미 게임이 진행 중이에요'}); return; }
        if(!p){ if(room.players.length>=room.settings.cap){ send('full',{to:f,why:'방이 가득 찼어요'}); return; } const np=Object.assign(d.p||{},{id:f,t:Date.now(),ready:false}); np.name=cleanName(np.name||'플레이어'); np.team=autoTeam(); room.players.push(np); Bus.emit('chat',{sys:1,m:`${esc(np.name)} 님이 들어왔어요`}); }
        pushLobby(); }
      if(t==='ready'&&p){ p.ready=!!d.r; pushLobby(); }
      if(t==='pref'&&p){ if(d.name) p.name=cleanName(d.name); if(d.pref) p.pref=d.pref; if(d.team!=null&&room.settings.swapOk!==false) p.team=d.team?1:0; if(d.load) p.load=d.load; pushLobby(); }
      if(t==='bye'&&p){ dropPlayer(f); }
    } else {
      if(t==='lobby'){ room=d; Bus.emit('lobby',room); if(Net._joined!==code){ Net._joined=code; }
        /* the host lost us (our app was asleep for a while): ask to be let in again */
        if(!d.started&&!d.players.some(p=>p.id===myId)&&Date.now()-reHello>2000){ reHello=Date.now(); send('hello',{p:me(),v:GAME_VERSION}); } }
      if(t==='full'&&d.to===myId){ Net._joinRej&&Net._joinRej(new Error(d.why)); leave(); Bus.emit('kicked',d.why); }
      if(t==='kick'&&d.to===myId){ leave(); Bus.emit('kicked','방장이 내보냈어요'); }
      if(t==='start'){ room&&(room.started=true); Bus.emit('netstart',d); }
      if(t==='back'){ if(room){ room.started=false; } Bus.emit('netback',d); }
      if(t==='bye'&&room&&f===room.host){ Bus.emit('hostleft'); }
      if(t==='takeover'){ Game.handle('takeover',d,f); }
    }
    if(t==='ping'&&host){ /* timestamps updated above */ }
  }
  function autoTeam(){ const n0=room.players.filter(p=>p.team===0).length, n1=room.players.length-n0; return n0<=n1?0:1; }
  function dropPlayer(id){ const i=room.players.findIndex(x=>x.id===id); if(i<0) return; const p=room.players[i]; room.players.splice(i,1); Bus.emit('chat',{sys:1,m:`${esc(p.name)} 님이 나갔어요`});
    if(room.started&&Game.active){ const a=Game.byId.get(id); if(a){ a.owner=myId; a.local=true; a.bot=true; a.diff=room.settings.diff||'normal'; send('takeover',{a:id}); } }
    pushLobby(); }
  function pushLobby(){ if(!host) return; send('lobby',room); advertise(); Bus.emit('lobby',room); }
  function advertise(){ if(!host||!C) return; T.advertise(C,{code,name:prefs.name,game:room.game,mode:room.settings.mode,map:room.settings.map,n:room.players.length,max:room.settings.cap,started:room.started,ts:Date.now(),v:GAME_VERSION}); }
  function startHB(){ clearInterval(hb); hb=setInterval(()=>{ if(!C) return;
    if(host){ advertise(); const now=Date.now(); const lim=room.started?(now-(room.startAt||0)<60000?LIM.load:LIM.game):LIM.lobby;
      for(const p of room.players.slice()) if(p.id!==myId&&now-p.t>lim) dropPlayer(p.id); if(!room.started) send('lobby',room); }
    /* a guest says "still here" every 2.5 s, also while it sits on the loadout screen or types in the chat */
    else { send('ping',{}); if(lastHost&&Date.now()-lastHost>(Game.active?(Game.state==='loading'||Game.t<20?LIM.load:LIM.host):LIM.host)){ Bus.emit('hostleft'); } } },2500); }
  /* ---------- host controls ---------- */
  function setSettings(s){ if(!host) return; Object.assign(room.settings,s); if(room.players.length>room.settings.cap) room.settings.cap=room.players.length; pushLobby(); }
  function setMine(o){ if(host){ const p=room.players.find(x=>x.id===myId); Object.assign(p,o); if(o.team!=null) p.team=o.team?1:0; pushLobby(); } else send('pref',o); }
  function setReady(r){ if(host) return; send('ready',{r}); }
  function kick(id){ if(!host) return; send('kick',{to:id}); dropPlayer(id); }
  function startMatch(setup){ if(!host) return; room.started=true; room.startAt=Date.now(); for(const p of room.players) p.t=Date.now(); send('start',setup); advertise(); }
  function backToLobby(){ if(!host) return; room.started=false; for(const p of room.players) p.ready=false; send('back',{}); pushLobby(); }
  /* ---------- room browser ---------- */
  async function browse(onList){ stopBrowse(); const rooms=new Map(); const emit=()=>{ const now=Date.now(); onList([...rooms.values()].filter(r=>r&&now-r.ts<25000&&r.v&&r.v.split('.')[0]===GAME_VERSION.split('.')[0]).sort((a,b)=>b.ts-a.ts)); };
    stopBrowseFn=T.browse((k,d)=>{ if(!d) rooms.delete(k); else rooms.set(k,d); emit(); });
    setTimeout(emit,2500); }
  function stopBrowse(){ if(stopBrowseFn){ stopBrowseFn(); stopBrowseFn=null; } }
  return {create,join,leave,send,setSettings,setMine,setReady,kick,startMatch,backToLobby,browse,stopBrowse,
    get connected(){ return connected; },get host(){ return host; },get room(){ return room; },get code(){ return code; },get myId(){ return myId; },get via(){ return T.kind; }};
})();
