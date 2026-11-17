/* main.js — start-up: renderer, input, menus, version label, ?room= links. */
'use strict';
(async()=>{
  const cv=$('c');
  if(!prefs.gfx) prefs.gfx=isTouch?'medium':'high';
  QUALITY=QUALITY_PRESETS[prefs.gfx]||QUALITY_PRESETS.high;
  try{ R.init(cv); }catch(e){ $('bootErr').textContent='WebGL을 시작할 수 없어요. 브라우저의 하드웨어 가속을 켜 주세요.'; $('bootErr').style.display='block'; return; }
  Input.init(cv); Input.bindTouch($('touch')); UI.init();
  const SIM=new URLSearchParams(location.search).get('sim'); if(SIM){ runSim(SIM); return; }
  addEventListener('pointerdown',()=>Sfx.unlock(),{once:true}); addEventListener('keydown',()=>Sfx.unlock(),{once:true});
  Bus.on('load-progress',p=>{ if($('loading').classList.contains('on')&&p.pending) $('loadBar').style.width=''; });
  UI.show('main',false); UI.showLoading(true,'맵 불러오는 중…');
  const NOBG=new URLSearchParams(location.search).get('nobg'); if(NOBG) UI.menuMap=async()=>{};
  if(new URLSearchParams(location.search).get('norender')){ const r0=R.render; R.render=()=>{ if(window.__renderOnce){ window.__renderOnce=false; r0(); } }; }
  prefs.tag.map=SandTag.okMap(prefs.tag.map); prefs.battle.map=SandTag.okMap(prefs.battle.map);
  await UI.menuMap(prefs.battle.map); UI.showLoading(false);
  if(!prefs.name){ prefs.name='플레이어'+String((Math.random()*900+100)|0); savePrefs(); $('mName').value=prefs.name; }
  const room=new URLSearchParams(location.search).get('room'); if(room){ history.replaceState(null,'',location.pathname); setTimeout(()=>{ $('joinCode').value=room; $('joinBtn').click(); },300); }
  window.addEventListener('beforeunload',()=>{ if(Net.connected) Net.leave(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden&&Game.active&&!Game.online&&Game.state==='live'){ Game.paused=true; $('pause').classList.add('on'); } });
})();

