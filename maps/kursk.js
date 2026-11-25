/* 쿠르스크 참호선 · 1943년 7월 — 2차대전 동부전선 참호전 (v7.11).
   북쪽 = 소련군 방어선(레드), 남쪽 = 독일군 공세선(블루). 무인지대는 3개 레인: 서쪽 A 마을 · 중앙 B 분화구(티거 잔해) · 동쪽 C 협곡(발카) 목교.
   설계 좌표는 지도 240×180 m(격자 15 m)이고, 실제 좌표는 바깥 경계 한 칸(4 m) 때문에 +4 m 씩 밀려 있어요 (D() 가 변환).
   땅 높이는 terrain 래스터(0.5 m)로 파요: 기본 0 / 1선 참호 바닥 -2.2 / 교통호 -1.8 / 함몰 도로 -1 / 협곡 바닥 -3 / B 분화구 중심 -2.
   참호는 길찾기 격자(2 m, 홀수 미터)에 맞춰 짝수 미터 모서리로 파고, 사격호 6 m + 횡단벽을 도는 톱니 모양으로 반복해요. */
(()=>{
const OX=4, RES=0.5, WX=248, WZ=188, NX=WX/RES, NZ=WZ/RES;
const R=mulberry(19430705);
/* ---------- design-space helpers (everything below is in design metres; out() shifts by +4) ---------- */
const boxes=[], ramps=[], ladders=[], props=[], mounts=[];
const WW={trees:[],wire:[],hedge:[],poles:[],wrecks:[],water:[],crates:[],lanterns:[],signs:[],smokes:[],wheat:[],reeds:[],fence:[],sunflower:[],rubble:[],rifles:[],nets:[],stoves:[],tables:[],bunks:[],mortars:[],misc:[],steps:[],planks:[]};
const B=(x0,z0,x1,z1,y0,y1,k,extra)=>{ const b=Object.assign({x0,x1,z0,z1,y0,y1,k},extra||{}); boxes.push(b); return b; };
/* ---------- terrain raster ---------- */
const H=new Float32Array(NX*NZ), MT=new Uint8Array(NX*NZ), WL=new Uint8Array(NX*NZ);
const cx=i=>(i+0.5)*RES-OX, cz=j=>(j+0.5)*RES-OX;
function each(x0,z0,x1,z1,f){ const i0=Math.max(0,Math.floor((x0+OX)/RES)), i1=Math.min(NX-1,Math.ceil((x1+OX)/RES)), j0=Math.max(0,Math.floor((z0+OX)/RES)), j1=Math.min(NZ-1,Math.ceil((z1+OX)/RES));
  for(let j=j0;j<=j1;j++){ const z=cz(j); if(z<z0||z>=z1) continue; for(let i=i0;i<=i1;i++){ const x=cx(i); if(x<x0||x>=x1) continue; f(j*NX+i,x,z); } } }
/* dig: lower the ground to h (never raises); mat = floor look, wall = revetment kind (0 earth 1 planks 2 wicker 3 concrete 4 logs) */
const dig=(x0,z0,x1,z1,h,mat,wall)=>each(x0,z0,x1,z1,(k)=>{ if(h<H[k]){ H[k]=h; MT[k]=mat; WL[k]=wall; } });
const setH=(x0,z0,x1,z1,hf,mat,wall)=>each(x0,z0,x1,z1,(k,x,z)=>{ H[k]=hf(x,z); MT[k]=mat; WL[k]=wall; });
/* 1) ground look: steppe grass behind the lines, churned mud in no-man's land (ragged edge) */
for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const x=cx(i), z=cz(j), n=Math.sin(x*0.21)*2.2+Math.sin(x*0.057+z*0.11)*3+Math.sin(z*0.3+x*0.07)*1.3;
  MT[j*NX+i]=(z>50+n&&z<130+n)?1:0; }
/* 2) sunken road (-1 m), A ↔ B ↔ C and on to both map edges */
const ROAD=[[-6,101],[30,98],[60,95.5],[90,93.5],[120,92],[150,91],[176,89.5],[195,88.5],[214,88],[246,86]];
function segDist(px,pz,a,b){ const dx=b[0]-a[0], dz=b[1]-a[1], L2=dx*dx+dz*dz, t=Math.max(0,Math.min(1,((px-a[0])*dx+(pz-a[1])*dz)/L2)); return Math.hypot(px-a[0]-dx*t,pz-a[1]-dz*t); }
function roadD(x,z){ let d=1e9; for(let k=1;k<ROAD.length;k++) d=Math.min(d,segDist(x,z,ROAD[k-1],ROAD[k])); return d; }
each(-4,70,244,115,(k,x,z)=>{ const d=roadD(x,z); if(d>5.2) return; const h=d<2.6?-1:-1+(d-2.6)/2.6; if(h<H[k]){ H[k]=h; MT[k]=3; WL[k]=0; } });
/* 3) the ravine (balka) at C: 18 m wide, 3 m deep, banks ~25°, shallow creek in the bed; tapers out at both ends */
const RVX=195, RVZ0=50, RVZ1=130, RD=4.4, RWY=-4.02;
each(RVX-10,RVZ0-2,RVX+10,RVZ1+2,(k,x,z)=>{ const dx=Math.abs(x-RVX-1.2*Math.sin(z*0.07)), end=Math.min(1,Math.max(0,(z-RVZ0)/12),Math.max(0,(RVZ1-z)/12));
  const rim=6.7+0.55*Math.sin(z*0.37)+0.35*Math.sin(z*0.91+1.3), drop=0.95+0.25*Math.sin(z*0.53+0.4);
  const hG=dx<2.4?-RD:dx<rim?-RD+(RD-drop)*(dx-2.4)/(rim-2.4):dx<rim+1.3?-drop*(1-(dx-rim)/1.3):0;
  /* steep eroded banks, with three gentle cattle paths down (z≈72, 104, 120) */
  const rs=6.3+0.45*Math.sin(z*0.41)+0.3*Math.sin(z*1.13+0.7), hS=dx<2.4?-RD:dx<5.4?-RD+(RD-1.3)*(dx-2.4)/3:dx<rs?-1.3+0.4*(dx-5.4)/Math.max(0.1,rs-5.4):dx<rs+1.0?-0.9*(1-(dx-rs)/1.0):0;
  const pz=Math.min(Math.abs(z-72),Math.abs(z-104),Math.abs(z-120)), wS=Math.min(1,Math.max(0,(pz-3.5)/2.5));
  let h=hG+(hS-hG)*wS; h*=end; if(h<H[k]-0.01){ H[k]=h; MT[k]=dx<3.2?4:1; WL[k]=0; } });
const SLOW=[{x0:RVX-3.6,z0:RVZ0+10,x1:RVX+3.6,z1:RVZ1-10,y:RWY+0.32,mul:0.6}];
for(let z=RVZ0+8;z<RVZ1-8;z+=2){ const xc=RVX+1.2*Math.sin((z+1)*0.07)+0.5*Math.sin(z*0.21); WW.water.push({x0:xc-0.85-0.3*Math.sin(z*0.3),z0:z,x1:xc+0.85+0.3*Math.sin(z*0.23+1),z1:z+2.05,y:RWY,c:'#3b4a3c'}); WW.water.push({x0:xc-2.0,z0:z,x1:xc+2.0,z1:z+2.05,y:RWY-0.03,c:'#3b4a3c'}); if(z%4===0) WW.rubble.push({x:xc+(z%8?1.7:-1.7),z:z+1,r:0.7,k:'stone',y:RD}); }
/* 4) shell craters: the big one at B (22 m, -2 m) and 30 small ones in no-man's land (bowls kept walkable) */
const CRATERS=[[120,92,11,3.6]];
const keepOut=[[44,96,16],[120,92,14],[195,90,12],[24,80,8],[215,115,7],[85,113,6],[143,77,6],[159,130,6],[132,50,5],[88,129,5],[97,68,4],[143,112,4]];
for(let n=0;n<700&&CRATERS.length<58;n++){ const x=12+R()*216, z=58+R()*64; if(Math.abs(x-RVX)<13) continue; if(keepOut.some(([a,b,r])=>Math.hypot(x-a,z-b)<r)) continue; if(roadD(x,z)<5) continue;
  if(CRATERS.some(([a,b,r])=>Math.hypot(x-a,z-b)<r+4)) continue; const big=R()<0.35; CRATERS.push([x,z,big?3.6:2.0,big?1.5:0.8]); }
for(const [x0,z0,r,d] of CRATERS) each(x0-r*1.6,z0-r*1.6,x0+r*1.6,z0+r*1.6,(k,x,z)=>{ const q=Math.hypot(x-x0,z-z0)/r;
  if(q<1){ const t=Math.max(0,(q-0.5)/0.5), h=r>8?-d*(1-Math.pow(q,1.35))+0.18*Math.sin(x*1.7+z*0.6)*Math.sin(z*1.3-x*0.4)*(1-q)+0.1*Math.sin(x*3.1)*Math.sin(z*2.7):-d*(0.5+0.5*Math.cos(Math.PI*q)); if(h<H[k]){ H[k]=h; MT[k]=1; WL[k]=0; } }
  else if(MT[k]<2&&H[k]>-0.2&&H[k]<0.6){ const rh=(r>5?1.3:Math.min(0.42,0.16*r))*Math.exp(-Math.pow((q-1.13)/0.24,2)); H[k]=Math.max(H[k],H[k]+rh); }
  else if(q<1.55&&H[k]>=0){ H[k]=Math.max(H[k],(r>8?0.45:0.2)*Math.sin(Math.PI*(q-1)/0.55)); MT[k]=1; } });
SLOW.push({x0:116,z0:88,x1:124,z1:96,y:-2.4,mul:0.7});
/* 5) front-line trenches: 6 m fire bays with a fire step on the enemy side, traverses the trench walks round behind.
   side 1 = Soviet (enemy to the south), -1 = German (enemy to the north). zf = the bay's edge on the home side. */
const SALLY={s:[36,96,144,204],d:[36,84,144,204]};
const MGX={s:[75,171],d:[51]};
function frontLine(zf,side,x0,x1,tag){ const wall=side>0?4:1, mat=2;
  for(let a=x0;a<x1;a+=12){
    const bz0=side>0?zf:zf-4, bz1=side>0?zf+4:zf, fz0=side>0?zf+2.2:zf-4, fz1=side>0?zf+4:zf-2.2;
    dig(a,bz0,a+6,bz1,-2.2,mat,wall);
    const sally=SALLY[tag].includes(a), tun=(tag==='s'&&a===96);
    /* fire step (+1.1 above the floor) — open where a sally ramp or the tunnel leaves the bay */
    let sx0=a+0.4, sx1=a+5.6; if(sally) sx1=a+1.6; if(tun) sx0=a+2.4;
    B(sx0,fz0,sx1,fz1,-2.2,-1.1,'firestep',{side:tag==='s'?'su':'de'}); if(sally) B(a+4.4,fz0,a+5.6,fz1,-2.2,-1.1,'firestep',{side:tag==='s'?'su':'de'});
    /* sandbag parapet (2 rows) on the enemy lip, gaps at the bay ends */
    const pz0=side>0?zf+4:zf-4.7, pz1=pz0+0.7; let px0=a+0.8, px1=a+5.2; if(tun) px0=a+2.6;
    const mg=MGX[tag].find(x=>x>a&&x<a+6);
    if(sally){ B(px0,pz0,a+1.6,pz1,0,0.42,'sandbag'); B(a+4.4,pz0,px1,pz1,0,0.42,'sandbag'); }
    else if(mg){ B(px0,pz0,mg-1.2,pz1,0,0.42,'sandbag'); B(mg+1.2,pz0,px1,pz1,0,0.42,'sandbag'); for(const sx of [-1.05,1.05]) B(mg+sx-0.15,pz0-(side>0?0.6:-0.6),mg+sx+0.15,pz1-(side>0?0.6:-0.6),0,0.32,'sandbag'); }
    else B(px0,pz0,px1,pz1,0,0.42,'sandbag');
    /* one course of bags on the home lip too (walkable, 0.3 m) except where a communication trench or the tunnel joins */
    if(!tun&&![38,120,172].some(x=>x>a-1.5&&x<a+7.5)) B(a+0.6,side>0?zf-0.62:zf,a+5.4,side>0?zf:zf+0.62,0,0.3,'sandbag');
    /* duckboards down the floor */
    const dz0=side>0?zf+0.25:zf-2.0, dz1=dz0+1.6; WW.planks.push({x0:a+0.2,z0:dz0,x1:a+5.8,z1:dz1,y:-2.2});
    /* jogs and the bay behind the traverse */
    const jz0=side>0?zf-4:zf-2, jz1=side>0?zf+2:zf+4, hz0=side>0?zf-4:zf+2, hz1=hz0+2;
    if(a+12<=x1){ dig(a+6,jz0,a+8,jz1,-2.2,mat,wall); dig(a+6,hz0,a+12,hz1,-2.2,mat,wall); dig(a+10,jz0,a+12,jz1,-2.2,mat,wall);
      WW.planks.push({x0:a+6.2,z0:hz0+0.2,x1:a+11.8,z1:hz1-0.2,y:-2.2}); }
    if(sally){ const rz0=side>0?zf+4:zf-10, rz1=rz0+6; setH(a+2,rz0,a+4,rz1,(x,z)=>side>0?-2.2*(1-(z-rz0)/6):-2.2*((z-rz0)/6),mat,wall); }
  }
}
frontLine(42,1,12,228,'s'); frontLine(138,-1,12,228,'d');
/* communication trenches (-1.8) from the rear areas to the bay behind the traverses, with entry ramps near the spawns */
function commTrench(xa,side){ const wall=side>0?1:2;
  if(side>0){ dig(xa,14,xa+2,26,-1.8,2,wall); dig(xa,24,xa+6,26,-1.8,2,wall); dig(xa+4,24,xa+6,34,-1.8,2,wall); dig(xa,32,xa+6,34,-1.8,2,wall); dig(xa,32,xa+2,38.2,-1.8,2,wall);
    setH(xa,8,xa+2,14,(x,z)=>-1.8*(z-8)/6,2,wall); }
  else { dig(xa,141.8,xa+2,148,-1.8,2,wall); dig(xa,146,xa+6,148,-1.8,2,wall); dig(xa+4,146,xa+6,156,-1.8,2,wall); dig(xa,154,xa+6,156,-1.8,2,wall); dig(xa,154,xa+2,166,-1.8,2,wall);
    setH(xa,166,xa+2,172,(x,z)=>-1.8*(172-z)/6,2,wall); } }
for(const x of [38,120,172]) commTrench(x,1);
for(const x of [38,120,172]) commTrench(x,-1);
/* the two tunnels (G3→G5 Soviet, J10→J8 German): covered trenches with a log roof, lanterns, an open ramp at the far end */
dig(96,44,98,66,-2.2,2,4); setH(96,66,98,70,(x,z)=>-2.2*(1-(z-66)/4),2,1); B(95.7,46.75,98.3,66,-0.32,0.06,'roofEarth');
dig(142,114,144,136,-2.2,2,4); setH(142,110,144,114,(x,z)=>-2.2*((z-110)/4),2,2); B(141.7,114,144.3,133.3,-0.32,0.06,'roofEarth');
for(const z of [50,57,63]) WW.lanterns.push({x:97,y:-0.55,z,hang:true}); for(const z of [117,124,131]) WW.lanterns.push({x:143,y:-0.55,z,hang:true});
WW.signs.push({x:97,y:0.9,z:71.2,rot:Math.PI,txt:'ХОД №2',style:'ru'},{x:143,y:0.9,z:108.8,rot:0,txt:'STOLLEN',style:'de'});
/* Z2 — Soviet command dugout (8×5 m, ceiling 2.1 m, log walls, 8-step entrance from the daylight) */
dig(110,21,118,26,-2.2,2,4); dig(118,22,120,24,-2.0,2,4); setH(112,15,114,21,(x,z)=>-2.2*(z-15)/6,2,4); B(109.6,20.6,118.4,26.4,-0.08,0.5,'roofEarth'); B(109.6,20.0,111.8,20.6,0,0.62,'sandbag'); B(114.2,20.0,118.4,20.6,0,0.62,'sandbag'); B(109.8,25.6,118.2,26.3,0.5,0.82,'sandbag');
B(111.4,20.3,114.6,20.8,-0.25,0.2,'log'); for(const x of [111.7,114.3]) B(x-0.2,20.35,x+0.2,20.8,-2.2,-0.25,'log'); WW.misc.push({t:'mound',x:114,z:23.5,y:0.42,sx:4.6,sy:0.5,sz:2.9});
for(let s=0;s<8;s++) WW.steps.push({x0:112,x1:114,z:15+s*0.75,y:-2.2*(s+0.5)/8});
WW.tables.push({x:113.6,z:23.4,w:2.2,d:1.1,y:-2.2,map:'ru'}); WW.bunks.push({x:110.5,z:23.5,len:2.0,y:-2.2,rot:Math.PI/2},{x:117.4,z:24.6,len:1.8,y:-2.2,rot:Math.PI/2});
WW.stoves.push({x:116.8,z:21.7,y:-2.2}); WW.crates.push({x:111.2,z:24.9,y:-2.2,rot:0.2,k:'ru',n:2},{x:117.3,z:23.3,y:-2.2,rot:-0.3,k:'ru',n:1}); WW.lanterns.push({x:113.6,y:-0.45,z:23.4,hang:true,light:2},{x:113.0,y:-0.55,z:21.5,hang:true,light:2}); WW.rifles.push({rack:true,x:111.2,z:21.25,y:-2.2,rot:0,id:'mosin',n:4});
WW.misc.push({t:'radio',x:110.6,z:25.6,y:-1.2},{t:'phone',x:114.4,z:23.0,y:-1.36},{t:'shelf',x:115.5,z:25.75,y:-2.2,rot:Math.PI},{t:'curtain',x:113,z:20.65,y:-2.2,w:2},{t:'wallmap',x:113.4,z:25.92,y:-1.2,rot:Math.PI});
B(112.5,22.85,114.7,23.95,-2.2,-1.42,'hidden'); B(109.9,22.5,111.1,24.5,-2.2,-0.9,'hidden'); B(116.8,23.6,118,25.6,-2.2,-0.9,'hidden'); B(116.4,21.3,117.2,22.1,-2.2,-1.3,'hidden');
/* German HQ bunker (concrete, half sunk, door to the communication trench) */
dig(109.5,151.5,118.5,158.5,-1.8,2,3); dig(118.5,154,120,156,-1.8,2,3);
B(109.5,151.5,118.5,152,-1.8,0.8,'conc'); B(109.5,158,118.5,158.5,-1.8,0.8,'conc'); B(109.5,152,110,158,-1.8,0.8,'conc'); B(118,152,118.5,154,-1.8,0.8,'conc'); B(118,156,118.5,158,-1.8,0.8,'conc'); B(118,154,118.5,156,0.8-0.6,0.8,'conc');
B(109.3,151.3,118.7,158.7,0.8,1.2,'conc');
WW.tables.push({x:114,z:155,w:2.4,d:1.2,y:-1.8,map:'de'}); WW.lanterns.push({x:114,y:0.5,z:155,hang:true,light:1}); WW.misc.push({t:'radio',x:110.8,z:156.8,y:-0.9},{t:'wallmap',x:114,z:152.08,y:-0.7,rot:0,de:1},{t:'shelf',x:116.5,z:157.75,y:-1.8,rot:Math.PI});
WW.rifles.push({rack:true,x:110.25,z:154.2,y:-1.8,rot:Math.PI/2,id:'kar98',n:3}); WW.bunks.push({x:116.5,z:153,len:2,y:-1.8,rot:0}); B(112.8,154.4,115.2,155.6,-1.8,-1.0,'hidden'); B(115.4,152.1,117.6,153.9,-1.8,-0.9,'hidden');
WW.signs.push({x:121,y:0.6,z:160,rot:Math.PI,txt:'GEFECHTSSTAND',style:'de'});
/* Z6 — German concrete pillbox with an MG42 at the embrasure; side stairs from the trench (5 steps) */
dig(156.6,128.6,161.4,131.4,-1.0,2,3); setH(162,129,164,131,()=>-1.0,2,3); setH(162,131,164,136,(x,z)=>-1.0-1.2*(z-131)/5,2,3); dig(161.4,129,162,131,-1.0,2,3);
B(156,128,162,128.6,-1.0,0.45,'conc'); B(156,128,158.4,128.6,0.45,1.7,'conc'); B(159.6,128,162,128.6,0.45,1.7,'conc'); B(158.4,128,159.6,128.6,0.85,1.7,'conc');
B(156,131.4,162,132,-1.0,1.7,'conc'); B(156,128.6,156.6,131.4,-1.0,1.7,'conc'); B(161.4,128.6,162,129,-1.0,1.7,'conc'); B(161.4,131,162,131.4,-1.0,1.7,'conc'); B(161.4,129,162,131,0.95,1.7,'conc');
B(155.8,127.8,162.2,132.2,1.7,2.05,'conc'); WW.misc.push({t:'bag',x:157,z:131.6,rot:0,y:2.05},{t:'bag',x:158.2,z:131.7,rot:0.1,y:2.05},{t:'bag',x:160.6,z:131.6,rot:-0.1,y:2.05}); for(let s=0;s<5;s++) WW.steps.push({x0:162,x1:164,z:131.5+s*1.0,y:-1.0-1.2*(s+0.5)/5,rot:1});
WW.signs.push({x:166.5,y:0.9,z:126.5,rot:0,txt:'ACHTUNG MINEN!',style:'warn'});
/* mortar pits and the AT gun pits (shallow, sandbagged) */
function pit(x,z,r,d,wall){ each(x-r,z-r,x+r,z+r,(k,px,pz)=>{ const q=Math.hypot(px-x,pz-z)/r; if(q<1&&-d<H[k]){ H[k]=-d; MT[k]=2; WL[k]=wall; } }); }
pit(163,30,2.2,0.7,1); pit(75,154,2.2,0.7,2); WW.mortars.push({x:163,z:30,y:-0.7,team:'ru'},{x:75,z:154,y:-0.7,team:'de'});
for(const [x,z] of [[163,30],[75,154]]) for(let a=0;a<12;a++){ if(a===3||a===4) continue; const t=a/12*Math.PI*2; WW.misc.push({t:'bag',x:x+Math.cos(t)*2.65,z:z+Math.sin(t)*2.65,rot:-t,y:0}); }
/* ---------- the village (A, west) ---------- */
/* farmhouse 14×9: stone ground floor (3.2 m), brick upper floor half gone, shell hole in the front wall, broken stair to the upper floor */
const FH={x0:38,z0:91,x1:52,z1:100}, T1=0.5, F1=3.2;
function wallZ(x0,x1,z0,z1,y0,y1,k,ops){ /* wall along x with openings [{a,b,y0,y1}] in metres from x0 */ let cur=x0; const os=(ops||[]).slice().sort((p,q)=>p.a-q.a);
  if(k==='stone'||k==='brickW') for(const o of os) if(o.y0>0) WW.misc.push({t:'frame',ax:'x',a:x0+o.a,b:x0+o.b,y0:y0+o.y0,y1:y0+o.y1,c:(z0+z1)/2,th:z1-z0});
  for(const o of os){ const a=x0+o.a, b=x0+o.b; if(a>cur) B(cur,z0,a,z1,y0,y1,k); if(o.y0>y0) B(a,z0,b,z1,y0,y0+o.y0,k); if(y0+o.y1<y1) B(a,z0,b,z1,y0+o.y1,y1,k); cur=b; } if(cur<x1) B(cur,z0,x1,z1,y0,y1,k); }
function wallX(z0,z1,x0,x1,y0,y1,k,ops){ let cur=z0; const os=(ops||[]).slice().sort((p,q)=>p.a-q.a);
  if(k==='stone'||k==='brickW') for(const o of os) if(o.y0>0) WW.misc.push({t:'frame',ax:'z',a:z0+o.a,b:z0+o.b,y0:y0+o.y0,y1:y0+o.y1,c:(x0+x1)/2,th:x1-x0});
  for(const o of os){ const a=z0+o.a, b=z0+o.b; if(a>cur) B(x0,cur,x1,a,y0,y1,k); if(o.y0>y0) B(x0,a,x1,b,y0,y0+o.y0,k); if(y0+o.y1<y1) B(x0,a,x1,b,y0+o.y1,y1,k); cur=b; } if(cur<z1) B(x0,cur,x1,z1,y0,y1,k); }
const door=(a)=>({a,b:a+1.8,y0:0,y1:2.3}), win=(a)=>({a,b:a+1.4,y0:0.9,y1:2.2});
wallZ(FH.x0,FH.x1,FH.z0,FH.z0+T1,0,F1,'stone',[win(1.6),door(5.1),{a:8.4,b:11.2,y0:0,y1:2.5},win(12)]);            // north front: window, door, shell hole, window
wallZ(FH.x0,FH.x1,FH.z1-T1,FH.z1,0,F1,'stone',[win(2),door(6.1),win(10.6)]);                                          // south back: back door
wallX(FH.z0+T1,FH.z1-T1,FH.x0,FH.x0+T1,0,F1,'stone',[win(3.2)]);                                                        // west
wallX(FH.z0+T1,FH.z1-T1,FH.x1-T1,FH.x1,0,F1,'stone',[win(1.2),{a:5,b:7,y0:0,y1:2.3}]);                                  // east: side door
B(FH.x0,FH.z0,FH.x0+7.4,FH.z1,F1-0.25,F1,'floorW');                                                                   // the half of the upper floor that is left
wallZ(FH.x0,FH.x0+7.4,FH.z0,FH.z0+0.4,F1,F1+2.6,'brickW',[win(1.6),{a:4.6,b:6.2,y0:0.9,y1:2.2}]); wallX(FH.z0+0.4,FH.z1-0.4,FH.x0,FH.x0+0.4,F1,F1+2.9,'brickW',[win(3.1)]);
wallZ(FH.x0,FH.x0+7.4,FH.z1-0.4,FH.z1,F1,F1+2.6,'brickW',[win(2.4)]); wallX(FH.z0+0.4,FH.z1-0.4,FH.x0+7.0,FH.x0+7.4,F1,F1+2.6,'brickW',[{a:0.1,b:2.4,y0:0,y1:2.3}]); B(FH.x0+7.0,FH.z0+0.4,FH.x0+7.4,FH.z0+3.2,F1,F1+1.2,'brickW');
ramps.push({x0:FH.x0+7.6,x1:FH.x0+9.4,z0:FH.z1-0.5-5.6,z1:FH.z1-0.5,hi:'z0',h:F1,base:0,k:'stairs',style:'ruin'});
B(FH.x0+7.4,FH.z0+0.5,FH.x0+9.6,FH.z1-6.3,F1-0.25,F1,'floorW');                                                       // stair landing joins the floor
WW.rubble.push({x:FH.x0+11,z:FH.z0+2.5,r:2.2},{x:FH.x1+1.5,z:FH.z0+4,r:1.6},{x:FH.x0+10.5,z:FH.z1-2,r:2.4},{x:FH.x0+2,z:FH.z0-1.2,r:1.2});
WW.rubble.push({x:FH.x0+10.6,z:FH.z0+4.6,r:2.6});
B(FH.x0+11,FH.z0+1.4,FH.x0+12.8,FH.z0+3.2,0,0.6,'hidden'); B(FH.x0+9.6,FH.z1-3.4,FH.x0+11.4,FH.z1-1.0,0,0.5,'hidden');
/* sandbag barricade at the front door, a standalone brick chimney, the covered well, the hay cart, wattle fence and burned sunflowers */
B(FH.x0+4.6,FH.z0-2.4,FH.x0+8.0,FH.z0-1.7,0,1.05,'sandbag');
B(54.2,101.6,55.6,103,0,7.5,'brickW'); WW.misc.push({t:'chimneyTop',x:54.9,z:102.3,y:7.5});
B(55,90.6,57,92.6,0,0.85,'stone'); WW.misc.push({t:'well',x:56,z:91.6});
B(30.2,96.4,34.2,98.4,0,1.3,'hidden'); WW.misc.push({t:'cart',x:32.2,z:97.4,rot:0.08});
WW.fence.push({x0:26,z0:104,x1:38,z1:104.4},{x0:52.5,z0:104.6,x1:60,z1:106.5}); for(const f of WW.fence) B(Math.min(f.x0,f.x1),Math.min(f.z0,f.z1)-0.1,Math.max(f.x0,f.x1),Math.max(f.z0,f.z1)+0.1,0,1.0,'hidden');
WW.sunflower.push({x0:27,z0:105.2,x1:38,z1:109},{x0:53,z0:107,x1:60,z1:111});
/* the barn (헛간), the warehouse (창고) and the smithy (대장간) */
function shed(x0,z0,x1,z1,h,k,doors){ const t=0.25;
  wallZ(x0,x1,z0,z0+t,0,h,k,doors.n||[]); wallZ(x0,x1,z1-t,z1,0,h,k,doors.s||[]); wallX(z0+t,z1-t,x0,x0+t,0,h,k,doors.w||[]); wallX(z0+t,z1-t,x1-t,x1,0,h,k,doors.e||[]); }
shed(24,112,34,120,3.2,'boards',{n:[{a:3.5,b:6.5,y0:0,y1:2.8}],e:[door(3)],w:[win(4)]}); WW.misc.push({t:'roofGable',x0:24,z0:112,x1:34,z1:120,y:3.2,h:2.0,broken:0.35});
shed(66,78,76,86,3.4,'boards',{s:[{a:2,b:5,y0:0,y1:2.8}],w:[door(4.2)],n:[win(3),win(7)]}); WW.misc.push({t:'roofGable',x0:66,z0:78,x1:76,z1:86,y:3.4,h:1.6,broken:0.6});
wallZ(58,66,108,108.5,0,2.8,'stone',[]); wallX(108.5,114,58,58.5,0,2.8,'stone',[win(2)]); wallX(108.5,114,65.5,66,0,2.8,'stone',[]); WW.misc.push({t:'forge',x:61,z:110.2},{t:'anvil',x:63,z:111.6},{t:'roofFlat',x0:58,z0:108,x1:66,z1:114,y:2.8});
B(60,109.2,62,110.9,0,0.95,'hidden');
/* v7.11 more of the village: a plastered cottage with a broken slate roof, a gutted brick cottage, and the farmhouse keeps half its roof */
function cottage(x0,z0,x1,z1,h,k,o,roof){ const t=0.45; wallZ(x0,x1,z0,z0+t,0,o.nh||h,k,o.n||[]); wallZ(x0,x1,z1-t,z1,0,o.sh||h,k,o.s||[]); wallX(z0+t,z1-t,x0,x0+t,0,o.wh||h,k,o.w||[]); wallX(z0+t,z1-t,x1-t,x1,0,o.eh||h,k,o.e||[]);
  if(roof) WW.misc.push({t:'roofGable',x0,z0,x1,z1,y:h,h:roof,broken:0.5,mat:'ter:roof',gmat:k==='stone'?'ter:stone':'ter:brick'}); }
cottage(29,84,36.5,89.5,2.9,'stone',{n:[win(1.1),door(3.3)],s:[win(2.6)],w:[win(1.8)],e:[door(2)]},2.3);
cottage(11,86,19,92.5,2.8,'brickW',{n:[door(1.4),win(4.8)],s:[win(2.2)],eh:1.3,sh:1.8,w:[win(2.2)]},0);
B(16.6,92.6,17.8,93.8,0,6.2,'brickW'); WW.misc.push({t:'chimneyTop',x:17.2,z:93.2,y:6.2});
WW.rubble.push({x:20.6,z:89,r:2.2},{x:15,z:94.4,r:1.6},{x:37.6,z:86.5,r:1.3},{x:32,z:91,r:1.4});
wallZ(FH.x0+7.4,FH.x1,FH.z0,FH.z0+0.45,F1,F1+2.6,'brickW',[win(1.4),win(4.0)]); wallZ(FH.x0+7.4,FH.x1,FH.z1-0.45,FH.z1,F1,F1+2.6,'brickW',[win(2.2)]); wallX(FH.z0+0.45,FH.z1-0.45,FH.x1-0.45,FH.x1,F1,F1+2.6,'brickW',[win(3.0)]);
WW.misc.push({t:'roofGable',x0:FH.x0,z0:FH.z0,x1:FH.x1,z1:FH.z1,y:F1+2.6,h:3.0,broken:0.3,mat:'ter:roof',gmat:'ter:stone',hole:[0.55,0.85]});
WW.smokes.push({x:44,z:95,y:3,s:0.6},{x:33,z:87,y:2,s:0.45});
/* orchard */
for(let r=0;r<3;r++) for(let c=0;c<5;c++){ const x=63+c*3.6+(r%2)*1.6+R()*0.6, z=95+r*3.8+R()*0.6; WW.trees.push({x,z,k:'fruit',s:0.85+R()*0.3}); B(x-0.22,z-0.22,x+0.22,z+0.22,0,3,'hidden'); }
/* the windmill (Soviet sniper post, +12 m): a timber tower with one ladder inside, a platform with a broken cap */
const WM={x:25,z:80}; { const s=2.6, t=0.3, h=12;
  wallZ(WM.x-s,WM.x+s,WM.z-s,WM.z-s+t,0,h,'boards',[{a:2,b:3.2,y0:5,y1:6.3}]); wallZ(WM.x-s,WM.x+s,WM.z+s-t,WM.z+s,0,h,'boards',[{a:1.7,b:3.5,y0:0,y1:2.3}]);
  wallX(WM.z-s+t,WM.z+s-t,WM.x-s,WM.x-s+t,0,h,'boards',[{a:2,b:3,y0:7,y1:8.2}]); wallX(WM.z-s+t,WM.z+s-t,WM.x+s-t,WM.x+s,0,h,'boards',[{a:2,b:3,y0:4,y1:5.2}]);
  B(WM.x-s,WM.z-s,WM.x+s,WM.z+s-1.2,h-0.2,h,'floorW'); ladders.push({x:WM.x+0.6,z:WM.z+s-1.2,face:'n',y0:0,y1:h});
  for(const [a,b,c,d] of [[WM.x-s,WM.z-s,WM.x+s,WM.z-s+0.2],[WM.x-s,WM.z-s,WM.x-s+0.2,WM.z+s],[WM.x+s-0.2,WM.z-s,WM.x+s,WM.z+s]]) B(a,b,c,d,h,h+1.0,'boards');
  WW.misc.push({t:'windmill',x:WM.x,z:WM.z,h}); }
/* burned wheat (concealment) and hay */
WW.wheat.push({x0:16,z0:52,x1:56,z1:68,burnt:1},{x0:16,z0:122,x1:54,z1:132,burnt:1},{x0:204,z0:58,x1:232,z1:76,burnt:0},{x0:206,z0:108,x1:232,z1:126,burnt:0});
/* ---------- B: the crater, the Tiger, hedgehogs, poles, wire, a foxhole; the T-34 and half-track wrecks ---------- */
/* Tiger I, tilted into the crater (climbable: track guard → hull deck → turret) */
WW.wrecks.push({t:'tiger',x:120.5,z:92.4,y:-3.45,rot:0.42,tilt:0.22,roll:-0.12}); WW.rubble.push({x:124.2,z:90.6,r:2.0,k:'metal'},{x:116.8,z:95.2,r:1.8,k:'metal'});
{ const c=Math.cos(0.42), s=Math.sin(0.42); const P=(lx,lz)=>[120.5+lx*c+lz*s,92.4-lx*s+lz*c];
  /* axis-aligned collision pieces sampled along the rotated hull */
  for(let lx=-3.0;lx<=3.0;lx+=1.0) for(const [lz0,lz1,y1] of [[-1.85,-1.15,-0.85],[1.15,1.85,-0.85],[-1.15,1.15,-0.35]]){ const [x,z]=P(lx,(lz0+lz1)/2), hw=0.55, hd=(lz1-lz0)/2+0.25;
    B(x-hw,z-hd*0.9,x+hw,z+hd*0.9,-3.4,y1-1.5+lx*0.05,'wreck'); }
  const [tx,tz]=P(-0.3,0); B(tx-1.0,tz-1.0,tx+1.0,tz+1.0,-1.85,-0.95,'wreck'); }
for(const [x,z,r] of [[103,80,0.3],[108,104,1.1],[133,81,0.7],[137,103,2.2],[112,74,0.2],[128,110,1.5],[99,93,2.6],[141,92,0.9],[126.5,100.6,0.5],[133.6,98.4,1.9],[124,104.5,2.8]]){ WW.hedge.push({x,z,rot:r}); B(x-0.45,z-0.45,x+0.45,z+0.45,0,1.35,'hidden',{pass:true}); }
WW.poles.push({x:104,z:86,lean:0.12,rot:0.3},{x:116,z:79,lean:-0.25,rot:2},{x:131,z:84,lean:0.32,rot:-0.7},{x:142,z:88,lean:0.05,rot:1.1});
for(const p of WW.poles) B(p.x-0.15,p.z-0.15,p.x+0.15,p.z+0.15,0,6.5,'hidden');
WW.wrecks.push({t:'t34',x:85,z:113,y:0,rot:-0.5},{t:'halftrack',x:143,z:77,y:0,rot:2.6},{t:'track',x:126.5,z:99.5,y:-0.9,rot:0.9});
B(82.2,110.6,87.8,115.4,0,1.55,'wreck'); B(83.6,111.8,86.4,114.2,1.55,2.35,'wreck'); B(140.4,75.6,145.6,78.4,0,1.9,'wreck');
/* foxhole on the crater lip */
pit(110,103,1.6,0.6,0); for(let a=0;a<9;a++){ if(a===4) continue; const t=a/9*Math.PI*2; WW.misc.push({t:'bag',x:110+Math.cos(t)*1.95,z:103+Math.sin(t)*1.95,rot:-t,y:0}); }
WW.misc.push({t:'helmet',x:110.4,z:103.3,y:-0.55,de:1},{t:'ammo42',x:109.4,z:102.6,y:-0.55});
/* barbed wire: a row in front of each line with 4 gaps, two short stretches at B */
function wireRow(z,x0,x1,gaps){ let cur=x0; for(const g of gaps.concat([x1+10])){ const a=cur, b=Math.min(x1,g-3); if(b-a>2){ WW.wire.push({x0:a,z0:z,x1:b,z1:z}); B(a,z-0.75,b,z+0.75,0,1.05,'wire',{pass:true}); } cur=g+3; } }
wireRow(56,8,232,[40,95,150,205]); wireRow(124,8,232,[35,90,145,200]);
WW.wire.push({x0:108,z0:77,x1:116,z1:75},{x0:126,z0:106,x1:134,z1:108}); B(108,74.8,116,77.2,0,1.05,'wire',{pass:true}); B(126,105.8,134,108.2,0,1.05,'wire',{pass:true});
/* ---------- C: the trestle bridge (middle 6 m fallen), sloped planks into the creek, a narrow plank across, the culvert ---------- */
const BZ0=86.5, BZ1=90.5;
B(187.2,BZ0,192.2,BZ1,-1.28,-1.0,'plank'); B(197.8,BZ0,202.8,BZ1,-1.28,-1.0,'plank');
B(192.2,88.75,197.8,89.45,-1.18,-1.0,'plank');                                                          // one board still spans the gap (exposed, quick)
ramps.push({x0:192.2,x1:195.9,z0:87.0,z1:88.4,hi:'x0',h:-1.0,base:RWY+0.07,k:'plank'},{x0:194.1,x1:197.8,z0:89.6,z1:90.2+0.2,hi:'x1',h:-1.0,base:RWY+0.07,k:'plank'});
WW.misc.push({t:'bridge',x0:187.2,x1:202.8,z0:BZ0,z1:BZ1,y:-1.0,gap:[192.2,197.8],wy:RWY},{t:'culvert',x:189.6,z:70,rot:Math.PI/2},{t:'willow',x:203.8,z:101});
WW.reeds.push({x0:RVX-4.2,z0:62,x1:RVX-1.5,z1:84},{x0:RVX+1.5,z0:94,x1:RVX+4.4,z1:118},{x0:RVX-4.3,z0:96,x1:RVX-2,z1:112},{x0:RVX+1.8,z0:64,x1:RVX+4.2,z1:80});
B(203.3,100.5,204.3,101.5,-1.0,4,'hidden');
/* sandbagged MG mound on the far bank (cover) */
for(let a=0;a<10;a++){ const t=-Math.PI/2+(a-4.5)*0.24; WW.misc.push({t:'bag',x:207+Math.cos(t)*2.4,z:80+Math.sin(t)*2.4,rot:-t,y:0}); } B(204.8,77.2,209.2,78.1,0,0.85,'sandbag');
/* the water tower (German sniper post, +14 m): four legs, one ladder, a railed deck */
const WT={x:215,z:115};
for(const [dx,dz] of [[-1.6,-1.6],[1.6,-1.6],[-1.6,1.6],[1.6,1.6]]) B(WT.x+dx-0.18,WT.z+dz-0.18,WT.x+dx+0.18,WT.z+dz+0.18,0,14,'hidden');
B(WT.x-2.4,WT.z-2.4,WT.x+2.4,WT.z+2.4,13.8,14,'floorW'); for(const [a,b,c,d] of [[-2.4,-2.4,2.4,-2.3],[-2.4,2.3,0.6,2.4],[-2.4,-2.4,-2.3,2.4],[2.3,-2.4,2.4,2.4]]) B(WT.x+a,WT.z+b,WT.x+c,WT.z+d,14,15.05,'hidden');
ladders.push({x:WT.x+1.5,z:WT.z+2.4,face:'n',y0:0,y1:14}); WW.misc.push({t:'watertower',x:WT.x,z:WT.z});
/* ---------- emplaced weapons that can be manned (E) ---------- */
mounts.push({id:'mx1',k:'maxim',team:1,x:75,z:46.45,y:-0.05,yaw:Math.PI,arc:1.05,op:[75,45.1,-1.1]});
mounts.push({id:'mx2',k:'maxim',team:1,x:171,z:46.45,y:-0.05,yaw:Math.PI,arc:1.05,op:[171,45.1,-1.1]});
mounts.push({id:'at1',k:'at45',team:1,x:132,z:50.6,y:0,yaw:Math.PI,arc:0.95,op:[132,48.7,0]});
mounts.push({id:'mg1',k:'mg42',team:0,x:51,z:133.6,y:-0.05,yaw:0,arc:1.05,op:[51,134.9,-1.1]});
mounts.push({id:'mg2',k:'mg42',team:0,x:159,z:128.45,y:0.58,yaw:0,arc:0.6,op:[159,130.1,-1.0],inside:true});
mounts.push({id:'at2',k:'pak40',team:0,x:88,z:128.4,y:0,yaw:0,arc:0.95,op:[88,130.6,0]});
/* nests: sandbags round the AT guns and the gun's spot on the parapet opened up */
for(const [x,z,f] of [[132,50.6,1],[88,128.4,-1]]) for(let a=0;a<9;a++){ const t=(f>0?Math.PI/2:-Math.PI/2)+(a-4)*0.36; WW.misc.push({t:'bag',x:x+Math.cos(t)*2.3,z:z+Math.sin(t)*2.3,rot:-t,y:0}); }
B(129.4,52.4,134.6,53.1,0,0.7,'sandbag'); B(85.4,125.9,90.6,126.6,0,0.7,'sandbag');
/* ---------- trench dressing: Z1 details per firebay (ammo stacks, leaning rifles, lanterns, phone wire, signs, periscopes, helmets) ---------- */
for(let a=12;a<228;a+=24){ const ru={x:a+3,z:43.4}, de={x:a+3+6,z:136.6};
  WW.crates.push({x:a+0.9,z:42.6,y:-2.2,rot:0.1,k:'ru',n:1+(a%3)},{x:a+11.2,z:136.7,y:-2.2,rot:-0.2,k:'de',n:1+((a/12)%2)});
  if(a%48===12){ WW.rifles.push({x:a+5.4,z:42.25,y:-2.2,rot:0,id:'mosin',n:3}); WW.lanterns.push({x:a+3,y:-0.65,z:42.15,wall:1}); }
  if(a%48===36){ WW.rifles.push({x:a+7.5,z:137.75,y:-2.2,rot:Math.PI,id:'kar98',n:2}); WW.lanterns.push({x:a+9,y:-0.65,z:137.85,wall:1}); }
  WW.misc.push({t:'helmet',x:a+1.6,z:43.1,y:-2.14,ru:1},{t:'helmet',x:a+10.4,z:136.9,y:-2.14,de:1}); }
WW.signs.push({x:61,y:-0.55,z:42.08,rot:0,txt:'ОСТОРОЖНО! СНАЙПЕР',style:'ru'},{x:157,y:-0.55,z:42.08,rot:0,txt:'ОСТОРОЖНО! СНАЙПЕР',style:'ru'},{x:63,y:-0.55,z:137.92,rot:Math.PI,txt:'ACHTUNG! FEINDEINSICHT',style:'de'});
WW.misc.push({t:'periscope',x:110,z:45.2,y:-1.1},{t:'periscope',x:182,z:134.8,y:-1.1},{t:'plate',x:139,z:46.4,y:0},{t:'plate',x:103,z:133.6,y:0},{t:'phoneWire',z:42.1,x0:12,x1:226,y:-0.6},{t:'phoneWire',z:137.9,x0:12,x1:226,y:-0.6});
/* rear areas: supply crates, mortar ammo, a field kitchen tent, trucks under nets, smoke columns over the steppe */
WW.crates.push({x:128,z:16,y:0,rot:0.3,k:'ru',n:3},{x:104,z:12,y:0,rot:-0.4,k:'ru',n:2},{x:160,z:26,y:0,rot:0.1,k:'ru',n:2},{x:113,z:165,y:0,rot:0.2,k:'de',n:3},{x:134,z:170,y:0,rot:-0.3,k:'de',n:2},{x:78,z:151,y:0,rot:0.4,k:'de',n:2});
for(const c of WW.crates) if(c.y===0) B(c.x-0.9,c.z-0.9,c.x+0.9,c.z+0.9,0,0.45*(1+Math.min(c.n,2)),'hidden');
WW.nets.push({x:150,z:16,w:9,d:6,y:3.2,truck:'ru',rot:0.1},{x:92,z:166,w:9,d:6,y:3.2,truck:'de',rot:-0.1});
B(146.5,14,153.5,18,0,2.6,'hidden'); B(88.5,164,95.5,168,0,2.6,'hidden');
WW.smokes.push({x:126,z:96,s:0.6,fire:1},{x:85,z:113,s:0.8,fire:1},{x:-30,z:40,s:3},{x:280,z:70,s:3.4},{x:60,z:-40,s:2.6},{x:200,z:230,s:3},{x:-40,z:150,s:2.4},{x:300,z:160,s:2.8});
/* ---------- forests round the edges (trunks inside the play area are solid) ---------- */
const SPAWN_R={x:120,z:7}, SPAWN_G={x:120,z:173};
function forest(x0,z0,x1,z1,n,solidIn){ for(let k=0;k<n;k++){ const x=x0+R()*(x1-x0), z=z0+R()*(z1-z0);
    if(Math.hypot(x-SPAWN_R.x,z-SPAWN_R.z)<22||Math.hypot(x-SPAWN_G.x,z-SPAWN_G.z)<22) continue;
    if(roadD(x,z)<4) continue; if([38,120,172].some(c=>x>c-3&&x<c+9&&((z>6&&z<40)||(z>140&&z<174)))) continue;
    const k2=R()<0.55?'birch':'pine'; WW.trees.push({x,z,k:k2,s:0.8+R()*0.5}); if(solidIn&&x>0&&x<240&&z>0&&z<180) B(x-0.25,z-0.25,x+0.25,z+0.25,0,6,'hidden'); } }
forest(2,1,238,11,12,true); forest(2,169,238,179,80,true); forest(-40,-40,280,-2,160,false); forest(-40,182,280,222,160,false); forest(-40,0,-3,180,70,false); forest(243,0,280,180,70,false);
forest(1,20,8,165,26,true); forest(232,20,239,165,26,true);
/* ---------- grid: one 4 m cell of invisible wall all round ---------- */
const GW=62, GH=47, grid=[]; for(let r=0;r<GH;r++){ let s=''; for(let c=0;c<GW;c++) s+=(r===0||r===GH-1||c===0||c===GW-1)?'#':'.'; grid.push(s); }
grid[0]='#'.repeat(2)+'DDD'+'#'.repeat(GW-5);
/* ---------- tag mode: orb cells on open, level ground (raster 0 at the cell middle and nothing standing there) ---------- */
const openCell=(c,r)=>{ const x=c*4+2-OX, z=r*4+2-OX; for(const dx of [-1,0,1]) for(const dz of [-1,0,1]){ const i=Math.floor((x+dx+OX)/RES), j=Math.floor((z+dz+OX)/RES); if(Math.abs(H[j*NX+i])>0.05) return false; }
  return !boxes.some(b=>x+1.2>b.x0&&x-1.2<b.x1&&z+1.2>b.z0&&z-1.2<b.z1); };
const ORB={zones:[],ground:[]}; const ZN=[{n:'A',c0:10,r0:22,c1:16,r1:28},{n:'B',c0:27,r0:20,c1:34,r1:27},{n:'C',c0:45,r0:20,c1:53,r1:26}];
for(const z of ZN){ const L=[]; for(let r=z.r0;r<z.r1;r++) for(let c=z.c0;c<z.c1;c++) if(openCell(c,r)) L.push([c,r]); for(let k=L.length-1;k>0;k--){ const q=(R()*(k+1))|0; [L[k],L[q]]=[L[q],L[k]]; } ORB.zones.push(L.slice(0,4)); }
for(let r=4;r<43;r+=3) for(let c=3;c<59;c+=4) if(openCell(c,r)&&R()<0.5) ORB.ground.push([c,r]);
/* earth banked against the pillbox sides and back */
each(151.8,125.8,166.2,135.2,(k,x,z)=>{ if(x>155.6&&x<162.4&&z>127.6&&z<132.4) return; if(x>161.6&&x<164.6&&z>128.6&&z<137) return; if(z<127.6&&x>153.5&&x<164.5) return; if(MT[k]===2||H[k]<-0.05) return;
  const dx=Math.max(155.8-x,x-162.2,0), dz=Math.max(127.8-z,z-132.2,0), d=Math.hypot(dx,dz); if(d<3.2) H[k]=Math.max(H[k],1.0*(1-d/3.2)*(1-d/3.2)*(3-2*(1-d/3.2))); });
/* the sunken road west of B: fences along both banks, a few crates, puddles in the ruts */
for(const [x0,x1,dz] of [[64,92,-4.3],[64,92,4.3]]){ const z0=95.5-(x0-60)*0.067+dz, z1=95.5-(x1-60)*0.067+dz; WW.fence.push({x0,z0,x1,z1}); B(x0,Math.min(z0,z1)-0.12,x1,Math.max(z0,z1)+0.12,0,1.0,'hidden'); }
WW.crates.push({x:78.5,z:98.9,y:0,rot:0.4,k:'de',n:2},{x:70.2,z:90.2,y:0,rot:-0.2,k:'ru',n:1});
/* v7.11 watchtowers behind each line, sandbags on the pillbox flanks */
function tower(x,z){ const s=1.2; for(const [a,b] of [[-s,-s],[s,-s],[-s,s],[s,s]]) B(x+a-0.12,z+b-0.12,x+a+0.12,z+b+0.12,0,6.2,'log'); B(x-s-0.2,z-s-0.2,x+s+0.2,z+s+0.2,4.4,4.6,'floorW');
  for(const [a,b,c,d] of [[x-s-0.2,z-s-0.2,x+s+0.2,z-s],[x-s-0.2,z+s,x+s+0.2,z+s+0.2],[x-s-0.2,z-s,x-s,z+s]]) B(a,b,c,d,4.6,5.5,'boards');
  WW.misc.push({t:'roofGable',x0:x-s-0.5,z0:z-s-0.5,x1:x+s+0.5,z1:z+s+0.5,y:6.2,h:1.0,broken:0}); }
tower(146,147); tower(104,31);
/* v7.11 earthworks: the solid traverse blocks between bays are heaped into rounded mounds; a low parados runs behind each line */
for(const [zf,side] of [[42,1],[138,-1]]) for(let a=12;a+12<=228;a+=12){ const tx0=a+8, tx1=a+10, tz0=side>0?zf-2:zf-4, tz1=side>0?zf+4:zf+2;
  each(tx0-0.2,tz0-0.2,tx1+0.2,tz1+0.2,(k,x,z)=>{ if(MT[k]===2||H[k]<-0.1) return; const u=Math.min(x-tx0+0.2,tx1+0.2-x)/1.2, v=Math.min(z-tz0+0.2,tz1+0.2-z)/1.6; H[k]=Math.max(H[k],0.5*Math.min(1,Math.min(u,v))); }); }
for(const [z0,z1,up] of [[29.5,35.5,1],[144.5,150.5,-1]]) each(10,z0,230,z1,(k,x,z)=>{ if(MT[k]===2||H[k]<-0.1||H[k]>0.05) return; const t=(z-z0)/(z1-z0), w=Math.sin(Math.PI*t); H[k]=Math.max(H[k],0.42*w*(0.75+0.25*Math.sin(x*0.21))); });
/* v7.11 relief: rolling ground, churned mud in no-man's land; fades to nothing within ~2 m of structures, trenches, the road and the ravine */
{ const M=new Float32Array(NX*NZ), mark=(x0,z0,x1,z1)=>each(x0,z0,x1,z1,k=>{ M[k]=1; });
  for(const b of boxes) if(b.k!=='hidden'||b.y1-b.y0>2.5) mark(b.x0-0.6,b.z0-0.6,b.x1+0.6,b.z1+0.6); for(const r of ramps) mark(r.x0-0.6,r.z0-0.6,r.x1+0.6,r.z1+0.6);
  for(const L of ladders) mark(L.x-2,L.z-2,L.x+2,L.z+2); for(const m of mounts) mark(m.x-3,m.z-3,m.x+3,m.z+3); for(let k=0;k<NX*NZ;k++) if(MT[k]>=2||H[k]<-0.5) M[k]=1;
  const blur=(A,r)=>{ const T=new Float32Array(NX*NZ), O=new Float32Array(NX*NZ), n=2*r+1;
    for(let j=0;j<NZ;j++){ let s=0; for(let i=0;i<Math.min(r,NX);i++) s+=A[j*NX+i]; for(let i=0;i<NX;i++){ if(i+r<NX) s+=A[j*NX+i+r]; if(i-r-1>=0) s-=A[j*NX+i-r-1]; T[j*NX+i]=s/n; } }
    for(let i=0;i<NX;i++){ let s=0; for(let j=0;j<Math.min(r,NZ);j++) s+=T[j*NX+i]; for(let j=0;j<NZ;j++){ if(j+r<NZ) s+=T[(j+r)*NX+i]; if(j-r-1>=0) s-=T[(j-r-1)*NX+i]; O[j*NX+i]=s/n; } } return O; };
  const W=blur(M,4), hs=(x,z)=>{ const n=Math.sin(x*127.1+z*311.7)*43758.5453; return n-Math.floor(n); },
    vn=(x,z)=>{ const i=Math.floor(x), j=Math.floor(z), f=x-i, g=z-j, u=f*f*(3-2*f), v=g*g*(3-2*g); return (hs(i,j)*(1-u)+hs(i+1,j)*u)*(1-v)+(hs(i,j+1)*(1-u)+hs(i+1,j+1)*u)*v; };
  for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const k=j*NX+i; if(M[k]) continue; const w=Math.max(0,1-W[k]*2.2); if(w<=0) continue; const x=cx(i), z=cz(j), mud=MT[k]===1;
    const roll=(vn(x/46+9,z/46+2)-0.5)*2*(mud?1.2:0.6)+(vn(x/11+3,z/11+7)-0.5)*2*(mud?0.8:0.38)+(vn(x/3.6+11,z/3.6+5)-0.5)*2*(mud?0.34:0.08), churn=mud?(vn(x/1.3,z/1.3)-0.5)*0.12:0;
    H[k]+=(roll+churn)*w*w*(3-2*w); } }
