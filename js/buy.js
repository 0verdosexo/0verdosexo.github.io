/* buy.js — the CS2-style buy menu: prices, kill rewards, the economy numbers, and the menu overlay.
   Search & destroy uses it with money; the training range uses the same menu with everything free.
   The menu only shows things and reports a pick; the mode decides what a pick does (ctx.pick). */
'use strict';
/* economy (search & destroy) — numbers from the CS2 rules the game follows; tune here */
const ECON={start:800,max:16000,win:{elim:3250,time:3250,bomb:3500,defuse:3500},loss:[1400,1900,2400,2900,3400],lossStart:1,
  plantTeam:800,plant:300,defuse:300,teamkill:-300,half:4,winAt:5,freeze:10,buyTime:25,roundTime:100,defaultPistol:'p1912'};
const PRICE={p1912:200,burst9:300,auto75:500,revolver:600,deagle:700, microsmg:1050,vector:1250,smg9:1500,p50:2350, pump:1050,sawed:1100,autosg:2000,m249:5200,
  g36:1800,famas:2050,ak47:2700,m4:2900,scar:3100,falcon:3300, lightsr:1700,m1:1900,heavysr:4750,piercesr:5000, flash:200,smoke:300,frag:300,stun:300,
  armor:650,helmet:1000,kit:400};
/* the shop columns (CS2 layout). Search & destroy shows these; the range shows every gun */
const SHOP=[
  {name:'장비',items:['armor','helmet','kit']},
  {name:'권총',items:['p1912','burst9','auto75','revolver','deagle']},
  {name:'기관단총',items:['microsmg','vector','smg9','p50']},
  {name:'중화기',items:['pump','sawed','autosg','m249']},
  {name:'소총',items:['g36','famas','ak47','m4','scar','falcon']},
  {name:'저격총',items:['lightsr','m1','heavysr','piercesr']},
  {name:'투척',items:['flash','smoke','frag','stun']}];
const GEAR={armor:{name:'방탄복',desc:'받는 피해 -45% (머리 제외)'},helmet:{name:'방탄복 + 헬멧',desc:'머리까지 보호'},kit:{name:'해체 키트',desc:'폭탄 해체 6초 → 3초 (수비만)'}};
const NADE_MAX={flash:2,smoke:1,frag:1,stun:1};
/* money for a kill, by what killed (CS2: the cheaper or weaker the weapon, the bigger the reward) */
function killReward(id){ if(!id) return 0; if(id==='bomb'||id==='barrel'||id==='fall'||id==='void') return 0; if(TH[id]) return 300;
  const w=WPN[id]; if(!w) return 0; if(w.mode==='melee') return 1500;
  const own={autosg:600,p50:300,heavysr:100,auto75:100,m249:300}; if(own[id]!=null) return own[id];
  if(w.cat==='sg') return 900; if(w.cat==='smg') return 600; return 300; }
const itemName=k=>GEAR[k]?GEAR[k].name:WPN[k]?WPN[k].name:TH[k]?TH[k].name:k;
const fmtMoney=n=>'$'+Math.round(n).toLocaleString('en-US');

