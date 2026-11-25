/* minimap.js — rotating radar in the top-right: walls & buildings pre-rendered once per map, live markers on top. */
'use strict';
const Minimap=(()=>{
  let base=null, cv=null, g=null; const PX=2; // base image px per metre
  function build(){ cv=$('hMini'); g=cv.getContext('2d'); const w=W*CELL*PX, h=H*CELL*PX; base=document.createElement('canvas'); base.width=w; base.height=h; const b=base.getContext('2d');
    b.fillStyle='#1b222c'; b.fillRect(0,0,w,h);
    for(let r=0;r<H;r++) for(let c=0;c<W;c++){ const v=G[r*W+c]; b.fillStyle=v===1||v===3?'#3a4452':v===4?'#06080b':v===2?'#3dff8a':'#141920'; b.fillRect(c*CELL*PX,r*CELL*PX,CELL*PX+0.5,CELL*PX+0.5); }
    if(TERR){ const T=TERR; for(let j=0;j<T.nz;j++) for(let i=0;i<T.nx;i++){ const h=T.h[j*T.nx+i]; if(h>-0.35&&h<0.3) continue;
        b.fillStyle=h<-1.5?'#161b22':h<-0.35?'#28303b':'#46505e'; b.fillRect(i*T.res*PX,j*T.res*PX,T.res*PX+0.3,T.res*PX+0.3); } }
    for(const z of ZONES){ b.fillStyle='rgba(255,210,31,0.22)'; b.fillRect(z.c0*CELL*PX,z.r0*CELL*PX,(z.c1-z.c0)*CELL*PX,(z.r1-z.r0)*CELL*PX); }
    const sorted=SOL.filter(s=>s.t==='b'&&s.k!=='pk').sort((a,c)=>a.y1-c.y1);
    for(const s of sorted){ if(s.k==='slab'||s.k==='roof'){ b.fillStyle='rgba(120,135,155,0.35)'; } else if(s.k==='wall'||s.k==='parapet'){ b.fillStyle='#c9d2de'; } else if(s.k==='rail') continue; else b.fillStyle=s.y1>1.4?'#6b7788':'#56606e';
      b.fillRect(s.x0*PX,s.z0*PX,Math.max(1,(s.x1-s.x0)*PX),Math.max(1,(s.z1-s.z0)*PX)); }
    for(const r of SOL.filter(s=>s.t==='r')){ b.fillStyle='rgba(255,255,255,0.25)'; b.fillRect(r.x0*PX,r.z0*PX,(r.x1-r.x0)*PX,(r.z1-r.z0)*PX); } }
  function draw(){ if(!base||!Game.me) return; const me=Game.me, S=cv.width, R2=S/2; const range=38*(Game.kind==='battle'?1+0.25*perkN(me.load,'eagle'):1.15); const k=R2/range; // px per metre
    g.clearRect(0,0,S,S); g.save(); g.beginPath(); g.arc(R2,R2,R2-1,0,Math.PI*2); g.clip();
    g.translate(R2,R2); g.rotate(me.yaw); g.scale(k/PX,k/PX); g.translate(-me.x*PX,-me.z*PX); g.drawImage(base,0,0); g.restore();
    const tp=(x,z)=>{ const dx=x-me.x, dz=z-me.z; const c=Math.cos(me.yaw), s=Math.sin(me.yaw); return [R2+(dx*c-dz*s)*k, R2+(dx*s+dz*c)*k]; };
    const clampR=([x,y],m)=>{ const dx=x-R2, dy=y-R2, d=Math.hypot(dx,dy), lim=R2-(m||6); return d>lim?[R2+dx/d*lim,R2+dy/d*lim,true]:[x,y,false]; };
    const dot=(x,z,col,r,edge)=>{ let p=tp(x,z); if(edge) p=clampR(p); else if(Math.hypot(p[0]-R2,p[1]-R2)>R2-3) return; g.fillStyle=col; g.beginPath(); g.arc(p[0],p[1],r||4,0,Math.PI*2); g.fill(); };
    const label=(x,z,txt,col)=>{ const p=clampR(tp(x,z),10); g.fillStyle='rgba(10,14,20,0.8)'; g.beginPath(); g.arc(p[0],p[1],8,0,Math.PI*2); g.fill(); g.strokeStyle=col; g.lineWidth=2; g.stroke(); g.fillStyle='#fff'; g.font='bold 10px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,p[0],p[1]+0.5); };
    /* objectives */
    if(Game.kind==='tag'){ const T=Tag.info(); if(T){ if(me.role==='run'||true) for(const o of T.orbs) if(!o.taken) dot(o.x,o.z,'#ffd34a',3.2,me.role==='run');
        if(DOOR) label((DOOR.c0+DOOR.c1)/2*CELL,(DOOR.r0+1)*CELL,'문',T.door?'#3dff8a':'#ff4d3d'); const j=Tag.JAIL(); label(j.x,j.z,'감',  '#ff9b3d'); for(const p of PORTALS) dot(p.x,p.z,'#3dd8ff',3.5); } }
    else { const M=Modes.info(); if(M){ const col=o=>o<0?'#ffffff':TEAM_COLORS[o];
      for(const p of M.pts) label(p.x,p.z,p.n,col(p.own)); if(M.hp&&M.hp.list.length){ const p=M.hp.list[M.hp.i]; label(p.x,p.z,'점',M.hp.cont?'#ffd34a':'#fff'); }
      for(const f of M.flags) label(f.x,f.z,'코',TEAM_COLORS[f.team]); if(M.drive) label(M.drive.x,M.drive.z,'드','#36e0ff');
      if(Game.mode==='snd'){ for(const s of (BATTLE.sites||[])) label(s.x,s.z,s.n,'#ff9b3d'); if(M.bomb&&(M.bomb.planted||me.team===M.att)&&!M.bomb.carrier) dot(M.bomb.x,M.bomb.z,'#ff3b2d',4,true); }
      for(const t of M.tags) dot(t.x,t.z,TEAM_COLORS[t.team],3); } }
    /* map elements: supply points (green +, dim while on cooldown) and jump pads (orange ^) */
    if(typeof Interact!=='undefined'){ if(Game.kind==='battle'&&Game.mode!=='gg') for(const q of Interact.supplies){ const p=tp(q.x,q.z); if(Math.hypot(p[0]-R2,p[1]-R2)>R2-5) continue; const rd=!(me.supCd&&me.supCd[q.i]>Game.t);
        g.fillStyle=rd?'rgba(20,60,34,0.9)':'rgba(30,34,40,0.8)'; g.fillRect(p[0]-4.5,p[1]-4.5,9,9); g.fillStyle=rd?'#4dff8a':'#69707a'; g.fillRect(p[0]-3,p[1]-0.9,6,1.8); g.fillRect(p[0]-0.9,p[1]-3,1.8,6); }
      for(const q of Interact.pads){ const p=tp(q.x,q.z); if(Math.hypot(p[0]-R2,p[1]-R2)>R2-5) continue; g.strokeStyle='#ff8a1f'; g.lineWidth=1.8; g.beginPath(); g.moveTo(p[0]-3.5,p[1]+2); g.lineTo(p[0],p[1]-2); g.lineTo(p[0]+3.5,p[1]+2); g.stroke(); } }
    /* actors */
    for(const a of Game.actors){ if(a===me||!a.alive||a.escaped) continue; let show=false, col='#fff';
      if(Game.kind==='tag'){ if(me.role==='run'){ show=a.role==='seek'||true; col=a.role==='seek'?'#ff4d3d':'#7fb6ff'; } else { col=a.role==='seek'?'#ff9a8a':'#7fb6ff'; show=a.role==='seek'||Tag.revealed(a)||a.jailed; } }
      else { const en=isEnemy(me,a); col=Game.teamMode?TEAM_COLORS[a.team]:(en?'#ff5a4e':'#7fb6ff'); show=!en||a.revealT>Game.t||a.carry==='flag'||a.carry==='drive'; }
      if(show){ const edge=Game.kind==='tag'&&me.role==='run'&&a.role==='seek'; dot(a.x,a.z,col,a.jailed?3:4.2,edge); } }
    /* me */
    g.fillStyle='#fff'; g.beginPath(); g.moveTo(R2,R2-8); g.lineTo(R2+5.5,R2+6); g.lineTo(R2,R2+3); g.lineTo(R2-5.5,R2+6); g.closePath(); g.fill();
    /* seeker view cone for seekers */
    if(Game.kind==='tag'&&me.role==='seek'){ g.fillStyle='rgba(255,77,61,0.12)'; g.beginPath(); g.moveTo(R2,R2); g.arc(R2,R2,R2,-Math.PI/2-Math.PI/6,-Math.PI/2+Math.PI/6); g.closePath(); g.fill(); }
    g.strokeStyle='rgba(255,255,255,0.25)'; g.lineWidth=2; g.beginPath(); g.arc(R2,R2,R2-1,0,Math.PI*2); g.stroke();
    g.fillStyle='rgba(255,255,255,0.7)'; g.font='bold 11px sans-serif'; g.textAlign='center'; const n=tp(me.x,me.z-1000); const np=clampR(n,9); g.fillText('N',np[0],np[1]+4); }
  return {build,draw};
})();