/* v7.11 sandbag courses along every trench lip (walkable 0.34 m; skipped where a ramp leaves the trench or something already stands) */
{ const occ=new Uint8Array(NX*NZ); for(const b of boxes) each(b.x0-0.05,b.z0-0.05,b.x1+0.05,b.z1+0.05,k=>{ occ[k]=1; });
  { const T0=new Uint8Array(NX*NZ); for(let j=1;j<NZ-1;j++) for(let i=1;i<NX-1;i++){ const k=j*NX+i; if(MT[k]===2||H[k]<-0.3||occ[k]) continue; for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const q=(j+b)*NX+i+a; if(MT[q]===2&&H[q]<=-1.5){ T0[k]=1; break; } } }
    for(let j=1;j<NZ-1;j++) for(let i=1;i<NX-1;i++){ const k=j*NX+i; if(T0[k]){ H[k]-=0.26; continue; } if(MT[k]===2||H[k]<-0.3||occ[k]) continue; for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]) if(T0[(j+b)*NX+i+a]){ H[k]-=0.1; break; } } }
  const lip=new Uint8Array(NX*NZ);
  for(let j=1;j<NZ-1;j++) for(let i=1;i<NX-1;i++){ const k=j*NX+i; if(MT[k]===2||H[k]<-0.5||occ[k]) continue; let tr=false, rampN=false;
    for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const q=(j+b)*NX+i+a; if(MT[q]===2&&H[q]<=-1.5) tr=true; }
    for(let b=-2;b<=2;b++) for(let a=-2;a<=2;a++){ const q=(j+b)*NX+i+a; if(H[q]<-0.25&&H[q]>-1.45) rampN=true; }
    if(tr&&!rampN) lip[k]=1; }
  const used=new Uint8Array(NX*NZ);
  for(let j=0;j<NZ;j++) for(let i=0;i<NX;i++){ const k=j*NX+i; if(!lip[k]||used[k]) continue; let i1=i; while(i1+1<NX&&lip[j*NX+i1+1]&&!used[j*NX+i1+1]) i1++;
    if(i1>i){ for(let a=i;a<=i1;a++) used[j*NX+a]=1; B(cx(i)-0.25,cz(j)-0.25,cx(i1)+0.25,cz(j)+0.25,H[k],H[k]+0.44,'sandbag'); } }
  for(let i=0;i<NX;i++) for(let j=0;j<NZ;j++){ const k=j*NX+i; if(!lip[k]||used[k]) continue; let j1=j; while(j1+1<NZ&&lip[(j1+1)*NX+i]&&!used[(j1+1)*NX+i]) j1++;
    for(let b=j;b<=j1;b++) used[b*NX+i]=1; B(cx(i)-0.25,cz(j)-0.25,cx(i)+0.25,cz(j1)+0.25,H[k],H[k]+0.44,'sandbag'); } }
