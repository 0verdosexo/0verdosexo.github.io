/* mapgen.js — turns compact building descriptions into collision boxes, stairs, ladders and render pieces.
   Building (metres, x/z = min corner, put corners on even metres):
   {x,z,w,d,floors:2,fh:4.5,style:'white'|'concrete'|'brick'|'metal'|'neon'|'glass',
    doors:[['s',offset,floor,width]], win:'auto'|false, winSkip:['n'], stairs:[{x,z,w,len,dir:'n'|'s'|'e'|'w',from:0}],
    rooms:[{x0,z0,x1,z1,floor,doors:[[side,offset]]}], ladders:[[side,offset]], roof:'parapet'|'flat'|'none', open:[[side,floor]] }
   Doors/windows are snapped so their centre sits on an odd metre (where the 2 m navigation grid samples). */
'use strict';
const WALL_T=0.3, DOOR_W=2.4, DOOR_H=2.6, WIN_W=1.6, SILL=0.9, WIN_TOP=3.2, SLAB_T=0.25, PARA_H=1.05, RAIL_H=1.0;
function snapOdd(v){ return Math.round((v-1)/2)*2+1; }
function subtractRects(rects,hole){
  const out=[];
  for(const r of rects){
    const ix0=Math.max(r.x0,hole.x0), ix1=Math.min(r.x1,hole.x1), iz0=Math.max(r.z0,hole.z0), iz1=Math.min(r.z1,hole.z1);
    if(ix0>=ix1||iz0>=iz1){ out.push(r); continue; }
    if(r.z0<iz0) out.push({x0:r.x0,x1:r.x1,z0:r.z0,z1:iz0});
    if(iz1<r.z1) out.push({x0:r.x0,x1:r.x1,z0:iz1,z1:r.z1});
    if(r.x0<ix0) out.push({x0:r.x0,x1:ix0,z0:iz0,z1:iz1});
    if(ix1<r.x1) out.push({x0:ix1,x1:r.x1,z0:iz0,z1:iz1});
  }
  return out.filter(r=>r.x1-r.x0>0.05&&r.z1-r.z0>0.05);
}
/* split a wall line into solid segments around openings. openings: [{a,b,y0,y1}] along axis */
function wallPieces(len,y0,y1,openings){
  const pieces=[]; const ops=openings.slice().sort((p,q)=>p.a-q.a); let cur=0;
  for(const o of ops){ const a=Math.max(0,o.a), b=Math.min(len,o.b); if(b<=a) continue;
    if(a>cur) pieces.push({a:cur,b:a,y0,y1});
    if(o.y0>y0+0.01) pieces.push({a,b,y0,y1:o.y0,part:'sill'});
    if(o.y1<y1-0.01) pieces.push({a,b,y0:o.y1,y1,part:'lintel'});
    cur=Math.max(cur,b); }
  if(cur<len) pieces.push({a:cur,b:len,y0,y1});
  return pieces;
}
function genBuildings(def){
  const out={boxes:[],ramps:[],ladders:[],meta:[]};
  (def.buildings||[]).forEach((B,bi)=>{
    const fh=B.fh||4.5, F=B.floors||1, st=B.style||'white', x0=B.x, z0=B.z, x1=B.x+B.w, z1=B.z+B.d, H=F*fh;
    const id='b'+bi; out.meta.push({t:'bld',id,x0,z0,x1,z1,floors:F,fh,style:st,roof:B.roof||'parapet',name:B.name||'',garden:!!B.garden,sign:B.sign||null,server:!!B.server});
    const sideLen={n:B.w,s:B.w,w:B.d,e:B.d};
    /* openings per side per floor */
    const opens={}; const key=(s,f)=>s+f;
    const addOpen=(s,f,o)=>{ (opens[key(s,f)]=opens[key(s,f)]||[]).push(o); };
    const sideOrigin=s=>s==='n'||s==='s'?x0:z0;
    for(const d of (B.doors||[])){ const [s,off,fl,wd]=d, f=fl||0, w=wd||DOOR_W; const c=snapOdd(sideOrigin(s)+off)-sideOrigin(s);
      addOpen(s,f,{a:c-w/2,b:c+w/2,y0:0,y1:DOOR_H,door:true}); out.meta.push({t:'door',side:s,c:sideOrigin(s)+c,w,floor:f,bid:id}); }
    for(const o of (B.open||[])){ const [s,f]=o; addOpen(s,f,{a:-1,b:sideLen[s]+1,y0:0,y1:fh,open:true});
      /* pillars every ~8 m along an open side, and a low rail on upper floors */
      const L=sideLen[s], n=Math.max(1,Math.round(L/8)), y0=f*fh;
      for(let i=0;i<=n;i++){ const a=Math.min(L-0.6,Math.max(0,i*L/n-0.3)); let b;
        if(s==='n') b={x0:x0+a,x1:x0+a+0.6,z0:z0,z1:z0+0.6}; else if(s==='s') b={x0:x0+a,x1:x0+a+0.6,z0:z1-0.6,z1:z1};
        else if(s==='w') b={x0:x0,x1:x0+0.6,z0:z0+a,z1:z0+a+0.6}; else b={x0:x1-0.6,x1:x1,z0:z0+a,z1:z0+a+0.6};
        out.boxes.push(Object.assign(b,{y0,y1:y0+fh,k:'pillar',bid:id,style:st})); }
      if(f>=1&&o[2]!==false){ let b; const T=0.25;
        if(s==='n') b={x0:x0,x1:x1,z0:z0,z1:z0+T}; else if(s==='s') b={x0:x0,x1:x1,z0:z1-T,z1:z1}; else if(s==='w') b={x0:x0,x1:x0+T,z0:z0,z1:z1}; else b={x0:x1-T,x1:x1,z0:z0,z1:z1};
        out.boxes.push(Object.assign(b,{y0,y1:y0+RAIL_H,k:'parapet',bid:id,style:st})); } }
    if(B.win!==false){
      for(const s of ['n','s','e','w']){ if((B.winSkip||[]).includes(s)) continue; const L=sideLen[s], org=sideOrigin(s);
        for(let f=0;f<F;f++){ const ex=opens[key(s,f)]||[];
          for(let c=snapOdd(org+2)-org; c<=L-1.9; c+=4){ if(c<1.9) continue; if(ex.some(o=>c+WIN_W/2>o.a-0.6&&c-WIN_W/2<o.b+0.6)) continue;
            if(f===0&&B.groundWin===false) continue;
            addOpen(s,f,{a:c-WIN_W/2,b:c+WIN_W/2,y0:SILL,y1:WIN_TOP,win:true}); out.meta.push({t:'win',side:s,c:org+c,w:WIN_W,floor:f,y0:f*fh+SILL,y1:f*fh+WIN_TOP,bid:id,style:st}); } } }
    }
    /* exterior walls */
    for(let f=0;f<F;f++){ const y0=f*fh, y1=(f+1)*fh;
      for(const s of ['n','s','e','w']){
        const L=sideLen[s]; const pieces=wallPieces(L,0,fh,opens[key(s,f)]||[]);
        for(const p of pieces){ let b;
          if(s==='n') b={x0:x0+p.a,x1:x0+p.b,z0:z0,z1:z0+WALL_T};
          else if(s==='s') b={x0:x0+p.a,x1:x0+p.b,z0:z1-WALL_T,z1:z1};
          else if(s==='w') b={x0:x0,x1:x0+WALL_T,z0:z0+p.a,z1:z0+p.b};
          else b={x0:x1-WALL_T,x1:x1,z0:z0+p.a,z1:z0+p.b};
          b.y0=y0+p.y0; b.y1=y0+p.y1; b.k='wall'; b.bid=id; b.side=s; b.style=st; b.part=p.part||'full'; out.boxes.push(b); }
      }
    }
    /* stairs (ramps) and slab holes */
    const holes=[]; for(let f=0;f<=F;f++) holes[f]=[];
    for(const S of (B.stairs||[])){ const f=S.from||0, w=S.w||2.4, len=S.len||8, dir=S.dir||'n';
      const along=dir==='n'||dir==='s'; let rx0=x0+S.x, rz0=z0+S.z;
      if(along) rx0=snapOdd(rx0+w/2)-w/2; else rz0=snapOdd(rz0+w/2)-w/2;   // centre line on an odd metre (nav samples)
      const rx1=rx0+(along?w:len), rz1=rz0+(along?len:w), M=0.55;
      const hi=dir==='n'?'z0':dir==='s'?'z1':dir==='w'?'x0':'x1';
      const r={x0:rx0,x1:rx1,z0:rz0,z1:rz1,hi,h:(f+1)*fh,base:f*fh,stair:true,bid:id,style:st}; out.ramps.push(r);
      holes[f+1].push(along?{x0:rx0-M,x1:rx1+M,z0:rz0,z1:rz1,dir,f:f+1}:{x0:rx0,x1:rx1,z0:rz0-M,z1:rz1+M,dir,f:f+1});
    }
    const atr=[]; for(const A of (B.atria||[])){ const a={x0:x0+A.x0,x1:x0+A.x1,z0:z0+A.z0,z1:z0+A.z1,dir:'atrium',f:A.floor||1}; holes[a.f]&&holes[a.f].push(a); atr.push(a); }
    /* floor slabs (floors 1..F-1) and roof (floor F) */
    for(let f=1;f<=F;f++){ const y=f*fh; let rects=[{x0:x0+WALL_T,x1:x1-WALL_T,z0:z0+WALL_T,z1:z1-WALL_T}];
      if(f===F) rects=[{x0,x1,z0,z1}];
      for(const h of holes[f]) rects=subtractRects(rects,h);
      for(const r of rects) out.boxes.push({x0:r.x0,x1:r.x1,z0:r.z0,z1:r.z1,y0:y-SLAB_T,y1:y,k:f===F?'roof':'slab',bid:id,style:st,floor:f});
      /* rails around stair holes (open at the arrival end) */
      for(const h of holes[f]){ const RT=0.08, sides=[];
        if(h.dir==='atrium'){ sides.push({x0:h.x0,x1:h.x1,z0:h.z0-RT,z1:h.z0},{x0:h.x0,x1:h.x1,z0:h.z1,z1:h.z1+RT},{x0:h.x0-RT,x1:h.x0,z0:h.z0,z1:h.z1},{x0:h.x1,x1:h.x1+RT,z0:h.z0,z1:h.z1}); }
        else { if(h.dir!=='n') sides.push({x0:h.x0,x1:h.x1,z0:h.z0-RT,z1:h.z0}); if(h.dir!=='s') sides.push({x0:h.x0,x1:h.x1,z0:h.z1,z1:h.z1+RT}); }
        if(h.dir!=='atrium'){ if(h.dir!=='w') sides.push({x0:h.x0-RT,x1:h.x0,z0:h.z0,z1:h.z1}); if(h.dir!=='e') sides.push({x0:h.x1,x1:h.x1+RT,z0:h.z0,z1:h.z1}); }
        for(const b of sides){ if(b.x0<x0+WALL_T-0.01||b.x1>x1-WALL_T+0.01||b.z0<z0+WALL_T-0.01||b.z1>z1-WALL_T+0.01) continue;
          out.boxes.push(Object.assign(b,{y0:y,y1:y+RAIL_H,k:'rail',bid:id,style:st})); }
      }
    }
    /* roof parapet with gaps where ladders arrive */
    const lad=(B.ladders||[]).map(([s,off])=>({s,c:snapOdd(sideOrigin(s)+off)-sideOrigin(s)}));
    if((B.roof||'parapet')==='parapet'){
      for(const s of ['n','s','e','w']){ const L=sideLen[s]; const gaps=lad.filter(l=>l.s===s).map(l=>({a:l.c-0.8,b:l.c+0.8,y0:PARA_H,y1:PARA_H}));
        for(const g of (B.roofGaps||[])) if(g[0]===s){ const c=snapOdd(sideOrigin(s)+g[1])-sideOrigin(s), w=g[2]||4; gaps.push({a:c-w/2,b:c+w/2,y0:PARA_H,y1:PARA_H}); }
        for(const p of wallPieces(L,0,PARA_H,gaps)){ if(p.part) continue; let b;
          if(s==='n') b={x0:x0+p.a,x1:x0+p.b,z0:z0,z1:z0+WALL_T}; else if(s==='s') b={x0:x0+p.a,x1:x0+p.b,z0:z1-WALL_T,z1:z1};
          else if(s==='w') b={x0:x0,x1:x0+WALL_T,z0:z0+p.a,z1:z0+p.b}; else b={x0:x1-WALL_T,x1:x1,z0:z0+p.a,z1:z0+p.b};
          b.y0=H; b.y1=H+PARA_H; b.k='parapet'; b.bid=id; b.style=st; out.boxes.push(b); } }
    }
    /* ladders up the outside to the roof */
    for(const l of lad){ const c=sideOrigin(l.s)+l.c; let L;
      if(l.s==='n') L={x:c,z:z0,face:'s'}; else if(l.s==='s') L={x:c,z:z1,face:'n'}; else if(l.s==='w') L={x:x0,z:c,face:'e'}; else L={x:x1,z:c,face:'w'};
      L.y0=0; L.y1=H; L.bid=id; out.ladders.push(L); }
    /* interior partition rooms */
    for(const R of (B.rooms||[])){ const f=R.floor||0, y0=f*fh; const rx0=x0+R.x0, rx1=x0+R.x1, rz0=z0+R.z0, rz1=z0+R.z1;
      const rs={n:{a:rx0,b:rx1,fixed:rz0,axis:'x'},s:{a:rx0,b:rx1,fixed:rz1,axis:'x'},w:{a:rz0,b:rz1,fixed:rx0,axis:'z'},e:{a:rz0,b:rz1,fixed:rx1,axis:'z'}};
      for(const s of ['n','s','e','w']){ const e=rs[s]; const onExt=(s==='n'&&Math.abs(e.fixed-z0)<0.5)||(s==='s'&&Math.abs(e.fixed-z1)<0.5)||(s==='w'&&Math.abs(e.fixed-x0)<0.5)||(s==='e'&&Math.abs(e.fixed-x1)<0.5); if(onExt) continue;
        const L=e.b-e.a; const ops=(R.doors||[]).filter(d=>d[0]===s).map(d=>{ const c=snapOdd(e.a+d[1])-e.a; return {a:c-DOOR_W/2,b:c+DOOR_W/2,y0:0,y1:DOOR_H,door:true}; });
        for(const p of wallPieces(L,0,fh,ops)){ const h=WALL_T/2; let b;
          if(e.axis==='x') b={x0:e.a+p.a,x1:e.a+p.b,z0:e.fixed-h,z1:e.fixed+h}; else b={x0:e.fixed-h,x1:e.fixed+h,z0:e.a+p.a,z1:e.a+p.b};
          b.y0=y0+p.y0; b.y1=y0+p.y1; b.k='wall'; b.inner=true; b.bid=id; b.style=st; b.part=p.part||'full'; out.boxes.push(b); }
      }
    }
    /* ceiling lights (render only) */
    for(let f=0;f<F;f++) out.meta.push({t:'light',x:(x0+x1)/2,z:(z0+z1)/2,y:(f+1)*fh-SLAB_T-0.05,w:B.w,d:B.d,bid:id,style:st});
  });
  return out;
}
/* parkour course: stepping platforms along the map's waypoints. Returns {boxes, cps:[{x,y,z,i}], start, finish} */
function genParkour(pk,solidTest){
  let wp=pk.waypoints; const boxes=[], cps=[]; if(!wp||wp.length<2) return null;
  /* out along the waypoints, then back on a line 6 m to the side: a longer loop that ends near the start */
  if(pk.loop!==false){ const back=[]; for(let i=wp.length-1;i>=0;i--){ const a=wp[Math.max(0,i-1)], b=wp[Math.min(wp.length-1,i+1)]; let dx=b[0]-a[0], dz=b[1]-a[1]; const l=Math.hypot(dx,dz)||1; dx/=l; dz/=l; back.push([wp[i][0]-dz*6.5,wp[i][1]+dx*6.5]); }
    wp=wp.concat(back.slice(1)); }
  const SP=4.5, PW=2.6; let i=0, prevY=0.6, along=0;
  const start={x:wp[0][0],z:wp[0][1],y:0.6};
  boxes.push({x0:start.x-4,x1:start.x+4,z0:start.z-4,z1:start.z+4,y0:0,y1:0.6,k:'pk',pk:'start'});
  cps.push({x:start.x,y:0.6,z:start.z,i:0});
  /* walk the polyline */
  const segs=[]; let total=0;
  for(let k=1;k<wp.length;k++){ const a=wp[k-1], b=wp[k], L=Math.hypot(b[0]-a[0],b[1]-a[1]); segs.push({a,b,L,s:total}); total+=L; }
  const posAt=d=>{ for(const s of segs) if(d<=s.s+s.L){ const t=(d-s.s)/s.L; return [s.a[0]+(s.b[0]-s.a[0])*t, s.a[1]+(s.b[1]-s.a[1])*t]; } const l=wp[wp.length-1]; return [l[0],l[1]]; };
  let d=6.5;
  while(d<total-3){
    const [x,z]=posAt(d); i++;
    let y=1.4+1.3*Math.sin(i*0.6)+Math.min(2.2,i*0.06); y=Math.max(prevY-0.9,Math.min(prevY+0.75,y)); y=Math.round(y*20)/20;
    const big=i%7===0, w=big?4.2:PW;
    /* try the path line first, then small sideways shifts, then a little higher */
    const [x2,z2]=posAt(d+0.5), tx=x2-x, tz=z2-z, tl=Math.hypot(tx,tz)||1, nx=-tz/tl, nz=tx/tl; let b=null;
    for(const [off,dy] of [[0,0],[2.2,0],[-2.2,0],[0,0.6],[3.4,0],[-3.4,0],[2.2,0.6],[-2.2,0.6]]){
      const yy=Math.min(prevY+0.75,y+dy), cx=x+nx*off, cz=z+nz*off;
      const c={x0:cx-w/2,x1:cx+w/2,z0:cz-w/2,z1:cz+w/2,y0:yy-0.35,y1:yy,k:'pk',pk:big?'cp':'step'};
      if(!solidTest||!solidTest(c)){ b=c; y=yy; break; } }
    if(!b){ d+=1.2; i--; continue; }
    boxes.push(b); if(big) cps.push({x:(b.x0+b.x1)/2,y,z:(b.z0+b.z1)/2,i:cps.length});
    prevY=y; d+=SP+(big?0.8:0);
  }
  const l=wp[wp.length-1], fy=Math.max(0.8,prevY-0.5);
  boxes.push({x0:l[0]-3,x1:l[0]+3,z0:l[1]-3,z1:l[1]+3,y0:fy-0.4,y1:fy,k:'pk',pk:'finish'});
  const finish={x:l[0],y:fy,z:l[1]}; cps.push(Object.assign({i:cps.length,finish:true},finish));
  return {boxes,cps,start,finish};
}