const Buy=(()=>{
  let ctx=null, col=-1, rT=0, msgT=0;
  const el=()=>$('buy');
  function cols(){ return ctx&&ctx.columns?ctx.columns():SHOP; }
  function open(c){ ctx=c; col=-1; if(!el()) return; Input.exitLock(); el().classList.add('on'); el().classList.toggle('free',!!ctx.free); render(); Sfx.play('click'); }
  function close(){ if(!ctx) return; ctx=null; el().classList.remove('on'); if(Game.active&&UI.cur==='game'&&!isTouch&&!UI.overlayOpen()) Input.requestLock(); }
  const isOpen=()=>!!ctx;
  function icon(k){ if(GEAR[k]){ const P={armor:'M32 2l14 5v7c0 7-6 11-14 13-8-2-14-6-14-13V7z',helmet:'M18 15c0-8 6-13 14-13s14 5 14 13v2H18zM16 17h32v2H16zM22 9h20',kit:'M20 6h24v12H20zM28 3h8v3h-8zM30 9h4v6h-4zM27 11h10v2H27z'}; return `<svg class="wi" viewBox="0 0 64 20"><path d="${P[k]}"/></svg>`; }
    return HUD.wIcon(k); }
  function render(){ if(!ctx) return; const C=cols(), money=ctx.money?ctx.money():0, B=el().querySelector('.buy-cols');
    $('buyMoney').textContent=ctx.free?ctx.title||'무기 선택':fmtMoney(money);
    B.style.gridTemplateColumns=`repeat(${C.length},minmax(0,1fr))`;
    B.innerHTML=C.map((c,i)=>`<div class="bc${i===col?' sel':''}"><h4><i>${i+1}</i>${esc(c.name)}</h4>${c.items.map((k,j)=>{ const st=ctx.state(k);
      return `<button class="bi${st.own?' own':''}${st.ok?'':' no'}${st.hide?' hide':''}" data-k="${k}"><i class="n">${j+1}</i><b>${esc(itemName(k))}</b>${icon(k)}<span class="p">${ctx.free?(st.own?'사용 중':''):st.own?'보유':fmtMoney(st.price)}</span></button>`; }).join('')}</div>`).join('');
    B.querySelectorAll('.bi').forEach(b=>{ b.onclick=()=>choose(b.dataset.k); b.onmouseenter=()=>hint(b.dataset.k); });
    tick(); }
  function hint(k){ if(!ctx) return; const st=ctx.state(k); msg(st.why||(GEAR[k]?GEAR[k].desc:WPN[k]?(WPN[k].desc||''):TH[k]?TH[k].desc:''),!st.ok); }
  function msg(t,bad){ const m=$('buyMsg'); if(!m) return; m.textContent=t||''; m.classList.toggle('bad',!!bad); msgT=2.5; }
  function choose(k){ if(!ctx) return; const st=ctx.state(k); if(!st.ok){ msg(st.why||'살 수 없어요',true); Sfx.play('deny'); return; }
    ctx.pick(k); Sfx.play('collect',{rate:1.4}); msg((ctx.free?'장착: ':'구매: ')+itemName(k)); setTimeout(()=>{ if(ctx) render(); },60);
    if(ctx.closeOnPick) close(); }
  /* keys: number = column, then number = item (CS style); B / Esc closes */
  function key(e){ if(!ctx) return false; if(e.code==='Escape'||(Input.BIND.buy||[]).includes(e.code)){ close(); return true; }
    const m=e.code.match(/^Digit([1-9])$/); if(!m) return false; const n=+m[1]-1, C=cols();
    if(col<0){ if(n<C.length){ col=n; render(); } } else { const it=C[col].items[n]; col=-1; if(it) choose(it); else render(); } return true; }
  function tick(){ if(!ctx) return; const t=ctx.timeLeft?ctx.timeLeft():null; const T=$('buyTime');
    if(t==null){ T.textContent=ctx.sub||''; } else { T.textContent=t>0?`남은 구매 시간 ${Math.floor(t/60)}:${String(Math.max(0,Math.ceil(t))%60).padStart(2,'0')}`:'구매 시간이 끝났어요'; if(t<=0&&!ctx.free) setTimeout(close,500); }
    if(!ctx.free) $('buyMoney').textContent=fmtMoney(ctx.money()); }
  function update(dt){ if(!ctx) return; rT-=dt; if(rT<=0){ rT=0.25; tick(); if(ctx&&ctx.dirty&&ctx.dirty()) render(); } if(msgT>0){ msgT-=dt; if(msgT<=0&&$('buyMsg')) $('buyMsg').textContent=''; } }
  function init(){ const e=el(); if(!e) return; e.addEventListener('click',ev=>{ if(ev.target===e) close(); }); $('buyClose').onclick=()=>close();
    addEventListener('keydown',ev=>{ if(ctx&&key(ev)){ ev.preventDefault(); ev.stopPropagation(); } },true); }
  return {open,close,isOpen,render,update,init,msg};
})();