/* village trees, smoke from the crater and far-off fires */
for(const [x,z,k] of [[40.5,88.4,'birch'],[36,103.5,'willow'],[25.5,93.5,'birch'],[59.5,101.5,'birch'],[10,99,'birch']]){ WW.trees.push({x,z,k,s:1.05}); B(x-0.3,z-0.3,x+0.3,z+0.3,0,5,'hidden'); }
WW.smokes.push({x:121,z:93,y:-2.2,s:1.0,low:1},{x:119.4,z:93.2,y:-1.4,s:0.75,low:1},{x:119.6,z:92.8,y:-1.2,s:0.5,low:1},{x:121,z:93,y:-0.5,s:1.6},{x:119.5,z:91.5,y:-1.5,s:0.35,fire:1},{x:62,z:-48,y:0,s:3.2},{x:196,z:-58,y:0,s:2.9},{x:-40,z:-60,y:0,s:2.6},{x:300,z:230,y:0,s:3.0},{x:-70,z:220,y:0,s:2.6});
WW.lanterns.push({x:73.2,y:-0.5,z:42.7,hang:true,light:2}); WW.signs.push({x:75.6,y:-1.0,z:42.2,rot:0,txt:'★',style:'star'},{x:72.06,y:-0.9,z:44.0,rot:Math.PI/2,txt:'★',style:'star'}); WW.crates.push({x:71.4,z:42.9,y:-2.2,rot:0.2,k:'ru',n:2},{x:77.4,z:43.0,y:-2.2,rot:-0.1,k:'ru',n:1}); WW.rifles.push({x:78.2,z:42.45,y:-2.2,rot:0,id:'mosin',n:2});
WW.misc.push({t:'pbgun',x:157.1,z:127.85,y:1.05},{t:'pbroof',x0:155.4,z0:127.4,x1:162.6,z1:132.6,y:2.05},{t:'farmill',x:62,z:-6,h:24},{t:'watertower',x:198,z:-6,far:1,s:1.45});
/* props for the panels: a cart before the farmhouse, Soviet flag on the dugout and in the trench, lanterns */
B(49.0,84.6,51.8,86.6,0,1.3,'hidden'); WW.fence.push({x0:45.5,z0:86.6,x1:51.2,z1:86.0}); B(45.5,85.9,51.2,86.7,0,1.0,'hidden'); WW.misc.push({t:'cart',x:50.4,z:85.6,rot:0.5,s:1.05},{t:'flag',x:117.6,z:21.2,y:0.5,h:3.2},{t:'flag',x:91.2,z:41.6,y:0,h:2.6});
WW.signs.push({x:101.5,y:-1.0,z:42.2,rot:0,txt:'★',style:'star'}); WW.lanterns.push({x:104.5,y:-0.6,z:42.4,hang:true,light:1},{x:113,y:-0.55,z:20.9,hang:true,light:2},{x:159,y:1.35,z:131.0,hang:true,light:1});
/* v7.11 ground marks for the terrain shader: tyre ruts on the road and across the fields, puddles in craters and on the road, scorched earth around shell holes */
const DEC=[{t:'rut',pts:ROAD.map(p=>p.slice()),w:0.85,wet:0.6},{t:'rut',pts:[[96,132],[104,118],[110,106],[113,100]],w:1.3,wet:0.4},{t:'rut',pts:[[150,132],[142,120],[136,108],[130,98]],w:1.3,wet:0.4},{t:'rut',pts:[[70,132],[76,120],[86,110],[100,104]],w:1.25,wet:0.35},{t:'rut',pts:[[124,132],[121,122],[122,110]],w:1.3,wet:0.45},{t:'rut',pts:[[36,58],[62,68],[92,78],[112,86]],w:1.25,wet:0.35},{t:'rut',pts:[[156,126],[140,112],[128,100]],w:1.25,wet:0.35},{t:'rut',pts:[[58,128],[78,114],[98,102]],w:1.25,wet:0.3},{t:'rut',pts:[[170,60],[160,72],[146,82]],w:1.2,wet:0.3}];
DEC.push({t:'scorch',x:120.5,z:92.4,r:7.5,a:1.0});
for(const [x,z,r,d] of CRATERS){ DEC.push({t:'scorch',x,z,r:r*(r>5?1.25:1.45),a:r>5?0.9:0.7}); if(d>0.4&&r<5) DEC.push({t:'puddle',x:x+(R()-0.5)*r*0.3,z:z+(R()-0.5)*r*0.3,r:r*(r>5?0.22:0.34)}); }
DEC.push({t:'puddle',x:84,z:93.9,r:1.4},{t:'puddle',x:74,z:94.6,r:1.1},{t:'puddle',x:67,z:95.1,r:1.2});
for(let i=1;i<ROAD.length-1;i++) for(const f of [0.3,0.7]){ const [a,b]=[ROAD[i],ROAD[i+1]]; if(R()<0.6) DEC.push({t:'puddle',x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f+(R()-0.5)*1.2,r:0.8+R()*0.9}); }
/* dead trees in no-man's land (bare, shell-stripped) */
for(let n=0,c=0;n<300&&c<24;n++){ const x=10+R()*220, z=56+R()*68; if(Math.abs(x-RVX)<13) continue; if(CRATERS.some(([a,b,r])=>Math.hypot(x-a,z-b)<r+1.5)) continue;
  if(ROAD.some(([a,b])=>Math.hypot(x-a,z-b)<6)) continue; if(Math.abs(x-120)<16&&Math.abs(z-92)<16) continue; if(x<68&&z>74&&z<114) continue; WW.trees.push({x,z,k:'dead',s:0.7+R()*0.6}); B(x-0.22,z-0.22,x+0.22,z+0.22,0,5,'hidden'); c++; }
