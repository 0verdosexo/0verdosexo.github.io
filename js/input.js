/* input.js — keyboard + mouse (pointer lock) and touch (joystick, look pad, buttons). Produces one intent object per frame. */
'use strict';
const Input=(()=>{
  const keys=new Set(), pressed=new Set(); let mdx=0, mdy=0, mouseL=false, mouseR=false, wheel=0, locked=false, enabled=false, canvas=null;
  const touch={jx:0,jz:0,jid:null,lid:null,lx:0,ly:0,fire:false,ads:false,btn:new Set(),tapped:new Set(),adsToggle:false};
  const BIND={fwd:['KeyW','ArrowUp'],back:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],jump:['Space'],crouch:['KeyC','ControlLeft'],
    reload:['KeyR'],use:['KeyE'],throw:['KeyG'],special:['KeyF'],swap:['KeyQ'],w1:['Digit1'],w2:['Digit2'],w3:['Digit3'],score:['Tab'],chat:['KeyT','Enter'],radar:['KeyQ'],emote:['KeyV'],walk:['ShiftLeft']};
  const down=a=>BIND[a].some(k=>keys.has(k))||touch.btn.has(a);
  const hit=a=>BIND[a].some(k=>pressed.has(k))||touch.tapped.has(a);
  function init(cv){ canvas=cv;
    addEventListener('keydown',e=>{ if(isTyping(e)) return; if(!enabled) return; if(e.code==='Tab'||e.code==='Space'||e.code.startsWith('Arrow')) e.preventDefault(); if(!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); });
    addEventListener('keyup',e=>{ keys.delete(e.code); });
    addEventListener('blur',()=>{ keys.clear(); mouseL=mouseR=false; });
    cv.addEventListener('mousedown',e=>{ if(!enabled) return; if(!locked&&!isTouch){ requestLock(); return; } if(e.button===0) mouseL=true; if(e.button===2) mouseR=true; });
    addEventListener('mouseup',e=>{ if(e.button===0) mouseL=false; if(e.button===2) mouseR=false; });
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    addEventListener('mousemove',e=>{ if(locked){ mdx+=e.movementX; mdy+=e.movementY; } });
    addEventListener('wheel',e=>{ if(locked) wheel+=Math.sign(e.deltaY); },{passive:true});
    document.addEventListener('pointerlockchange',()=>{ locked=document.pointerLockElement===canvas; Bus.emit('lock',locked); });
  }
  const isTyping=e=>{ const t=e.target; return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'); };
  function requestLock(){ if(isTouch||!canvas||document.body.classList.contains('touch')) return; const plain=()=>{ try{ const q=canvas.requestPointerLock(); if(q&&q.catch) q.catch(()=>{}); }catch(_){} };
    try{ const p=canvas.requestPointerLock({unadjustedMovement:true}); if(p&&p.catch) p.catch(e=>{ if(e&&e.name==='NotSupportedError') plain(); }); }catch(_){ plain(); } }
  function exitLock(){ if(document.pointerLockElement) document.exitPointerLock(); }
  /* ---------- touch controls ---------- */
  function bindTouch(root){
    const joy=root.querySelector('#joy'), knob=root.querySelector('#joyKnob'), look=root.querySelector('#lookPad');
    const jr=()=>joy.getBoundingClientRect();
    joy.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; touch.jid=t.identifier; moveJ(t); },{passive:false});
    const moveJ=t=>{ const r=jr(), cx=r.left+r.width/2, cy=r.top+r.height/2, R=r.width/2; let dx=(t.clientX-cx)/R, dy=(t.clientY-cy)/R; const l=Math.hypot(dx,dy); if(l>1){ dx/=l; dy/=l; }
      touch.jx=dx; touch.jz=dy; knob.style.transform=`translate(${dx*R*0.6}px,${dy*R*0.6}px)`; };
    addEventListener('touchmove',e=>{ for(const t of e.changedTouches){ if(t.identifier===touch.jid) moveJ(t); else if(t.identifier===touch.lid){ mdx+=(t.clientX-touch.lx)*1.6; mdy+=(t.clientY-touch.ly)*1.6; touch.lx=t.clientX; touch.ly=t.clientY; } } },{passive:false});
    const end=e=>{ for(const t of e.changedTouches){ if(t.identifier===touch.jid){ touch.jid=null; touch.jx=touch.jz=0; knob.style.transform=''; } if(t.identifier===touch.lid) touch.lid=null; } };
    addEventListener('touchend',end); addEventListener('touchcancel',end);
    look.addEventListener('touchstart',e=>{ e.preventDefault(); const t=e.changedTouches[0]; touch.lid=t.identifier; touch.lx=t.clientX; touch.ly=t.clientY; },{passive:false});
    root.querySelectorAll('[data-btn]').forEach(b=>{ const a=b.dataset.btn;
      b.addEventListener('touchstart',e=>{ e.preventDefault(); e.stopPropagation(); if(a==='ads'){ touch.adsToggle=!touch.adsToggle; b.classList.toggle('on',touch.adsToggle); return; }
        touch.btn.add(a); touch.tapped.add(a); b.classList.add('on');
        const t=e.changedTouches[0]; if(a==='fire'){ touch.lid=t.identifier; touch.lx=t.clientX; touch.ly=t.clientY; } },{passive:false});
      b.addEventListener('touchend',e=>{ e.preventDefault(); touch.btn.delete(a); b.classList.remove('on'); },{passive:false}); });
  }
  /* sample one frame of intent */
  function sample(){
    const sens=(prefs.sens||1)*0.0022, inv=prefs.invertY?-1:1;
    let mx=0, mz=0; if(down('fwd')) mz-=1; if(down('back')) mz+=1; if(down('left')) mx-=1; if(down('right')) mx+=1;
    mx+=touch.jx; mz+=touch.jz; const l=Math.hypot(mx,mz); if(l>1){ mx/=l; mz/=l; }
    const I={mx,mz,lookX:mdx*sens,lookY:mdy*sens*inv,fire:mouseL||touch.btn.has('fire'),ads:mouseR||touch.adsToggle,jump:down('jump'),jumpHit:hit('jump'),crouch:down('crouch'),crouchHit:hit('crouch'),
      reload:hit('reload'),use:down('use'),useHit:hit('use'),throwHit:hit('throw'),throwDown:down('throw'),special:hit('special'),swap:hit('swap'),w1:hit('w1'),w2:hit('w2'),w3:hit('w3'),wheel,score:down('score'),
      chat:hit('chat'),radar:hit('radar'),emote:hit('emote'),walk:down('walk')};
    mdx=mdy=0; wheel=0; pressed.clear(); touch.tapped.clear(); return I;
  }
  function setEnabled(v){ enabled=v; if(!v){ keys.clear(); mouseL=mouseR=false; touch.btn.clear(); touch.adsToggle=false; } }
  return {init,bindTouch,sample,requestLock,exitLock,setEnabled,get locked(){return locked;},touch,BIND};
})();
