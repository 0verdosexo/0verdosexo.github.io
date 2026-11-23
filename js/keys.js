/* keys.js — 키 설정 screen. Every rebindable action (Input.ACTIONS) gets two slots: click a slot, then press a key, a mouse button
   (left, wheel click, right, the two side buttons) or turn the wheel. Esc cancels, Backspace / Delete clears the slot.
   A key that another action already uses (in a mode where both work) moves to the new action and the note says where it came from.
   On-screen key names ([data-key] elements and the HUD texts) follow the bindings. */
'use strict';
const KeysUI=(()=>{
  let cap=null, swallow=false;
  const note=(t,bad)=>{ const n=$('keysNote'); if(!n) return; n.textContent=t||DEFAULT_NOTE; n.classList.toggle('bad',!!bad); n.classList.toggle('hl',!!t&&!bad); };
  const DEFAULT_NOTE='바꿀 칸을 누른 다음 키보드 키, 마우스 버튼, 휠을 움직여요. 한 동작에 두 개까지 정할 수 있어요.';
  function render(){ const box=$('keysList'); if(!box) return; let g='', h='';
    for(const [id,name,grp] of Input.ACTIONS){
      if(grp!==g){ if(g) h+='</div>'; g=grp; h+=`<h3>${esc(grp)}</h3><div class="kb-grp">`; }
      const b=Input.BIND[id]||[], changed=JSON.stringify(b)!==JSON.stringify(Input.DEF[id]);
      h+=`<div class="kb-row${changed?' changed':''}${b.length?'':' none'}" data-id="${id}"><span class="kb-name">${esc(name)}${b.length?'':'<em>키 없음</em>'}</span>`+
        [0,1].map(i=>`<button class="kb-slot${b[i]?'':' empty'}" data-slot="${i}">${b[i]?esc(Input.codeName(b[i])):'—'}</button>`).join('')+`</div>`; }
    box.innerHTML=h+(g?'</div>':'');
    box.querySelectorAll('.kb-slot').forEach(btn=>btn.onclick=e=>{ e.stopPropagation(); start(btn.closest('.kb-row').dataset.id,+btn.dataset.slot,btn); }); }
  function start(id,slot,btn){ stop(); cap={id,slot}; btn.classList.add('wait'); btn.textContent='누르세요…';
    note('키보드 키 · 마우스 버튼 · 휠 · Esc 취소 · Backspace 지우기'); Sfx.play('click'); }
  function stop(){ if(!cap) return; cap=null; render(); }
  function finish(code){ const c=cap; cap=null; if(!c){ return; }
    if(code==null){ render(); note(''); return; }
    if(code===''){ Input.setBind(c.id,c.slot,''); render(); note('지웠어요'); return; }
    if(Input.RESERVED.has(code)){ render(); note(`${Input.codeName(code)} 키는 쓸 수 없어요 (게임·브라우저가 써요)`,true); Sfx.play('deny'); return; }
    const took=Input.setBind(c.id,c.slot,code); render(); Sfx.play('collect',{rate:1.4});
    note(took.length?`${Input.codeName(code)} — '${took.join("', '")}'에서 옮겨 왔어요`:`${Input.codeName(code)} 키로 정했어요`); }
  function reset(){ cap=null; Input.resetBinds(); render(); note('모두 기본값으로 되돌렸어요'); }
  /* names on screen follow the bindings */
  function refreshHints(){ document.querySelectorAll('[data-key]').forEach(e=>{ e.textContent=Input.keyLabel(e.dataset.key); }); }
  function init(){
    const r=$('keysReset'); if(r) r.onclick=()=>reset();
    /* capture phase on window: while a slot waits, nothing else (the game, menus, the buy menu) sees the key or click */
    addEventListener('keydown',e=>{ if(!cap) return; e.preventDefault(); e.stopImmediatePropagation();
      if(e.code==='Escape') finish(null); else if(e.code==='Backspace'||e.code==='Delete') finish(''); else finish(e.code); },true);
    /* the press that sets a mouse button must not also click what is under the pointer (the back button, another slot) or open a menu */
    addEventListener('mousedown',e=>{ if(!cap) return; e.preventDefault(); e.stopImmediatePropagation(); swallow=true; finish('Mouse'+e.button); },true);
    const eat=e=>{ if(swallow||cap){ e.preventDefault(); e.stopImmediatePropagation(); } };
    addEventListener('mouseup',e=>{ eat(e); if(swallow) setTimeout(()=>{ swallow=false; },0); },true);
    for(const t of ['click','auxclick','contextmenu']) addEventListener(t,eat,true);
    addEventListener('wheel',e=>{ if(!cap||!e.deltaY) return; e.preventDefault(); e.stopImmediatePropagation(); finish(e.deltaY<0?'WheelUp':'WheelDown'); },{capture:true,passive:false});
    Bus.on('binds',refreshHints); refreshHints(); }
  return {init,render,stop,refreshHints,get capturing(){ return !!cap; }};
})();
