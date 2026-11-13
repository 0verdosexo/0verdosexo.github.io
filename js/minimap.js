/* minimap.js — heading-up circular minimap */
const mmCanvas=$('mm'), mmx=mmCanvas.getContext('2d'), MS=8, mapImg=document.createElement('canvas');
function buildMapImage(){ mapImg.width=W*MS; mapImg.height=H*MS; const x=mapImg.getContext('2d'), k=MS/CELL; x.clearRect(0,0,mapImg.width,mapImg.height);
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){ const v=G[r*W+c]; if(!v) continue; x.fillStyle=v===2?'#9aa0a7':'#d9bb92'; x.fillRect(c*MS,r*MS,MS,MS); }
  for(const f of FLOORPAINT){ x.fillStyle='#c9928f'; x.fillRect(f.c0*MS,f.r0*MS,(f.c1-f.c0)*MS,(f.r1-f.r0)*MS); }
  for(const q of ZONES) for(let r=q.r0;r<q.r1;r++)for(let c=q.c0;c<q.c1;c++) if(G[r*W+c]===1){ x.fillStyle='#f0cf3c'; x.fillRect(c*MS,r*MS,MS,MS); }
  for(const L of LOWB){ x.fillStyle='#9ea5ac'; x.fillRect(L.c0*MS,L.r0*MS,(L.c1-L.c0)*MS,(L.r1-L.r0)*MS); x.strokeStyle='#5d646b'; x.lineWidth=1.5; x.strokeRect(L.c0*MS+.75,L.r0*MS+.75,(L.c1-L.c0)*MS-1.5,(L.r1-L.r0)*MS-1.5); }
  for(const s of RAMPS){ x.fillStyle='#c4c9ce'; x.fillRect(s.x0*k,s.z0*k,(s.x1-s.x0)*k,(s.z1-s.z0)*k); x.strokeStyle='#7d848b'; x.lineWidth=1;
    const along=s.hi[0]==='z'; for(let t=0.15;t<1;t+=0.2){ x.beginPath(); if(along){ const zz=s.z0+(s.z1-s.z0)*t; x.moveTo(s.x0*k,zz*k); x.lineTo(s.x1*k,zz*k); } else { const xx=s.x0+(s.x1-s.x0)*t; x.moveTo(xx*k,s.z0*k); x.lineTo(xx*k,s.z1*k); } x.stroke(); } }
  for(const b of BOXES){ if(b.k==='bridge'||b.k==='deck'){ x.fillStyle=b.k==='bridge'?'#7f878e':'#a7aeb5'; x.fillRect(b.x0*k,b.z0*k,(b.x1-b.x0)*k,(b.z1-b.z0)*k); }
    if(b.k==='planter'){ x.fillStyle='#6cc463'; x.fillRect(b.x0*k,b.z0*k,(b.x1-b.x0)*k,(b.z1-b.z0)*k); }
    if(b.k==='crate'){ x.fillStyle='#8b8f94'; x.fillRect(b.x0*k,b.z0*k,(b.x1-b.x0)*k,(b.z1-b.z0)*k); }
    if(b.k==='slide'){ x.fillStyle='#f29a1c'; x.fillRect(b.x0*k-1,b.z0*k-1,(b.x1-b.x0)*k+2,(b.z1-b.z0)*k+2); } }
  for(const p of PORTALS){ x.fillStyle='#a06bff'; x.beginPath(); x.arc(p.x*k,p.z*k,MS*.55,0,7); x.fill(); x.strokeStyle='#fff'; x.lineWidth=1.2; x.stroke(); }
}
let mmZoom=false;
$('mmWrap').addEventListener('pointerdown',e=>{ e.stopPropagation(); mmZoom=!mmZoom; });
function drawMinimap(){
  const r=mmCanvas.getBoundingClientRect(), D0=Math.max(60,Math.round(r.width*(window.devicePixelRatio||1))); if(mmCanvas.width!==D0) mmCanvas.width=mmCanvas.height=D0;
  const D=mmCanvas.width, R=D/2, x=mmx, me=S.me, yaw=me.yaw, u=D/150, k=R/((mmZoom?26:12)*CELL);
  x.clearRect(0,0,D,D); x.save(); x.beginPath(); x.arc(R,R,R,0,7); x.clip(); x.fillStyle='rgba(20,27,48,.9)'; x.fillRect(0,0,D,D);
  x.save(); x.translate(R,R); x.rotate(yaw); x.scale(k,k); x.translate(-me.x,-me.z);
  x.drawImage(mapImg,0,0,W*CELL,H*CELL);
  x.fillStyle=S.doorOpen?'#5fd38a':'#e2483d'; x.fillRect(DOOR.c0*CELL,DOOR.r0*CELL,(DOOR.c1-DOOR.c0)*CELL,CELL);
  for(const o of orbs){ if(o.taken) continue; x.fillStyle='#3fe0e8'; x.beginPath(); x.arc(o.x,o.z,3.2*u/k,0,7); x.fill(); x.strokeStyle=o.y>1?'#ffffff':'#0b4a50'; x.lineWidth=(o.y>1?2:1)*u/k; x.stroke(); }
  x.restore();
  const toS=(px,pz)=>{ const dx=px-me.x,dz=pz-me.z,c=Math.cos(yaw),s=Math.sin(yaw); return [(dx*c-dz*s)*k,(dx*s+dz*c)*k]; };
  const dot=(px,py,pz,col,pulse)=>{ let [sx,sy]=toS(px,pz); const L=Math.hypot(sx,sy), lim=R-8*u; if(L>lim){ sx*=lim/L; sy*=lim/L; }
    x.fillStyle=col; x.beginPath(); x.arc(R+sx,R+sy,(pulse?6+2*Math.sin(perfT*8):6)*u,0,7); x.fill(); x.strokeStyle='#fff'; x.lineWidth=2*u; x.stroke();
    const dy=py-me.y; if(Math.abs(dy)>2){ x.fillStyle='#fff'; x.font=`bold ${10*u}px sans-serif`; x.textAlign='center'; x.textBaseline='middle'; x.fillText(dy>0?'▲':'▼',R+sx,R+sy-12*u); } };
  const o=S.opp;
  if(S.game==='tag'&&S.role==='runner'&&o.present){
    // seeker's 60° view cone
    const [sx,sy]=toS(o.x,o.z), a=-o.yaw+yaw-Math.PI/2, Rr=26*k*CELL/4;
    x.fillStyle='rgba(226,72,61,.22)'; x.beginPath(); x.moveTo(R+sx,R+sy); x.arc(R+sx,R+sy,Math.min(R*1.5,Rr),a-Math.PI/6,a+Math.PI/6); x.closePath(); x.fill();
    dot(o.x,o.y,o.z,'#e2483d',false); }
  if(S.game==='duel'&&o.present&&S.shotPing&&perfT-S.shotPing.t<3){ x.globalAlpha=1-(perfT-S.shotPing.t)/3; dot(S.shotPing.x,S.shotPing.y,S.shotPing.z,'#ff6a3d',true); x.globalAlpha=1; }
  if(S.role==='seeker'&&o.present){
    if(o.exposed) dot(o.x,o.y,o.z,'#f2d23a',true);
    else if(S.lastSeen&&perfT-S.lastSeen.t<4){ x.globalAlpha=1-(perfT-S.lastSeen.t)/4; dot(S.lastSeen.x,S.lastSeen.y,S.lastSeen.z,'rgba(242,210,58,.7)',false); x.globalAlpha=1; } }
  x.fillStyle=S.role==='runner'?'#2bb3c0':'#e2483d'; x.strokeStyle='#fff'; x.lineWidth=2*u;
  x.beginPath(); x.moveTo(R,R-9*u); x.lineTo(R+6.5*u,R+7*u); x.lineTo(R,R+3.5*u); x.lineTo(R-6.5*u,R+7*u); x.closePath(); x.fill(); x.stroke();
  x.fillStyle='#fff7ec'; x.font=`bold ${11*u}px sans-serif`; x.textAlign='center'; x.textBaseline='middle';
  x.fillText('N',R+(R-11*u)*Math.sin(yaw),R-(R-11*u)*Math.cos(yaw)); x.restore();
}