/* automated match for tests: ?sim=kind:mode:map:players:seconds[:meBot] */
async function runSim(spec){
  const [kind,mode,map,n,secs,human]=spec.split(':'); const N=+n||8, S=+secs||60;
  Game._noLoop=true; const errs=[]; window.addEventListener('error',e=>errs.push(String(e.message)));
  const origErr=console.error; console.error=(...a)=>{ errs.push(a.map(String).join(' ').slice(0,300)); origErr(...a); };
  const players=[{id:'me',name:'나',owner:'me',bot:human!=='1',diff:'hard',team:0,load:myLoad()}];
  for(let i=1;i<N;i++) players.push({id:'b'+i,name:Bots.botName(i),bot:true,owner:'me',diff:['easy','normal','hard'][i%3],team:i%2,load:UI.randomLoadout()});
  let setup; if(kind==='tag'){ players.forEach((p,i)=>p.role=i<seekerCount(N)?'seek':'run'); if(new URLSearchParams(location.search).get('meRun')) { players[0].role='run'; players[N-1].role='seek'; } setup={kind:'tag',map,players,cfg:{diff:'normal',seekerGun:new URLSearchParams(location.search).get('gun')==='1',time:10}}; }
  else setup={kind:'battle',mode,map,players,cfg:{diff:'normal'}};
  Object.assign(setup,{host:true,online:false,myId:'me',meId:'me',seed:12345});
  await Game.start(setup);
  if(new URLSearchParams(location.search).get('dbg')){ const H=Game.handle; Game.handle=function(t,d,f){ const r=H.call(this,t,d,f); for(const a of Game.actors) if(!isFinite(a.hp)&&!a._nanRep){ a._nanRep=1; errs.push('NaN hp after '+t+' '+JSON.stringify(d).slice(0,200)); } return r; };
    const U=window.updateProjs; window.updateProjs=function(dt){ const snap=Game.projs.map(P=>({id:P.id,k:P.k,x:P.x,y:P.y,z:P.z,vx:P.vx,vy:P.vy,vz:P.vz,st:P.stuck,t:P.t})); U(dt); for(const P of Game.projs){ if(!isFinite(P.x)&&!P._rep){ P._rep=1; errs.push('NaN proj '+JSON.stringify(snap.find(q=>q.id===P.id))); } } };
    const S=Game._step; Game._step=(dt,r)=>{ S(dt,r); for(const a of Game.actors) if(!isFinite(a.hp)&&!a._nanRep){ a._nanRep=1; errs.push('NaN hp in step '+a.name+' maxHp '+a.maxHp+' load '+JSON.stringify(a.load)); } }; }
  Game._prof={bots:0,mode:0,avatars:0,fx:0,hud:0,n:0}; const t0=performance.now(); let f=0; const shots=+new URLSearchParams(location.search).get('shots')||0; window.__frames=[];
  for(;f<S*30;f++){ Game._step(1/30,false); if(Game.state==='end') break; if(shots&&f>0&&f%Math.floor(S*30/shots)===0){ Game._step(1/30,true); Game._step(1/30,true); window.__shotReady=(window.__shotReady||0)+1; while((window.__shotAck||0)<window.__shotReady) await new Promise(r=>setTimeout(r,50)); } if(f%300===0) await new Promise(r=>setTimeout(r,0)); }
  Game._step(1/30,true);
  R.scene.traverse(o=>{ const g=o.geometry; if(!g||!g.attributes||!g.attributes.position) return; const a=g.attributes.position.array; for(let i=0;i<a.length;i++) if(!isFinite(a[i])){ errs.push('NaN geo: '+o.type+' '+(o.name||'')+' '+(o.material&&o.material.name||'')+' parent '+(o.parent&&o.parent.type)); break; } });
  const M=kind==='tag'?Tag.info():Modes.info();
  window.__sim={prof:Object.fromEntries(Object.entries(Game._prof).map(([k,v])=>[k,+(v/Game._prof.n).toFixed(2)])),frames:f,simSec:+(f/30).toFixed(1),ms:Math.round(performance.now()-t0),state:Game.state,result:Game.result,errs:errs.slice(0,20),
    score:M&&M.score, tag:kind==='tag'?{orbs:M.orbs.filter(o=>o.taken).length+'/'+M.orbs.length,door:M.door,esc:M.escaped,jailed:Game.actors.filter(a=>a.jailed).length}:null,
    actors:Game.actors.map(a=>({n:a.name,t:a.team,r:a.role,k:a.kills,d:a.deaths,s:a.score,hp:Math.round(a.hp),alive:a.alive,pos:[a.x|0,+a.y.toFixed(1),a.z|0],cp:a.pkCp}))};
  window.__ready=true;
}
/* version label: click for the change log; check for a newer deploy every 5 minutes */
(()=>{ const v=$('ver'); v.style.pointerEvents='auto'; v.style.cursor='pointer'; v.title='업데이트 내역';
  v.onclick=()=>{ if(Game.active) return; UI.toast(GAME_CHANGES.slice(0,3).map(c=>'v'+c[0]+' — '+c[1]).join('\n'),7000); };
  setInterval(()=>{ if(document.hidden) return; fetch('js/version.js?t='+Date.now(),{cache:'no-store'}).then(r=>r.text()).then(t=>{ const m=t.match(/GAME_VERSION='([^']+)'/); if(m&&m[1]!==GAME_VERSION){ v.textContent='v'+GAME_VERSION+' → 새 버전 v'+m[1]+' (새로고침)'; v.style.color='#ff8a1f'; v.onclick=()=>location.reload(); } }).catch(()=>{}); },300000); })();
