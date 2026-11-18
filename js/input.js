/* input.js — keyboard + mouse (pointer lock) and touch (joystick, look pad, buttons). Produces one intent object per frame. */
'use strict';
const Input=(()=>{
  const keys=new Set(), pressed=new Set(); let mdx=0, mdy=0, mouseL=false, mouseR=false, wheel=0, locked=false, enabled=false, canvas=null;
  /* right mouse button: a short click toggles aiming down the sights, holding it raises the gun to the shoulder (견착) until released.
     prefs.adsMode==='hold' keeps the old way (aim while held). */
  const HOLD_MS=220; let rDown=0, mouseAds=false;
  const touch={jx:0,jz:0,jid:null,lid:null,lx:0,ly:0,fire:false,ads:false,btn:new Set(),tapped:new Set(),adsToggle:false};
  const BIND={fwd:['KeyW','ArrowUp'],back:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],jump:['Space'],crouch:['KeyC','ControlLeft'],
    reload:['KeyR'],use:['KeyE'],throw:['KeyG'],special:['KeyF'],swap:['KeyQ'],w1:['Digit1'],w2:['Digit2'],w3:['Digit3'],score:['Tab'],chat:['KeyT','Enter'],radar:['KeyQ'],emote:['KeyV'],walk:['ShiftLeft'],inspect:['KeyY']};
  const down=a=>BIND[a].some(k=>keys.has(k))||touch.btn.has(a);
  const hit=a=>BIND[a].some(k=>pressed.has(k))||touch.tapped.has(a);
  function init(cv){ canvas=cv;
    addEventListener('keydown',e=>{ if(isTyping(e)) return; if(!enabled) return; if(e.code==='Tab'||e.code==='Space'||e.code.startsWith('Arrow')) e.preventDefault(); if(!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); });
    addEventListener('keyup',e=>{ keys.delete(e.code); });
    addEventListener('blur',()=>{ keys.clear(); mouseL=mouseR=false; rDown=0; });
    /* listen on the whole page, not the canvas: the HUD layer sits on top of the canvas, so a click on the screen never reached it.
       If the browser refused the first capture (it does when loading took longer than a few seconds), any click on the play screen captures the mouse now. */
    addEventListener('mousedown',e=>{ if(!enabled) return;
      if(!locked){ if(wantLock(e.target)){ requestLock(); e.preventDefault(); } return; }
      if(e.button===0) mouseL=true; if(e.button===2){ mouseR=true; rDown=e.timeStamp||performance.now(); } });
    addEventListener('mouseup',e=>{ if(e.button===0) mouseL=false;
      if(e.button===2){ if(mouseR&&rDown&&(e.timeStamp||performance.now())-rDown<HOLD_MS&&prefs.adsMode!=='hold') mouseAds=!mouseAds; mouseR=false; rDown=0; } });
    addEventListener('contextmenu',e=>{ if(document.body.classList.contains('ingame')&&!isTyping(e)) e.preventDefault(); });
    addEventListener('mousemove',e=>{ if(locked){ mdx+=e.movementX; mdy+=e.movementY; } });
    addEventListener('wheel',e=>{ if(locked) wheel+=Math.sign(e.deltaY); },{passive:true});
    document.addEventListener('pointerlockchange',()=>{ locked=document.pointerLockElement===canvas; if(!locked){ mouseL=mouseR=false; rDown=0; mouseAds=false; mdx=mdy=0; } Bus.emit('lock',locked); });
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
    let ads=touch.adsToggle, shoulder=false;
    if(prefs.adsMode==='hold') ads=ads||mouseR;
    else { if(mouseR&&rDown&&performance.now()-rDown>=HOLD_MS){ shoulder=true; mouseAds=false; } ads=ads||mouseAds; }
    const I={mx,mz,lookX:mdx*sens,lookY:mdy*sens*inv,fire:mouseL||touch.btn.has('fire'),ads,shoulder:shoulder&&!ads,jump:down('jump'),jumpHit:hit('jump'),crouch:down('crouch'),crouchHit:hit('crouch'),
      reload:hit('reload'),use:down('use'),useHit:hit('use'),throwHit:hit('throw'),throwDown:down('throw'),special:hit('special'),swap:hit('swap'),w1:hit('w1'),w2:hit('w2'),w3:hit('w3'),wheel,score:down('score'),
      chat:hit('chat'),radar:hit('radar'),emote:hit('emote'),walk:down('walk'),inspect:hit('inspect')};
    mdx=mdy=0; wheel=0; pressed.clear(); touch.tapped.clear(); return I;
  }
  function setEnabled(v){ enabled=v; if(!v){ keys.clear(); mouseL=mouseR=false; rDown=0; mouseAds=false; touch.btn.clear(); touch.adsToggle=false; } }
  /* the mouse aim toggle switches off on reload, weapon change and death, like most shooters */
  function adsOff(){ mouseAds=false; }
  return {init,bindTouch,sample,requestLock,exitLock,setEnabled,adsOff,get locked(){return locked;},touch,BIND};
})();