/* ---------- shift design → world (+4 m) ---------- */
const D=o=>{ for(const k of ['x','z','x0','x1','z0','z1','ex','ez']) if(typeof o[k]==='number') o[k]+=OX; return o; };
boxes.forEach(D); ramps.forEach(D); ladders.forEach(D); props.forEach(D); for(const k in WW) WW[k].forEach(D); SLOW.forEach(D);
for(const m of mounts){ D(m); m.op=[m.op[0]+OX,m.op[1]+OX,m.op[2]]; }
for(const m of WW.misc) if(m.t==='frame'){ m.a+=OX; m.b+=OX; m.c+=OX; }
for(const d of DEC){ if(d.pts) d.pts=d.pts.map(([x,z])=>[x+OX,z+OX]); else D(d); }
const P=(x,z,y)=>({x:x+OX,z:z+OX,y:y||0});
SandTag.registerMap({
  id:'kursk', name:'쿠르스크 참호선', desc:'1943년 7월 동부전선. 지그재그 참호, 분화구의 티거 잔해, 협곡 목교. 거치된 기관총·대전차포를 E로 잡아 쏠 수 있어요',
  theme:'kursk', rockH:30, size:[GW,GH], grid, autoFill:false, interact:false, ww2:WW, slow:SLOW,
  terrain:{res:RES,nx:NX,nz:NZ,h:H,mat:MT,wall:WL,decals:DEC},
  boxes, ramps, ladders, props, mounts,
  door:{c0:2,r0:0,c1:5,name:'북서쪽 숲길'}, jail:P(226,14), portals:[{x:P(30,116).x,z:P(30,116).z,yaw:0,ex:P(212,60).x,ez:P(212,60).z,eyaw:Math.PI},{x:P(212,60).x+2,z:P(212,60).z+2,yaw:0,ex:P(34,122).x,ez:P(34,122).z,eyaw:Math.PI}],
  spawns:{runner:Object.assign(P(120,172),{yaw:0}),seeker:Object.assign(P(120,8),{yaw:Math.PI})},
  zones:ZN,
  orbs:{zones:ORB.zones,up:[],ground:ORB.ground},
  battle:{
    spawnsA:[P(108,172),P(114,175),P(120,171),P(126,175),P(132,172),P(111,168),P(129,168),P(120,176),P(104,168),P(136,168),P(116,165),P(124,165)],
    spawnsB:[P(108,8),P(114,5),P(120,9),P(126,5),P(132,8),P(111,12),P(129,12),P(120,4),P(104,12),P(136,12),P(116,15),P(124,15)],
    points:[{n:'A',...P(45,96)},{n:'B',...P(117,89,-2.4)},{n:'C',...P(195,88.5,-1)}],
    hardpoints:[P(45,96),P(117,89,-2.4),P(195,88.5,-1),P(85,108),P(143,82),P(70,84)],
    sites:[{n:'A',...P(29,116)},{n:'B',...P(196,98,-RD)}],
    flags:[P(117,169),P(117,11)],
    upload:{drive:P(117,89,-2.4),goals:[P(117,169),P(117,11)]},
    parkour:{loop:false,waypoints:[[124,174],[122,150],[118,128],[108,112],[100,98],[112,84],[130,78],[146,70],[150,58],[136,40],[124,20]].map(([x,z])=>[x+OX,z+OX])}
  },
  decor:[]
});
})();
