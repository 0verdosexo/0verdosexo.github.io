/* input.js — keyboard + mouse (pointer lock) and touch (joystick, look pad, buttons). Produces one intent object per frame. */
'use strict';
const Input=(()=>{
  /* keys and mouse buttons share one set of "codes": KeyboardEvent.code, Mouse0…Mouse4 (left, wheel click, right, back, forward), WheelUp / WheelDown (one-frame presses) */
  const keys=new Set(), pressed=new Set(), downAt=new Map(); let mdx=0, mdy=0, locked=false, enabled=false, canvas=null;
  /* aim: a short press toggles aiming down the sights, holding raises the gun to the shoulder (견착) until released.
     prefs.adsMode==='hold' keeps the old way (aim while held). The aim button is the right mouse button unless changed. */
  const HOLD_MS=220; let mouseAds=false;
  const touch={jx:0,jz:0,jid:null,lid:null,lx:0,ly:0,fire:false,ads:false,btn:new Set(),tapped:new Set(),adsToggle:false};
  /* every action that can be rebound: [id, name, group, where it works, default codes]. where: all = every mode, battle = battle modes, tag = 술래잡기, range = 훈련장 (also a battle mode) */
  const ACTIONS=[
    ['fwd','앞으로','이동','all',['KeyW','ArrowUp']],['back','뒤로','이동','all',['KeyS','ArrowDown']],['left','왼쪽','이동','all',['KeyA','ArrowLeft']],['right','오른쪽','이동','all',['KeyD','ArrowRight']],
    ['jump','점프','이동','all',['Space']],['crouch','앉기 · 슬라이딩','이동','all',['KeyC','ControlLeft']],['walk','천천히 걷기','이동','all',['ShiftLeft']],
    ['fire','사격','무기','all',['Mouse0']],['ads','조준 (짧게: 전환 · 길게: 견착)','무기','all',['Mouse2']],['reload','재장전','무기','all',['KeyR']],
    ['w1','주무기','무기','battle',['Digit1']],['w2','보조 무기','무기','battle',['Digit2']],['w3','근접 무기','무기','battle',['Digit3']],['swap','직전 무기로','무기','battle',['KeyQ']],
    ['wnext','다음 무기','무기','battle',['WheelDown']],['wprev','이전 무기','무기','battle',['WheelUp']],['inspect','무기 살펴보기','무기','battle',['KeyY']],
    ['throw','투척 무기 (수류탄 · 섬광탄 등)','전술','battle',['KeyG']],['special','필드 장비 (탄약 상자 등)','전술','battle',['KeyF']],['use','상호작용 · 보급 · 폭탄 설치/해체','전술','all',['KeyE']],
    ['score','점수판 (누르는 동안)','기타','all',['Tab']],['chat','채팅','기타','all',['KeyT','Enter']],['emote','감정 표현','기타','all',['KeyV']],
    ['loadout','로드아웃 바꾸기','기타','battle',['KeyL']],['buy','구매 메뉴 · 훈련장 무기 선택','기타','battle',['KeyB']],
    ['radar','레이더 (술래)','술래잡기','tag',['KeyQ']],
    ['dummy','더미 놓기','훈련장','range',['KeyN']],['dmove','더미 동작 바꾸기','훈련장','range',['KeyM']],['dclear','더미 치우기','훈련장','range',['KeyX']],['dreset','기록 초기화','훈련장','range',['KeyZ']]];
  const DEF={}; for(const a of ACTIONS) DEF[a[0]]=a[4];
  const BIND={}; let BOUND=new Set();
  /* prefs.binds keeps only what the player changed ({action:[code,code]}); everything else uses the default */
  function applyBinds(){ const P=prefs.binds&&typeof prefs.binds==='object'?prefs.binds:{};
    for(const a of ACTIONS){ const id=a[0], v=P[id]; BIND[id]=Array.isArray(v)?[...new Set(v.filter(c=>typeof c==='string'&&c))].slice(0,2):DEF[id].slice(); }
    BOUND=new Set(Object.values(BIND).flat()); if(typeof Bus!=='undefined') Bus.emit('binds'); }
  applyBinds();
  /* two actions clash when both can be pressed in the same mode (훈련장 is a battle mode; 술래잡기 and battle never meet) */
  const scopeOf=id=>{ const a=ACTIONS.find(x=>x[0]===id); return a?a[3]:'all'; };
  function clash(a,b){ if(a===b) return false; let x=scopeOf(a), y=scopeOf(b); if(x==='all'||y==='all') return true; if(x==='range') x='battle'; if(y==='range') y='battle'; return x===y; }
  /* set one slot (0/1) of an action; the same code is taken off every action it would clash with. Returns the names it was taken from. */
  function setBind(id,slot,code){ const cur=(BIND[id]||[]).slice(); const took=[];
    if(code){ for(const a of ACTIONS){ const o=a[0]; if(o!==id&&clash(id,o)&&BIND[o].includes(code)){ BIND[o]=BIND[o].filter(c=>c!==code); took.push(a[1]); } } }
    if(code) cur[slot]=code; else cur.splice(slot,1); BIND[id]=[...new Set(cur.filter(Boolean))].slice(0,2);
    saveBinds(); return took; }
  function saveBinds(){ const out={}; for(const a of ACTIONS){ const id=a[0]; if(JSON.stringify(BIND[id])!==JSON.stringify(DEF[id])) out[id]=BIND[id].slice(); }
    if(Object.keys(out).length) prefs.binds=out; else delete prefs.binds; savePrefs(); applyBinds(); }
  function resetBinds(){ delete prefs.binds; savePrefs(); applyBinds(); }
  /* names on screen: long for the settings list, short for the HUD */
  const KEYNAME={Space:'스페이스',Tab:'Tab',Enter:'Enter',Backspace:'Backspace',CapsLock:'CapsLock',ShiftLeft:'왼쪽 Shift',ShiftRight:'오른쪽 Shift',ControlLeft:'왼쪽 Ctrl',ControlRight:'오른쪽 Ctrl',
    AltLeft:'왼쪽 Alt',AltRight:'오른쪽 Alt',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',
    Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Insert:'Insert',Delete:'Delete',Home:'Home',End:'End',PageUp:'PageUp',PageDown:'PageDown',IntlBackslash:'\\',
    Mouse0:'마우스 왼쪽',Mouse1:'휠 클릭',Mouse2:'마우스 오른쪽',Mouse3:'마우스 옆 버튼 (뒤)',Mouse4:'마우스 옆 버튼 (앞)',WheelUp:'휠 위로',WheelDown:'휠 아래로',
    HangulMode:'한/영',Lang1:'한/영',Lang2:'한자',KanaMode:'한/영'};
  const SHORT={Mouse0:'좌클릭',Mouse1:'휠클릭',Mouse2:'우클릭',Mouse3:'마우스4',Mouse4:'마우스5',WheelUp:'휠↑',WheelDown:'휠↓',Space:'Space',ShiftLeft:'Shift',ShiftRight:'R-Shift',ControlLeft:'Ctrl',ControlRight:'R-Ctrl',AltLeft:'Alt',AltRight:'R-Alt'};
  function codeName(c,short){ if(!c) return ''; if(short&&SHORT[c]) return SHORT[c]; if(KEYNAME[c]) return KEYNAME[c];
    let m=c.match(/^Key([A-Z])$/); if(m) return m[1]; m=c.match(/^Digit(\d)$/); if(m) return m[1]; m=c.match(/^Numpad(.+)$/); if(m) return (short?'Num':'숫자패드 ')+({Add:'+',Subtract:'-',Multiply:'*',Divide:'/',Decimal:'.',Enter:'Enter'}[m[1]]||m[1]);
    m=c.match(/^Mouse(\d+)$/); if(m) return '마우스 '+(+m[1]+1); return c; }
  /* the first key of an action, short ("B", "우클릭"), or "—" when nothing is set */
  const keyLabel=id=>{ const b=BIND[id]; return b&&b.length?codeName(b[0],true):'—'; };
  const RESERVED=new Set(['Escape','F1','F5','F11','F12','MetaLeft','MetaRight','OSLeft','OSRight','ContextMenu']);
  const down=a=>(BIND[a]||[]).some(k=>keys.has(k))||touch.btn.has(a);
  const hit=a=>(BIND[a]||[]).some(k=>pressed.has(k))||touch.tapped.has(a);
  const press=c=>{ if(!keys.has(c)){ pressed.add(c); downAt.set(c,performance.now()); } keys.add(c); };
  /* a short press of an aim key toggles the aim (decided when it is let go, so the hold can become 견착 instead) */
  const release=c=>{ const t=downAt.get(c); keys.delete(c); downAt.delete(c);
    if(t!=null&&(BIND.ads||[]).includes(c)&&prefs.adsMode!=='hold'&&performance.now()-t<HOLD_MS&&!(BIND.ads||[]).some(k=>keys.has(k))) mouseAds=!mouseAds; };
  const dropMouse=()=>{ for(const c of [...keys]) if(c.startsWith('Mouse')){ keys.delete(c); downAt.delete(c); } };
  const sideBtn=e=>e.button===3||e.button===4;
  function init(cv){ canvas=cv; applyBinds();
    addEventListener('keydown',e=>{ if(isTyping(e)) return; if(!enabled) return;
      if(e.code==='Tab'||e.code==='Space'||e.code.startsWith('Arrow')||(locked&&BOUND.has(e.code))) e.preventDefault(); press(e.code); });
    addEventListener('keyup',e=>{ release(e.code); });
    addEventListener('blur',()=>{ keys.clear(); downAt.clear(); });
    /* listen on the whole page, not the canvas: the HUD layer sits on top of the canvas, so a click on the screen never reached it.
       If the browser refused the first capture (it does when loading took longer than a few seconds), any click on the play screen captures the mouse now. */
    addEventListener('mousedown',e=>{ if(sideBtn(e)&&document.body.classList.contains('ingame')) e.preventDefault(); if(!enabled) return;
      if(!locked){ if(wantLock(e.target)){ requestLock(); e.preventDefault(); } return; }
      press('Mouse'+e.button); });
    /* the side buttons are "back" / "forward" in a browser: never leave the game page with them */
    addEventListener('mouseup',e=>{ if(sideBtn(e)&&document.body.classList.contains('ingame')) e.preventDefault(); release('Mouse'+e.button); });
    addEventListener('auxclick',e=>{ if(sideBtn(e)&&document.body.classList.contains('ingame')) e.preventDefault(); });
    addEventListener('contextmenu',e=>{ if(document.body.classList.contains('ingame')&&!isTyping(e)) e.preventDefault(); });
    addEventListener('mousemove',e=>{ if(locked){ mdx+=e.movementX; mdy+=e.movementY; } });
    addEventListener('wheel',e=>{ if(locked&&e.deltaY) pressed.add(e.deltaY<0?'WheelUp':'WheelDown'); },{passive:true});
    document.addEventListener('pointerlockchange',()=>{ locked=document.pointerLockElement===canvas; if(!locked){ dropMouse(); mouseAds=false; mdx=mdy=0; } Bus.emit('lock',locked); });
    document.addEventListener('pointerlockerror',()=>{ Bus.emit('lockfail'); });
  }
  /* may a click on this element capture the mouse? only on the bare play screen, never on menus, buttons or text boxes */
  function wantLock(t){ if(isTouch||document.body.classList.contains('touch')||!document.body.classList.contains('ingame')) return false;
    if(typeof UI!=='undefined'&&UI.overlayOpen()) return false; if(typeof Game!=='undefined'&&(!Game.active||Game.state==='end'||Game.state==='loading')) return false;
    return !(t&&t.closest&&t.closest('button,input,textarea,select,a,#pause,#result,#hBoard,#loading')); }
  const isTyping=e=>{ const t=e.target; return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'); };
  function requestLock(){ if(isTouch||!canvas||document.body.classList.contains('touch')) return; const plain=()=>{ try{ const q=canvas.requestPointerLock(); if(q&&q.catch) q.catch(()=>{}); }catch(_){} };
    try{ const p=canvas.requestPointerLock({unadjustedMovement:true}); if(p&&p.catch) p.catch(e=>{ if(e&&e.name==='NotSupportedError') plain(); else Bus.emit('lockfail'); }); }catch(_){ plain(); } }
  function exitLock(){ if(document.pointerLockElement) document.exitPointerLock(); }
  /* ---------- touch controls ---------- */
  function bindTouch(root){
    const joy=root.querySelector('#joy'), knob=root.querySelector('#joyKnob'), look=root.querySelector('#lookPad'), zone=root.querySelector('#joyZone');
    const jr=()=>joy.getBoundingClientRect();
    /* floating stick: it jumps to wherever the left thumb lands, and returns home on release */
    const editing=()=>document.body.classList.contains('le-edit');
    const grab=e=>{ if(editing()) return; e.preventDefault(); if(touch.jid!=null) return; const t=e.changedTouches[0]; touch.jid=t.identifier;
      const R=joy.offsetWidth/2, x=clamp(t.clientX,R+6,innerWidth*0.45), y=clamp(t.clientY,R+6,innerHeight-R-6);
      joy.style.left=(x-R)+'px'; joy.style.bottom=(innerHeight-y-R)+'px'; joy.classList.add('act'); moveJ(t); };
    joy.addEventListener('touchstart',grab,{passive:false}); if(zone) zone.addEventListener('touchstart',grab,{passive:false});
    const moveJ=t=>{ const r=jr(), cx=r.left+r.width/2, cy=r.top+r.height/2, R=r.width/2; let dx=(t.clientX-cx)/R, dy=(t.clientY-cy)/R; const l=Math.hypot(dx,dy); if(l>1){ dx/=l; dy/=l; }
      touch.jx=dx; touch.jz=dy; knob.style.transform=`translate(${dx*R*0.6}px,${dy*R*0.6}px)`; };
    addEventListener('touchmove',e=>{ for(const t of e.changedTouches){ if(t.identifier===touch.jid) moveJ(t); else if(t.identifier===touch.lid){ mdx+=(t.clientX-touch.lx)*1.6; mdy+=(t.clientY-touch.ly)*1.6; touch.lx=t.clientX; touch.ly=t.clientY; } } },{passive:false});
    const end=e=>{ for(const t of e.changedTouches){ if(t.identifier===touch.jid){ touch.jid=null; touch.jx=touch.jz=0; knob.style.transform=''; joy.style.left=joy.dataset.homeL||''; joy.style.bottom=joy.dataset.homeB||''; joy.classList.remove('act'); } if(t.identifier===touch.lid) touch.lid=null; } };
    addEventListener('touchend',end); addEventListener('touchcancel',end);
    look.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; touch.lid=t.identifier; touch.lx=t.clientX; touch.ly=t.clientY; },{passive:false});
    root.querySelectorAll('[data-btn]').forEach(b=>{ const a=b.dataset.btn;
      b.addEventListener('touchstart',e=>{ if(editing()) return; e.preventDefault(); e.stopPropagation(); if(a==='ads'){ touch.adsToggle=!touch.adsToggle; b.classList.toggle('on',touch.adsToggle); return; }
        touch.btn.add(a); touch.tapped.add(a); b.classList.add('on');
        const t=e.changedTouches[0]; if(a==='fire'){ touch.lid=t.identifier; touch.lx=t.clientX; touch.ly=t.clientY; } },{passive:false});
      const up=e=>{ if(editing()) return; e.preventDefault(); b.classList.remove('on'); if(!root.querySelector(`[data-btn="${a}"].on`)) touch.btn.delete(a); };
      b.addEventListener('touchend',up,{passive:false}); b.addEventListener('touchcancel',up,{passive:false}); });
  }
  /* sample one frame of intent */
  function sample(){
    const sens=(prefs.sens||1)*0.0022, inv=prefs.invertY?-1:1;
    let mx=0, mz=0; if(down('fwd')) mz-=1; if(down('back')) mz+=1; if(down('left')) mx-=1; if(down('right')) mx+=1;
    mx+=touch.jx; mz+=touch.jz; const l=Math.hypot(mx,mz); if(l>1){ mx/=l; mz/=l; }
    let ads=touch.adsToggle, shoulder=false; const aimHeld=(BIND.ads||[]).some(k=>keys.has(k));
    if(prefs.adsMode==='hold') ads=ads||aimHeld;
    else { const t0=Math.min(...(BIND.ads||[]).filter(k=>keys.has(k)).map(k=>downAt.get(k)||Infinity));
      if(aimHeld&&isFinite(t0)&&performance.now()-t0>=HOLD_MS){ shoulder=true; mouseAds=false; } ads=ads||mouseAds; }
    const wheel=hit('wnext')?1:hit('wprev')?-1:0;
    const I={mx,mz,lookX:mdx*sens,lookY:mdy*sens*inv,fire:down('fire'),ads,shoulder:shoulder&&!ads,jump:down('jump'),jumpHit:hit('jump'),crouch:down('crouch'),crouchHit:hit('crouch'),
      reload:hit('reload'),use:down('use'),useHit:hit('use'),throwHit:hit('throw'),throwDown:down('throw'),special:hit('special'),swap:hit('swap'),w1:hit('w1'),w2:hit('w2'),w3:hit('w3'),wheel,score:down('score'),
      chat:hit('chat'),radar:hit('radar'),emote:hit('emote'),walk:down('walk'),inspect:hit('inspect'),loadout:hit('loadout'),buy:hit('buy'),dummy:hit('dummy'),dmove:hit('dmove'),dclear:hit('dclear'),dreset:hit('dreset')};
    mdx=mdy=0; pressed.clear(); touch.tapped.clear(); return I;
  }
  function setEnabled(v){ enabled=v; if(!v){ keys.clear(); downAt.clear(); mouseAds=false; touch.btn.clear(); touch.adsToggle=false; } }
  /* the mouse aim toggle switches off on reload, weapon change and death, like most shooters */
  function adsOff(){ mouseAds=false; }
  return {init,bindTouch,sample,requestLock,exitLock,setEnabled,adsOff,get locked(){return locked;},touch,BIND,ACTIONS,DEF,setBind,resetBinds,applyBinds,clash,codeName,keyLabel,RESERVED};
})();
